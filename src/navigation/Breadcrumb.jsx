import { useScene } from '../contexts/SceneContext';
import { getScene } from '../scenes/sceneData';
import './Breadcrumb.css';

export default function Breadcrumb() {
  const { currentScene, navigateToScene } = useScene();
  const scene = getScene(currentScene);

  if (currentScene === 'inn-exterior') return null;

  return (
    <nav className="breadcrumb" aria-label="Navigation">
      <button
        className="breadcrumb-link"
        onClick={() => navigateToScene('inn-exterior')}
      >
        The Inn
      </button>
      <span className="breadcrumb-separator">›</span>
      <span className="breadcrumb-current">
        {scene?.tomeEmoji} {scene?.name}
      </span>
    </nav>
  );
}
