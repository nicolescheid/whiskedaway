import { createContext, useContext, useState, useCallback } from 'react';
import { getUIPreferences, saveUIPreferences } from '../engine/storageManager';

const SceneContext = createContext(null);

export function SceneProvider({ children }) {
  const [currentScene, setCurrentScene] = useState('inn-exterior');
  const [previousScene, setPreviousScene] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState(null);
  const [overlayData, setOverlayData] = useState(null);

  // UI mode: 'scene' (2.5D) or 'quick' (classic forms)
  const [uiMode, setUiMode] = useState(() => {
    const prefs = getUIPreferences();
    // Default to quick on very small screens
    if (typeof window !== 'undefined' && window.innerWidth < 400) return 'quick';
    return prefs.uiMode || 'scene';
  });

  const navigateToScene = useCallback((sceneId) => {
    if (sceneId === currentScene || isTransitioning) return;

    setIsTransitioning(true);
    setPreviousScene(currentScene);
    setActiveOverlay(null);
    setOverlayData(null);

    // Allow exit animation to play
    setTimeout(() => {
      setCurrentScene(sceneId);
      // Allow enter animation to play
      setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
    }, 300);
  }, [currentScene, isTransitioning]);

  const openOverlay = useCallback((overlayId, data = null) => {
    setActiveOverlay(overlayId);
    setOverlayData(data);
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
    setOverlayData(null);
  }, []);

  const toggleUIMode = useCallback(() => {
    setUiMode(prev => {
      const next = prev === 'scene' ? 'quick' : 'scene';
      saveUIPreferences({ uiMode: next });
      return next;
    });
  }, []);

  const value = {
    currentScene,
    previousScene,
    isTransitioning,
    uiMode,
    activeOverlay,
    overlayData,
    navigateToScene,
    openOverlay,
    closeOverlay,
    toggleUIMode,
  };

  return (
    <SceneContext.Provider value={value}>
      {children}
    </SceneContext.Provider>
  );
}

export function useScene() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error('useScene must be used within SceneProvider');
  return ctx;
}

export default SceneContext;
