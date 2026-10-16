import { useState } from 'react';
import './DietaryOptions.css';

/**
 * DietaryOptions Component
 * 
 * Reusable dietary restrictions selector with religious/cultural options.
 * Used in: Cuddlecore, Flourish, Chiapothecary, Sweet Spells
 * 
 * Props:
 * - options: Array of {id, label, value} for diet-specific options (e.g., low-FODMAP for Cuddlecore)
 * - showReligious: Boolean - whether to show religious/cultural section (default: true)
 * - onChange: Callback function receiving { dietary: string[], allergies: string }
 */
export default function DietaryOptions({ 
  options = [], 
  showReligious = true, 
  onChange 
}) {
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [allergies, setAllergies] = useState('');

  // Standard dietary options (shown for all tomes)
  const standardOptions = [
    { id: 'vegetarian', label: 'Vegetarian', value: 'vegetarian' },
    { id: 'vegan', label: 'Vegan', value: 'vegan' },
    { id: 'gluten-free', label: 'Gluten-free', value: 'gluten-free' },
    { id: 'dairy-free', label: 'Dairy-free', value: 'dairy-free' },
  ];

  // Religious/cultural options
  const religiousOptions = [
    { id: 'halal', label: 'Halal', value: 'halal' },
    { id: 'kosher', label: 'Kosher', value: 'kosher' },
    { id: 'hindu-vegetarian', label: 'Hindu vegetarian', value: 'hindu-vegetarian' },
    { id: 'jain', label: 'Jain', value: 'jain' },
    { id: 'buddhist-vegetarian', label: 'Buddhist vegetarian', value: 'buddhist-vegetarian' },
  ];

  // Combine standard + tome-specific options
  const allDietaryOptions = [...standardOptions, ...options];

  const handleDietaryChange = (value, checked) => {
    const newDietary = checked
      ? [...selectedDietary, value]
      : selectedDietary.filter(v => v !== value);
    
    setSelectedDietary(newDietary);
    onChange?.({ dietary: newDietary, allergies });
  };

  const handleAllergiesChange = (e) => {
    setAllergies(e.target.value);
    onChange?.({ dietary: selectedDietary, allergies: e.target.value });
  };

  return (
    <section className="form-section dietary-section">
      <h2>🥗 Dietary needs</h2>
      <p className="helper-text">Select any that apply</p>
      
      <div className="option-group">
        {allDietaryOptions.map(opt => (
          <div className="option-item" key={opt.id}>
            <input
              type="checkbox"
              id={`diet-${opt.id}`}
              name="dietary"
              value={opt.value}
              checked={selectedDietary.includes(opt.value)}
              onChange={(e) => handleDietaryChange(opt.value, e.target.checked)}
            />
            <label htmlFor={`diet-${opt.id}`}>{opt.label}</label>
          </div>
        ))}
      </div>

      {showReligious && (
        <>
          <h3 className="subsection-title">Religious & cultural</h3>
          <div className="option-group">
            {religiousOptions.map(opt => (
              <div className="option-item" key={opt.id}>
                <input
                  type="checkbox"
                  id={`diet-${opt.id}`}
                  name="dietary"
                  value={opt.value}
                  checked={selectedDietary.includes(opt.value)}
                  onChange={(e) => handleDietaryChange(opt.value, e.target.checked)}
                />
                <label htmlFor={`diet-${opt.id}`}>{opt.label}</label>
              </div>
            ))}
          </div>
        </>
      )}

      <label style={{ marginTop: '1rem' }} htmlFor="allergies">
        Allergies, intolerances, or things to avoid
      </label>
      <p className="helper-text">Medical, personal, or cultural — all respected equally</p>
      <input
        type="text"
        id="allergies"
        name="allergies"
        placeholder="e.g., nuts, pork, shellfish, onion, garlic (commas to add multiple)"
        value={allergies}
        onChange={handleAllergiesChange}
      />
    </section>
  );
}
