import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import KitchenController from './KitchenController';
import useKitchenSubmit from './useKitchenSubmit';
import OverlayPanel from '../overlays/OverlayPanel';
import ResultsOverlay from '../overlays/ResultsOverlay';
import { DietaryOptions, PantryInput, ShoppingScroll, NourishmentHighlights } from '../components';
import Chiapothecary from '../pages/Chiapothecary';

const vibeOptions = [
  { id: 'energizing', icon: '⚡', label: 'Energizing' },
  { id: 'calming', icon: '🧘', label: 'Calming' },
  { id: 'indulgent', icon: '🍫', label: 'Indulgent' },
  { id: 'refreshing', icon: '🍃', label: 'Refreshing' },
  { id: 'warming', icon: '☕', label: 'Warming' },
  { id: 'tropical', icon: '🥥', label: 'Tropical' },
];

const baseOptions = [
  { id: 'creamy', label: '🥛 Creamy' },
  { id: 'light', label: '💧 Light' },
  { id: 'rich', label: '🍫 Rich' },
];

const textureLabels = ['Very thin', 'Pourable', 'Classic', 'Thick', 'Spoonable'];

export default function ChiapothecaryController() {
  const { getDietaryDefaults, getPantryHistory, getPreferredLocale, getPreferredSourcing, trackOptionSelect, trackDietarySet, trackPantryAdd, trackLocaleSet } = useProfile();

  const [vibe, setVibe] = useState('');
  const [basePreference, setBasePreference] = useState('');
  const [textureLevel, setTextureLevel] = useState(2);
  const [dietaryData, setDietaryData] = useState(() => getDietaryDefaults());
  const [pantryItems, setPantryItems] = useState(() => getPantryHistory().slice(0, 5));
  const [locale, setLocale] = useState(() => getPreferredLocale());
  const [sourcingPref, setSourcingPref] = useState(() => getPreferredSourcing());
  const [showResults, setShowResults] = useState(false);

  const { loading, result, error, submit } = useKitchenSubmit('chiapothecary');

  const handleSubmit = useCallback(async () => {
    const payload = {
      tome_id: 'chiapothecary',
      locale,
      vibe,
      base_preference: basePreference,
      texture_level: textureLevel,
      pantry_ingredients: pantryItems,
      dietary_restrictions: dietaryData.dietary,
      allergies: dietaryData.allergies.split(',').map(s => s.trim()).filter(Boolean),
      sourcing_preference: sourcingPref,
    };
    const data = await submit(payload);
    if (data) setShowResults(true);
  }, [locale, vibe, basePreference, textureLevel, pantryItems, dietaryData, sourcingPref, submit]);

  const overlayContent = (
    <>
      <OverlayPanel overlayId="vibe" title="Choose Your Vibe" icon="🧪">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {vibeOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '14px', borderRadius: '8px', border: `2px solid ${vibe === opt.id ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: vibe === opt.id ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', textAlign: 'center', transition: 'all 0.2s' }}>
              <input type="radio" name="vibe" checked={vibe === opt.id} onChange={() => { setVibe(opt.id); trackOptionSelect('chiapothecary', 'vibe', opt.id); }} style={{ display: 'none' }} />
              <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', marginTop: '4px', fontWeight: 600 }}>{opt.label}</div>
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="basePreference" title="Base Preference" icon="🥛">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {baseOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px', border: `2px solid ${basePreference === opt.id ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: basePreference === opt.id ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', transition: 'all 0.2s' }}>
              <input type="radio" name="base" checked={basePreference === opt.id} onChange={() => { setBasePreference(opt.id); trackOptionSelect('chiapothecary', 'base_preference', opt.id); }} style={{ display: 'none' }} />
              {opt.label}
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="texture" title="Texture Level" icon="⚗️">
        <div style={{ padding: '12px 0' }}>
          <input type="range" min="0" max="4" value={textureLevel}
            onChange={(e) => { setTextureLevel(Number(e.target.value)); trackOptionSelect('chiapothecary', 'texture_level', Number(e.target.value)); }}
            style={{ width: '100%', accentColor: 'var(--tome-accent, var(--herb))' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Quicksand, sans-serif', fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '8px' }}>
            <span>Very thin</span>
            <span>Spoonable</span>
          </div>
          <p style={{ textAlign: 'center', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>
            {textureLabels[textureLevel]}
          </p>
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="dietary" title="Dietary Needs" icon="📋">
        <DietaryOptions
          options={[
            { id: 'low-sugar', label: 'Low-sugar', value: 'low-sugar' },
            { id: 'nut-free', label: 'Nut-free', value: 'nut-free' },
          ]}
          showReligious={true}
          onChange={(data) => { setDietaryData(data); trackDietarySet(data); }}
        />
      </OverlayPanel>

      <OverlayPanel overlayId="pantry" title="Your Pantry" icon="🗄️">
        <PantryInput
          placeholder="e.g., coconut milk, blueberries, maple syrup"
          helperText="What do you have? Gemma will build around it."
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
                <input type="radio" name="sourcing" checked={sourcingPref === val} onChange={() => { setSourcingPref(val); trackOptionSelect('chiapothecary', 'sourcing_preference', val); }} style={{ display: 'none' }} />
                {val === 'supermarket_only' ? '🛒 Supermarket only' : '✨ Specialty stores OK'}
              </label>
            ))}
          </div>
        </div>
      </OverlayPanel>
    </>
  );

  const resultContent = (
    <ResultsOverlay isOpen={showResults && !!result} onClose={() => setShowResults(false)} title="Your Chia Pudding" icon="🧪">
      {error && <p className="error-message">{error}</p>}
      {result && (
        <div style={{ '--tome-accent': 'var(--herb)' }}>
          {result.nourishment_highlights && <NourishmentHighlights highlights={result.nourishment_highlights} />}
          {result.base_recipe && (
            <div className="recipe-card" style={{ margin: '16px 0', padding: '16px', borderRadius: '10px', border: '1px solid var(--parchment-dark)' }}>
              <h4 style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', margin: '0 0 8px' }}>{result.base_recipe.name}</h4>
              {result.base_recipe.description && <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: '0.9rem', margin: '0 0 12px' }}>{result.base_recipe.description}</p>}
              {result.base_recipe.steps && (
                <ol style={{ paddingLeft: '20px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
                  {result.base_recipe.steps.map((step, i) => <li key={i} style={{ marginBottom: '6px' }}>{step}</li>)}
                </ol>
              )}
            </div>
          )}
          {result.variations?.length > 0 && (
            <div>
              <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Variations:</p>
              {result.variations.map((v, i) => (
                <div key={i} style={{ padding: '8px', borderRadius: '6px', background: 'color-mix(in srgb, var(--herb) 8%, transparent)', marginBottom: '4px', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem' }}>
                  <strong>{v.name}</strong> — {v.description} {v.add && <span style={{ color: 'var(--ink-soft)' }}>(add: {v.add})</span>}
                </div>
              ))}
            </div>
          )}
          {result.texture_tips && (
            <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '8px' }}>
              Texture tip: {result.texture_tips}
            </p>
          )}
          {result.base_recipe?.ingredients && (
            <ShoppingScroll ingredients={result.base_recipe.ingredients} locale={locale} recipeName={result.base_recipe.name} tomeEmoji="🧪" tomeName="Chiapothecary" accentColor={[92, 124, 92]} />
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
      sceneId="chiapothecary"
      onSubmit={handleSubmit}
      overlayContent={overlayContent}
      resultContent={resultContent}
      quickModeContent={<Chiapothecary />}
    />
  );
}
