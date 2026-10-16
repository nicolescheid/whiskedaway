import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import KitchenController from './KitchenController';
import useKitchenSubmit from './useKitchenSubmit';
import OverlayPanel from '../overlays/OverlayPanel';
import ResultsOverlay from '../overlays/ResultsOverlay';
import { DietaryOptions, PantryInput, ShoppingScroll, NourishmentHighlights } from '../components';
import Cuddlecore from '../pages/Cuddlecore';

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

export default function CuddlecoreController() {
  const { getDietaryDefaults, getPantryHistory, getPreferredLocale, getPreferredSourcing, trackOptionSelect, trackDietarySet, trackPantryAdd, trackLocaleSet } = useProfile();

  // Form state — pre-populated from profile
  const [symptoms, setSymptoms] = useState([]);
  const [freeformSymptoms, setFreeformSymptoms] = useState('');
  const [energyLevel, setEnergyLevel] = useState(1);
  const [dietaryData, setDietaryData] = useState(() => getDietaryDefaults());
  const [pantryItems, setPantryItems] = useState(() => getPantryHistory().slice(0, 5));
  const [locale, setLocale] = useState(() => getPreferredLocale());
  const [sourcingPref, setSourcingPref] = useState(() => getPreferredSourcing());
  const [showResults, setShowResults] = useState(false);

  const { loading, result, error, submit } = useKitchenSubmit('cuddlecore');

  const handleSubmit = useCallback(async () => {
    const payload = {
      tome_id: 'cuddlecore',
      locale,
      symptoms,
      freeform_symptoms: freeformSymptoms,
      energy_level: energyLevel,
      pantry_ingredients: pantryItems,
      dietary_restrictions: dietaryData.dietary,
      allergies: dietaryData.allergies.split(',').map(s => s.trim()).filter(Boolean),
      sourcing_preference: sourcingPref,
    };

    const data = await submit(payload);
    if (data) setShowResults(true);
  }, [locale, symptoms, freeformSymptoms, energyLevel, pantryItems, dietaryData, sourcingPref, submit]);

  const toggleSymptom = (symptomId) => {
    setSymptoms(prev => {
      const next = prev.includes(symptomId) ? prev.filter(s => s !== symptomId) : [...prev, symptomId];
      trackOptionSelect('cuddlecore', 'symptoms', next);
      return next;
    });
  };

  const handleAddToPantry = (item) => {
    if (!pantryItems.includes(item.toLowerCase())) {
      setPantryItems(prev => [...prev, item.toLowerCase()]);
      return true;
    }
    return false;
  };

  // Collect all ingredients from all tiers for ShoppingScroll
  const allIngredients = result?.recipes
    ? result.recipes.flatMap(r => r.ingredients || [])
    : [];

  const overlayContent = (
    <>
      {/* Symptoms overlay */}
      <OverlayPanel overlayId="symptoms" title="How are you feeling?" icon="🫙">
        <div className="form-section">
          <div className="option-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {symptomOptions.map(opt => (
              <label key={opt.id} className={`option-item ${symptoms.includes(opt.id) ? 'selected' : ''}`}
                style={{ cursor: 'pointer', padding: '10px', borderRadius: '8px', border: `2px solid ${symptoms.includes(opt.id) ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: symptoms.includes(opt.id) ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', textAlign: 'center', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={symptoms.includes(opt.id)} onChange={() => toggleSymptom(opt.id)} style={{ display: 'none' }} />
                <span style={{ fontSize: '1.3rem' }}>{opt.icon}</span>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', marginTop: '4px' }}>{opt.label}</div>
              </label>
            ))}
          </div>
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-soft)' }}>
              Anything else?
            </label>
            <textarea
              value={freeformSymptoms}
              onChange={(e) => setFreeformSymptoms(e.target.value)}
              placeholder="Describe how you're feeling..."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--parchment-dark)', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', resize: 'vertical', minHeight: '60px', marginTop: '6px' }}
            />
          </div>
        </div>
      </OverlayPanel>

      {/* Energy overlay */}
      <OverlayPanel overlayId="energy" title="Energy Level" icon="🕯️">
        <div className="form-section">
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: 'var(--ink-soft)', marginBottom: '16px' }}>
            How many spoons do you have today?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {energyLabels.map((label, i) => (
              <label key={i}
                style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px', border: `2px solid ${energyLevel === i ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: energyLevel === i ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', transition: 'all 0.2s' }}>
                <input type="radio" name="energy" checked={energyLevel === i} onChange={() => { setEnergyLevel(i); trackOptionSelect('cuddlecore', 'energy_level', i); }} style={{ display: 'none' }} />
                {'🕯️'.repeat(i + 1)} {label}
              </label>
            ))}
          </div>
        </div>
      </OverlayPanel>

      {/* Dietary overlay */}
      <OverlayPanel overlayId="dietary" title="Dietary Needs" icon="📋">
        <DietaryOptions
          options={[{ id: 'low-fodmap', label: 'Low-FODMAP', value: 'low-fodmap' }]}
          showReligious={true}
          onChange={(data) => { setDietaryData(data); trackDietarySet(data); }}
        />
      </OverlayPanel>

      {/* Pantry overlay */}
      <OverlayPanel overlayId="pantry" title="Your Pantry" icon="🗄️">
        <PantryInput
          placeholder="e.g., chicken broth, ginger, honey"
          helperText="What do you have on hand? Gemma will work with it."
          onChange={(items) => { setPantryItems(items); trackPantryAdd(items); }}
          initialItems={pantryItems}
        />
      </OverlayPanel>

      {/* Locale overlay */}
      <OverlayPanel overlayId="locale" title="Shopping Location" icon="🗺️">
        <div className="form-section">
          <select value={locale} onChange={(e) => { setLocale(e.target.value); trackLocaleSet(e.target.value); }}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--parchment-dark)', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem' }}>
            <option value="NZ">New Zealand</option>
            <option value="AU">Australia</option>
            <option value="UK">United Kingdom</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Sourcing</p>
            {['supermarket_only', 'specialty_ok'].map(val => (
              <label key={val} style={{ display: 'block', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: `2px solid ${sourcingPref === val ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: sourcingPref === val ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', marginBottom: '6px', fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                <input type="radio" name="sourcing" checked={sourcingPref === val} onChange={() => { setSourcingPref(val); trackOptionSelect('cuddlecore', 'sourcing_preference', val); }} style={{ display: 'none' }} />
                {val === 'supermarket_only' ? '🛒 Supermarket only' : '✨ Specialty stores OK'}
              </label>
            ))}
          </div>
        </div>
      </OverlayPanel>
    </>
  );

  const resultContent = (
    <ResultsOverlay
      isOpen={showResults && !!result}
      onClose={() => setShowResults(false)}
      title="Comfort Recipe"
      icon="🍵"
    >
      {error && <p className="error-message">{error}</p>}
      {result && (
        <div style={{ '--tome-accent': 'var(--berry)' }}>
          {result.safety_banner && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid var(--danger)', marginBottom: '16px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: 'var(--danger)' }}>
              {result.safety_banner}
            </div>
          )}

          {result.nourishment_highlights && (
            <NourishmentHighlights highlights={result.nourishment_highlights} onAddToPantry={handleAddToPantry} />
          )}

          {result.recipes?.map((recipe, idx) => (
            <div key={idx} className="recipe-card" style={{ margin: '16px 0', padding: '16px', borderRadius: '10px', border: '1px solid var(--parchment-dark)', background: 'var(--parchment)' }}>
              <h4 style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', margin: '0 0 8px' }}>
                {recipe.name}
              </h4>
              {recipe.description && <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: '0.9rem', margin: '0 0 12px' }}>{recipe.description}</p>}
              {recipe.steps && (
                <ol className="steps-list" style={{ paddingLeft: '20px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
                  {recipe.steps.map((step, i) => <li key={i} style={{ marginBottom: '6px' }}>{step}</li>)}
                </ol>
              )}
              {recipe.alternative && (
                <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: 'var(--ink-soft)', fontStyle: 'italic', marginTop: '8px' }}>
                  Alternative: {recipe.alternative}
                </p>
              )}
            </div>
          ))}

          {result.avoid_list?.length > 0 && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', marginTop: '12px' }}>
              <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 6px' }}>Foods to avoid right now:</p>
              <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', margin: 0, color: 'var(--ink-soft)' }}>{result.avoid_list.join(', ')}</p>
            </div>
          )}

          {allIngredients.length > 0 && (
            <ShoppingScroll
              ingredients={allIngredients}
              locale={locale}
              recipeName={result.recipes?.[0]?.name || 'Comfort Recipe'}
              tomeEmoji="🍵"
              tomeName="Cuddlecore"
              accentColor={[139, 77, 92]}
            />
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
      sceneId="cuddlecore"
      onSubmit={handleSubmit}
      overlayContent={overlayContent}
      resultContent={resultContent}
      quickModeContent={<Cuddlecore />}
    />
  );
}
