import { useState, useEffect, useCallback } from 'react';
import { useScene } from '../contexts/SceneContext';

/**
 * Themed slide-in panel for form interactions.
 * Wraps existing components (DietaryOptions, PantryInput, etc.) in a scene-aware overlay.
 */
export default function OverlayPanel({ overlayId, title, icon, children, isResults }) {
  const { activeOverlay, closeOverlay } = useScene();
  const [isClosing, setIsClosing] = useState(false);

  const isOpen = activeOverlay === overlayId;

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      closeOverlay();
      setIsClosing(false);
    }, 250);
  }, [closeOverlay]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const panelClass = [
    'overlay-panel',
    isResults ? 'overlay-panel--results' : '',
    isClosing ? 'overlay-panel--closing' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className="overlay-backdrop"
        onClick={handleClose}
        style={isClosing ? { opacity: 0, transition: 'opacity 0.2s ease' } : undefined}
      />
      <div className={panelClass} role="dialog" aria-label={title}>
        <div className="overlay-header">
          <h3 className="overlay-title">
            {icon && <span>{icon}</span>}
            {title}
          </h3>
          <button
            className="overlay-close-btn"
            onClick={handleClose}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
        <div className="overlay-body">
          {children}
        </div>
      </div>
    </>
  );
}
