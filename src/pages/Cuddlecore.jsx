import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  DietaryOptions, 
  PantryInput, 
  ShoppingScroll, 
  NourishmentHighlights 
} from '../components';
import './Cuddlecore.css';

const WORKER_URL = 'https://whiskedaway-genie.nicole-scheid.workers.dev';

export default function Cuddlecore() {
  // Form state
  const [symptoms, setSymptoms] = useState([]);
  const [freeformSymptoms, setFreeformSymptoms] = useState('');
  const [energyLevel, setEnergyLevel] = useState(1);
  const [dietaryData, setDietaryData] = useState({ dietary: [], allergies: '' });
  const [pantryItems, setPantryItems] = useState([]);
  const [locale, setLocale] = useState('NZ');
  const [sourcingPref, setSourcingPref] = useState('supermarket_only');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const symptomOptions = [
    { id: 'nausea', icon: '🤢', label: 'Nausea' },
    { id: 'sore-throat', icon: '😮‍💨', label: 'Sore throat' },
    { id: 'fatigue', icon: '😴', label: 'Exhaustion' },
    { id: 'cold', icon: '🥶', label: 'Cold/chills' },
    { id: 'headache', icon: '🤕', label: 'Headache' },
    { id: 'sad', icon: '😢', label: 'Feeling low' },
    { id: 'stomach', icon: '🫃', label: 'Upset stomach' },
    { id: 'congestion', icon: '🤧', label: 'Congested' },
  ];

  const energyLabels = ['Zero spoons', 'One spoon', 'A few spoons'];

  const toggleSymptom = (symptomId) => {
    setSymptoms(prev => 
      prev.includes(symptomId) 
        ? prev.filter(s => s !== symptomId)
        : [...prev, symptomId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      tome_id: 'cuddlecore',
      locale,
      symptoms: symptoms,
      freeform_symptoms: freeformSymptoms,
      energy_level: energyLevel,
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

  const getTierLabel = (tier) => {
    const labels = { 0: 'Zero effort', 1: 'Minimal effort', 2: 'Some effort' };
    return labels[tier] || '';
  };

  // Collect all ingredients from all recipes for shopping scroll
  const getAllIngredients = () => {
    if (!result?.recipes) return [];
    const ingredientMap = new Map();
    result.recipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        const key = ing.canonical_name || ing.display_name.toLowerCase();
        if (!ingredientMap.has(key)) {
          ingredientMap.set(key, ing);
        }
      });
    });
    return Array.from(ingredientMap.values());
  };

  return (
    <div className="tome-container cuddlecore-theme">
      {/* Header */}
      <header className="tome-header">
        <Link to="/" className="back-link">← Back to Gemma</Link>
        <div className="tome-sigil">🍵</div>
        <h1 className="tome-title">Cuddlecore Care</h1>
        <p className="tome-subtitle">Gentle nourishment when you need it most</p>
      </header>

      {/* Gemma's greeting */}
      <div className="gemma-message tome-themed">
        <span className="avatar">🧞‍♀️</span>
        <p>"Oh lovely, you're not feeling great? Let's get you sorted. Tell me what's going on and I'll find something gentle that might help. No pressure, no complicated recipes — just comfort. 💛"</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="intake-form">
        
        {/* Symptoms */}
        <section className="form-section">
          <h2><span className="icon">🩺</span> What's going on?</h2>
          <p className="helper-text">Select all that apply</p>
          
          <div className="symptom-grid">
            {symptomOptions.map(s => (
              <label 
                key={s.id} 
                className={`symptom-card ${symptoms.includes(s.id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={symptoms.includes(s.id)}
                  onChange={() => toggleSymptom(s.id)}
                />
                <span className="symptom-icon">{s.icon}</span>
                <span className="symptom-label">{s.label}</span>
              </label>
            ))}
          </div>

          <label htmlFor="freeform" style={{ marginTop: '1rem' }}>
            Anything else?
          </label>
          <textarea
            id="freeform"
            value={freeformSymptoms}
            onChange={(e) => setFreeformSymptoms(e.target.value)}
            placeholder="Tell Gemma more... recovering from surgery, morning sickness, just need comfort..."
            rows={3}
          />
        </section>

        {/* Energy Level */}
        <section className="form-section">
          <h2><span className="icon">🥄</span> Energy level</h2>
          <p className="helper-text">How many spoons do you have today?</p>
          
          <div className="spoon-selector">
            {[0, 1, 2].map(level => (
              <label 
                key={level} 
                className={`spoon-option ${energyLevel === level ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="energy"
                  checked={energyLevel === level}
                  onChange={() => setEnergyLevel(level)}
                />
                <span className="spoon-icons">
                  {level === 0 && '🥄'}
                  {level === 1 && '🥄🥄'}
                  {level === 2 && '🥄🥄🥄'}
                </span>
                <span className="spoon-label">{energyLabels[level]}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Dietary Options - REUSABLE COMPONENT */}
        <DietaryOptions
          options={[
            { id: 'low-fodmap', label: 'Low-FODMAP', value: 'low-fodmap' },
          ]}
          onChange={setDietaryData}
        />

        {/* Pantry Input - REUSABLE COMPONENT */}
        <PantryInput
          placeholder="e.g., chicken broth, rice, ginger (commas to add multiple)"
          helperText="Add ingredients you have on hand — Gemma will try to work with what you've got"
          onChange={setPantryItems}
        />

        {/* Location & Sourcing */}
        <section className="form-section">
          <h2><span className="icon">🛒</span> Where are you shopping?</h2>
          <p className="helper-text">Or where someone can shop for you</p>
          
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
            data-loading-text="Gemma's preparing something gentle... 💛"
          >
            🍵 Find Comfort
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
          {/* Safety Banner */}
          {result.safety_banner && (
            <div className="safety-banner">
              <p>{result.safety_banner}</p>
            </div>
          )}

          {/* Nourishment Highlights - REUSABLE */}
          <NourishmentHighlights 
            highlights={result.nourishment_highlights}
            onAddToPantry={handleAddToPantry}
          />

          {/* Recipe Cards */}
          {result.recipes?.map((recipe, idx) => (
            <div key={idx} className="recipe-card">
              <span className="recipe-tier">Tier {recipe.tier} — {getTierLabel(recipe.tier)}</span>
              <h3>{recipe.name}</h3>
              <p className="recipe-description">{recipe.description}</p>

              <h4 className="recipe-section-title">Ingredients</h4>
              <ul className="ingredients-list">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.amount} {ing.unit} {ing.display_name}
                    {ing.notes && <em> ({ing.notes})</em>}
                  </li>
                ))}
              </ul>

              <h4 className="recipe-section-title">Steps</h4>
              <ol className="steps-list">
                {recipe.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>

              {recipe.alternative && (
                <div className="alternative-box">
                  <h4>If this sounds awful right now…</h4>
                  <p>{recipe.alternative}</p>
                </div>
              )}
            </div>
          ))}

          {/* Shopping Scroll - REUSABLE */}
          {result.recipes?.length > 0 && (
            <ShoppingScroll
              ingredients={getAllIngredients()}
              locale={locale}
              recipeName="Cuddlecore Recipes"
              tomeEmoji="🍵"
              tomeName="Cuddlecore"
              accentColor={[139, 77, 92]}
            />
          )}

          {/* Avoid List */}
          {result.avoid_list?.length > 0 && (
            <div className="avoid-list">
              <h4>Things that might not help right now</h4>
              <p>{result.avoid_list.join(', ')}</p>
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
          Gemma offers comfort and ideas — never medical advice. Please see a healthcare professional if you're unwell.{' '}
          <a href="https://ko-fi.com/whiskedaway" target="_blank" rel="noopener noreferrer">
            Support WhiskedAway
          </a> ☕
        </p>
      </footer>
    </div>
  );
}
