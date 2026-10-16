import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import KitchenController from './KitchenController';
import useKitchenSubmit from './useKitchenSubmit';
import OverlayPanel from '../overlays/OverlayPanel';
import ResultsOverlay from '../overlays/ResultsOverlay';
import { DietaryOptions, PantryInput, ShoppingScroll, NourishmentHighlights } from '../components';
import Flourish from '../pages/Flourish';

const goalOptions = [
  { id: 'energy', icon: '⚡', label: 'Energy' },
  { id: 'strength', icon: '💪', label: 'Strength' },
  { id: 'clarity', icon: '🧠', label: 'Clarity' },
  { id: 'glow', icon: '✨', label: 'Glow' },
  { id: 'gut', icon: '🌿', label: 'Gut health' },
  { id: 'balance', icon: '☯️', label: 'Balance' },
];

const mealOptions = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
  { id: 'meal-prep', label: 'Meal prep' },
];

const effortLabels = ['5 mins', '15 mins', '25 mins', '35 mins', '45+ mins'];

export default function FlourishController() {
  const { getDietaryDefaults, getPantryHistory, getPreferredLocale, getPreferredSourcing, trackOptionSelect, trackDietarySet, trackPantryAdd, trackLocaleSet } = useProfile();

  const [goal, setGoal] = useState('');
  const [mealType, setMealType] = useState('');
  const [effortLevel, setEffortLevel] = useState(2);
  const [dietaryData, setDietaryData] = useState(() => getDietaryDefaults());
  const [pantryItems, setPantryItems] = useState(() => getPantryHistory().slice(0, 5));
  const [locale, setLocale] = useState(() => getPreferredLocale());
  const [sourcingPref, setSourcingPref] = useState(() => getPreferredSourcing());
  const [showResults, setShowResults] = useState(false);

  const { loading, result, error, submit } = useKitchenSubmit('flourish');

  const handleSubmit = useCallback(async () => {
    const payload = {
      tome_id: 'flourish',
      locale,
      goal,
      meal_type: mealType,
      effort_level: effortLevel,
      pantry_ingredients: pantryItems,
      dietary_restrictions: dietaryData.dietary,
      allergies: dietaryData.allergies.split(',').map(s => s.trim()).filter(Boolean),
      sourcing_preference: sourcingPref,
    };
    const data = await submit(payload);
    if (data) setShowResults(true);
  }, [locale, goal, mealType, effortLevel, pantryItems, dietaryData, sourcingPref, submit]);

  const handleAddToPantry = (item) => {
    if (!pantryItems.includes(item.toLowerCase())) {
      setPantryItems(prev => [...prev, item.toLowerCase()]);
      return true;
    }
    return false;
  };

  const overlayContent = (
    <>
      <OverlayPanel overlayId="goal" title="Your Goal" icon="🎯">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {goalOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '14px', borderRadius: '8px', border: `2px solid ${goal === opt.id ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: goal === opt.id ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', textAlign: 'center', transition: 'all 0.2s' }}>
              <input type="radio" name="goal" checked={goal === opt.id} onChange={() => { setGoal(opt.id); trackOptionSelect('flourish', 'goal', opt.id); }} style={{ display: 'none' }} />
              <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', marginTop: '4px', fontWeight: 600 }}>{opt.label}</div>
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="mealType" title="Meal Type" icon="🕐">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mealOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px', border: `2px solid ${mealType === opt.id ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: mealType === opt.id ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', transition: 'all 0.2s' }}>
              <input type="radio" name="mealType" checked={mealType === opt.id} onChange={() => { setMealType(opt.id); trackOptionSelect('flourish', 'meal_type', opt.id); }} style={{ display: 'none' }} />
              {opt.label}
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="effort" title="Effort Level" icon="⏳">
        <div style={{ padding: '12px 0' }}>
          <input type="range" min="0" max="4" value={effortLevel}
            onChange={(e) => { setEffortLevel(Number(e.target.value)); trackOptionSelect('flourish', 'effort_level', Number(e.target.value)); }}
            style={{ width: '100%', accentColor: 'var(--tome-accent, var(--golden))' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Quicksand, sans-serif', fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '8px' }}>
            <span>Quick</span>
            <span>Worth it</span>
          </div>
          <p style={{ textAlign: 'center', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>
            {effortLabels[effortLevel]}
          </p>
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="dietary" title="Dietary Needs" icon="📋">
        <DietaryOptions
          options={[
            { id: 'keto-friendly', label: 'Keto-friendly', value: 'keto-friendly' },
            { id: 'high-protein', label: 'High-protein', value: 'high-protein' },
          ]}
          showReligious={true}
          onChange={(data) => { setDietaryData(data); trackDietarySet(data); }}
        />
      </OverlayPanel>

      <OverlayPanel overlayId="pantry" title="Your Pantry" icon="🗄️">
        <PantryInput
          placeholder="e.g., salmon, spinach, quinoa"
          helperText="Add ingredients you have — Gemma will build around them."
          onChange={(items) => { setPantryItems(items); trackPantryAdd(items); }}
          initialItems={pantryItems}
        />
      </OverlayPanel>

      <OverlayPanel overlayId="locale" title="Shopping Location" icon="🗺️">
        <div className="form-section">
          <select value={locale} onChange={(e) => { setLocale(e.target.value); trackLocaleSet(e.target.value); }}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--parchment-dark)', fontFamily: 'Quicksand, sans-serif' }}>
            <option value="NZ">New Zealand</option>
            <option value="AU">Australia</option>
            <option value="UK">United Kingdom</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
          <div style={{ marginTop: '12px' }}>
            {['supermarket_only', 'specialty_ok'].map(val => (
              <label key={val} style={{ display: 'block', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: `2px solid ${sourcingPref === val ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: sourcingPref === val ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', marginBottom: '6px', fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                <input type="radio" name="sourcing" checked={sourcingPref === val} onChange={() => { setSourcingPref(val); trackOptionSelect('flourish', 'sourcing_preference', val); }} style={{ display: 'none' }} />
                {val === 'supermarket_only' ? '🛒 Supermarket only' : '✨ Specialty stores OK'}
              </label>
            ))}
          </div>
        </div>
      </OverlayPanel>
    </>
  );

  const resultContent = (
    <ResultsOverlay isOpen={showResults && !!result} onClose={() => setShowResults(false)} title="Your Flourish Meal" icon="🌱">
      {error && <p className="error-message">{error}</p>}
      {result && (
        <div style={{ '--tome-accent': 'var(--golden)' }}>
          {result.nourishment_highlights && (
            <NourishmentHighlights highlights={result.nourishment_highlights} onAddToPantry={handleAddToPantry} />
          )}
          {result.recipe && (
            <div className="recipe-card" style={{ margin: '16px 0', padding: '16px', borderRadius: '10px', border: '1px solid var(--parchment-dark)' }}>
              <h4 style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', margin: '0 0 8px' }}>{result.recipe.name}</h4>
              {result.recipe.description && <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: '0.9rem', margin: '0 0 12px' }}>{result.recipe.description}</p>}
              {result.recipe.steps && (
                <ol style={{ paddingLeft: '20px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
                  {result.recipe.steps.map((step, i) => <li key={i} style={{ marginBottom: '6px' }}>{step}</li>)}
                </ol>
              )}
            </div>
          )}
          {result.boosts?.length > 0 && (
            <div style={{ margin: '12px 0' }}>
              <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Boosts:</p>
              {result.boosts.map((b, i) => (
                <div key={i} style={{ padding: '8px', borderRadius: '6px', background: 'color-mix(in srgb, var(--golden) 8%, transparent)', marginBottom: '4px', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem' }}>
                  <strong>{b.name}</strong> — {b.description}
                </div>
              ))}
            </div>
          )}
          {result.recipe?.ingredients && (
            <ShoppingScroll ingredients={result.recipe.ingredients} locale={locale} recipeName={result.recipe.name} tomeEmoji="🌱" tomeName="Flourish" accentColor={[212, 168, 75]} />
          )}
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
      sceneId="flourish"
      onSubmit={handleSubmit}
      overlayContent={overlayContent}
      resultContent={resultContent}
      quickModeContent={<Flourish />}
    />
  );
}
