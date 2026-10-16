/**
 * Cravings Decoded Kitchen — mystical fortune-teller kitchen.
 * Purple tones (#7c5c8b), crystal ball, mood lanterns, mysterious.
 */
export default function CravingsDecodedKitchen({ layersRef }) {
  return (
    <>
      {/* Background — dark mystical walls */}
      <div className="scene-layer" data-depth="0" ref={el => { if (layersRef) layersRef.current[0] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cd-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2030" />
              <stop offset="100%" stopColor="#3d3045" />
            </linearGradient>
            <radialGradient id="cd-glow" cx="45%" cy="40%" r="40%">
              <stop offset="0%" stopColor="rgba(124, 92, 139, 0.25)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="1400" height="520" fill="url(#cd-wall)" />
          <rect x="0" y="0" width="1400" height="520" fill="url(#cd-glow)" />

          {/* Stars/sparkles on ceiling */}
          {[100, 250, 400, 600, 800, 950, 1100, 1250].map((x, i) => (
            <circle key={i} cx={x} cy={30 + (i % 3) * 25} r={1 + (i % 2)} fill="#c0b0d0" opacity={0.3 + (i % 3) * 0.15}
              className="ambient-candle" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}

          {/* Draped fabric on walls */}
          <path d="M0 80 Q350 120 700 80 Q1050 40 1400 80" fill="none" stroke="#5c4060" strokeWidth="30" opacity="0.3" />

          {/* Floor — dark wood */}
          <rect x="0" y="520" width="1400" height="280" fill="#3d2d20" />
          <rect x="0" y="520" width="1400" height="4" fill="#2d1d15" />

          {/* Circular rug */}
          <ellipse cx="700" cy="650" rx="300" ry="100" fill="#5c4060" opacity="0.3" />
          <ellipse cx="700" cy="650" rx="250" ry="80" fill="none" stroke="#7c5c8b" strokeWidth="1" opacity="0.3" />
        </svg>
      </div>

      {/* Midground — crystal ball, lanterns, shelves */}
      <div className="scene-layer" data-depth="1" ref={el => { if (layersRef) layersRef.current[1] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Craving tags shelf (left) */}
          <rect x="60" y="130" width="280" height="200" rx="6" fill="#3d2d25" />
          {[140, 210, 280].map(y => (
            <rect key={y} x="65" y={y} width="270" height="5" fill="#2d1d15" rx="2" />
          ))}
          {/* Tag bottles */}
          {[80, 120, 160, 200, 240, 280].map((x, i) => (
            <g key={i}>
              <rect x={x} y={148 + (i % 2) * 70} width="25" height="35" rx="5"
                fill={`rgba(124, 92, 139, ${0.4 + i * 0.08})`} />
              <rect x={x + 5} y={145 + (i % 2) * 70} width="15" height="6" rx="3" fill="#5c4060" />
            </g>
          ))}

          {/* Crystal ball area (center) */}
          <rect x="420" y="300" width="200" height="100" rx="8" fill="#3d2d25" />
          {/* Table cloth */}
          <path d="M410 300 Q520 280 630 300" fill="#5c4060" opacity="0.5" />
          {/* Crystal ball */}
          <circle cx="520" cy="260" r="55" fill="#8070a0" opacity="0.3" />
          <circle cx="520" cy="260" r="50" fill="#9080b0" opacity="0.2" />
          <circle cx="520" cy="260" r="45" fill="none" stroke="#b0a0c8" strokeWidth="1.5" opacity="0.4" />
          <ellipse cx="508" cy="240" rx="15" ry="20" fill="rgba(200, 180, 220, 0.2)" />
          {/* Crystal ball glow */}
          <circle cx="520" cy="260" r="65" fill="none" stroke="rgba(124, 92, 139, 0.15)" strokeWidth="8"
            className="ambient-glow" />
          {/* Base */}
          <ellipse cx="520" cy="310" rx="35" ry="10" fill="#4a3520" />

          {/* Mood lanterns (right side) */}
          {[
            { x: 820, y: 120, color: '#c25a5a', label: 'stressed' },
            { x: 900, y: 140, color: '#7c5c8b', label: 'tired' },
            { x: 980, y: 110, color: '#c27a8c', label: 'emotional' },
            { x: 860, y: 220, color: '#d4a84b', label: 'bored' },
            { x: 940, y: 200, color: '#5c7c5c', label: 'hungry' },
          ].map((lantern, i) => (
            <g key={i} className="ambient-candle" style={{ animationDelay: `${i * 0.5}s` }}>
              <line x1={lantern.x + 12} y1={lantern.y - 30} x2={lantern.x + 12} y2={lantern.y} stroke="#5c4060" strokeWidth="1" />
              <rect x={lantern.x} y={lantern.y} width="24" height="35" rx="4" fill={lantern.color} opacity="0.5" />
              <ellipse cx={lantern.x + 12} cy={lantern.y + 5} rx="14" ry="8" fill={lantern.color} opacity="0.2" />
            </g>
          ))}

          {/* Location map */}
          <rect x="1120" y="80" width="60" height="45" rx="3" fill="#e8d5b8" stroke="#5c4060" strokeWidth="1.5" />

          {/* Main surface */}
          <rect x="350" y="420" width="360" height="15" rx="3" fill="#3d2d25" />

          {/* Submit area — mystical circle on floor */}
          <ellipse cx="530" cy="550" rx="100" ry="40" fill="none" stroke="#7c5c8b" strokeWidth="2" opacity="0.3" />
          <ellipse cx="530" cy="550" rx="70" ry="28" fill="none" stroke="#7c5c8b" strokeWidth="1" opacity="0.2" />
        </svg>
      </div>

      {/* Foreground */}
      <div className="scene-layer" data-depth="2" ref={el => { if (layersRef) layersRef.current[2] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Mystical particles */}
          <circle cx="400" cy="200" r="2" fill="#b0a0c8" className="ambient-particle" opacity="0.5" />
          <circle cx="600" cy="150" r="1.5" fill="#c0b0d8" className="ambient-particle" opacity="0.4" />
          <circle cx="520" cy="250" r="2.5" fill="#d0c0e0" className="ambient-particle" opacity="0.3" />
          <circle cx="900" cy="300" r="1.5" fill="#b0a0c8" className="ambient-particle" opacity="0.4" />

          {/* Exit door */}
          <rect x="0" y="240" width="50" height="300" rx="4" fill="#2d1d15" />
          <rect x="5" y="248" width="40" height="284" rx="3" fill="#3d2d25" />
          <circle cx="40" cy="390" r="4" fill="#7c5c8b" />
        </svg>
      </div>
    </>
  );
}
