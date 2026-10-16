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

export default function SceneRenderer({ sceneId, onHotspotClick, onSubmit, children }) {
  const viewportRef = useRef(null);
  const layersRef = useRef([]);
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

    layersRef.current.forEach((layer, index) => {
      if (!layer) return;
      const factor = (index + 1) * 3; // 3px, 6px, 9px per layer
      const moveX = (x / centerX) * factor;
      const moveY = (y / centerY) * factor * 0.5; // Less vertical movement
      layer.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    layersRef.current.forEach((layer) => {
      if (!layer) return;
      layer.style.transform = 'translate(0, 0)';
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
        {/* SVG Environment Layers */}
        {EnvironmentComponent && (
          <EnvironmentComponent
            layersRef={layersRef}
          />
        )}

        {/* Interactive Hotspots */}
        <div className="scene-hotspots">
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

        {/* Overlay panels, Gemma, etc. rendered as children */}
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
