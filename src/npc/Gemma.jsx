import { useState, useEffect } from 'react';
import { getGemmaGreeting, getGemmaHint } from './gemmaDialogue';
import { useProfile } from '../contexts/ProfileContext';
import './Gemma.css';

/**
 * Gemma NPC — positioned in scenes with contextual speech bubbles.
 */
export default function Gemma({ sceneId, position, interactedObjects = [] }) {
  const { profile } = useProfile();
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  // Set initial greeting when entering a scene
  useEffect(() => {
    const timeOfDay = getTimeOfDay();
    const greeting = getGemmaGreeting(sceneId, {
      isReturning: profile?.isReturning || false,
      timeOfDay,
    });
    setMessage(greeting);
    setHintIndex(0);

    // Show speech bubble after a brief delay
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, [sceneId, profile?.isReturning]);

  // Click Gemma to cycle through hints
  const handleClick = () => {
    const hint = getGemmaHint(sceneId, interactedObjects);
    if (hint) {
      setMessage(hint);
      setHintIndex(prev => prev + 1);
    } else {
      // No more hints — toggle bubble visibility
      setIsVisible(prev => !prev);
    }
  };

  return (
    <div
      className="gemma-npc"
      style={{
        left: `${position?.x || 50}%`,
        top: `${position?.y || 60}%`,
      }}
    >
      {/* Speech bubble */}
      {isVisible && message && (
        <div className="gemma-speech-bubble">
          <p>{message}</p>
          <div className="gemma-speech-tail" />
        </div>
      )}

      {/* Gemma character */}
      <button
        className="gemma-avatar ambient-sway"
        onClick={handleClick}
        aria-label="Talk to Gemma"
        title="Click for a hint"
      >
        🧞‍♀️
      </button>
    </div>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'lateNight';
}
