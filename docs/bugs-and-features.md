# WhiskedAway - Bugs & Features Register

## 🐛 BUGS

| ID | Priority | Page/Component | Description | Status |
|----|----------|----------------|-------------|--------|
| BUG-001 | Medium | ShoppingScroll | PDF export has encoding issues - weird characters appearing (e.g., `%Ë` instead of bullet points), spacing issues | Open |
| BUG-002 | Low | All recipe pages | "Conjure" button needs more margin/space above it when results are displayed below | Open |
| BUG-003 | Medium | Sweet Spells (+ others) | Submit button too small to contain text on some pages - needs to auto-size to content | Open |
| BUG-004 | Low | Home page | Remove "No accounts. No tracking. Your recipes are yours." text (prep for future accounts feature) | Open |

---

## ✨ FEATURES - Future Development

### Account System (Monetization Potential)
| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FEAT-001 | User accounts | Basic sign-up/login functionality | High |
| FEAT-002 | Save favourite recipes | Logged-in users can heart/save recipes to their profile | High |
| FEAT-003 | User profile/preferences | Store dietary restrictions, pantry staples, location so Gemma "knows" you | High |
| FEAT-004 | Recipe history | View past recipes Gemma has made for you | Medium |
| FEAT-005 | Meal planning | Plan out a week of meals, generate consolidated shopping list | Medium |
| FEAT-006 | Premium tier | Additional features for paid subscribers (TBD what those are) | Low |

### Other Features
| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FEAT-007 | Google Analytics | Track usage, popular tomes, etc. | High |
| FEAT-008 | Share recipes | Generate shareable links to recipes | Medium |
| FEAT-009 | Print-friendly view | Better formatted print stylesheet | Medium |
| FEAT-010 | Dark mode | Because everyone wants dark mode | Low |
| FEAT-011 | PWA support | Install as app on phone, offline access to saved recipes | Low |
| FEAT-012 | Email recipes | Send recipe to yourself or others | Low |

---

## 📝 NOTES

### PDF Encoding Issue (BUG-001)
The jsPDF library struggles with:
- Unicode bullet characters (○, •, etc.)
- Template literals with special characters
- Non-ASCII characters from API responses

Potential fixes to try:
1. Use only ASCII characters (-, *, etc.) ✅ Attempted
2. Add a custom font that supports Unicode
3. Use a different PDF library (pdfmake, react-pdf)
4. Generate PDF server-side instead of client-side

### Account System Architecture Notes
For FEAT-001 through FEAT-006, will need:
- Authentication provider (Auth0, Firebase Auth, Supabase, or custom)
- Database for user data (Supabase, PlanetScale, or similar)
- API routes for saving/retrieving user data
- Consider Cloudflare D1 (SQLite at edge) to keep everything in Cloudflare ecosystem

### Monetization Ideas
- Free tier: All current functionality
- Premium tier ($X/month): 
  - Unlimited saved recipes (free tier limited to 10?)
  - Meal planning features
  - Consolidated weekly shopping lists
  - Priority API access (faster responses?)
  - Custom Gemma personality tweaks?
  - Ad-free (if we ever add ads, which... probably not)

---

## 🔄 CHANGELOG

### 2026-01-03
- Initial React migration completed
- All 6 tomes live
- Worker updated with cultural/religious dietary options
- PDF export added (with known encoding issues)

---

*Last updated: 3 January 2026*
