/**
 * Flourish Kitchen — bright, garden-adjacent kitchen.
 * Golden tones (#d4a84b), sunlight, plants, vibrant energy.
 */
export default function FlourishKitchen({ layersRef }) {
  return (
    <>
      {/* Background — bright walls, large window with garden view */}
      <div className="scene-layer" data-depth="0" ref={el => { if (layersRef) layersRef.current[0] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="fl-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0e8d4" />
              <stop offset="100%" stopColor="#e8dcc0" />
            </linearGradient>
            <radialGradient id="fl-sun" cx="70%" cy="20%" r="50%">
              <stop offset="0%" stopColor="rgba(212, 168, 75, 0.2)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="1400" height="520" fill="url(#fl-wall)" />
          <rect x="0" y="0" width="1400" height="520" fill="url(#fl-sun)" />

          {/* Large window with garden view */}
          <rect x="900" y="50" width="350" height="300" rx="8" fill="#88aa70" />
          <rect x="910" y="60" width="330" height="280" rx="4" fill="#a4c488" />
          {/* Garden shapes through window */}
          <circle cx="980" cy="250" r="40" fill="#7a9a60" opacity="0.6" />
          <circle cx="1050" cy="220" r="50" fill="#8aaa70" opacity="0.5" />
          <circle cx="1140" cy="260" r="35" fill="#7a9a60" opacity="0.6" />
          <rect x="910" y="280" width="330" height="60" fill="#6b8a50" opacity="0.5" />
          {/* Window frame */}
          <line x1="1075" y1="60" x2="1075" y2="340" stroke="#8b7050" strokeWidth="6" />
          <line x1="910" y1="200" x2="1240" y2="200" stroke="#8b7050" strokeWidth="6" />

          {/* Sunbeam */}
          <polygon points="1100,60 1000,500 1200,500" fill="rgba(212, 168, 75, 0.06)" />

          {/* Floor — lighter wood */}
          <rect x="0" y="520" width="1400" height="280" fill="#a08060" />
          <rect x="0" y="520" width="1400" height="4" fill="#8b6b50" />
          {/* Floor boards */}
          {[0, 180, 360, 540, 720, 900, 1080, 1260].map(x => (
            <line key={x} x1={x} y1="520" x2={x} y2="800" stroke="#907050" strokeWidth="1" opacity="0.2" />
          ))}
        </svg>
      </div>

      {/* Midground — counter, goal board, clock, hourglass */}
      <div className="scene-layer" data-depth="1" ref={el => { if (layersRef) layersRef.current[1] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Goal board on left wall */}
          <rect x="60" y="80" width="280" height="240" rx="6" fill="#5c4030" />
          <rect x="70" y="90" width="260" height="220" rx="4" fill="#e8d5b8" />
          {/* Goal cards pinned to board */}
          {[
            { x: 80, y: 100, w: 110, h: 60, color: '#d4a84b', text: 'Energy' },
            { x: 200, y: 100, w: 110, h: 60, color: '#c4956a', text: 'Strength' },
            { x: 80, y: 170, w: 110, h: 60, color: '#5c7c5c', text: 'Clarity' },
            { x: 200, y: 170, w: 110, h: 60, color: '#8b4d5c', text: 'Balance' },
          ].map((card, i) => (
            <g key={i}>
              <rect x={card.x} y={card.y} width={card.w} height={card.h} rx="4" fill={card.color} opacity="0.3" />
              <text x={card.x + card.w / 2} y={card.y + card.h / 2 + 5} textAnchor="middle"
                fontFamily="Quicksand, sans-serif" fontSize="12" fill={card.color} fontWeight="600">{card.text}</text>
              <circle cx={card.x + card.w / 2} cy={card.y + 5} r="3" fill="#c4956a" />
            </g>
          ))}

          {/* Meal clock on wall */}
          <circle cx="440" cy="120" r="50" fill="#f4efe4" stroke="#8b7050" strokeWidth="3" />
          <circle cx="440" cy="120" r="45" fill="none" stroke="#d4c0a0" strokeWidth="1" />
          <line x1="440" y1="120" x2="440" y2="85" stroke="#5c4030" strokeWidth="2.5" />
          <line x1="440" y1="120" x2="465" y2="130" stroke="#5c4030" strokeWidth="2" />
          <circle cx="440" cy="120" r="3" fill="#d4a84b" />

          {/* Hourglass */}
          <g transform="translate(625, 80)">
            <rect x="0" y="0" width="50" height="8" rx="2" fill="#8b7050" />
            <rect x="0" y="100" width="50" height="8" rx="2" fill="#8b7050" />
            <path d="M8 8 L22 50 L8 100" fill="none" stroke="#8b7050" strokeWidth="2" />
            <path d="M42 8 L28 50 L42 100" fill="none" stroke="#8b7050" strokeWidth="2" />
            <ellipse cx="25" cy="75" rx="12" ry="15" fill="#d4a84b" opacity="0.4" />
          </g>

          {/* Main counter */}
          <rect x="0" y="430" width="1400" height="20" rx="3" fill="#7a6048" />
          <rect x="0" y="445" width="1400" height="100" fill="#8b7055" />

          {/* Cooking area (cauldron zone) */}
          <rect x="480" y="395" width="220" height="55" rx="8" fill="#4a3520" />
          <ellipse cx="590" cy="390" rx="80" ry="22" fill="#3d2b1a" />
          {/* Pan */}
          <ellipse cx="590" cy="375" rx="65" ry="18" fill="#5c4030" />
          <rect x="655" y="365" width="80" height="12" rx="4" fill="#4a3520" />

          {/* Dietary shelf */}
          <rect x="820" y="100" width="230" height="250" rx="4" fill="#6b5040" />
          {[110, 185, 260].map(y => (
            <rect key={y} x="825" y={y} width="220" height="6" fill="#5c4030" rx="2" />
          ))}

          {/* Pantry area */}
          <rect x="1100" y="120" width="200" height="320" rx="6" fill="#5c4030" />
          <rect x="1110" y="130" width="85" height="300" rx="3" fill="#6b5040" />
          <rect x="1205" y="130" width="85" height="300" rx="3" fill="#6b5040" />

          {/* Map on wall */}
          <rect x="1010" y="50" width="60" height="45" rx="3" fill="#e8d5b8" stroke="#8b7050" strokeWidth="1.5" />

          {/* Herbs hanging */}
          {[750, 780, 810].map((x, i) => (
            <g key={i} className="ambient-sway" style={{ animationDelay: `${i * 0.8}s` }}>
              <line x1={x} y1="50" x2={x} y2={90 + i * 10} stroke="#5c7c5c" strokeWidth="2" />
              <ellipse cx={x} cy={95 + i * 10} rx="8" ry="12" fill="#5c7c5c" opacity="0.7" />
            </g>
          ))}
        </svg>
      </div>

      {/* Foreground */}
      <div className="scene-layer" data-depth="2" ref={el => { if (layersRef) layersRef.current[2] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Potted plants */}
          <g transform="translate(30, 470)">
            <rect x="0" y="30" width="40" height="45" rx="5" fill="#7a5c45" />
            <ellipse cx="20" cy="20" rx="25" ry="25" fill="#5c7c5c" opacity="0.8" />
          </g>

          {/* Sunlight particles */}
          <circle cx="1000" cy="200" r="2" fill="#d4a84b" className="ambient-particle" opacity="0.4" />
          <circle cx="1050" cy="300" r="1.5" fill="#d4a84b" className="ambient-particle" opacity="0.3" />
          <circle cx="1100" cy="250" r="2" fill="#d4a84b" className="ambient-particle" opacity="0.5" />

          {/* Exit door */}
          <rect x="0" y="240" width="50" height="300" rx="4" fill="#5c4030" />
          <rect x="5" y="248" width="40" height="284" rx="3" fill="#6b5040" />
          <circle cx="40" cy="390" r="4" fill="#c4956a" />
        </svg>
      </div>
    </>
  );
}
