import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const tomes = [
    { path: '/cuddlecore', sigil: '🍵', name: 'Cuddlecore Care', desc: 'Gentle nourishment when you\'re unwell, exhausted, or the world is just too much.', cta: 'Gemma\'s got you →', theme: 'berry' },
    { path: '/flourish', sigil: '🌱', name: 'Flourish', desc: 'Building-you-up meals. Maximum nourishment for becoming your best self.', cta: 'Let\'s grow →', theme: 'golden' },
    { path: '/cravings', sigil: '🔮', name: 'Cravings Decoded', desc: 'What\'s your body really asking for? Understand and satisfy your cravings wisely.', cta: 'Decode this →', theme: 'purple' },
    { path: '/sweet-spells', sigil: '🧁', name: 'Sweet Spells', desc: 'Treats that happen to be good for you. Sweetness without the guilt spiral.', cta: 'Something sweet →', theme: 'rose' },
    { path: '/academy', sigil: '📚', name: 'Nourish Academy', desc: 'Kitchen wisdom, no jargon. Learn about food and nutrition from a friend.', cta: 'Teach me →', theme: 'teal' },
    { path: '/chiapothecary', sigil: '🧪', name: 'Chiapothecary', desc: 'Chia pudding experiments with playful "superpower" vibes.', cta: 'Get experimental →', theme: 'herb' },
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
          <p>I'm your kitchen genie. Tell me how you're feeling and what you have, and I'll help you figure out what to eat. No judgment, no complicated recipes when you're exhausted — just good food that meets you where you are. 💛</p>
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

      <footer className="home-footer">
        <p>No accounts. No tracking. Your recipes are yours.</p>
        <p className="gemma-note">Gemma offers comfort and nourishment ideas — never medical advice. When in doubt, please see a human healer. 💛</p>
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
