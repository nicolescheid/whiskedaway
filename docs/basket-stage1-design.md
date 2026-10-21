# Recipe basket, Stage 1: design note (Ideas build (4), 22 Oct 2026)

Free only. Phone first. Built inside the book's existing dialog, so history, focus, inert and the phone sheet come for free.

## Model
- **Basket** (`explore/basket.js`, localStorage `wa-basket`, like `wa-book`): leaflets = idea snapshots. Cap 30.
- **Book** = recipes Gemma has written out (plus anything kept before today, unchanged).
- **Allowance**: 3 a day per device, localStorage `wa-allowance` `{ day: 'YYYY-MM-DD' (local), n }`. Shared by checkout,
  "Get the full recipe", the Mix and cook mode (all go through `writer.writeNow`). A failure never counts. Soft limit:
  clearing the browser resets it; the Worker's rate limits are unchanged.
- **Any write-out lands in the book** (and leaves the basket). Keep on an already-written recipe goes straight to the book.

## Screens
- Bar chip: was "Gemma's recipe book / Book", now **"Your basket / Basket"** with the leaflet count. It opens the book at a new
  first page, **Basket** (the checkout). Footer tabs: Basket · Contents · This visit.
- **Basket page (checkout):** heading; allowance line ("3 free today" / "2 left today" / none left, back tomorrow);
  one row per leaflet: tick box, title, room ribbon, Read ›, ✕ take out. Nothing ticked by default (deliberate choice),
  except the idea a centrepiece or the star chart just added. Can't tick more than are left. Diet question as on a page.
  Button "Write out N". Rows show writing… / written ✓ / failed (stays). After: "Open in my book".
  Empty: a line that ♥ Keep puts leaflets here, plus "Open my book".
- **Leaflet page** (Read ›): the loose page, footer "In your basket · Take it out"; "Get the full recipe" still works.
- **♥ Keep** (highlight, swipe, loose page): into the basket; flies to the basket chip as now.
- **Centrepieces / star chart:** add the idea, Gemma says her line, checkout opens with it ticked (whenFree). Written
  already: opens its page, free. While the checkout writes a cast's idea, the object glows and her writing/done/failed lines
  are the cast's. At the cap: her atCap line, checkout opens (leaflet waits for tomorrow).
- **Print:** "Save as PDF / print" under every written recipe. A print-only sheet (`#print-sheet`) gets the recipe; a
  print stylesheet hides everything else; `window.print()`.

## Analytics (allow-list change: API deploy needed)
- `basket_add` from (button|swipe|book|cast|star_chart), basket_size
- `checkout_open` from (chip|cast|star_chart|tab), basket_size, remaining
- `checkout_written` count (written this checkout), failed, remaining
- `allowance_reached` from (checkout|book|mix|cook): sent when a write takes today's left to 0

## Copy
Placeholder keys under `basket` in gemma-lines.json (listed in the report); the keep lines move to `basket.keep.*`
(same shape as `keep`). Content editor (3) writes the words; changed meanings flagged for `write_out.*`, `cast.*.atCap/failed`,
`chia.mix.cap/capNone`.

## Copy keys for content editor (3) (placeholders in gemma-lines.json now)
- New, `basket.*`: chip_long, chip_short, tab, title, intro, empty, free ({n}), free_one, none, pick_full, write_button ({n}),
  write_one, writing, written, failed, open_book, read, remove, remove_page, in_basket, keep_button, book_empty,
  keep.{first_ever, first_this_visit[], third[] ({cluster_label}), later[]} (the keep lines now say "basket").
- New: `cast.{spell,pot,table}.added` (said as the centrepiece puts its idea in the basket); `write_out.print`.
- Meaning changed, rewritten as placeholders: `cast.{spell,pot,table}.atCap` / `.failed` (the leaflet waits in the basket,
  no idea card any more); `write_out.remaining`, `remaining_one`, `at_cap`; `chia.lines.cap`, `capNone` (3 a day, not a visit).
- Worth a look, unchanged: `chia.lines.written` ("Keep it if you like it": a Mix write-out now goes into the book by itself);
  the notebook's privacy paragraph in explore.html (#notes: mentions the book, not the basket); "Clear my book" now empties
  the basket too (its note says so).

## Basket 2 (Nicole's follow-ups, 22 Oct)
- Two places, two chips: "Your basket / Basket" (basket-view.js, its own sheet with the checkout; ideas still fly to it, id
  btn-book) and "My recipe book / Book" (btn-mybook; the book, "My Custom Recipe Book", only written-out recipes, each
  with Cook this). On phones below 400 px the chips tighten and Front door reads "Door" so six fit one row at 375.
  Older keeps never written out move to the basket on load. Basket → book and book → basket wait for the history step back.
- A leaflet's Read › opens it in place in the basket (short version). An idea read from its card is a loose page headed
  "A recipe idea".
- Explainers: an empty book shows how it works (3 steps + Open my basket); a book opened with recipes shows a short
  first-use note once per device (wa-book introSeen), gone on Got it or close.
- Diet "More options": halal, kosher, hindu-no-beef (labelled Hindu), keto, low-carb. Sent to the write-out as ids (the
  Worker passes dietary_restrictions through unchanged: no API deploy). They shape the ideas only on cards content has judged
  for that need (atom.diet_checked: needs judged; atom.diet: needs met), like low-FODMAP and fodmap_checked. Checkout: needs
  already set show as "I'll keep to {d}. Change" (write_out.keeping, change_diets), Change opens the buttons pre-filled.
- Renames: "Add recipe to my book" / "Add {n} recipes to my book" (basket.add_one/add_many, replacing write_one/write_button);
  "Shopping list" (book.shopping_list) in the book's Contents, cook mode and the list's heading.
- New keys: book.{title, chip_long, chip_short, loose_title, how_title, how[3], to_basket, first_use_title, first_use, got_it,
  shopping_list}; basket.{add_one, add_many, read_less, leaflet_need, leaflet_how, close}; write_out.{more_diets, diet_labels.*}.

## Recipe tools: measurements, swaps, re-writes (22 Oct)
- Measurements: write_out.units_* ; the visit's `units` (metric | cups | both), default from the Map's country (US → cups,
  else metric). Checkout: "In metric. Change" beside the diet line. A written recipe stores `units` and says "Written in …
  Change"; choosing another offers "Re-write it in …".
- Swaps: on a written recipe, an ingredient with swaps is a button; its swaps come from gemma-lines.json `swaps.table`
  (key = the ingredient's base word, also matched as a word in its name; up to 6 short swaps), and sugar/honey/maple/agave
  also get Sweet Spells' "Sweeten with" list. Picking one re-writes the recipe with it; the page keeps the old one until the
  new one lands; a failure shows write_out.rewrite_failed and isn't counted.
- Cost rule (PM 4): re-writes don't use the 3 a day; 5 a day per device (localStorage `wa-rewrites`), the visitor pass as
  ever, and the Worker's /rewrite route with its own REWRITE_LIMIT (3 a minute per visitor). A true daily cap on the server
  would need storage (KV or D1), which the Worker doesn't have yet. Event: recipe_rewrite {kind: swap|units, outcome, remaining}.
