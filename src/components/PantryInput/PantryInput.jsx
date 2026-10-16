import { useState } from 'react';
import './PantryInput.css';

/**
 * PantryInput Component
 * 
 * Ingredient input with tag management. Supports comma-separated entry.
 * Used in: Cuddlecore, Flourish, Chiapothecary, Sweet Spells
 * 
 * Props:
 * - placeholder: Custom placeholder text
 * - helperText: Custom helper text
 * - onChange: Callback receiving array of ingredients
 * - initialItems: Array of pre-populated items
 */
export default function PantryInput({ 
  placeholder = "e.g., chicken, rice, ginger (commas to add multiple)",
  helperText = "Add ingredients you have on hand — Gemma will try to work with what you've got",
  onChange,
  initialItems = []
}) {
  const [items, setItems] = useState(initialItems);
  const [inputValue, setInputValue] = useState('');

  const addItems = () => {
    if (!inputValue.trim()) return;
    
    // Split by commas and clean up
    const newItems = inputValue
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(item => item && !items.includes(item));
    
    if (newItems.length > 0) {
      const updatedItems = [...items, ...newItems];
      setItems(updatedItems);
      setInputValue('');
      onChange?.(updatedItems);
    }
  };

  const removeItem = (itemToRemove) => {
    const updatedItems = items.filter(item => item !== itemToRemove);
    setItems(updatedItems);
    onChange?.(updatedItems);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItems();
    }
  };

  // Expose addItem for external use (e.g., from nourishment highlights)
  const addExternalItem = (item) => {
    const cleanItem = item.trim().toLowerCase();
    if (cleanItem && !items.includes(cleanItem)) {
      const updatedItems = [...items, cleanItem];
      setItems(updatedItems);
      onChange?.(updatedItems);
      return true;
    }
    return false;
  };

  // Attach to window for cross-component access (temporary solution)
  if (typeof window !== 'undefined') {
    window.addToPantry = addExternalItem;
  }

  return (
    <section className="form-section pantry-section">
      <h2>🗄️ What's in your kitchen?</h2>
      <p className="helper-text">{helperText}</p>
      
      <div className="pantry-input-row">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
        />
        <button type="button" className="add-pantry-btn" onClick={addItems}>
          + Add
        </button>
      </div>
      
      {items.length > 0 && (
        <div className="pantry-tags">
          {items.map(item => (
            <span key={item} className="pantry-tag">
              {item}
              <button 
                type="button" 
                className="remove-tag" 
                onClick={() => removeItem(item)}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
