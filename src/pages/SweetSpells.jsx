import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  DietaryOptions, 
  ShoppingScroll, 
  NourishmentHighlights 
} from '../components';
import './SweetSpells.css';

const WORKER_URL = 'https://whiskedaway-genie.nicole-scheid.workers.dev';

export default function SweetSpells() {
  // Form state
  const [craving, setCraving] = useState('chocolate');
  const [occasion, setOccasion] = useState('just-because');
  const [effortLevel, setEffortLevel] = useState(2);
  const [dietaryData, setDietaryData] = useState({ dietary: [], allergies: '' });
  const [locale, setLocale] = useState('NZ');
  const [sourcingPref, setSourcingPref] = useState('supermarket_only');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const cravingOptions = [
    { value: 'chocolate', icon: '🍫', label: 'Chocolate' },
    { value: 'fruity', icon: '🍓', label: 'Fruity' },
    { value: 'creamy', icon: '🍦', label: 'Creamy' },
    { value: 'crunchy', icon: '🍪', label: 'Crunchy' },
    { value: 'warm', icon: '🥧', label: 'Warm & cozy' },
    { value: 'frozen', icon: '🧊', label: 'Frozen' },
  ];

  const occasionOptions = [
    { value: 'just-because', label: 'Just because 💛' },
    { value: 'movie-night', label: 'Movie night' },
    { value: 'guests', label: 'Impressing guests' },
    { value: 'meal-prep', label: 'Meal prep batch' },
    { value: 'kids', label: 'Kid-friendly' },
    { value: 'romantic', label: 'Romantic evening' },
  ];

  const effortLabels = ['No-bake magic', '15 minutes', '30 minutes', '45 minutes', 'Worth the wait'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      tome_id: 'sweet-spells',
      locale,
      craving,
      occasion,
      effort_level: effortLevel,
      dietary_restrictions: dietaryData.dietary,
      allergies: dietaryData.allergies.split(',').map(s => s.trim()).filter(Boolean),
      sourcing_preference: sourcingPref
    };

    try {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tome-container sweetspells-theme">
      {/* Header */}
      <header className="tome-header">
        <Link to="/" className="back-link">← Back to Gemma</Link>
        <div className="tome-sigil">🧁</div>
        <h1 className="tome-title">Sweet Spells</h1>
        <p className="tome-subtitle">Treats that happen to be good for you</p>
      </header>

      {/* Gemma's greeting */}
      <div className="gemma-message tome-themed">
        <span className="avatar">🧞‍♀️</span>
        <p>"Life's too short for guilt about dessert! Let's make something sweet that also makes your body happy. Tell me what you're craving and I'll work my magic. ✨🧁"</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="intake-form">
        
        {/* Craving Selection */}
        <section className="form-section">
          <h2><span className="icon">✨</span> What are you craving?</h2>
          <div className="craving-grid">
            {cravingOptions.map(c => (
              <label 
                key={c.value} 
                className={`craving-card ${craving === c.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="craving"
                  value={c.value}
                  checked={craving === c.value}
                  onChange={(e) => setCraving(e.target.value)}
                />
                <span className="craving-icon">{c.icon}</span>
                <span className="craving-label">{c.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Occasion */}
        <section className="form-section">
          <h2><span className="icon">🎉</span> What's the occasion?</h2>
          <div className="occasion-pills">
            {occasionOptions.map(o => (
              <label 
                key={o.value} 
                className={`occasion-pill ${occasion === o.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="occasion"
                  value={o.value}
                  checked={occasion === o.value}
                  onChange={(e) => setOccasion(e.target.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </section>

        {/* Effort Level */}
        <section className="form-section">
          <h2><span className="icon">⏱️</span> How much effort?</h2>
          <div className="effort-slider-container">
            <input
              type="range"
              min="0"
              max="4"
              value={effortLevel}
              onChange={(e) => setEffortLevel(parseInt(e.target.value))}
              className="effort-slider"
            />
            <div className="effort-labels">
              <span>Quick</span>
              <span className="effort-current">{effortLabels[effortLevel]}</span>
              <span>Fancy</span>
            </div>
          </div>
        </section>

        {/* Dietary Options - REUSABLE */}
        <DietaryOptions
          options={[
            { id: 'nut-free', label: 'Nut-free', value: 'nut-free' },
          ]}
          showReligious={true}
          onChange={setDietaryData}
        />

        {/* Location & Sourcing */}
        <section className="form-section">
          <h2><span className="icon">🛒</span> Where are you shopping?</h2>
          
          <label htmlFor="locale">Your location</label>
          <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="NZ">New Zealand</option>
            <option value="AU">Australia</option>
            <option value="UK">United Kingdom</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>

          <div className="option-group" style={{ marginTop: '1rem' }}>
            <div className="option-item">
              <input
                type="radio"
                id="source-supermarket"
                name="sourcing"
                value="supermarket_only"
                checked={sourcingPref === 'supermarket_only'}
                onChange={(e) => setSourcingPref(e.target.value)}
              />
              <label htmlFor="source-supermarket">Regular supermarkets only</label>
            </div>
            <div className="option-item">
              <input
                type="radio"
                id="source-specialty"
                name="sourcing"
                value="specialty_ok"
                checked={sourcingPref === 'specialty_ok'}
                onChange={(e) => setSourcingPref(e.target.value)}
              />
              <label htmlFor="source-specialty">Specialty shops okay too</label>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="conjure-section">
          <button 
            type="submit" 
            className={`btn-primary ${loading ? 'loading' : ''}`}
            disabled={loading}
            data-loading-text="Casting a sweet spell... ✨"
          >
            🧁 Cast Sweet Spell
          </button>
        </div>
      </form>

      {/* Results */}
      {error && (
        <div className="error-message">
          <p>Gemma got a bit tangled up: {error}</p>
          <p>Give it another try? 💛</p>
        </div>
      )}

      {result && (
        <div className="results-area">
          {/* Nourishment Highlights - REUSABLE */}
          <NourishmentHighlights 
            highlights={result.nourishment_highlights}
          />

          {/* Base Recipe */}
          {result.base_recipe && (
            <div className="recipe-card main-recipe">
              <span className="recipe-badge">Sweet Spell</span>
              <h3>{result.base_recipe.name}</h3>
              <p className="recipe-description">{result.base_recipe.description}</p>

              {/* Shopping Scroll - REUSABLE */}
              <ShoppingScroll
                ingredients={result.base_recipe.ingredients}
                locale={locale}
                recipeName={result.base_recipe.name}
                tomeEmoji="🧁"
                tomeName="Sweet Spells"
                accentColor={[194, 122, 140]}
              />

              <h4 className="recipe-section-title">Method</h4>
              <ol className="steps-list">
                {result.base_recipe.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>

              {/* Guilt-free note */}
              {result.guilt_free_note && (
                <div className="guilt-free-box">
                  <h4>💛 Why this is guilt-free</h4>
                  <p>{result.guilt_free_note}</p>
                </div>
              )}
            </div>
          )}

          {/* Enchantments (Variations) */}
          {result.enchantments?.length > 0 && (
            <>
              <h4 className="enchantments-title">✨ Enchantments</h4>
              <p className="enchantments-subtitle">Optional ways to level up your spell</p>
              {result.enchantments.map((enchant, idx) => (
                <div key={idx} className="recipe-card enchantment-card">
                  <strong>{enchant.name}</strong>
                  <p>{enchant.description}</p>
                </div>
              ))}
            </>
          )}

          {/* Gemma's Note */}
          {result.gemma_note && (
            <p className="gemma-closing">🧞‍♀️ {result.gemma_note}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="tome-footer">
        <p>
          Gemma offers ideas — never medical advice.{' '}
          <a href="https://ko-fi.com/whiskedaway" target="_blank" rel="noopener noreferrer">
            Support WhiskedAway
          </a> ☕
        </p>
      </footer>
    </div>
  );
}
