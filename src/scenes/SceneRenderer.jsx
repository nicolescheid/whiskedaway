import { useRef, useEffect, useCallback } from 'react';
import { useScene } from '../contexts/SceneContext';
import { getScene } from './sceneData';
import InteractiveObject from './objects/InteractiveObject';
import './SceneRenderer.css';

// Environment component imports
import InnExterior from './environments/InnExterior';
import CuddlecoreKitchen from './environments/CuddlecoreKitchen';
import FlourishKitchen from './environments/FlourishKitchen';
import CravingsDecodedKitchen from './environments/CravingsDecodedKitchen';
import SweetSpellsKitchen from './environments/SweetSpellsKitchen';
import ChiapothecaryKitchen from './environments/ChiapothecaryKitchen';
import NourishAcademyKitchen from './environments/NourishAcademyKitchen';

const environmentComponents = {
  'inn-exterior': InnExterior,
  'cuddlecore': CuddlecoreKitchen,
  'flourish': FlourishKitchen,
  'cravings': CravingsDecodedKitchen,
  'sweet-spells': SweetSpellsKitchen,
  'chiapothecary': ChiapothecaryKitchen,
  'academy': NourishAcademyKitchen,
};

// Parallax travel in px per depth layer. Hotspots ride with the midground,
// where the clickable objects are drawn.
const PARALLAX_STEP = 3;
const HOTSPOT_DEPTH = 1;

/**
 * Renders a scene on a fixed-aspect "stage" (1400×800, the SVG viewBox and
 * the painted-background size). The stage covers the viewport like
 * background-size: cover, and the art layers, hotspots and stage content all
 * live inside it, so cropping at any window size affects them equally.
 *
 * - children: viewport-anchored UI (overlay panels, results)
 * - stageContent: things placed in the scene itself (Gemma)
 */
export default function SceneRenderer({ sceneId, onHotspotClick, onSubmit, stageContent, children }) {
  const viewportRef = useRef(null);
  const layersRef = useRef([]);
  const hotspotsRef = useRef(null);
  const { activeOverlay } = useScene();

  // Parallax effect on mouse/touch movement
  const handlePointerMove = useCallback((e) => {
    if (!viewportRef.current) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;

    const offset = (depth) => {
      const factor = (depth + 1) * PARALLAX_STEP; // 3px, 6px, 9px per layer
      const moveX = (x / centerX) * factor;
      const moveY = (y / centerY) * factor * 0.5; // Less vertical movement
      return `translate(${moveX}px, ${moveY}px)`;
    };

    layersRef.current.forEach((layer, index) => {
      if (layer) layer.style.transform = offset(index);
    });
    if (hotspotsRef.current) hotspotsRef.current.style.transform = offset(HOTSPOT_DEPTH);
  }, []);

  const handlePointerLeave = useCallback(() => {
    [...layersRef.current, hotspotsRef.current].forEach((el) => {
      if (el) el.style.transform = 'translate(0, 0)';
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.addEventListener('mousemove', handlePointerMove);
    viewport.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      viewport.removeEventListener('mousemove', handlePointerMove);
      viewport.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, [handlePointerMove, handlePointerLeave]);

  const scene = getScene(sceneId);
  if (!scene) return null;

  const EnvironmentComponent = environmentComponents[sceneId];

  return (
    <div
      className="scene-root"
      style={{ '--tome-accent': scene.accentColor }}
    >
      <div className="scene-viewport" ref={viewportRef}>
        <div className="scene-stage">
          {/* Environment layers (SVG today, painted PNG later) */}
          {EnvironmentComponent && (
            <EnvironmentComponent
              layersRef={layersRef}
            />
          )}

          {/* Interactive Hotspots — % of the stage, i.e. of the 1400×800 art */}
          <div className="scene-hotspots" ref={hotspotsRef}>
            {scene.hotspots.map((hotspot) => (
              <InteractiveObject
                key={hotspot.id}
                hotspot={hotspot}
                isActive={activeOverlay === hotspot.overlay}
                onClick={() => {
                  if (hotspot.type === 'door') {
                    onHotspotClick?.(hotspot);
                  } else if (hotspot.type === 'submit') {
                    onSubmit?.();
                  } else {
                    onHotspotClick?.(hotspot);
                  }
                }}
              />
            ))}
          </div>

          {stageContent}
        </div>

        {/* Overlay panels etc. stay anchored to the viewport */}
        {children}
      </div>

      {/* Mobile object bar */}
      <div className="scene-object-bar">
        {scene.hotspots
          .filter(h => h.type === 'interactive' || h.type === 'submit')
          .map((hotspot) => (
            <button
              key={hotspot.id}
              className="scene-object-bar-item"
              onClick={() => {
                if (hotspot.type === 'submit') {
                  onSubmit?.();
                } else {
                  onHotspotClick?.(hotspot);
                }
              }}
              aria-label={hotspot.label}
            >
              <span className="icon">{hotspot.icon}</span>
              <span>{hotspot.label}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
