import { useState, useEffect } from 'react';
import { useScene } from '../contexts/SceneContext';

/**
 * Wraps scene content with enter/exit transition classes.
 */
export default function SceneTransition({ children }) {
  const { currentScene, previousScene, isTransitioning } = useScene();
  const [transitionClass, setTransitionClass] = useState('scene-enter-active');

  useEffect(() => {
    if (isTransitioning) {
      // Determine transition type
      const isEnteringKitchen = previousScene === 'inn-exterior' && currentScene !== 'inn-exterior';
      const isReturningToInn = previousScene !== 'inn-exterior' && currentScene === 'inn-exterior';

      if (isEnteringKitchen) {
        setTransitionClass('scene-door-enter');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTransitionClass('scene-door-enter-active');
          });
        });
      } else if (isReturningToInn) {
        setTransitionClass('scene-return-enter');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTransitionClass('scene-return-enter-active');
          });
        });
      } else {
        setTransitionClass('scene-enter');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTransitionClass('scene-enter-active');
          });
        });
      }
    } else {
      setTransitionClass('scene-enter-active');
    }
  }, [currentScene, isTransitioning, previousScene]);

  return (
    <div className={`scene-transition-wrapper ${transitionClass}`}>
      {children}
    </div>
  );
}
