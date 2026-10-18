# WhiskedAway - Bugs & Features Register

## 🐛 BUGS

| ID | Priority | Page/Component | Description | Status |
|----|----------|----------------|-------------|--------|
| BUG-001 | Medium | ShoppingScroll | PDF export has encoding issues - weird characters appearing (e.g., `%Ë` instead of bullet points), spacing issues | Open |
| BUG-002 | Low | All recipe pages | "Conjure" button needs more margin/space above it when results are displayed below | Open |
| BUG-003 | Medium | Sweet Spells (+ others) | Submit button too small to contain text on some pages - needs to auto-size to content | Open |
| BUG-004 | Low | Home page | Remove "No accounts. No tracking. Your recipes are yours." text (prep for future accounts feature) | Open |
| BUG-005 | Medium | Explore: kitchen and hallway windows | Can't see out: the view looks like frosted glass. The panes were refractive glass boxes (plus a streaky rain bump) that blurred and washed out the view; the pot's steam also ended in a hard-edged shell over the window. Now clear glass with a faint reflection, sparse raindrops only in Rain and Stormy, and soft steam | Fixed. Live since 18 Oct 2026 (main ca22b0a) |

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

### Explore room (the Inn), agreed with Nicole 2026-10-18
| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| FEAT-013 | Energy candles | Five real candles on the left-hand counter (burnt out with a curl of smoke, low with pooled wax, half, three-quarters, full and bright). Click the one that matches your energy; it feeds the navigator and the recipes' "spoons", like the barometer does for weather | Live since 18 Oct 2026 (main ca22b0a) |
| FEAT-014 | Books that open | Books on the shelf open as a two-page spread over the room (illustration left, text right, page turns): Gemma's recipe book (what she's served this visit), kitchen wisdom (Nourish Academy), Gemma's journal (today's notebook panel, moved into the world). Widget design still to agree | High |
| FEAT-015 | Choose, don't chat | Gemma asks, the visitor picks 90s-style canned replies. No free-text chat: it keeps costs down and keeps Gemma different from a general chatbot (she reads what you do, not what you type) | High |
| FEAT-016 | "What's in your cupboard?" | The one focused text box: list your ingredients and Gemma builds a recipe from them, in one AI call | High |
| FEAT-017 | Your country and shops | Gemma asks (optional, and says why) which country you're in and where you shop, so shopping lists name things you'll actually find there. Defaults from the visit's country, always changeable; nothing stored after the visit | Medium |

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

### 2026-10-18
- Energy candles in the Cuddlecore kitchen: five candles, from burnt out to full and bright. The one you pick feeds the navigator and the recipes' spoons (FEAT-013)
- Clear kitchen and hallway windows you can see out of (BUG-005)
- The hallway: the entrance hall and middle hallway, each in five weathers, with a magic dial beside the doors
- The glasshouse, reached by the hallway dial. It opens in the visitor's season, has a seasons wheel to change it, and a glazed door with a glimpse of the Chiapothecary through it

### 2026-10-17
- Turnstile bot guard on the genie Worker: visitor passes, an origin check and rate limits. Set to enforce
- whiskedaway.com is served by a Cloudflare Worker (`whiskedaway-site`) on a Worker route, no longer from DreamHost

### 2026-01-03
- Initial React migration completed
- All 6 tomes live
- Worker updated with cultural/religious dietary options
- PDF export added (with known encoding issues)

---

*Last updated: 18 October 2026*
