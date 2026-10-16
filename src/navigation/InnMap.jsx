import { useState } from 'react';
import { useScene } from '../contexts/SceneContext';
import { scenes } from '../scenes/sceneData';
import './InnMap.css';

const kitchenList = [
  { id: 'cuddlecore', name: 'Cuddlecore', icon: '🍵', color: 'var(--berry)' },
  { id: 'flourish', name: 'Flourish', icon: '🌱', color: 'var(--golden)' },
  { id: 'cravings', name: 'Cravings', icon: '🔮', color: 'var(--purple)' },
  { id: 'sweet-spells', name: 'Sweet Spells', icon: '🧁', color: 'var(--rose)' },
  { id: 'chiapothecary', name: 'Chiapothecary', icon: '🧪', color: 'var(--herb)' },
  { id: 'academy', name: 'Academy', icon: '📚', color: 'var(--teal)' },
];

export default function InnMap() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentScene, navigateToScene } = useScene();

  const handleNavigate = (sceneId) => {
    navigateToScene(sceneId);
    setIsOpen(false);
  };

  return (
    <>
      <button
        className="inn-map-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open inn map"
        title="Inn Map"
      >
        🗺️
      </button>

      {isOpen && (
        <>
          <div className="inn-map-backdrop" onClick={() => setIsOpen(false)} />
          <div className="inn-map" role="dialog" aria-label="Inn Map">
            <h3 className="inn-map-title">The WhiskedAway Inn</h3>

            <div className="inn-map-grid">
              {kitchenList.map((kitchen) => (
                <button
                  key={kitchen.id}
                  className={`inn-map-room ${currentScene === kitchen.id ? 'inn-map-room--current' : ''}`}
                  style={{ '--room-color': kitchen.color }}
                  onClick={() => handleNavigate(kitchen.id)}
                  disabled={currentScene === kitchen.id}
                >
                  <span className="inn-map-room-icon">{kitchen.icon}</span>
                  <span className="inn-map-room-name">{kitchen.name}</span>
                  {currentScene === kitchen.id && (
                    <span className="inn-map-room-here">You are here</span>
                  )}
                </button>
              ))}
            </div>

            {currentScene !== 'inn-exterior' && (
              <button
                className="inn-map-lobby"
                onClick={() => handleNavigate('inn-exterior')}
              >
                🏠 Return to the Inn Lobby
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
