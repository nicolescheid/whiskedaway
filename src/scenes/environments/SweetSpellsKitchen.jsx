/**
 * Sweet Spells Kitchen — pastel bakery workshop.
 * Rose tones (#c27a8c), candy jars, baking surfaces, whimsical.
 */
export default function SweetSpellsKitchen({ layersRef }) {
  return (
    <>
      {/* Background — soft pastel walls */}
      <div className="scene-layer" data-depth="0" ref={el => { if (layersRef) layersRef.current[0] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ss-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0e4e8" />
              <stop offset="100%" stopColor="#e8d8dc" />
            </linearGradient>
            <radialGradient id="ss-glow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="rgba(194, 122, 140, 0.1)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="1400" height="520" fill="url(#ss-wall)" />
          <rect x="0" y="0" width="1400" height="520" fill="url(#ss-glow)" />

          {/* Decorative bunting */}
          <path d="M50 60 Q200 90 350 60 Q500 30 650 60 Q800 90 950 60 Q1100 30 1250 60 Q1350 80 1400 65"
            fill="none" stroke="#c27a8c" strokeWidth="2" opacity="0.4" />
          {[200, 350, 500, 650, 800, 950, 1100, 1250].map((x, i) => (
            <polygon key={i} points={`${x - 12},${55 + (i % 2) * 15} ${x + 12},${55 + (i % 2) * 15} ${x},${80 + (i % 2) * 15}`}
              fill={['#c27a8c', '#d4a84b', '#e8b87a', '#c27a8c'][i % 4]} opacity="0.3" />
          ))}

          {/* Floor — checkered tile */}
          <rect x="0" y="520" width="1400" height="280" fill="#e8d8dc" />
          {Array.from({ length: 20 }).map((_, i) =>
            Array.from({ length: 5 }).map((_, j) => (
              (i + j) % 2 === 0 &&
              <rect key={`tile-${i}-${j}`} x={i * 70} y={520 + j * 56} width="70" height="56" fill="#d8c8cc" opacity="0.5" />
            ))
          )}
        </svg>
      </div>

      {/* Midground — candy jars, calendar, baking area */}
      <div className="scene-layer" data-depth="1" ref={el => { if (layersRef) layersRef.current[1] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Candy jar shelf (left) */}
          <rect x="50" y="100" width="280" height="240" rx="6" fill="#d8c0c4" />
          <rect x="55" y="105" width="270" height="4" fill="#c0a8ac" rx="2" />
          <rect x="55" y="215" width="270" height="4" fill="#c0a8ac" rx="2" />
          {/* Candy jars */}
          {[
            { x: 70, color: '#8b4d5c', label: 'Chocolate' },
            { x: 130, color: '#c27a8c', label: 'Fruity' },
            { x: 190, color: '#e8d5b8', label: 'Creamy' },
            { x: 250, color: '#d4a84b', label: 'Crunchy' },
          ].map((jar, i) => (
            <g key={i}>
              {/* Jar body */}
              <rect x={jar.x} y={120} width="45" height="65" rx="8" fill={jar.color} opacity="0.35" />
              <ellipse cx={jar.x + 22} cy={118} rx="20" ry="6" fill={jar.color} opacity="0.25" />
              {/* Lid */}
              <rect x={jar.x + 5} y={112} width="35" height="10" rx="5" fill="#d8c0c4" />
              <circle cx={jar.x + 22} cy={110} r="4" fill="#c4956a" />
              {/* Candies inside */}
              <circle cx={jar.x + 14} cy={150} r="5" fill={jar.color} opacity="0.5" />
              <circle cx={jar.x + 28} cy={155} r="4" fill={jar.color} opacity="0.4" />
              <circle cx={jar.x + 20} cy={165} r="5" fill={jar.color} opacity="0.5" />
            </g>
          ))}
          {/* Second row */}
          {[70, 130].map((x, i) => (
            <g key={`jar2-${i}`}>
              <rect x={x} y={225} width="45" height="65" rx="8" fill={['#c4956a', '#5c7c5c'][i]} opacity="0.35" />
              <rect x={x + 5} y={218} width="35" height="10" rx="5" fill="#d8c0c4" />
            </g>
          ))}

          {/* Calendar on wall */}
          <rect x="380" y="70" width="140" height="120" rx="6" fill="#f4efe4" stroke="#c27a8c" strokeWidth="2" />
          <rect x="380" y="70" width="140" height="28" rx="6" fill="#c27a8c" opacity="0.3" />
          <text x="450" y="90" textAnchor="middle" fontFamily="Quicksand, sans-serif" fontSize="12" fill="#8b4d5c" fontWeight="600">Occasion</text>
          {/* Calendar grid */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <rect key={i} x={395 + (i % 3) * 38} y={108 + Math.floor(i / 3) * 32} width="30" height="24" rx="3"
              fill="#c27a8c" opacity={0.15 + (i % 3) * 0.05} />
          ))}

          {/* Hourglass */}
          <g transform="translate(625, 80)">
            <rect x="0" y="0" width="50" height="8" rx="2" fill="#c27a8c" opacity="0.6" />
            <rect x="0" y="100" width="50" height="8" rx="2" fill="#c27a8c" opacity="0.6" />
            <path d="M8 8 L22 50 L8 100" fill="none" stroke="#c27a8c" strokeWidth="2" opacity="0.5" />
            <path d="M42 8 L28 50 L42 100" fill="none" stroke="#c27a8c" strokeWidth="2" opacity="0.5" />
            <ellipse cx="25" cy="75" rx="12" ry="15" fill="#c27a8c" opacity="0.2" />
          </g>

          {/* Dietary shelf */}
          <rect x="850" y="100" width="230" height="250" rx="4" fill="#d8c0c4" />
          {[110, 185, 260].map(y => (
            <rect key={y} x="855" y={y} width="220" height="5" fill="#c0a8ac" rx="2" />
          ))}

          {/* Location map */}
          <rect x="1130" y="80" width="60" height="45" rx="3" fill="#f4efe4" stroke="#c27a8c" strokeWidth="1.5" />

          {/* Main baking counter */}
          <rect x="0" y="430" width="1400" height="20" rx="3" fill="#d8c0c4" />
          <rect x="0" y="445" width="1400" height="100" fill="#e0ccd0" />

          {/* Mixing bowl / cauldron area */}
          <ellipse cx="560" cy="400" rx="70" ry="25" fill="#e8d5b8" />
          <rect x="490" y="360" width="140" height="40" rx="6" fill="#e8d5b8" />
          <ellipse cx="560" cy="360" rx="70" ry="22" fill="#f0e8d8" />
          {/* Whisk */}
          <line x1="620" y1="330" x2="650" y2="380" stroke="#c4956a" strokeWidth="3" />
        </svg>
      </div>

      {/* Foreground */}
      <div className="scene-layer" data-depth="2" ref={el => { if (layersRef) layersRef.current[2] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Sparkle particles */}
          <circle cx="300" cy="200" r="2" fill="#c27a8c" className="ambient-particle" opacity="0.4" />
          <circle cx="700" cy="150" r="1.5" fill="#d4a84b" className="ambient-particle" opacity="0.3" />
          <circle cx="550" cy="350" r="2" fill="#c27a8c" className="ambient-particle" opacity="0.5" />

          {/* Exit door */}
          <rect x="0" y="240" width="50" height="300" rx="4" fill="#c0a8ac" />
          <rect x="5" y="248" width="40" height="284" rx="3" fill="#d8c0c4" />
          <circle cx="40" cy="390" r="4" fill="#c27a8c" />
        </svg>
      </div>
    </>
  );
}
