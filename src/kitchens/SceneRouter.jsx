import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useScene } from '../contexts/SceneContext';
import { getSceneIdFromRoute, getRouteFromSceneId } from '../scenes/sceneData';
import { track } from '../lib/analytics.js';

import InnExteriorController from './InnExteriorController';
import CuddlecoreController from './CuddlecoreController';
import FlourishController from './FlourishController';
import CravingsDecodedController from './CravingsDecodedController';
import SweetSpellsController from './SweetSpellsController';
import ChiapothecaryController from './ChiapothecaryController';
import NourishAcademyController from './NourishAcademyController';

const sceneComponents = {
  'inn-exterior': InnExteriorController,
  'cuddlecore': CuddlecoreController,
  'flourish': FlourishController,
  'cravings': CravingsDecodedController,
  'sweet-spells': SweetSpellsController,
  'chiapothecary': ChiapothecaryController,
  'academy': NourishAcademyController,
};

/**
 * Bridges React Router with SceneContext.
 * - When URL changes → update SceneContext
 * - When SceneContext navigates → update URL
 */
export default function SceneRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentScene, navigateToScene } = useScene();

  // Sync: URL → SceneContext
  useEffect(() => {
    const sceneId = getSceneIdFromRoute(location.pathname);
    if (sceneId !== currentScene) {
      navigateToScene(sceneId);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync: SceneContext → URL
  useEffect(() => {
    const route = getRouteFromSceneId(currentScene);
    if (route !== location.pathname) {
      navigate(route, { replace: true });
    }
  }, [currentScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count which scenes are seen (docs/analytics-plan.md)
  useEffect(() => {
    if (currentScene) track('scene_view', { scene: currentScene });
  }, [currentScene]);

  const SceneComponent = sceneComponents[currentScene] || InnExteriorController;
  return <SceneComponent />;
}
