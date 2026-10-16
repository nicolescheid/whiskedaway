/**
 * Inn Exterior — main hallway with 6 doors to kitchens.
 * Warm, inviting inn lobby with wooden beams and warm lighting.
 */
export default function InnExterior({ layersRef }) {
  return (
    <>
      {/* Background layer — walls, ceiling, far details */}
      <div className="scene-layer" data-depth="0" ref={el => { if (layersRef) layersRef.current[0] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Sky/ceiling gradient */}
          <defs>
            <linearGradient id="inn-ceiling" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d2b1a" />
              <stop offset="100%" stopColor="#5c4030" />
            </linearGradient>
            <linearGradient id="inn-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8d5b8" />
              <stop offset="60%" stopColor="#d4c0a0" />
              <stop offset="100%" stopColor="#c4a882" />
            </linearGradient>
            <radialGradient id="warm-light" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="rgba(232, 184, 122, 0.3)" />
              <stop offset="100%" stopColor="rgba(232, 184, 122, 0)" />
            </radialGradient>
          </defs>

          {/* Ceiling */}
          <rect x="0" y="0" width="1400" height="200" fill="url(#inn-ceiling)" />

          {/* Wooden beams */}
          <rect x="0" y="180" width="1400" height="25" fill="#4a3520" rx="3" />
          <rect x="200" y="0" width="18" height="200" fill="#4a3520" rx="2" />
          <rect x="500" y="0" width="18" height="200" fill="#4a3520" rx="2" />
          <rect x="880" y="0" width="18" height="200" fill="#4a3520" rx="2" />
          <rect x="1180" y="0" width="18" height="200" fill="#4a3520" rx="2" />

          {/* Wall */}
          <rect x="0" y="200" width="1400" height="400" fill="url(#inn-wall)" />

          {/* Wainscoting */}
          <rect x="0" y="520" width="1400" height="8" fill="#6b5040" />
          <rect x="0" y="528" width="1400" height="272" fill="#8b6b50" />

          {/* Warm light overlay */}
          <rect x="0" y="0" width="1400" height="800" fill="url(#warm-light)" />

          {/* Floor */}
          <rect x="0" y="620" width="1400" height="180" fill="#6b5040" />
          {/* Floor boards */}
          {[0, 200, 400, 600, 800, 1000, 1200].map(x => (
            <line key={x} x1={x} y1="620" x2={x} y2="800" stroke="#5c4030" strokeWidth="1" opacity="0.3" />
          ))}

          {/* Wall decorations — small frames */}
          <rect x="80" y="260" width="60" height="80" rx="4" fill="none" stroke="#8b7050" strokeWidth="2" />
          <rect x="600" y="240" width="200" height="120" rx="4" fill="none" stroke="#8b7050" strokeWidth="2" />
          <text x="700" y="310" textAnchor="middle" fontFamily="Crimson Pro, serif" fontSize="18" fill="#8b7050" fontStyle="italic">WhiskedAway Inn</text>
          <rect x="1260" y="260" width="60" height="80" rx="4" fill="none" stroke="#8b7050" strokeWidth="2" />
        </svg>
      </div>

      {/* Midground layer — doors, fixtures */}
      <div className="scene-layer" data-depth="1" ref={el => { if (layersRef) layersRef.current[1] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="door-shadow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(0,0,0,0.1)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>

          {/* Six doors — 150 wide every 180, inside the middle ~76% so all six survive
              a 4:3 crop. Hotspots in sceneData.js match these boxes. */}
          {[
            { x: 175, color: '#8b4d5c', label: '🍵', name: 'Cuddlecore' },
            { x: 355, color: '#d4a84b', label: '🌱', name: 'Flourish' },
            { x: 535, color: '#7c5c8b', label: '🔮', name: 'Cravings' },
            { x: 715, color: '#c27a8c', label: '🧁', name: 'Sweet Spells' },
            { x: 895, color: '#5c7c5c', label: '🧪', name: 'Chiapothecary' },
            { x: 1075, color: '#4a7c7c', label: '📚', name: 'Academy' },
          ].map((door, i) => (
            <g key={i}>
              {/* Door frame */}
              <rect x={door.x} y="280" width="150" height="340" rx="6" fill="#5c4030" />
              {/* Door surface */}
              <rect x={door.x + 7} y="288" width="136" height="324" rx="4" fill={door.color} opacity="0.85" />
              {/* Door panels */}
              <rect x={door.x + 15} y="300" width="120" height="120" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
              <rect x={door.x + 15} y="440" width="120" height="140" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
              {/* Door handle */}
              <circle cx={door.x + 124} cy="460" r="6" fill="#c4956a" />
              {/* Door label sign */}
              <rect x={door.x + 25} y="250" width="100" height="32" rx="6" fill="#f4efe4" stroke={door.color} strokeWidth="1.5" />
              <text x={door.x + 75} y="271" textAnchor="middle" fontFamily="Quicksand, sans-serif" fontSize="12" fontWeight="600" fill={door.color}>
                {door.name}
              </text>
              {/* Icon above door */}
              <text x={door.x + 75} y="240" textAnchor="middle" fontSize="28">{door.label}</text>
            </g>
          ))}

          {/* Lanterns between doors */}
          {[337, 517, 697, 877, 1057].map((x, i) => (
            <g key={`lantern-${i}`} className="ambient-candle">
              <rect x={x} y="230" width="6" height="30" fill="#8b7050" />
              <ellipse cx={x + 3} cy="225" rx="10" ry="14" fill="#e8b87a" opacity="0.6" />
              <ellipse cx={x + 3} cy="222" rx="5" ry="8" fill="#f0d090" opacity="0.8" />
            </g>
          ))}
        </svg>
      </div>

      {/* Foreground layer — carpet, plants, atmospheric */}
      <div className="scene-layer" data-depth="2" ref={el => { if (layersRef) layersRef.current[2] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Welcome carpet/rug */}
          <rect x="400" y="640" width="600" height="120" rx="8" fill="#8b4d5c" opacity="0.3" />
          <rect x="420" y="650" width="560" height="100" rx="6" fill="none" stroke="#8b4d5c" strokeWidth="1" opacity="0.3" />

          {/* Potted plants */}
          <g transform="translate(30, 550)">
            <rect x="0" y="30" width="35" height="40" rx="4" fill="#6b5040" />
            <ellipse cx="17" cy="25" rx="22" ry="20" fill="#5c7c5c" opacity="0.8" />
            <ellipse cx="10" cy="18" rx="12" ry="14" fill="#6b8c6b" opacity="0.7" />
          </g>
          <g transform="translate(1340, 550)">
            <rect x="0" y="30" width="35" height="40" rx="4" fill="#6b5040" />
            <ellipse cx="17" cy="25" rx="22" ry="20" fill="#5c7c5c" opacity="0.8" />
            <ellipse cx="24" cy="18" rx="12" ry="14" fill="#6b8c6b" opacity="0.7" />
          </g>

          {/* Floating dust motes */}
          <circle cx="300" cy="350" r="2" fill="#e8d5b8" className="ambient-particle" opacity="0.5" />
          <circle cx="700" cy="280" r="1.5" fill="#e8d5b8" className="ambient-particle" opacity="0.4" />
          <circle cx="1100" cy="320" r="2" fill="#e8d5b8" className="ambient-particle" opacity="0.5" />
        </svg>
      </div>
    </>
  );
}
