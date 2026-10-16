import { useEffect } from 'react';
import { useScene } from '../contexts/SceneContext';
import { useProfile } from '../contexts/ProfileContext';
import { getScene } from '../scenes/sceneData';
import SceneRenderer from '../scenes/SceneRenderer';
import SceneTransition from '../scenes/SceneTransition';
import Gemma from '../npc/Gemma';
import Breadcrumb from '../navigation/Breadcrumb';
import InnMap from '../navigation/InnMap';
import QuickModeToggle from '../overlays/QuickModeToggle';

/**
 * Base kitchen controller — orchestrates the scene, overlays, navigation, and Gemma.
 * Specific kitchen controllers pass their overlay content and submit handler as children/props.
 */
export default function KitchenController({
  sceneId,
  onSubmit,
  overlayContent,
  resultContent,
  quickModeContent,
}) {
  const { navigateToScene, openOverlay, uiMode, activeOverlay } = useScene();
  const { trackKitchenEnter, trackKitchenExit, trackObjectInteract } = useProfile();

  const scene = getScene(sceneId);

  // Track kitchen entry/exit
  useEffect(() => {
    trackKitchenEnter(sceneId);
    return () => trackKitchenExit(sceneId);
  }, [sceneId, trackKitchenEnter, trackKitchenExit]);

  const handleHotspotClick = (hotspot) => {
    if (hotspot.type === 'door') {
      navigateToScene(hotspot.navigateTo);
    } else if (hotspot.type === 'interactive') {
      trackObjectInteract(sceneId, hotspot.id, hotspot.label);
      openOverlay(hotspot.overlay);
    }
  };

  // Quick mode renders the original page component directly
  if (uiMode === 'quick' && quickModeContent) {
    return (
      <>
        <QuickModeToggle />
        {quickModeContent}
      </>
    );
  }

  return (
    <>
      <Breadcrumb />
      <InnMap />
      <QuickModeToggle />

      <SceneTransition>
        <SceneRenderer
          sceneId={sceneId}
          onHotspotClick={handleHotspotClick}
          onSubmit={onSubmit}
          stageContent={
            <Gemma
              sceneId={sceneId}
              position={scene?.gemmaPosition}
            />
          }
        >
          {/* Overlay panels rendered within the scene */}
          {overlayContent}

          {/* Results overlay */}
          {resultContent}
        </SceneRenderer>
      </SceneTransition>
    </>
  );
}
