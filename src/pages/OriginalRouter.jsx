import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './Home';
import Cuddlecore from './Cuddlecore';
import Flourish from './Flourish';
import CravingsDecoded from './CravingsDecoded';
import SweetSpells from './SweetSpells';
import Chiapothecary from './Chiapothecary';
import NourishAcademy from './NourishAcademy';

/**
 * Wraps original page components so internal links
 * stay within /original/* instead of navigating to the inn.
 *
 * Uses a context-style prefix approach: overrides Link paths
 * by wrapping each page with adjusted "back" links.
 */

function OriginalHome() {
  const tomes = [
    { path: '/original/cuddlecore', sigil: '🍵', name: 'Cuddlecore Care', desc: "Gentle nourishment when you're unwell, exhausted, or the world is just too much.", cta: "Gemma's got you →", theme: 'berry' },
    { path: '/original/flourish', sigil: '🌱', name: 'Flourish', desc: 'Building-you-up meals. Maximum nourishment for becoming your best self.', cta: "Let's grow →", theme: 'golden' },
    { path: '/original/cravings', sigil: '🔮', name: 'Cravings Decoded', desc: "What's your body really asking for? Understand and satisfy your cravings wisely.", cta: 'Decode this →', theme: 'purple' },
    { path: '/original/sweet-spells', sigil: '🧁', name: 'Sweet Spells', desc: 'Treats that happen to be good for you. Sweetness without the guilt spiral.', cta: 'Something sweet →', theme: 'rose' },
    { path: '/original/academy', sigil: '📚', name: 'Nourish Academy', desc: 'Kitchen wisdom, no jargon. Learn about food and nutrition from a friend.', cta: 'Teach me →', theme: 'teal' },
    { path: '/original/chiapothecary', sigil: '🧪', name: 'Chiapothecary', desc: 'Chia pudding experiments with playful "superpower" vibes.', cta: 'Get experimental →', theme: 'herb' },
  ];

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="site-title">WhiskedAway</h1>
        <p className="site-tagline">Where nourishment meets comfort</p>
      </header>

      <section className="gemma-intro">
        <div className="gemma-avatar">🧞‍♀️</div>
        <div className="gemma-greeting">
          <h2>Hi, I'm Gemma</h2>
          <p>I'm your kitchen genie. Tell me how you're feeling and what you have, and I'll help you figure out what to eat. No judgment, no complicated recipes when you're exhausted — just good food that meets you where you are.</p>
        </div>
      </section>

      <section className="tomes-section">
        <h3>What do you need today?</h3>
        <div className="tomes-grid">
          {tomes.map(tome => (
            <Link to={tome.path} key={tome.path} className={`tome-card ${tome.theme}`}>
              <span className="tome-sigil">{tome.sigil}</span>
              <div className="tome-content">
                <h4 className="tome-name">{tome.name}</h4>
                <p className="tome-description">{tome.desc}</p>
                <span className="tome-cta">{tome.cta}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Link to="/" style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', color: 'var(--amber)', textDecoration: 'none' }}>
          ✨ Try the new Kitchen Inn experience →
        </Link>
      </section>

      <footer className="home-footer">
        <p>No accounts. No tracking. Your recipes are yours.</p>
        <p className="gemma-note">Gemma offers comfort and nourishment ideas — never medical advice. When in doubt, please see a human healer.</p>
        <p className="support-link">
          WhiskedAway is free and ad-free. If Gemma's helped you, you can{' '}
          <a href="https://ko-fi.com/whiskedaway" target="_blank" rel="noopener noreferrer">
            support her here
          </a>. ☕
        </p>
      </footer>
    </div>
  );
}

/** Wraps a page component to redirect its "Back to Gemma" link to /original */
function WithOriginalBack({ children }) {
  return (
    <div className="original-back-wrapper">
      <style>{`.original-back-wrapper .tome-header .back-link { display: none !important; }`}</style>
      <nav style={{ padding: '12px 16px' }}>
        <Link to="/original" style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', color: 'var(--ink-soft)', textDecoration: 'none' }}>
          ← Back to Gemma
        </Link>
      </nav>
      {children}
    </div>
  );
}

export default function OriginalRouter() {
  return (
    <Routes>
      <Route index element={<OriginalHome />} />
      <Route path="cuddlecore" element={<WithOriginalBack><Cuddlecore /></WithOriginalBack>} />
      <Route path="flourish" element={<WithOriginalBack><Flourish /></WithOriginalBack>} />
      <Route path="cravings" element={<WithOriginalBack><CravingsDecoded /></WithOriginalBack>} />
      <Route path="sweet-spells" element={<WithOriginalBack><SweetSpells /></WithOriginalBack>} />
      <Route path="chiapothecary" element={<WithOriginalBack><Chiapothecary /></WithOriginalBack>} />
      <Route path="academy" element={<WithOriginalBack><NourishAcademy /></WithOriginalBack>} />
    </Routes>
  );
}
