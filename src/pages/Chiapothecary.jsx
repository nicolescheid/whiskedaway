import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  DietaryOptions, 
  PantryInput, 
  ShoppingScroll, 
  NourishmentHighlights 
} from '../components';
import './Chiapothecary.css';

import { genieFetch } from '../lib/genie';

export default function Chiapothecary() {
  // Form state
  const [vibe, setVibe] = useState('energizing');
  const [basePreference, setBasePreference] = useState('creamy');
  const [textureLevel, setTextureLevel] = useState(2);
  const [dietaryData, setDietaryData] = useState({ dietary: [], allergies: '' });
  const [pantryItems, setPantryItems] = useState([]);
  const [locale, setLocale] = useState('NZ');
  const [sourcingPref, setSourcingPref] = useState('supermarket_only');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const vibeOptions = [
    { value: 'energizing', icon: '⚡', label: 'Energizing' },
    { value: 'calming', icon: '😌', label: 'Calming' },
    { value: 'indulgent', icon: '🍫', label: 'Indulgent' },
    { value: 'refreshing', icon: '🍋', label: 'Refreshing' },
    { value: 'warming', icon: '🔥', label: 'Warming' },
    { value: 'tropical', icon: '🥥', label: 'Tropical' },
  ];

  const baseOptions = [
    { value: 'creamy', label: 'Creamy (coconut milk, oat milk)' },
    { value: 'light', label: 'Light (almond milk, water-based)' },
    { value: 'rich', label: 'Rich (full-fat yogurt base)' },
  ];

  const textureLabels = ['Very thin', 'Pourable', 'Classic', 'Thick', 'Spoonable'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      tome_id: 'chiapothecary',
      locale,
      vibe,
      base_preference: basePreference,
      texture_level: textureLevel,
      pantry_ingredients: pantryItems,
      dietary_restrictions: dietaryData.dietary,
      allergies: dietaryData.allergies.split(',').map(s => s.trim()).filter(Boolean),
      sourcing_preference: sourcingPref
    };

    try {
      const response = await genieFetch('/', payload);

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPantry = (item) => {
    if (!pantryItems.includes(item.toLowerCase())) {
      setPantryItems([...pantryItems, item.toLowerCase()]);
      return true;
    }
    return false;
  };

  return (
    <div className="tome-container chiapothecary-theme">
      {/* Header */}
      <header className="tome-header">
        <Link to="/" className="back-link">← Back to Gemma</Link>
        <div className="tome-sigil">🧪</div>
        <h1 className="tome-title">Chiapothecary</h1>
        <p className="tome-subtitle">Chia pudding experiments with superpower vibes</p>
      </header>

      {/* Gemma's greeting */}
      <div className="gemma-message tome-themed">
        <span className="avatar">🧞‍♀️</span>
        <p>"Welcome to the lab! Chia pudding is secretly one of the most customizable, meal-preppable, secretly-healthy things you can make. Tell me what vibe you're after and I'll brew something up. 🧪✨"</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="intake-form">
        
        {/* Vibe Selection */}
        <section className="form-section">
          <h2><span className="icon">✨</span> What's the vibe?</h2>
          <div className="vibe-grid">
            {vibeOptions.map(v => (
              <label 
                key={v.value} 
                className={`vibe-card ${vibe === v.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="vibe"
                  value={v.value}
                  checked={vibe === v.value}
                  onChange={(e) => setVibe(e.target.value)}
                />
                <span className="vibe-icon">{v.icon}</span>
                <span className="vibe-label">{v.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Base Preference */}
        <section className="form-section">
          <h2><span className="icon">🥛</span> Base preference</h2>
          <div className="option-group vertical">
            {baseOptions.map(b => (
              <div className="option-item" key={b.value}>
                <input
                  type="radio"
                  id={`base-${b.value}`}
                  name="base"
                  value={b.value}
                  checked={basePreference === b.value}
                  onChange={(e) => setBasePreference(e.target.value)}
                />
                <label htmlFor={`base-${b.value}`}>{b.label}</label>
              </div>
            ))}
          </div>
        </section>

        {/* Texture Level */}
        <section className="form-section">
          <h2><span className="icon">🥄</span> Texture preference</h2>
          <div className="texture-slider-container">
            <input
              type="range"
              min="0"
              max="4"
              value={textureLevel}
              onChange={(e) => setTextureLevel(parseInt(e.target.value))}
              className="texture-slider"
            />
            <div className="texture-labels">
              <span>Thin</span>
              <span className="texture-current">{textureLabels[textureLevel]}</span>
              <span>Thick</span>
            </div>
          </div>
        </section>

        {/* Dietary Options - REUSABLE */}
        <DietaryOptions
          options={[
            { id: 'low-sugar', label: 'Low sugar', value: 'low-sugar' },
            { id: 'nut-free', label: 'Nut-free', value: 'nut-free' },
          ]}
          showReligious={true}
          onChange={setDietaryData}
        />

        {/* Pantry Input - REUSABLE */}
        <PantryInput
          placeholder="e.g., almond milk, berries, maple syrup (commas to add multiple)"
          helperText="Add ingredients you'd like to use up — Gemma will try to work them in"
          onChange={setPantryItems}
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
            data-loading-text="Brewing your potion... 🧪"
          >
            🧪 Brew My Pudding
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
            onAddToPantry={handleAddToPantry}
          />

          {/* Base Recipe */}
          {result.base_recipe && (
            <div className="recipe-card main-recipe">
              <span className="recipe-badge">Base Potion</span>
              <h3>{result.base_recipe.name}</h3>
              <p className="recipe-description">{result.base_recipe.description}</p>

              {/* Shopping Scroll - REUSABLE */}
              <ShoppingScroll
                ingredients={result.base_recipe.ingredients}
                locale={locale}
                recipeName={result.base_recipe.name}
                tomeEmoji="🧪"
                tomeName="Chiapothecary"
                accentColor={[92, 124, 92]}
              />

              <h4 className="recipe-section-title">Method</h4>
              <ol className="steps-list">
                {result.base_recipe.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Variations */}
          {result.variations?.length > 0 && (
            <>
              <h4 className="variations-title">🔮 Variations to Try</h4>
              {result.variations.map((variation, idx) => (
                <div key={idx} className="recipe-card variation-card">
                  <strong>{variation.name}</strong>
                  <p>{variation.description}</p>
                  {variation.add && (
                    <p className="variation-add">Add: {variation.add}</p>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Texture Tips */}
          {result.texture_tips && (
            <div className="texture-tips">
              <h4>🥄 Texture Tips</h4>
              <p>{result.texture_tips}</p>
            </div>
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
