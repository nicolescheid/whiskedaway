import { useState } from 'react';
import { Link } from 'react-router-dom';
import './NourishAcademy.css';

import { genieFetch } from '../lib/genie';

export default function NourishAcademy() {
  // Form state
  const [question, setQuestion] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const topics = [
    { id: 'protein', icon: '💪', title: 'Protein 101', desc: 'What it does, how much you need' },
    { id: 'gut-health', icon: '🦠', title: 'Gut Health', desc: 'The microbiome basics' },
    { id: 'energy', icon: '⚡', title: 'Energy & Food', desc: 'Why you crash (and how not to)' },
    { id: 'meal-prep', icon: '📦', title: 'Meal Prep Basics', desc: 'Set yourself up for success' },
    { id: 'labels', icon: '🏷️', title: 'Reading Labels', desc: 'What actually matters' },
    { id: 'budget', icon: '💰', title: 'Budget Eating', desc: 'Eating well for less' },
    { id: 'sleep', icon: '😴', title: 'Sleep & Food', desc: 'Foods that help (and hurt) sleep' },
    { id: 'hydration', icon: '💧', title: 'Hydration', desc: 'More than just water' },
    { id: 'comfort-eating', icon: '🍪', title: 'Comfort Eating', desc: 'Understanding emotional hunger' },
  ];

  const exampleQuestions = [
    "What's the difference between good and bad fats?",
    "Why do I feel sleepy after eating?",
    "How do I know if I'm getting enough nutrients?",
    "Is breakfast really the most important meal?",
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      tome_id: 'nourish-academy',
      question: question || undefined,
      topic: selectedTopic || undefined
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

  const handleTopicClick = (topicId) => {
    setSelectedTopic(topicId);
    setQuestion('');
  };

  const handleExampleClick = (q) => {
    setQuestion(q);
    setSelectedTopic(null);
  };

  const handleFollowUp = (q) => {
    setQuestion(q);
    setSelectedTopic(null);
    // Auto-submit
    setTimeout(() => {
      document.querySelector('.intake-form').requestSubmit();
    }, 100);
  };

  return (
    <div className="tome-container academy-theme">
      {/* Header */}
      <header className="tome-header">
        <Link to="/" className="back-link">← Back to Gemma</Link>
        <div className="tome-sigil">📚</div>
        <h1 className="tome-title">Nourish Academy</h1>
        <p className="tome-subtitle">Kitchen wisdom, no jargon</p>
      </header>

      {/* Gemma's greeting */}
      <div className="gemma-message tome-themed">
        <span className="avatar">🧞‍♀️</span>
        <p>"Welcome to class! I'm not a dietitian, but I can share what I know about food and nutrition in plain language. No judgment, no weird rules — just useful stuff. What do you want to learn about? 📚✨"</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="intake-form">
        
        {/* Topics to Browse */}
        <section className="form-section">
          <h2><span className="icon">📖</span> Topics to explore</h2>
          <div className="topic-grid">
            {topics.map(t => (
              <button
                key={t.id}
                type="button"
                className={`topic-card ${selectedTopic === t.id ? 'selected' : ''}`}
                onClick={() => handleTopicClick(t.id)}
              >
                <span className="topic-icon">{t.icon}</span>
                <div className="topic-content">
                  <strong>{t.title}</strong>
                  <span>{t.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Or Ask Anything */}
        <section className="form-section">
          <h2><span className="icon">❓</span> Or ask Gemma anything</h2>
          
          <textarea
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setSelectedTopic(null); }}
            placeholder="Type your food or nutrition question here..."
            rows={3}
          />

          <div className="example-questions">
            <p>Try these:</p>
            {exampleQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="example-btn"
                onClick={() => handleExampleClick(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="conjure-section">
          <button 
            type="submit" 
            className={`btn-primary ${loading ? 'loading' : ''}`}
            disabled={loading || (!question && !selectedTopic)}
            data-loading-text="Gemma's preparing a lesson... 📚"
          >
            📚 Teach Me
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
          {/* Lesson Card */}
          {result.lesson && (
            <div className="lesson-card">
              <h3>{result.lesson.title}</h3>
              
              <div 
                className="lesson-content"
                dangerouslySetInnerHTML={{ __html: result.lesson.content }}
              />

              {result.lesson.key_takeaways?.length > 0 && (
                <div className="takeaways">
                  <h4>📝 Key Takeaways</h4>
                  <ul>
                    {result.lesson.key_takeaways.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.lesson.practical_tips?.length > 0 && (
                <div className="practical-tips">
                  <h4>💡 Try This</h4>
                  <ul>
                    {result.lesson.practical_tips.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Follow-up Questions */}
          {result.follow_up_questions?.length > 0 && (
            <div className="follow-ups">
              <h4>Keep learning:</h4>
              <div className="follow-up-buttons">
                {result.follow_up_questions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="follow-up-btn"
                    onClick={() => handleFollowUp(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
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
          Gemma offers ideas — never medical or dietary advice. For personalized guidance, see a registered dietitian.{' '}
          <a href="https://ko-fi.com/whiskedaway" target="_blank" rel="noopener noreferrer">
            Support WhiskedAway
          </a> ☕
        </p>
      </footer>
    </div>
  );
}
