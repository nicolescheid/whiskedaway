import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import KitchenController from './KitchenController';
import useKitchenSubmit from './useKitchenSubmit';
import OverlayPanel from '../overlays/OverlayPanel';
import ResultsOverlay from '../overlays/ResultsOverlay';
import NourishAcademy from '../pages/NourishAcademy';

const topicOptions = [
  { id: 'protein', icon: '💪', label: 'Protein' },
  { id: 'gut-health', icon: '🌿', label: 'Gut health' },
  { id: 'energy', icon: '⚡', label: 'Energy' },
  { id: 'meal-prep', icon: '📦', label: 'Meal prep' },
  { id: 'labels', icon: '🏷️', label: 'Reading labels' },
  { id: 'budget', icon: '💰', label: 'Budget cooking' },
  { id: 'sleep', icon: '🌙', label: 'Sleep & food' },
  { id: 'hydration', icon: '💧', label: 'Hydration' },
  { id: 'comfort-eating', icon: '🤗', label: 'Comfort eating' },
];

export default function NourishAcademyController() {
  const { trackOptionSelect } = useProfile();

  const [selectedTopic, setSelectedTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [showResults, setShowResults] = useState(false);

  const { loading, result, error, submit } = useKitchenSubmit('academy');

  const handleSubmit = useCallback(async () => {
    const payload = {
      tome_id: 'nourish-academy',
      ...(selectedTopic ? { topic: selectedTopic } : {}),
      ...(question ? { question } : {}),
    };
    const data = await submit(payload);
    if (data) setShowResults(true);
  }, [selectedTopic, question, submit]);

  const handleFollowUp = (q) => {
    setQuestion(q);
    setSelectedTopic('');
    setShowResults(false);
    // Auto-submit follow-up
    submit({
      tome_id: 'nourish-academy',
      question: q,
    }).then(data => { if (data) setShowResults(true); });
  };

  const overlayContent = (
    <>
      <OverlayPanel overlayId="topic" title="Browse Topics" icon="📖">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {topicOptions.map(opt => (
            <label key={opt.id}
              style={{ cursor: 'pointer', padding: '12px 8px', borderRadius: '8px', border: `2px solid ${selectedTopic === opt.id ? 'var(--tome-accent)' : 'var(--parchment-dark)'}`, background: selectedTopic === opt.id ? 'color-mix(in srgb, var(--tome-accent) 12%, transparent)' : 'transparent', textAlign: 'center', transition: 'all 0.2s' }}>
              <input type="radio" name="topic" checked={selectedTopic === opt.id} onChange={() => { setSelectedTopic(opt.id); setQuestion(''); trackOptionSelect('academy', 'topic', opt.id); }} style={{ display: 'none' }} />
              <span style={{ fontSize: '1.3rem' }}>{opt.icon}</span>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>{opt.label}</div>
            </label>
          ))}
        </div>
      </OverlayPanel>

      <OverlayPanel overlayId="question" title="Ask a Question" icon="📝">
        <textarea
          value={question}
          onChange={(e) => { setQuestion(e.target.value); if (e.target.value) setSelectedTopic(''); }}
          placeholder="Ask Gemma anything about nutrition, cooking, or wellness..."
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--parchment-dark)', fontFamily: 'Crimson Pro, serif', fontSize: '1rem', resize: 'vertical', minHeight: '120px' }}
        />
        <div style={{ marginTop: '8px' }}>
          <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.8rem', color: 'var(--ink-soft)', marginBottom: '6px' }}>Or try one of these:</p>
          {['Why do I crave sugar after meals?', 'How to read nutrition labels', 'Best foods for energy'].map(q => (
            <button key={q} onClick={() => setQuestion(q)}
              style={{ display: 'block', width: '100%', padding: '8px', marginBottom: '4px', borderRadius: '6px', border: '1px solid var(--parchment-dark)', background: 'transparent', cursor: 'pointer', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', textAlign: 'left', color: 'var(--ink-soft)', transition: 'all 0.2s' }}>
              {q}
            </button>
          ))}
        </div>
      </OverlayPanel>
    </>
  );

  const resultContent = (
    <ResultsOverlay isOpen={showResults && !!result} onClose={() => setShowResults(false)} title="Lesson" icon="📚">
      {error && <p className="error-message">{error}</p>}
      {result && (
        <div style={{ '--tome-accent': 'var(--teal)' }}>
          {result.lesson && (
            <div>
              <h4 style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.2rem', margin: '0 0 12px' }}>{result.lesson.title}</h4>
              {result.lesson.content && (
                <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{ __html: result.lesson.content }} />
              )}
              {result.lesson.key_takeaways?.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'color-mix(in srgb, var(--teal) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--teal) 20%, transparent)' }}>
                  <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 8px' }}>Key takeaways:</p>
                  <ul style={{ paddingLeft: '18px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', margin: 0 }}>
                    {result.lesson.key_takeaways.map((t, i) => <li key={i} style={{ marginBottom: '4px' }}>{t}</li>)}
                  </ul>
                </div>
              )}
              {result.lesson.practical_tips?.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Practical tips:</p>
                  <ul style={{ paddingLeft: '18px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
                    {result.lesson.practical_tips.map((t, i) => <li key={i} style={{ marginBottom: '4px' }}>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result.follow_up_questions?.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Keep learning:</p>
              {result.follow_up_questions.map((q, i) => (
                <button key={i} onClick={() => handleFollowUp(q)}
                  style={{ display: 'block', width: '100%', padding: '10px', marginBottom: '4px', borderRadius: '6px', border: '1px solid var(--parchment-dark)', background: 'transparent', cursor: 'pointer', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', textAlign: 'left', color: 'var(--teal)', transition: 'all 0.2s' }}>
                  → {q}
                </button>
              ))}
            </div>
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
      sceneId="academy"
      onSubmit={handleSubmit}
      overlayContent={overlayContent}
      resultContent={resultContent}
      quickModeContent={<NourishAcademy />}
    />
  );
}
