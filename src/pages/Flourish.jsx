import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  DietaryOptions, 
  PantryInput, 
  ShoppingScroll, 
  NourishmentHighlights 
} from '../components';
import './Flourish.css';

const WORKER_URL = 'https://whiskedaway-genie.nicole-scheid.workers.dev';

export default function Flourish() {
  // Form state
  const [goal, setGoal] = useState('energy');
  const [mealType, setMealType] = useState('dinner');
  const [effortLevel, setEffortLevel] = useState(2);
  const [dietaryData, setDietaryData] = useState({ dietary: [], allergies: '' });
  const [pantryItems, setPantryItems] = useState([]);
  const [locale, setLocale] = useState('NZ');
  const [sourcingPref, setSourcingPref] = useState('supermarket_only');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const effortLabels = ['5 mins', '~10 mins', '~20 mins', '~30 mins', '45+ mins'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      tome_id: 'flourish',
      locale,
      goal,
      meal_type: mealType,
      effort_level: effortLevel,
      pantry_ingredients: pantryItems,
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

  const handleAddToPantry = (item) => {
    if (!pantryItems.includes(item.toLowerCase())) {
      setPantryItems([...pantryItems, item.toLowerCase()]);
      return true;
    }
    return false;
  };

  return (
    <div className="tome-container flourish-theme">
      {/* Header */}
      <header className="tome-header">
        <Link to="/" className="back-link">← Back to Gemma</Link>
        <div className="tome-sigil">🌱</div>
        <h1 className="tome-title">Flourish</h1>
        <p className="tome-subtitle">Nourishment for becoming your best self</p>
      </header>

      {/* Gemma's greeting */}
      <div className="gemma-message tome-themed">
        <span className="avatar">🧞‍♀️</span>
        <p>"This is about giving your body what it needs to thrive — not restriction, not punishment. Just really good food that makes you feel amazing. Tell me where you're at and let's build you up. 💛"</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="intake-form">
        
        {/* Goal Selection */}
        <section className="form-section">
          <h2>🎯 What's your focus?</h2>
          <div className="goal-grid">
            {[
              { value: 'energy', icon: '⚡', label: 'More energy' },
              { value: 'strength', icon: '💪', label: 'Building strength' },
              { value: 'clarity', icon: '🧠', label: 'Mental clarity' },
              { value: 'glow', icon: '✨', label: 'Skin & glow' },
              { value: 'gut', icon: '🌿', label: 'Gut health' },
              { value: 'balance', icon: '☯️', label: 'Overall balance' },
            ].map(g => (
              <label key={g.value} className={`goal-card ${goal === g.value ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="goal"
                  value={g.value}
                  checked={goal === g.value}
                  onChange={(e) => setGoal(e.target.value)}
                />
                <div className="goal-icon">{g.icon}</div>
                <div className="goal-name">{g.label}</div>
              </label>
            ))}
          </div>
        </section>

        {/* Meal Type */}
        <section className="form-section">
          <h2>🍽️ What meal?</h2>
          <div className="meal-pills">
            {['breakfast', 'lunch', 'dinner', 'snack', 'meal-prep'].map(m => (
              <label key={m} className={`meal-pill ${mealType === m ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="meal"
                  value={m}
                  checked={mealType === m}
                  onChange={(e) => setMealType(e.target.value)}
                />
                {m.charAt(0).toUpperCase() + m.slice(1).replace('-', ' ')}
              </label>
            ))}
          </div>
        </section>

        {/* Effort Level */}
        <section className="form-section">
          <h2>⏱️ How much effort?</h2>
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
              <span>Minimal</span>
              <span className="effort-current">{effortLabels[effortLevel]}</span>
              <span>Worth it</span>
            </div>
          </div>
        </section>

        {/* Dietary Options - THE REUSABLE COMPONENT! */}
        <DietaryOptions
          options={[
            { id: 'keto', label: 'Keto-friendly', value: 'keto-friendly' },
            { id: 'high-protein', label: 'High protein', value: 'high-protein' },
          ]}
          onChange={setDietaryData}
        />

        {/* Pantry Input - ANOTHER REUSABLE COMPONENT! */}
        <PantryInput
          placeholder="e.g., salmon, spinach, quinoa (commas to add multiple)"
          onChange={setPantryItems}
        />

        {/* Location & Sourcing */}
        <section className="form-section">
          <h2>🛒 Where are you shopping?</h2>
          
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
            data-loading-text="Gemma's thinking... ✨"
          >
            🌱 Build My Meal
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
          {/* Nourishment Highlights - REUSABLE! */}
          <NourishmentHighlights 
            highlights={result.nourishment_highlights}
            onAddToPantry={handleAddToPantry}
          />

          {/* Recipe Card */}
          {result.recipe && (
            <div className="recipe-card main-recipe">
              <span className="recipe-badge">Flourish Recipe</span>
              <h3>{result.recipe.name}</h3>
              <p className="recipe-description">{result.recipe.description}</p>

              {/* Shopping Scroll - THE BIG REUSABLE ONE! */}
              <ShoppingScroll
                ingredients={result.recipe.ingredients}
                locale={locale}
                recipeName={result.recipe.name}
                tomeEmoji="🌱"
                tomeName="Flourish"
                accentColor={[212, 168, 75]}
              />

              <h4 className="recipe-section-title">Method</h4>
              <ol className="steps-list">
                {result.recipe.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>

              {result.nourishment_note && (
                <div className="nourishment-box">
                  <h4>🌱 Why this is great for you</h4>
                  <p>{result.nourishment_note}</p>
                </div>
              )}
            </div>
          )}

          {/* Boosts */}
          {result.boosts?.length > 0 && (
            <>
              <h4 className="boosts-title">Optional boosts</h4>
              {result.boosts.map((boost, idx) => (
                <div key={idx} className="recipe-card boost-card">
                  <strong>{boost.name}</strong>
                  <p>{boost.description}</p>
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
