import './NourishmentHighlights.css';

/**
 * NourishmentHighlights Component
 * 
 * Displays nutritional benefits of the recipe ingredients.
 * Allows adding highlighted food sources to pantry.
 * 
 * Props:
 * - highlights: Array of { emoji, compound, benefit, sources: string[] }
 * - onAddToPantry: Callback when user clicks to add a source ingredient
 */
export default function NourishmentHighlights({ highlights = [], onAddToPantry }) {
  if (!highlights || highlights.length === 0) return null;

  const handleAddSource = (source, event) => {
    const button = event.target;
    const added = onAddToPantry?.(source);
    
    if (added !== false) {
      button.classList.add('added');
      button.textContent = `${source} ✓`;
    }
  };

  return (
    <div className="nourishment-highlights">
      <h4>🌟 Nourishment Highlights</h4>
      
      {highlights.map((h, idx) => (
        <div className="highlight-item" key={idx}>
          <span className="highlight-emoji">{h.emoji}</span>
          <div className="highlight-content">
            <div className="highlight-compound">{h.compound}</div>
            <div className="highlight-benefit">{h.benefit}</div>
            <div className="highlight-sources">
              Found in:{' '}
              {h.sources.map((source, sIdx) => (
                <button
                  key={sIdx}
                  className="add-source-btn"
                  onClick={(e) => handleAddSource(source, e)}
                  type="button"
                >
                  {source} +
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
