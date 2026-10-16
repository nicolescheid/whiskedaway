/**
 * Nourish Academy — library/study with bookshelf and chalkboard.
 * Teal tones (#4a7c7c), scholarly, warm, wisdom-focused.
 */
export default function NourishAcademyKitchen({ layersRef }) {
  return (
    <>
      {/* Background — wood-paneled study walls */}
      <div className="scene-layer" data-depth="0" ref={el => { if (layersRef) layersRef.current[0] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="na-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d0dcd4" />
              <stop offset="100%" stopColor="#c0d0c8" />
            </linearGradient>
            <radialGradient id="na-glow" cx="30%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(74, 124, 124, 0.1)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="1400" height="520" fill="url(#na-wall)" />
          <rect x="0" y="0" width="1400" height="520" fill="url(#na-glow)" />

          {/* Wainscoting */}
          <rect x="0" y="380" width="1400" height="6" fill="#6b7c6b" opacity="0.3" />
          <rect x="0" y="386" width="1400" height="134" fill="#5c6c5c" opacity="0.1" />

          {/* Floor — warm wood */}
          <rect x="0" y="520" width="1400" height="280" fill="#7a6c55" />
          <rect x="0" y="520" width="1400" height="4" fill="#6a5c45" />
          {/* Reading rug */}
          <ellipse cx="700" cy="650" rx="280" ry="90" fill="#4a7c7c" opacity="0.15" />
        </svg>
      </div>

      {/* Midground — bookshelf, chalkboard, desk */}
      <div className="scene-layer" data-depth="1" ref={el => { if (layersRef) layersRef.current[1] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Large bookshelf (left) */}
          <rect x="50" y="50" width="380" height="400" rx="6" fill="#5c4c3c" />
          {/* Shelf dividers */}
          {[60, 155, 250, 345].map(y => (
            <rect key={y} x="55" y={y} width="370" height="6" fill="#4c3c2c" rx="2" />
          ))}
          {/* Books! Lots of colorful books */}
          {[
            // Row 1
            { x: 65, y: 70, w: 18, h: 70, color: '#4a7c7c' },
            { x: 88, y: 75, w: 15, h: 65, color: '#8b4d5c' },
            { x: 108, y: 68, w: 20, h: 72, color: '#d4a84b' },
            { x: 133, y: 72, w: 16, h: 68, color: '#5c7c5c' },
            { x: 155, y: 70, w: 22, h: 70, color: '#7c5c8b' },
            { x: 182, y: 74, w: 14, h: 66, color: '#c4956a' },
            { x: 200, y: 68, w: 18, h: 72, color: '#c27a8c' },
            { x: 225, y: 72, w: 20, h: 68, color: '#4a7c7c' },
            { x: 250, y: 69, w: 16, h: 71, color: '#8b6b5c' },
            { x: 275, y: 75, w: 22, h: 65, color: '#5c7c5c' },
            { x: 302, y: 70, w: 15, h: 70, color: '#d4a84b' },
            { x: 322, y: 72, w: 18, h: 68, color: '#7c5c8b' },
            { x: 345, y: 68, w: 20, h: 72, color: '#4a7c7c' },
            { x: 370, y: 74, w: 16, h: 66, color: '#c27a8c' },
            { x: 392, y: 70, w: 18, h: 70, color: '#8b4d5c' },
            // Row 2
            { x: 65, y: 165, w: 20, h: 70, color: '#c27a8c' },
            { x: 90, y: 168, w: 16, h: 67, color: '#4a7c7c' },
            { x: 112, y: 163, w: 22, h: 72, color: '#d4a84b' },
            { x: 140, y: 167, w: 14, h: 68, color: '#8b4d5c' },
            { x: 160, y: 165, w: 18, h: 70, color: '#5c7c5c' },
            { x: 185, y: 170, w: 20, h: 65, color: '#7c5c8b' },
            { x: 210, y: 163, w: 15, h: 72, color: '#c4956a' },
            { x: 232, y: 168, w: 22, h: 67, color: '#4a7c7c' },
            { x: 260, y: 165, w: 16, h: 70, color: '#c27a8c' },
            // Row 3
            { x: 65, y: 258, w: 18, h: 70, color: '#5c7c5c' },
            { x: 88, y: 262, w: 20, h: 66, color: '#d4a84b' },
            { x: 115, y: 255, w: 16, h: 73, color: '#4a7c7c' },
            { x: 138, y: 260, w: 22, h: 68, color: '#8b4d5c' },
            { x: 165, y: 258, w: 14, h: 70, color: '#7c5c8b' },
            { x: 185, y: 264, w: 18, h: 64, color: '#c4956a' },
          ].map((book, i) => (
            <rect key={i} x={book.x} y={book.y} width={book.w} height={book.h} rx="2" fill={book.color} opacity="0.6" />
          ))}
          {/* Globe on top of bookshelf */}
          <circle cx="230" cy="40" r="22" fill="#4a7c7c" opacity="0.3" />
          <circle cx="230" cy="40" r="22" fill="none" stroke="#4a7c7c" strokeWidth="1" opacity="0.4" />
          <line x1="230" y1="18" x2="230" y2="62" stroke="#4a7c7c" strokeWidth="1" opacity="0.3" />
          <ellipse cx="230" cy="40" rx="22" ry="8" fill="none" stroke="#4a7c7c" strokeWidth="1" opacity="0.3" />

          {/* Chalkboard (center-right) */}
          <rect x="520" y="60" width="450" height="300" rx="8" fill="#2c3830" />
          <rect x="530" y="70" width="430" height="280" rx="4" fill="#344840" />
          {/* Chalk tray */}
          <rect x="530" y="350" width="430" height="15" rx="3" fill="#5c4c3c" />
          {/* Chalk marks */}
          <text x="600" y="140" fontFamily="Crimson Pro, serif" fontSize="22" fill="rgba(220, 220, 200, 0.6)" fontStyle="italic">
            Ask Gemma anything...
          </text>
          <line x1="560" y1="180" x2="900" y2="180" stroke="rgba(220, 220, 200, 0.2)" strokeWidth="1" strokeDasharray="8 4" />
          <line x1="560" y1="210" x2="850" y2="210" stroke="rgba(220, 220, 200, 0.2)" strokeWidth="1" strokeDasharray="8 4" />
          <line x1="560" y1="240" x2="920" y2="240" stroke="rgba(220, 220, 200, 0.2)" strokeWidth="1" strokeDasharray="8 4" />
          {/* Chalk pieces */}
          <rect x="540" y="353" width="25" height="6" rx="2" fill="#e8e0d0" opacity="0.7" />
          <rect x="575" y="354" width="20" height="5" rx="2" fill="#4a7c7c" opacity="0.5" />

          {/* Main desk */}
          <rect x="200" y="440" width="1000" height="20" rx="3" fill="#5c4c3c" />
          <rect x="200" y="455" width="1000" height="80" fill="#6b5c48" />
          {/* Desk legs */}
          <rect x="220" y="455" width="15" height="100" fill="#5c4c3c" />
          <rect x="1170" y="455" width="15" height="100" fill="#5c4c3c" />

          {/* Open book on desk (submit area) */}
          <g transform="translate(550, 400)">
            <rect x="0" y="0" width="100" height="45" rx="3" fill="#f4efe4" transform="rotate(-5, 50, 22)" />
            <rect x="100" y="0" width="100" height="45" rx="3" fill="#f0ebe0" transform="rotate(5, 50, 22)" />
            <line x1="100" y1="0" x2="100" y2="45" stroke="#d4c0a0" strokeWidth="2" />
          </g>

          {/* Reading lamp */}
          <g className="ambient-candle">
            <rect x="1050" y="380" width="8" height="60" fill="#8b7050" />
            <ellipse cx="1054" cy="375" rx="25" ry="15" fill="#4a7c7c" opacity="0.15" />
            <ellipse cx="1054" cy="375" rx="20" ry="12" fill="none" stroke="#4a7c7c" strokeWidth="1" opacity="0.3" />
            <ellipse cx="1054" cy="370" rx="8" ry="5" fill="#e8d5b8" opacity="0.5" />
          </g>
        </svg>
      </div>

      {/* Foreground */}
      <div className="scene-layer" data-depth="2" ref={el => { if (layersRef) layersRef.current[2] = el; }}>
        <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Dust motes in light */}
          <circle cx="600" cy="200" r="1.5" fill="#e8d5b8" className="ambient-particle" opacity="0.4" />
          <circle cx="750" cy="300" r="2" fill="#e8d5b8" className="ambient-particle" opacity="0.3" />
          <circle cx="400" cy="350" r="1.5" fill="#e8d5b8" className="ambient-particle" opacity="0.4" />

          {/* Exit door */}
          <rect x="0" y="240" width="50" height="300" rx="4" fill="#5c4c3c" />
          <rect x="5" y="248" width="40" height="284" rx="3" fill="#6b5c48" />
          <circle cx="40" cy="390" r="4" fill="#4a7c7c" />
        </svg>
      </div>
    </>
  );
}
