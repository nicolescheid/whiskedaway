import { useState } from 'react';
import { Link } from 'react-router-dom';
import './CravingsDecoded.css';

import { genieFetch } from '../lib/genie';

export default function CravingsDecoded() {
  // Form state
  const [cravingText, setCravingText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [contextTags, setContextTags] = useState([]);
  const [locale, setLocale] = useState('NZ');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedRecipe, setExpandedRecipe] = useState(null);

  const cravingTags = [
    { id: 'chocolate', label: '🍫 Chocolate' },
    { id: 'salty', label: '🧂 Salty/Crunchy' },
    { id: 'sweet', label: '🍬 Sweet' },
    { id: 'carbs', label: '🍞 Carbs' },
    { id: 'cheese', label: '🧀 Cheese' },
    { id: 'meat', label: '🥩 Red meat' },
    { id: 'ice', label: '🧊 Ice' },
    { id: 'fizzy', label: '🥤 Fizzy' },
    { id: 'spicy', label: '🌶️ Spicy' },
    { id: 'creamy', label: '🍦 Creamy' },
  ];

  const contextOptions = [
    { id: 'stressed', label: 'Stressed' },
    { id: 'tired', label: 'Tired' },
    { id: 'menstrual', label: 'Menstrual' },
    { id: 'post-exercise', label: 'Post-exercise' },
    { id: 'skipped-meal', label: 'Skipped a meal' },
    { id: 'emotional', label: 'Emotional' },
    { id: 'pregnant', label: 'Pregnant' },
    { id: 'bored', label: 'Bored' },
  ];

  const toggleTag = (tagId, setFn, currentTags) => {
    setFn(currentTags.includes(tagId) 
      ? currentTags.filter(t => t !== tagId)
      : [...currentTags, tagId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      tome_id: 'cravings-decoded',
      locale,
      craving_text: cravingText,
      craving_tags: selectedTags,
      context: contextTags
    };

    try {
      const response = await genieFetch('/', payload);

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      
      const data = await response.json();
      setResult(data);
      setExpandedRecipe(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verdictColors = {
    honor: 'var(--herb)',
    redirect: 'var(--amber)',
    caution: 'var(--danger)'
  };

  return (
    <div className="tome-container cravings-theme">
      {/* Header */}
      <header className="tome-header">
        <Link to="/" className="back-link">← Back to Gemma</Link>
        <div className="tome-sigil">🔮</div>
        <h1 className="tome-title">Cravings Decoded</h1>
        <p className="tome-subtitle">What's your body really asking for?</p>
      </header>

      {/* Gemma's greeting */}
      <div className="gemma-message tome-themed">
        <span className="avatar">🧞‍♀️</span>
        <p>"Cravings aren't random — they're your body trying to tell you something. Let's figure out what's behind yours and find something that truly satisfies. 🔮✨"</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="intake-form">
        
        {/* Craving Description */}
        <section className="form-section">
          <h2><span className="icon">🔮</span> What are you craving?</h2>
          <p className="helper-text">Describe it in your own words, or tap the tags below</p>
          
          <textarea
            value={cravingText}
            onChange={(e) => setCravingText(e.target.value)}
            placeholder="e.g., I can't stop thinking about crunchy, salty chips..."
            rows={3}
          />

          <div className="craving-tags">
            {cravingTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                className={`craving-tag ${selectedTags.includes(tag.id) ? 'selected' : ''}`}
                onClick={() => toggleTag(tag.id, setSelectedTags, selectedTags)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </section>

        {/* Context */}
        <section className="form-section">
          <h2><span className="icon">💭</span> What's going on?</h2>
          <p className="helper-text">Any of these apply? (optional)</p>
          
          <div className="context-tags">
            {contextOptions.map(ctx => (
              <button
                key={ctx.id}
                type="button"
                className={`context-tag ${contextTags.includes(ctx.id) ? 'selected' : ''}`}
                onClick={() => toggleTag(ctx.id, setContextTags, contextTags)}
              >
                {ctx.label}
              </button>
            ))}
          </div>
        </section>

        {/* Location */}
        <section className="form-section">
          <h2><span className="icon">📍</span> Your location</h2>
          <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="NZ">New Zealand</option>
            <option value="AU">Australia</option>
            <option value="UK">United Kingdom</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </section>

        {/* Submit */}
        <div className="conjure-section">
          <button 
            type="submit" 
            className={`btn-primary ${loading ? 'loading' : ''}`}
            disabled={loading || (!cravingText && selectedTags.length === 0)}
            data-loading-text="Reading the signs... 🔮"
          >
            🔮 Decode My Craving
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
          {/* Insight Card */}
          {result.insight && (
            <div className="insight-card">
              <h3>{result.insight.title}</h3>
              <p className="insight-explanation">{result.insight.explanation}</p>
              
              <div 
                className="insight-verdict"
                style={{ borderColor: verdictColors[result.insight.verdict] }}
              >
                <span className="verdict-label">
                  {result.insight.verdict === 'honor' && '✓ Honor it'}
                  {result.insight.verdict === 'redirect' && '↻ Redirect'}
                  {result.insight.verdict === 'caution' && '⚠ Pause & consider'}
                </span>
              </div>

              <div className="what-body-wants">
                <strong>What your body might actually want:</strong>
                <p>{result.insight.what_body_wants}</p>
              </div>
            </div>
          )}

          {/* Recipe Suggestions */}
          {result.recipes?.length > 0 && (
            <div className="recipe-suggestions">
              <h4>Try these instead (or alongside!)</h4>
              
              {result.recipes.map((recipe, idx) => (
                <div 
                  key={idx} 
                  className={`recipe-card ${expandedRecipe === idx ? 'expanded' : ''}`}
                >
                  <button
                    type="button"
                    className="recipe-header"
                    onClick={() => setExpandedRecipe(expandedRecipe === idx ? null : idx)}
                  >
                    <span className="recipe-emoji">{recipe.emoji}</span>
                    <div className="recipe-info">
                      <strong>{recipe.name}</strong>
                      <p>{recipe.teaser}</p>
                    </div>
                    <span className="expand-icon">
                      {expandedRecipe === idx ? '−' : '+'}
                    </span>
                  </button>

                  {expandedRecipe === idx && (
                    <div className="recipe-details">
                      <p className="why-it-works">
                        <strong>Why it works:</strong> {recipe.why_it_works}
                      </p>
                      
                      <h5>Ingredients</h5>
                      <ul>
                        {recipe.ingredients?.map((ing, i) => (
                          <li key={i}>{ing}</li>
                        ))}
                      </ul>
                      
                      <h5>Quick steps</h5>
                      <ol>
                        {recipe.steps?.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
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
