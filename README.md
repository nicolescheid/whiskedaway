# WhiskedAway

WhiskedAway (whiskedaway.com) is an AI recipe site hosted by Gemma, a genie who keeps an Inn. It's
also an experiment in exploratory navigation: rooms you wander through, which notice how you
explore and respond to it.

This is the canonical repo (consolidated 17 Oct 2026). Older copies at `C:\dev\whiskedaway-react`,
`C:\dev\www\WhiskedAway\whiskedaway.com` and the loose `whiskedaway-worker.js` files are stale.

## Start here

### What's live

- **The Inn app** at whiskedaway.com: the 2.5D React Inn, with a room for each tome. The original
  form-based tomes are still there at `/original/*`.
- **The explore rooms** at whiskedaway.com/explore: 360° Blender panoramas you can walk between.
  - **Cuddlecore kitchen:** five weathers by day and night, the barometer, the wall clock and the
    five energy candles.
  - **The hallway:** the entrance hall and the middle of the hall, with a magic dial beside the
    doors that takes you to any open room, or wherever your wander points.
  - **The glasshouse:** opens in the visitor's season, with a seasons wheel to change it and a
    glazed door looking into the Chiapothecary.
- **The genie Worker** (`whiskedaway-genie`): recipes, the AI navigator and the Turnstile bot guard.

Flourish, Sweet Spells and the Chiapothecary are being built on their own branches.

### Repo map

| Folder | What's in it |
|---|---|
| `src/` | The React Inn app: scenes, kitchens, overlays, the behaviour engine and the original tomes |
| `worker/` | The genie Worker (`whiskedaway-worker.js`) and its `wrangler.toml` |
| `blender/` | The Blender build scripts for each room (`*_build.py`, shared helpers in `whisked.py`), `fetch_assets.py` for the Poly Haven assets, and `explore.html`, the explore page. Renders and each room's hotspots go in `blender/out/` |
| `blender/explore/` | Room data for the explore page (`*-world.json`: objects, themes, atoms), `navigator.js`, and Gemma's avatar |
| `cloud/` | Rendering on Runpod GPUs: `render.sh`, `pod_render.sh` and the image's `Dockerfile` |
| `art-inbox/` | Concept art and reference packs for each room, mostly from ChatGPT briefs |
| `docs/` | Concept notes, art briefs, the floorplan and the bugs register (index below) |
| `scripts/` | `build-explore.mjs`, which copies the explore page into `public/explore/` at build time |

### How we work

- **One branch and one worktree per room.** From `whiskedaway-react`, run
  `git worktree add ../whiskedaway-<room> -b <room> main` and work in the new folder. Several rooms
  are built at once, so keep each room's changes on its own branch.
- **Deploy only from `whiskedaway-react` on `main`,** and only when main is up to date with GitHub
  (`git pull` first). Room branches are merged into main before they go live.
- **Site:** `npm run deploy` builds and uploads `dist/` to the `whiskedaway-site` Worker, which
  answers whiskedaway.com on a Worker route. DNS still points at DreamHost, and removing the route
  falls back to it.
- **Genie Worker:** `npm run deploy:api` deploys `whiskedaway-genie` from `worker/wrangler.toml`.
  Always use this script, or `--config worker/wrangler.toml`. Run bare inside `worker/`, wrangler
  picks up the site's `wrangler.jsonc` from the parent folder instead.
- **Bot guard:** `BOT_GUARD` in `worker/wrangler.toml` is `enforce`. If a frontend change needs to
  roll out before the client sends passes, set it to `log` for a while.
- **Explore page locally:** run `npm run dev` and open `/blender/explore.html`, or
  `/blender/explore.html?ai=1` for the AI navigator (it uses the live Worker with a visitor pass).
  `?room=hall-entrance`, `?room=hall-middle` or `?room=glasshouse` opens a room directly.
- **Renders:** quick previews run on the laptop. Full 8K renders run on Runpod (see
  `docs/cloud-rendering.md`). Fetch the assets first with `python -I blender/fetch_assets.py`.

### Docs

| Doc | What it's for |
|---|---|
| [concept-exploratory-navigation.md](docs/concept-exploratory-navigation.md) | What WhiskedAway is for, and how the explore rooms and the navigator work |
| [inn-floorplan.html](docs/inn-floorplan.html) | The Inn's plan, every room and its status |
| [bugs-and-features.md](docs/bugs-and-features.md) | Bugs, features and the changelog |
| [cloud-rendering.md](docs/cloud-rendering.md) | Rendering on Runpod |
| [flythrough-plan.md](docs/flythrough-plan.md) | The fly-through video for YouTube |
| [art-brief-cuddlecore.md](docs/art-brief-cuddlecore.md), [-window](docs/art-brief-cuddlecore-window.md), [-night](docs/art-brief-cuddlecore-night.md) | ChatGPT briefs #1 to #3, the Cuddlecore kitchen |
| [art-brief-inn.md](docs/art-brief-inn.md) | Brief #4, the hallway, the magic door and the Inn from outside |
| [art-brief-glasshouse.md](docs/art-brief-glasshouse.md) | Brief #5, the glasshouse |
| [art-brief-gemma.md](docs/art-brief-gemma.md) | Brief #7, Gemma's character design |

### Licences

- **Code** is under the MIT licence: [LICENSE](LICENSE).
- **Art, renders and writing** are under CC BY-SA 4.0: [LICENSE-content](LICENSE-content).
  It lists the third-party pieces that keep their own licences.

Both are © 2026 Nicole Scheid.

---

# The original tomes

These notes are from January 2026, when WhiskedAway was rebuilt in React. They describe the
original form-based tomes, which still live at `/original/*`. They predate the Inn (scenes,
kitchens, overlays) and the explore rooms.

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
