import { useScene } from '../contexts/SceneContext';
import { useProfile } from '../contexts/ProfileContext';
import './QuickModeToggle.css';

/**
 * Toggle between 2.5D scene mode and classic form mode.
 */
export default function QuickModeToggle() {
  const { uiMode, toggleUIMode } = useScene();
  const { trackQuickModeToggle } = useProfile();

  const handleToggle = () => {
    const newMode = uiMode === 'scene' ? 'quick' : 'scene';
    toggleUIMode();
    trackQuickModeToggle(newMode);
  };

  return (
    <button
      className="quick-mode-toggle"
      onClick={handleToggle}
      aria-label={uiMode === 'scene' ? 'Switch to classic form view' : 'Switch to kitchen view'}
      title={uiMode === 'scene' ? 'Switch to classic form view' : 'Switch to kitchen view'}
    >
      <span className="quick-mode-icon">
        {uiMode === 'scene' ? '📋' : '🏠'}
      </span>
      <span className="quick-mode-label">
        {uiMode === 'scene' ? 'Quick Mode' : 'Kitchen View'}
      </span>
    </button>
  );
}
