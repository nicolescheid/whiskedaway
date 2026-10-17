# WhiskedAway - React Architecture

A componentized React version of WhiskedAway, Gemma's kitchen sanctuary.

> **This is the canonical repo** (consolidated 2026-10-17). It holds the live 2.5D "Inn" site
> plus the `whiskedaway-genie` Worker in `worker/`. Older copies at `C:\dev\whiskedaway-react`,
> `C:\dev\www\WhiskedAway\whiskedaway.com` and the loose `whiskedaway-worker.js` files are stale.
> The architecture notes below predate the Inn (scenes, kitchens, overlays) and describe the
> original form-based tomes, which still live at `/original/*`.

## 🏗️ Architecture Overview

This project uses a **component-based architecture** where reusable UI pieces are shared across all tomes (recipe pages).

```
whiskedaway-react/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/           # 🧱 REUSABLE COMPONENTS
│   │   ├── DietaryOptions/   # Dietary restrictions + religious/cultural
│   │   ├── PantryInput/      # Ingredient input with tags
│   │   ├── ShoppingScroll/   # Ingredient checklist + shopping list + PDF
│   │   ├── NourishmentHighlights/  # Nutritional benefits display
│   │   └── index.js          # Clean exports
│   │
│   ├── pages/                # 📄 TOME PAGES
│   │   ├── Home.jsx          # Landing page
│   │   ├── Flourish.jsx      # Flourish tome
│   │   ├── Cuddlecore.jsx    # (to be migrated)
│   │   └── ...
│   │
│   ├── styles/               # 🎨 SHARED STYLES
│   │   ├── base.css          # Colors, typography, reset
│   │   └── components.css    # Shared component styles
│   │
│   ├── App.jsx               # Main app with routing
│   └── main.jsx              # Entry point
│
├── index.html
├── package.json
└── vite.config.js
```

## 🧱 Component Philosophy

### DRY (Don't Repeat Yourself)

Instead of copying the same 50 lines of dietary checkboxes into 4 different files, we have ONE component:

```jsx
// Before (in every tome HTML file):
<div class="option-item">
  <input type="checkbox" id="diet-halal" name="dietary" value="halal">
  <label for="diet-halal">Halal</label>
</div>
// ... repeated 10+ times per page

// After (in any tome):
<DietaryOptions 
  options={[{ id: 'low-fodmap', label: 'Low-FODMAP', value: 'low-fodmap' }]}
  onChange={setDietaryData}
/>
```

### Component Customization

Each component accepts **props** to customize behavior:

```jsx
// Cuddlecore might have Low-FODMAP option
<DietaryOptions options={[
  { id: 'low-fodmap', label: 'Low-FODMAP', value: 'low-fodmap' }
]} />

// Flourish might have High-Protein option
<DietaryOptions options={[
  { id: 'high-protein', label: 'High protein', value: 'high-protein' }
]} />
```

The religious/cultural options (Halal, Kosher, Jain, etc.) are **built into the component** — they show on every tome automatically.

## 🎨 Styling System

### CSS Variables (Theming)

Each tome sets its accent color via CSS variable:

```css
/* In Flourish.css */
.flourish-theme {
  --tome-accent: var(--golden);
  --tome-accent-soft: var(--golden-soft);
}

/* In Cuddlecore.css */
.cuddlecore-theme {
  --tome-accent: var(--berry);
  --tome-accent-soft: var(--berry-soft);
}
```

All shared components automatically use `var(--tome-accent)` — they adapt to whichever tome they're in!

### Style Layering

1. **base.css** — Colors, typography, reset (loaded globally)
2. **components.css** — Shared component styles (loaded globally)
3. **[Tome].css** — Tome-specific overrides only

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Navigate to project
cd whiskedaway-react

# Install dependencies
npm install

# Start development server
npm run dev
```

This will start a local server at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

This creates a `dist/` folder with static files ready for deployment.

### Deployment (Cloudflare, since Oct 2026)

- **Site:** `npm run deploy` builds and uploads `dist/` to the `whiskedaway-site` Worker, which
  answers whiskedaway.com via a Worker route (DNS still points at DreamHost; removing the route
  falls back to it).
- **API:** `npm run deploy:api` deploys `whiskedaway-genie` from `worker/wrangler.toml`. Always use
  this script, or `--config worker/wrangler.toml`: run bare inside `worker/`, wrangler picks up the
  site's `wrangler.jsonc` from the parent folder instead.
- **Bot guard:** `BOT_GUARD` in `worker/wrangler.toml` is `enforce`. If a frontend change needs to
  roll out before the client sends passes, set it to `log` temporarily.

### Deployment to DreamHost (old)

1. Run `npm run build`
2. Upload the *contents* of `dist/` (not the folder itself) into the site's web directory on
   DreamHost. That's the folder named after the domain, `whiskedaway.com/`, in the home
   directory (DreamHost doesn't use `public_html`). Overwrite `index.html`; keep `.htaccess`.
3. Check it's live: `curl -s https://whiskedaway.com/ | grep assets/` should list the new
   `index-<hash>.js` from `dist/index.html`.

## 📦 Available Components

### `<DietaryOptions />`

Dietary restrictions with religious/cultural options.

| Prop | Type | Description |
|------|------|-------------|
| `options` | Array | Additional tome-specific options |
| `showReligious` | Boolean | Show religious section (default: true) |
| `onChange` | Function | Callback with `{ dietary: string[], allergies: string }` |

```jsx
<DietaryOptions 
  options={[{ id: 'keto', label: 'Keto-friendly', value: 'keto-friendly' }]}
  onChange={(data) => console.log(data)}
/>
```

### `<PantryInput />`

Ingredient input with tag management.

| Prop | Type | Description |
|------|------|-------------|
| `placeholder` | String | Input placeholder text |
| `helperText` | String | Helper text above input |
| `onChange` | Function | Callback with array of ingredients |
| `initialItems` | Array | Pre-populated items |

```jsx
<PantryInput 
  placeholder="e.g., salmon, rice (commas to add multiple)"
  onChange={(items) => setPantryItems(items)}
/>
```

### `<ShoppingScroll />`

The big one! Ingredient checklist with shopping list generation and PDF export.

| Prop | Type | Description |
|------|------|-------------|
| `ingredients` | Array | Ingredient objects from API |
| `locale` | String | 'NZ', 'AU', 'UK', 'US', or 'CA' |
| `recipeName` | String | For PDF title |
| `tomeEmoji` | String | Emoji for branding |
| `tomeName` | String | Tome name for branding |
| `accentColor` | Array | RGB values for PDF, e.g., `[139, 77, 92]` |

```jsx
<ShoppingScroll
  ingredients={recipe.ingredients}
  locale="NZ"
  recipeName="Honey Ginger Salmon"
  tomeEmoji="🌱"
  tomeName="Flourish"
  accentColor={[212, 168, 75]}
/>
```

### `<NourishmentHighlights />`

Displays nutritional benefits with "add to pantry" buttons.

| Prop | Type | Description |
|------|------|-------------|
| `highlights` | Array | `{ emoji, compound, benefit, sources: string[] }` |
| `onAddToPantry` | Function | Callback when source is clicked |

```jsx
<NourishmentHighlights 
  highlights={result.nourishment_highlights}
  onAddToPantry={(item) => addToPantryItems(item)}
/>
```

## 🔄 Migration Status

| Tome | Migrated | Notes |
|------|----------|-------|
| Home | ✅ | Landing page |
| Flourish | ✅ | Full implementation |
| Cuddlecore | ✅ | Full implementation |
| Chiapothecary | ✅ | Full implementation |
| Sweet Spells | ✅ | Full implementation |
| Cravings Decoded | ✅ | Full implementation |
| Nourish Academy | ✅ | Full implementation |

## 💡 Key Concepts for Learning

### Props
Data passed INTO a component. Like function arguments.

```jsx
// Passing props
<DietaryOptions showReligious={true} />

// Receiving props (inside component)
function DietaryOptions({ showReligious }) {
  if (showReligious) { ... }
}
```

### State
Data that lives INSIDE a component and can change.

```jsx
const [items, setItems] = useState([]);  // Start with empty array
setItems([...items, 'new item']);         // Update state
```

### Hooks
Special functions that let you "hook into" React features.

- `useState` — Store and update data
- `useEffect` — Do something when component loads or data changes

### Components
Reusable pieces of UI. Like LEGO blocks. Capital letter names.

```jsx
// A component is just a function that returns JSX
function MyButton({ label }) {
  return <button>{label}</button>;
}

// Use it like HTML
<MyButton label="Click me" />
```

## 🤝 Working with Your Dev Team

Now you can speak their language:

- "Can we make the DietaryOptions component also support X?"
- "The ShoppingScroll needs a new prop for Y"
- "Let's add a new shared component for Z"
- "This should be in base.css, not the page-specific styles"

---

## Made with 💛 by Gemma & Claude

## Exploratory navigation prototype

See [docs/concept-exploratory-navigation.md](docs/concept-exploratory-navigation.md) for the idea.
Run `npm run dev` and open `/blender/explore.html` (local navigator), or
`/blender/explore.html?ai=1` for the AI navigator (uses the live Worker with a visitor pass).
The panorama is built by `blender/cuddlecore_build.py` (assets: `python -I blender/fetch_assets.py`).
