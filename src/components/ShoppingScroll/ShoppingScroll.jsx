import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import './ShoppingScroll.css';

/**
 * ShoppingScroll Component
 * 
 * Displays ingredients with checkbox to mark what you have.
 * Only unchecked items appear in the shopping list.
 * Includes copy and PDF export functionality.
 * 
 * Props:
 * - ingredients: Array of { display_name, amount, unit, source_bucket, notes, optional, canonical_name }
 * - locale: 'NZ' | 'AU' | 'UK' | 'US' | 'CA'
 * - recipeName: Name of the recipe (for PDF title)
 * - tomeEmoji: Emoji for the tome (for PDF branding)
 * - tomeName: Name of the tome (for PDF branding)
 * - accentColor: RGB array for PDF accent color, e.g., [139, 77, 92]
 */

const LOCALES = {
  NZ: { supermarket: 'Pak\'nSave / New World / Countdown', specialty: 'Farro / Asian grocers / Health stores' },
  AU: { supermarket: 'Coles / Woolworths / Aldi', specialty: 'Harris Farm / Asian grocers / Health stores' },
  UK: { supermarket: 'Tesco / Sainsbury\'s / Asda', specialty: 'Whole Foods / Asian grocers / Health stores' },
  US: { supermarket: 'Kroger / Safeway / Whole Foods', specialty: 'Trader Joe\'s / Asian markets / Health stores' },
  CA: { supermarket: 'Loblaws / Sobeys / No Frills', specialty: 'Whole Foods / Asian markets / Health stores' },
};

export default function ShoppingScroll({ 
  ingredients = [], 
  locale = 'NZ',
  recipeName = 'Recipe',
  tomeEmoji = '🧞‍♀️',
  tomeName = 'WhiskedAway',
  accentColor = [196, 149, 106]
}) {
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [copied, setCopied] = useState(false);

  const localeConfig = LOCALES[locale] || LOCALES.NZ;

  // Get unchecked items grouped by source
  const getUncheckedItems = () => {
    const supermarket = [];
    const specialty = [];

    ingredients.forEach((ing, idx) => {
      if (!checkedItems.has(idx)) {
        const item = {
          name: ing.display_name,
          amount: `${ing.amount} ${ing.unit}`.trim(),
          optional: ing.optional,
          notes: ing.notes
        };
        if (ing.source_bucket === 'specialty') {
          specialty.push(item);
        } else {
          supermarket.push(item);
        }
      }
    });

    return { supermarket, specialty };
  };

  const toggleItem = (idx) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(idx)) {
      newChecked.delete(idx);
    } else {
      newChecked.add(idx);
    }
    setCheckedItems(newChecked);
  };

  const checkAll = () => {
    setCheckedItems(new Set(ingredients.map((_, idx) => idx)));
  };

  const uncheckAll = () => {
    setCheckedItems(new Set());
  };

  const copyToClipboard = async () => {
    const { supermarket, specialty } = getUncheckedItems();
    
    if (supermarket.length === 0 && specialty.length === 0) {
      alert('Nothing to copy — you have everything!');
      return;
    }

    let text = `${tomeEmoji} ${tomeName} Shopping Scroll\n`;
    text += `For: ${recipeName}\n\n`;

    if (supermarket.length > 0) {
      text += `${localeConfig.supermarket}\n`;
      supermarket.forEach(item => {
        text += `○ ${item.amount} ${item.name}${item.optional ? ' (optional)' : ''}\n`;
      });
      text += '\n';
    }

    if (specialty.length > 0) {
      text += `${localeConfig.specialty}\n`;
      specialty.forEach(item => {
        text += `○ ${item.amount} ${item.name}${item.optional ? ' (optional)' : ''}\n`;
      });
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveShoppingPDF = () => {
    const { supermarket, specialty } = getUncheckedItems();
    
    if (supermarket.length === 0 && specialty.length === 0) {
      alert('Nothing to save — you have everything!');
      return;
    }

    const doc = new jsPDF();
    const margin = 20;
    let y = 20;
    const [r, g, b] = accentColor;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;

    // Helper to sanitize text for PDF
    const sanitize = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII
        .trim();
    };

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(r, g, b);
    doc.text('Shopping Scroll', margin, y);
    y += 8;

    // Recipe name
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(92, 80, 64);
    doc.text('For: ' + sanitize(recipeName), margin, y);
    y += 12;

    // Supermarket items
    if (supermarket.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(r, g, b);
      doc.text(sanitize(localeConfig.supermarket), margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(44, 36, 22);
      supermarket.forEach(item => {
        const line = '- ' + sanitize(item.amount) + '  ' + sanitize(item.name) + (item.optional ? ' (optional)' : '');
        doc.text(line, margin, y);
        y += 5;
      });
      y += 6;
    }

    // Specialty items
    if (specialty.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(r, g, b);
      doc.text(sanitize(localeConfig.specialty), margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(44, 36, 22);
      specialty.forEach(item => {
        const line = '- ' + sanitize(item.amount) + '  ' + sanitize(item.name) + (item.optional ? ' (optional)' : '');
        doc.text(line, margin, y);
        y += 5;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 140, 120);
    doc.text('Made with love by Gemma at WhiskedAway.com', margin, 287);

    doc.save(`${tomeName.toLowerCase()}-shopping.pdf`);
  };

  const { supermarket, specialty } = getUncheckedItems();
  const allChecked = supermarket.length === 0 && specialty.length === 0;

  return (
    <div className="shopping-scroll-container">
      {/* Ingredient Checklist */}
      <div className="ingredient-checklist-section">
        <h4 className="recipe-section-title">Ingredients</h4>
        <p className="helper-text">Tick items you have — unticked items go to your shopping scroll</p>
        
        <ul className="ingredient-checklist">
          {ingredients.map((ing, idx) => (
            <li 
              key={idx} 
              className={`ingredient-check-item ${checkedItems.has(idx) ? 'have-it' : ''}`}
            >
              <input
                type="checkbox"
                id={`ing-${idx}`}
                checked={checkedItems.has(idx)}
                onChange={() => toggleItem(idx)}
              />
              <label htmlFor={`ing-${idx}`}>
                <span className="ing-amount">{ing.amount} {ing.unit}</span>
                {' '}{ing.display_name}
                {ing.notes && <em> ({ing.notes})</em>}
              </label>
            </li>
          ))}
        </ul>

        <div className="checklist-actions">
          <button type="button" className="btn-small" onClick={checkAll}>
            I have all
          </button>
          <button type="button" className="btn-small" onClick={uncheckAll}>
            Need all
          </button>
        </div>
      </div>

      {/* Shopping Scroll */}
      <div className="shopping-scroll">
        <h3>📜 Shopping Scroll</h3>
        
        {allChecked ? (
          <p className="shopping-scroll-subtitle all-done">
            ✓ You have everything you need! Time to cook. 💛
          </p>
        ) : (
          <>
            <p className="shopping-scroll-subtitle">Just the items you need to buy</p>

            {supermarket.length > 0 && (
              <div className="shopping-bucket">
                <h4>{localeConfig.supermarket}</h4>
                <ul>
                  {supermarket.map((item, idx) => (
                    <li key={idx}>
                      <span className="ingredient-amount">{item.amount}</span>
                      <span>{item.name}{item.optional ? ' (optional)' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {specialty.length > 0 && (
              <div className="shopping-bucket">
                <h4>{localeConfig.specialty}</h4>
                <ul>
                  {specialty.map((item, idx) => (
                    <li key={idx}>
                      <span className="ingredient-amount">{item.amount}</span>
                      <span>{item.name}{item.optional ? ' (optional)' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button 
              className={`copy-btn ${copied ? 'copied' : ''}`} 
              onClick={copyToClipboard}
            >
              {copied ? '✓ Copied!' : '📋 Copy to clipboard'}
            </button>

            <div className="export-buttons">
              <button className="export-btn" onClick={saveShoppingPDF}>
                🛒 Save Shopping PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
