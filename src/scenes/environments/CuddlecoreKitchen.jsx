/**
 * Cuddlecore Kitchen — cozy, warm, rainy-day comfort kitchen.
 * Berry tones (#8b4d5c), soft lighting, steam, rain on window.
 */
export default function CuddlecoreKitchen({ layersRef }) {
  return (
    <>
      {/* Background — walls, window with rain */}
      <div className="scene-layer" data-depth="0" ref={el => { if (layersRef) layersRef.current[0] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cc-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8d5c0" />
              <stop offset="100%" stopColor="#d4bfa5" />
            </linearGradient>
            <radialGradient id="cc-glow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="rgba(139, 77, 92, 0.15)" />
              <stop offset="100%" stopColor="rgba(139, 77, 92, 0)" />
            </radialGradient>
          </defs>

          {/* Wall */}
          <rect x="0" y="0" width="1400" height="520" fill="url(#cc-wall)" />
          <rect x="0" y="0" width="1400" height="520" fill="url(#cc-glow)" />

          {/* Window with rain */}
          <rect x="550" y="60" width="300" height="250" rx="8" fill="#3d5060" />
          <rect x="560" y="70" width="280" height="230" rx="4" fill="#506878" />
          {/* Window panes */}
          <line x1="700" y1="70" x2="700" y2="300" stroke="#8b7050" strokeWidth="6" />
          <line x1="560" y1="185" x2="840" y2="185" stroke="#8b7050" strokeWidth="6" />
          {/* Rain drops */}
          {[580, 620, 660, 720, 760, 800].map((x, i) => (
            <line key={i} x1={x} y1={80 + i * 15} x2={x - 5} y2={100 + i * 15}
              stroke="rgba(180, 200, 220, 0.4)" strokeWidth="1.5" className="ambient-rain"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
          {/* Curtains */}
          <path d="M540 55 Q540 180 520 310" fill="none" stroke="#8b4d5c" strokeWidth="20" opacity="0.4" />
          <path d="M860 55 Q860 180 880 310" fill="none" stroke="#8b4d5c" strokeWidth="20" opacity="0.4" />

          {/* Floor */}
          <rect x="0" y="520" width="1400" height="280" fill="#7a5c45" />
          <rect x="0" y="520" width="1400" height="4" fill="#6b4d38" />
        </svg>
      </div>

      {/* Midground — counter, stove, shelves, jars */}
      <div className="scene-layer" data-depth="1" ref={el => { if (layersRef) layersRef.current[1] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Back counter/shelf unit */}
          <rect x="50" y="140" width="300" height="200" rx="4" fill="#6b5040" />
          <rect x="55" y="145" width="290" height="6" fill="#5c4030" rx="2" />
          <rect x="55" y="235" width="290" height="6" fill="#5c4030" rx="2" />

          {/* Jars on shelf (symptom jars area) */}
          {[80, 130, 180, 230, 280].map((x, i) => (
            <g key={`jar-${i}`}>
              <rect x={x} y={155 + (i % 2) * 5} width="30" height="45" rx="6" fill={`rgba(139, 77, 92, ${0.3 + i * 0.1})`} />
              <rect x={x + 2} y={152 + (i % 2) * 5} width="26" height="8" rx="3" fill="#8b7050" />
            </g>
          ))}

          {/* Candles (energy level area) */}
          {[400, 440, 480].map((x, i) => (
            <g key={`candle-${i}`} className="ambient-candle" style={{ animationDelay: `${i * 0.4}s` }}>
              <rect x={x} y={160 - i * 15} width="16" height={50 + i * 15} rx="4" fill="#e8d5b8" />
              <ellipse cx={x + 8} cy={155 - i * 15} rx="6" ry="10" fill="#e8b87a" opacity="0.8" />
              <ellipse cx={x + 8} cy={152 - i * 15} rx="3" ry="6" fill="#f0d090" />
            </g>
          ))}

          {/* Main counter */}
          <rect x="0" y="430" width="1400" height="20" rx="3" fill="#6b5040" />
          <rect x="0" y="445" width="1400" height="120" fill="#7a5c48" />

          {/* Stove/pot area (cauldron zone) */}
          <rect x="480" y="400" width="200" height="50" rx="8" fill="#4a3520" />
          <ellipse cx="580" cy="395" rx="70" ry="20" fill="#3d2b1a" />
          {/* Pot */}
          <ellipse cx="580" cy="380" rx="55" ry="18" fill="#5c4030" />
          <rect x="525" y="340" width="110" height="40" rx="4" fill="#5c4030" />
          <ellipse cx="580" cy="340" rx="55" ry="16" fill="#6b5040" />
          {/* Steam */}
          <ellipse cx="560" cy="310" rx="8" ry="12" fill="rgba(255,255,255,0.15)" className="ambient-steam" />
          <ellipse cx="580" cy="305" rx="10" ry="14" fill="rgba(255,255,255,0.12)" className="ambient-steam" />
          <ellipse cx="600" cy="308" rx="8" ry="12" fill="rgba(255,255,255,0.15)" className="ambient-steam" />

          {/* Dietary shelf (right side) */}
          <rect x="780" y="100" width="250" height="250" rx="4" fill="#6b5040" />
          {[110, 185, 260].map(y => (
            <rect key={y} x="785" y={y} width="240" height="6" fill="#5c4030" rx="2" />
          ))}
          {/* Books/items on shelf */}
          {[800, 830, 860, 900, 940, 970].map((x, i) => (
            <rect key={`book-${i}`} x={x} y={120 + (i % 3) * 75} width={15 + (i % 2) * 5} height={40 + (i % 2) * 10} rx="2"
              fill={['#8b4d5c', '#a06050', '#7a6050', '#8b6b5c', '#6b5c50', '#8b7060'][i]} opacity="0.7" />
          ))}

          {/* Pantry cabinet (far right) */}
          <rect x="1070" y="120" width="200" height="320" rx="6" fill="#5c4030" />
          <rect x="1080" y="130" width="85" height="300" rx="3" fill="#6b5040" />
          <rect x="1175" y="130" width="85" height="300" rx="3" fill="#6b5040" />
          <circle cx="1160" cy="280" r="5" fill="#c4956a" />
          <circle cx="1178" cy="280" r="5" fill="#c4956a" />

          {/* Map on wall */}
          <rect x="615" y="50" width="60" height="45" rx="3" fill="#e8d5b8" stroke="#8b7050" strokeWidth="1.5" />

          {/* Blanket on chair */}
          <g transform="translate(1000, 480)">
            <rect x="0" y="0" width="60" height="80" rx="4" fill="#6b5040" />
            <path d="M0 10 Q30 -10 60 10" fill="#8b4d5c" opacity="0.6" />
            <path d="M5 20 Q30 0 55 20" fill="#8b4d5c" opacity="0.4" />
          </g>
        </svg>
      </div>

      {/* Foreground — atmospheric effects */}
      <div className="scene-layer" data-depth="2" ref={el => { if (layersRef) layersRef.current[2] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Warm ambient glow */}
          <radialGradient id="cc-ambient" cx="40%" cy="45%" r="45%">
            <stop offset="0%" stopColor="rgba(232, 184, 122, 0.12)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <rect x="0" y="0" width="1400" height="800" fill="url(#cc-ambient)" />

          {/* Floating particles */}
          <circle cx="200" cy="400" r="2" fill="#e8d5b8" className="ambient-particle" opacity="0.4" />
          <circle cx="800" cy="300" r="1.5" fill="#e8d5b8" className="ambient-particle" opacity="0.3" />
          <circle cx="1200" cy="450" r="2" fill="#e8d5b8" className="ambient-particle" opacity="0.4" />

          {/* Exit door (left edge) */}
          <rect x="0" y="240" width="50" height="300" rx="4" fill="#5c4030" />
          <rect x="5" y="248" width="40" height="284" rx="3" fill="#6b5040" />
          <circle cx="40" cy="390" r="4" fill="#c4956a" />
        </svg>
      </div>
    </>
  );
}
