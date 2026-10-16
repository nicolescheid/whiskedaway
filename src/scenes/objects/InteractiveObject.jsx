import './InteractiveObject.css';

/**
 * Generic interactive hotspot positioned within a scene.
 * Renders as a clickable area with icon, label tooltip, and glow effects.
 */
export default function InteractiveObject({ hotspot, isActive, onClick }) {
  const {
    id, type, x, y, width, height,
    label, icon,
  } = hotspot;

  const typeClass = `scene-hotspot--${type}`;
  const activeClass = isActive ? 'scene-hotspot--active' : '';

  return (
    <button
      className={`scene-hotspot ${typeClass} ${activeClass}`}
      style={{
        left: `${x}%`,
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
