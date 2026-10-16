import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import KitchenController from './KitchenController';
import useKitchenSubmit from './useKitchenSubmit';
import OverlayPanel from '../overlays/OverlayPanel';
import ResultsOverlay from '../overlays/ResultsOverlay';
import { DietaryOptions, ShoppingScroll, NourishmentHighlights } from '../components';
import SweetSpells from '../pages/SweetSpells';

const cravingOptions = [
  { id: 'chocolate', icon: '🍫', label: 'Chocolate' },
  { id: 'fruity', icon: '🍓', label: 'Fruity' },
  { id: 'creamy', icon: '🍦', label: 'Creamy' },
  { id: 'crunchy', icon: '🥜', label: 'Crunchy' },
  { id: 'warm', icon: '☕', label: 'Warm' },
  { id: 'frozen', icon: '🍧', label: 'Frozen' },
];

const occasionOptions = [
  { id: 'just-because', label: 'Just because' },
  { id: 'movie-night', label: 'Movie night' },
  { id: 'guests', label: 'Guests coming' },
  { id: 'meal-prep', label: 'Meal prep' },
  { id: 'kids', label: 'For kids' },
  { id: 'romantic', label: 'Date night' },
];

const effortLabels = ['No-bake magic', 'Quick mix', 'Easy bake', 'Some effort', 'Worth the wait'];

export default function SweetSpellsController() {
  const { getDietaryDefaults, getPreferredLocale, getPreferredSourcing, trackOptionSelect, trackDietarySet, trackLocaleSet } = useProfile();

  const [craving, setCraving] = useState('');
  const [occasion, setOccasion] = useState('');
  const [effortLevel, setEffortLevel] = useState(2);
  const [dietaryData, setDietaryData] = useState(() => getDietaryDefaults());
  const [locale, setLocale] = useState(() => getPreferredLocale());
  const [sourcingPref, setSourcingPref] = useState(() => getPreferredSourcing());
  const [showResults, setShowResults] = useState(false);

  const { loading, result, error, submit } = useKitchenSubmit('sweet-spells');

  const handleSubmit = useCallback(async () => {
    const payload = {
      tome_id: 'sweet-spells',
      locale,
      craving,
      occasion,
      effort_level: effortLevel,
      dietary_restrictions: dietaryData.dietary,
      allergies: dietaryData.allergies.split(',').map(s => s.trim()).filter(Boolean),
      sourcing_preference: sourcingPref,
    };
    const data = await submit(payload);
    if (data) setShowResults(true);
  }, [locale, craving, occasion, effortLevel, dietaryData, sourcingPref, submit]);

  const overlayContent = (
    <>
      <OverlayPanel overlayId="sweetCraving" title="What Sounds Good?" icon="🍬">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {cravingOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '14px', borderRadius: '8px', border: `2px solid ${craving === opt.id ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: craving === opt.id ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', textAlign: 'center', transition: 'all 0.2s' }}>
              <input type="radio" name="craving" checked={craving === opt.id} onChange={() => { setCraving(opt.id); trackOptionSelect('sweet-spells', 'craving', opt.id); }} style={{ display: 'none' }} />
              <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', marginTop: '4px', fontWeight: 600 }}>{opt.label}</div>
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="occasion" title="The Occasion" icon="📅">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {occasionOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px', border: `2px solid ${occasion === opt.id ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: occasion === opt.id ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', transition: 'all 0.2s' }}>
              <input type="radio" name="occasion" checked={occasion === opt.id} onChange={() => { setOccasion(opt.id); trackOptionSelect('sweet-spells', 'occasion', opt.id); }} style={{ display: 'none' }} />
              {opt.label}
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="effort" title="Effort Level" icon="⏳">
        <div style={{ padding: '12px 0' }}>
          <input type="range" min="0" max="4" value={effortLevel}
            onChange={(e) => { setEffortLevel(Number(e.target.value)); trackOptionSelect('sweet-spells', 'effort_level', Number(e.target.value)); }}
            style={{ width: '100%', accentColor: 'var(--tome-accent, var(--rose))' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Quicksand, sans-serif', fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '8px' }}>
            <span>No-bake</span>
            <span>Worth it</span>
          </div>
          <p style={{ textAlign: 'center', fontFamily: 'Quicksand, sans-serif', fontSize: '0.9rem', fontWeight: 600, marginTop: '8px' }}>
            {effortLabels[effortLevel]}
          </p>
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="dietary" title="Dietary Needs" icon="📋">
        <DietaryOptions
          options={[{ id: 'nut-free', label: 'Nut-free', value: 'nut-free' }]}
          showReligious={true}
          onChange={(data) => { setDietaryData(data); trackDietarySet(data); }}
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
                <input type="radio" name="sourcing" checked={sourcingPref === val} onChange={() => { setSourcingPref(val); trackOptionSelect('sweet-spells', 'sourcing_preference', val); }} style={{ display: 'none' }} />
                {val === 'supermarket_only' ? '🛒 Supermarket only' : '✨ Specialty stores OK'}
              </label>
            ))}
          </div>
        </div>
      </OverlayPanel>
    </>
  );

  const resultContent = (
    <ResultsOverlay isOpen={showResults && !!result} onClose={() => setShowResults(false)} title="Sweet Spell Cast" icon="🧁">
      {error && <p className="error-message">{error}</p>}
      {result && (
        <div style={{ '--tome-accent': 'var(--rose)' }}>
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
          {result.guilt_free_note && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'color-mix(in srgb, var(--herb) 10%, transparent)', marginBottom: '12px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
              ✨ {result.guilt_free_note}
            </div>
          )}
          {result.enchantments?.length > 0 && (
            <div>
              <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Enchantments:</p>
              {result.enchantments.map((e, i) => (
                <div key={i} style={{ padding: '8px', borderRadius: '6px', background: 'color-mix(in srgb, var(--rose) 8%, transparent)', marginBottom: '4px', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem' }}>
                  <strong>{e.name}</strong> — {e.description}
                </div>
              ))}
            </div>
          )}
          {result.base_recipe?.ingredients && (
            <ShoppingScroll ingredients={result.base_recipe.ingredients} locale={locale} recipeName={result.base_recipe.name} tomeEmoji="🧁" tomeName="Sweet Spells" accentColor={[194, 122, 140]} />
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
      sceneId="sweet-spells"
      onSubmit={handleSubmit}
      overlayContent={overlayContent}
      resultContent={resultContent}
      quickModeContent={<SweetSpells />}
    />
  );
}
