import { useState, useEffect, useCallback } from 'react';

/**
 * Full-screen overlay for displaying recipe results.
 * Wraps ShoppingScroll and NourishmentHighlights in a scrollable parchment panel.
 */
export default function ResultsOverlay({ isOpen, onClose, title, icon, children }) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
      setIsClosing(false);
    }, 250);
  }, [onClose]);

  // Close on Escape
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
    'overlay-panel--results',
    isClosing ? 'overlay-panel--closing' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className="overlay-backdrop"
        onClick={handleClose}
        style={isClosing ? { opacity: 0, transition: 'opacity 0.2s ease' } : undefined}
      />
      <div className={panelClass} role="dialog" aria-label={title || 'Recipe Results'}>
        <div className="overlay-header">
          <h3 className="overlay-title">
            {icon && <span>{icon}</span>}
            {title || 'Your Recipe'}
          </h3>
          <button
            className="overlay-close-btn"
            onClick={handleClose}
            aria-label="Close results"
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
