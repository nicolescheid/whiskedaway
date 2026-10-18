# Cook in the room (QA W1, option C): scope

*Content editor, 19 Oct 2026. A scoping note, not a spec Nicole has approved. Option A (honest Gemma copy
on the tools) went in with the content stage 2 branch.*

## The problem

Each room has one "make it" object: the Cuddlecore pot, the Flourish table, the Sweet Spells spell table and
the Chiapothecary jars. Each also has fixed tools: feelings jars, dietary shelf, pantry, map, spell books,
lectern, potion cabinet, drawers, fridge and flasks. In the Inn none of them does anything yet. The old app at
`/archive/` can make recipes, but it's orphaned on purpose and its forms ask for everything up front.

## The idea

When the visitor touches the make-it object, Gemma cooks from what the wander already knows. Only things the
trail can't infer get asked, and only then.

**What the trail already gives us**
- Energy (candle): maps to effort or spoons (`energy_level` for Cuddlecore, `effort_level` for the others).
- Weather and time of day: temperature preference and meal type.
- Season (glasshouse): what's in season.
- The leading cluster: the mood, e.g. "something warm and slow", "a sweet treat", "a pudding to wake you up".
- Atoms opened and set aside: "like this, not that".

**What only the visitor can tell us** (the fixed tools become small in-world pickers)
- Dietary needs (the cookbook shelf). This one matters most: a recipe must respect it, and the trail can't guess it.
- Location (the map): ingredient names and shops. The Worker already asks for `locale`.
- Pantry: optional "use these".
- Room-specific: feelings (Cuddlecore jars), flavour and occasion (Sweet Spells), milk, add-ins and superpower
  (Chiapothecary), goal (Flourish).

## How it would work

1. The make-it object opens a short Gemma card: "Here's what I'll cook from: [what she read from the wander].
   Anything I should know first?" There are chips for dietary needs, plus "That's it, cook".
2. The page builds the existing `handleRecipe` payload for the room's `tome_id` from the trail, plus any chip
   answers. The Worker's recipe route and its ethics prompt stay as they are, so no new prompt is needed for a
   first version.
3. The recipe comes back as a large card on the counter (or a panel in rooms without one). It says why it was
   chosen, like the atom cards do ("Because you picked the low candle and opened the miso broth").
4. The recipe is a trail event (`kind: 'recipe'`), so the notebook shows it and "forget" clears it.

## Pieces of work

- **Page:** trail-to-payload mapping per room, the confirm card, the recipe card, loading and failure states
  in Gemma's voice. Most of it is explore.html, the shared file, so the PM sets the order.
- **Worker:** probably nothing for v1. The recipe route already sits behind the bot guard (`guard(..., 'recipe')`).
  Check its rate limit is fine for the Inn's traffic, and whether it should move to a per-app key (see the
  Anthropic-keys-per-app plan).
- **Content:** Gemma's lines for the card, the wait and the failures. Map each room's chips to the Worker's
  field values. The content editor can own this.
- **Analytics:** `recipe_request`, `recipe_served`, `recipe_failed`, with the room and nav mode, not the inputs.

## Suggested order

1. Cuddlecore pot and the dietary shelf only. It's the oldest room and the one the Worker knows best.
2. The other three rooms, one at a time, each with its own chips.
3. The remaining fixed tools as pickers that feed the trail as well as the recipe.

## Open questions for Nicole

- Should a recipe be made with no dietary answer at all ("That's it, cook"), or should Gemma always ask once?
- Do generated recipes stay on the counter for the visit only, like atoms, or can they be saved?
- Cost: one recipe call is a Sonnet request. Is a per-visit cap (say three recipes) wanted?
