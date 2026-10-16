/**
 * Chiapothecary Kitchen — apothecary lab with potions and flasks.
 * Herb tones (#5c7c5c), scientific/magical lab aesthetic.
 */
export default function ChiapothecaryKitchen({ layersRef }) {
  return (
    <>
      {/* Background — stone/herb walls */}
      <div className="scene-layer" data-depth="0" ref={el => { if (layersRef) layersRef.current[0] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ch-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8e0d0" />
              <stop offset="100%" stopColor="#c8d4c0" />
            </linearGradient>
            <radialGradient id="ch-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(92, 124, 92, 0.1)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="1400" height="520" fill="url(#ch-wall)" />
          <rect x="0" y="0" width="1400" height="520" fill="url(#ch-glow)" />

          {/* Stone texture hints */}
          {[100, 300, 500, 700, 900, 1100].map((x, i) => (
            <rect key={i} x={x} y={50 + (i % 3) * 120} width={80 + (i % 2) * 40} height={60 + (i % 2) * 30}
              rx="3" fill="none" stroke="#b8c8b0" strokeWidth="1" opacity="0.3" />
          ))}

          {/* Floor — darker stone */}
          <rect x="0" y="520" width="1400" height="280" fill="#5c6050" />
          <rect x="0" y="520" width="1400" height="4" fill="#4c5040" />
        </svg>
      </div>

      {/* Midground — potions, flasks, lab equipment */}
      <div className="scene-layer" data-depth="1" ref={el => { if (layersRef) layersRef.current[1] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Vibe potions shelf (left) */}
          <rect x="50" y="100" width="280" height="240" rx="6" fill="#4c5040" />
          {[110, 195, 280].map(y => (
            <rect key={y} x="55" y={y} width="270" height="5" fill="#3c4030" rx="2" />
          ))}
          {/* Potion bottles */}
          {[
            { x: 70, color: '#7aaa50', label: 'Energizing' },
            { x: 125, color: '#5080a0', label: 'Calming' },
            { x: 180, color: '#8b4d5c', label: 'Indulgent' },
            { x: 235, color: '#50a080', label: 'Refreshing' },
            { x: 290, color: '#c4956a', label: 'Warming' },
          ].map((potion, i) => (
            <g key={i}>
              {/* Flask shape */}
              <path d={`M${potion.x + 8} ${120} L${potion.x + 8} ${145} Q${potion.x - 2} ${160} ${potion.x} ${175} L${potion.x + 30} ${175} Q${potion.x + 32} ${160} ${potion.x + 22} ${145} L${potion.x + 22} ${120}`}
                fill={potion.color} opacity="0.35" />
              <rect x={potion.x + 6} y={115} width="18" height="8" rx="3" fill="#4c5040" />
              {/* Liquid level */}
              <rect x={potion.x + 2} y={155} width="26" height="18" rx="3" fill={potion.color} opacity="0.25" />
            </g>
          ))}

          {/* Milk bottles (base preference) */}
          <g transform="translate(380, 90)">
            <rect x="0" y="0" width="180" height="180" rx="4" fill="#4c5040" />
            <rect x="5" y="5" width="170" height="4" fill="#3c4030" rx="2" />
            <rect x="5" y="90" width="170" height="4" fill="#3c4030" rx="2" />
            {/* Three milk bottles */}
            {[20, 70, 120].map((x, i) => (
              <g key={i}>
                <rect x={x} y={15} width="30" height="60" rx="6" fill={['#f0e8e0', '#e8e0d0', '#d8d0c0'][i]} opacity="0.7" />
                <rect x={x + 5} y={10} width="20" height="10" rx="4" fill="#e8d5b8" />
              </g>
            ))}
          </g>

          {/* Texture flask (center) */}
          <g transform="translate(640, 90)">
            {/* Large flask */}
            <path d="M30 0 L30 40 Q0 60 5 100 L75 100 Q80 60 50 40 L50 0" fill="#5c7c5c" opacity="0.2" />
            <rect x="25" y="-5" width="30" height="12" rx="4" fill="#4c5040" />
            {/* Liquid inside with bubbles */}
            <rect x="10" y="65" width="60" height="32" rx="4" fill="#5c7c5c" opacity="0.25" />
            <circle cx="30" cy="75" r="3" fill="#6b8c6b" opacity="0.3" className="ambient-bubble" />
            <circle cx="50" cy="80" r="2" fill="#6b8c6b" opacity="0.3" className="ambient-bubble" />
          </g>

          {/* Dietary shelf */}
          <rect x="850" y="100" width="230" height="250" rx="4" fill="#4c5040" />
          {[110, 185, 260].map(y => (
            <rect key={y} x="855" y={y} width="220" height="5" fill="#3c4030" rx="2" />
          ))}

          {/* Pantry cabinet */}
          <rect x="1120" y="120" width="200" height="320" rx="6" fill="#4c5040" />
          <rect x="1130" y="130" width="85" height="300" rx="3" fill="#5c6050" />
          <rect x="1225" y="130" width="85" height="300" rx="3" fill="#5c6050" />
          <circle cx="1210" cy="280" r="5" fill="#5c7c5c" />
          <circle cx="1228" cy="280" r="5" fill="#5c7c5c" />

          {/* Map */}
          <rect x="1010" y="50" width="60" height="45" rx="3" fill="#e8d5b8" stroke="#5c7c5c" strokeWidth="1.5" />

          {/* Lab counter */}
          <rect x="0" y="430" width="1400" height="20" rx="3" fill="#4c5040" />
          <rect x="0" y="445" width="1400" height="100" fill="#5c6050" />

          {/* Brewing beaker (cauldron area) */}
          <g transform="translate(450, 340)">
            <rect x="0" y="40" width="180" height="60" rx="6" fill="#3c4030" />
            {/* Large beaker */}
            <rect x="40" y="0" width="100" height="80" rx="8" fill="#5c7c5c" opacity="0.15" />
            <rect x="40" y="50" width="100" height="28" rx="4" fill="#5c7c5c" opacity="0.2" />
            {/* Bubbles */}
            <circle cx="70" cy="55" r="4" fill="#6b8c6b" opacity="0.3" className="ambient-bubble" />
            <circle cx="100" cy="48" r="3" fill="#6b8c6b" opacity="0.25" className="ambient-bubble" />
            <circle cx="120" cy="60" r="3.5" fill="#6b8c6b" opacity="0.3" className="ambient-bubble" />
            {/* Steam */}
            <ellipse cx="80" cy="0" rx="8" ry="10" fill="rgba(255,255,255,0.1)" className="ambient-steam" />
            <ellipse cx="100" cy="-5" rx="6" ry="8" fill="rgba(255,255,255,0.08)" className="ambient-steam" />
          </g>

          {/* Hanging dried herbs */}
          {[750, 790, 830].map((x, i) => (
            <g key={i} className="ambient-sway" style={{ animationDelay: `${i * 0.6}s` }}>
              <line x1={x} y1="0" x2={x} y2={50 + i * 8} stroke="#5c7c5c" strokeWidth="2" />
              <ellipse cx={x} cy={55 + i * 8} rx="8" ry="14" fill="#5c7c5c" opacity="0.6" />
              <ellipse cx={x + 3} cy={60 + i * 8} rx="6" ry="10" fill="#6b8c6b" opacity="0.5" />
            </g>
          ))}
        </svg>
      </div>

      {/* Foreground */}
      <div className="scene-layer" data-depth="2" ref={el => { if (layersRef) layersRef.current[2] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Green particles */}
          <circle cx="500" cy="300" r="2" fill="#6b8c6b" className="ambient-particle" opacity="0.4" />
          <circle cx="800" cy="200" r="1.5" fill="#5c7c5c" className="ambient-particle" opacity="0.3" />
          <circle cx="300" cy="400" r="2" fill="#6b8c6b" className="ambient-particle" opacity="0.4" />

          {/* Exit door */}
          <rect x="0" y="240" width="50" height="300" rx="4" fill="#3c4030" />
          <rect x="5" y="248" width="40" height="284" rx="3" fill="#4c5040" />
          <circle cx="40" cy="390" r="4" fill="#5c7c5c" />
        </svg>
      </div>
    </>
  );
}
