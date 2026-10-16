import './InteractiveObject.css';

/**
 * Generic interactive hotspot positioned within a scene.
 * Renders as a clickable area with icon, label tooltip, and glow effects.
 */
export default function InteractiveObject({ hotspot, isActive, onClick }) {
  const {
    id, type, x, y, width, height,
    label, icon, pin,
  } = hotspot;

  // Coordinates are % of the scene stage. A pinned hotspot (the exit door at
  // the stage's left edge) is clamped to the visible part of the stage, which
  // starts (stage width - viewport width) / 2 in from the stage's left.
  const left = pin === 'left'
    ? `max(${x}%, calc((var(--stage-w) - 100cqw) / 2))`
    : `${x}%`;

  const typeClass = `scene-hotspot--${type}`;
  const activeClass = isActive ? 'scene-hotspot--active' : '';

  return (
    <button
      className={`scene-hotspot ${typeClass} ${activeClass}`}
      style={{
        left,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      onClick={onClick}
      aria-label={label}
      data-hotspot-id={id}
      title={label}
    >
      <span className="scene-hotspot-icon">{icon}</span>
      <span className="scene-hotspot-label">{label}</span>
    </button>
  );
}
