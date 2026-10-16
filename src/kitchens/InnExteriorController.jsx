import { useEffect } from 'react';
import { useScene } from '../contexts/SceneContext';
import { useProfile } from '../contexts/ProfileContext';
import SceneRenderer from '../scenes/SceneRenderer';
import SceneTransition from '../scenes/SceneTransition';
import Gemma from '../npc/Gemma';
import InnMap from '../navigation/InnMap';
import QuickModeToggle from '../overlays/QuickModeToggle';
import { getScene } from '../scenes/sceneData';
import Home from '../pages/Home';

/**
 * Inn Exterior — the lobby/landing page.
 * In scene mode: shows the inn hallway with 6 doors.
 * In quick mode: renders the original Home page.
 */
export default function InnExteriorController() {
  const { navigateToScene, uiMode } = useScene();
  const { trackKitchenEnter } = useProfile();
  const scene = getScene('inn-exterior');

  useEffect(() => {
    trackKitchenEnter('inn-exterior');
  }, [trackKitchenEnter]);

  const handleHotspotClick = (hotspot) => {
    if (hotspot.type === 'door') {
      navigateToScene(hotspot.navigateTo);
    }
  };

  if (uiMode === 'quick') {
    return (
      <>
        <QuickModeToggle />
        <Home />
      </>
    );
  }

  return (
    <>
      <InnMap />
      <QuickModeToggle />

      <SceneTransition>
        <SceneRenderer
          sceneId="inn-exterior"
          onHotspotClick={handleHotspotClick}
          stageContent={
            <Gemma
              sceneId="inn-exterior"
              position={scene?.gemmaPosition}
            />
          }
        />
      </SceneTransition>
    </>
  );
}
