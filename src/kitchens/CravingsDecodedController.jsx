import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import KitchenController from './KitchenController';
import useKitchenSubmit from './useKitchenSubmit';
import OverlayPanel from '../overlays/OverlayPanel';
import ResultsOverlay from '../overlays/ResultsOverlay';
import CravingsDecoded from '../pages/CravingsDecoded';

const cravingTagOptions = [
  { id: 'chocolate', label: '🍫 Chocolate' },
  { id: 'salty', label: '🧂 Salty' },
  { id: 'sweet', label: '🍯 Sweet' },
  { id: 'carbs', label: '🍞 Carbs' },
  { id: 'cheese', label: '🧀 Cheese' },
  { id: 'meat', label: '🥩 Meat' },
  { id: 'ice', label: '🧊 Ice' },
  { id: 'fizzy', label: '🥤 Fizzy' },
  { id: 'spicy', label: '🌶️ Spicy' },
  { id: 'creamy', label: '🍦 Creamy' },
];

const contextOptions = [
  { id: 'stressed', label: '😰 Stressed' },
  { id: 'tired', label: '😴 Tired' },
  { id: 'menstrual', label: '🌙 Menstrual' },
  { id: 'post-exercise', label: '🏋️ Post-exercise' },
  { id: 'skipped-meal', label: '⏭️ Skipped meal' },
  { id: 'emotional', label: '💭 Emotional' },
  { id: 'pregnant', label: '🤰 Pregnant' },
  { id: 'bored', label: '😐 Bored' },
];

const verdictColors = { honor: 'var(--herb)', redirect: 'var(--golden)', caution: 'var(--danger)' };

export default function CravingsDecodedController() {
  const { getPreferredLocale, trackOptionSelect, trackLocaleSet } = useProfile();

  const [cravingText, setCravingText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [contextTags, setContextTags] = useState([]);
  const [locale, setLocale] = useState(() => getPreferredLocale());
  const [showResults, setShowResults] = useState(false);
  const [expandedRecipe, setExpandedRecipe] = useState(null);

  const { loading, result, error, submit } = useKitchenSubmit('cravings');

  const handleSubmit = useCallback(async () => {
    const payload = {
      tome_id: 'cravings-decoded',
      locale,
      craving_text: cravingText,
      craving_tags: selectedTags,
      context: contextTags,
    };
    const data = await submit(payload);
    if (data) setShowResults(true);
  }, [locale, cravingText, selectedTags, contextTags, submit]);

  const toggleTag = (arr, setArr, field, id) => {
    setArr(prev => {
      const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      trackOptionSelect('cravings', field, next);
      return next;
    });
  };

  const overlayContent = (
    <>
      <OverlayPanel overlayId="cravingInput" title="Describe Your Craving" icon="🔮">
        <textarea
          value={cravingText}
          onChange={(e) => setCravingText(e.target.value)}
          placeholder="What are you craving? Be as specific as you like..."
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--parchment-dark)', fontFamily: 'Crimson Pro, serif', fontSize: '1rem', resize: 'vertical', minHeight: '120px' }}
        />
      </OverlayPanel>

      <OverlayPanel overlayId="cravingTags" title="Craving Type" icon="🏷️">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {cravingTagOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '10px', borderRadius: '8px', border: `2px solid ${selectedTags.includes(opt.id) ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: selectedTags.includes(opt.id) ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', textAlign: 'center', transition: 'all 0.2s' }}>
              <input type="checkbox" checked={selectedTags.includes(opt.id)} onChange={() => toggleTag(selectedTags, setSelectedTags, 'craving_tags', opt.id)} style={{ display: 'none' }} />
              {opt.label}
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="context" title="What's Happening" icon="🏮">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {contextOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '10px', borderRadius: '8px', border: `2px solid ${contextTags.includes(opt.id) ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: contextTags.includes(opt.id) ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', textAlign: 'center', transition: 'all 0.2s' }}>
              <input type="checkbox" checked={contextTags.includes(opt.id)} onChange={() => toggleTag(contextTags, setContextTags, 'context', opt.id)} style={{ display: 'none' }} />
              {opt.label}
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="locale" title="Location" icon="🗺️">
        <select value={locale} onChange={(e) => { setLocale(e.target.value); trackLocaleSet(e.target.value); }}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--parchment-dark)', fontFamily: 'Quicksand, sans-serif' }}>
          <option value="NZ">New Zealand</option>
          <option value="AU">Australia</option>
          <option value="UK">United Kingdom</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
      </OverlayPanel>
    </>
  );

  const resultContent = (
    <ResultsOverlay isOpen={showResults && !!result} onClose={() => setShowResults(false)} title="Craving Decoded" icon="🔮">
      {error && <p className="error-message">{error}</p>}
      {result && (
        <div style={{ '--tome-accent': 'var(--purple)' }}>
          {result.insight && (
            <div style={{ padding: '16px', borderRadius: '10px', border: `2px solid ${verdictColors[result.insight.verdict] || 'var(--parchment-dark)'}`, marginBottom: '16px' }}>
              <h4 style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', margin: '0 0 8px' }}>{result.insight.title}</h4>
              <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', margin: '0 0 8px' }}>{result.insight.explanation}</p>
              {result.insight.what_body_wants && (
                <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--herb)' }}>
                  What your body actually wants: {result.insight.what_body_wants}
                </p>
              )}
            </div>
          )}

          {result.recipes?.map((recipe, idx) => (
            <div key={idx} style={{ margin: '8px 0', borderRadius: '8px', border: '1px solid var(--parchment-dark)', overflow: 'hidden' }}>
              <button onClick={() => setExpandedRecipe(expandedRecipe === idx ? null : idx)}
                style={{ width: '100%', padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', fontWeight: 600, textAlign: 'left' }}>
                <span>{recipe.emoji}</span> {recipe.name}
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{expandedRecipe === idx ? '▲' : '▼'}</span>
              </button>
              {expandedRecipe === idx && (
                <div style={{ padding: '0 12px 12px' }}>
                  {recipe.teaser && <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{recipe.teaser}</p>}
                  {recipe.why_it_works && <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem' }}><strong>Why:</strong> {recipe.why_it_works}</p>}
                  {recipe.ingredients && (
                    <div>
                      <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.8rem', fontWeight: 600 }}>Ingredients:</p>
                      <ul style={{ paddingLeft: '18px', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem' }}>
                        {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                      </ul>
                    </div>
                  )}
                  {recipe.steps && (
                    <ol style={{ paddingLeft: '18px', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem' }}>
                      {recipe.steps.map((step, i) => <li key={i} style={{ marginBottom: '4px' }}>{step}</li>)}
                    </ol>
                  )}
                </div>
              )}
            </div>
          ))}

          {result.gemma_note && (
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.9rem' }}>
              🧞‍♀️ {result.gemma_note}
            </div>
          )}
        </div>
      )}
    </ResultsOverlay>
  );

  return (
    <KitchenController
      sceneId="cravings"
      onSubmit={handleSubmit}
      overlayContent={overlayContent}
      resultContent={resultContent}
      quickModeContent={<CravingsDecoded />}
    />
  );
}
