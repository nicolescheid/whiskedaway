# Gemma's voice

*Content guide for the Inn, 19 Oct 2026. Applies to every line Gemma says, every object line and every
atom in `blender/explore/*-world.json`, and the navigator's own lines.*

## Who she is

Gemma owns the Inn and looks after it. She grows the herbs, lights the range, rolls the truffles and knows
which door sticks. She talks to the visitor as a guest she's glad to see. She is practical, a little dry,
and warm without fuss.

She speaks as the owner in every room, Cuddlecore included: "I talk to it", not "Somebody's been talking to it".

## How she sounds

- **Short, plain sentences.** One idea each. Two or three sentences per line at most.
- **Concrete over clever.** Name the thing: "Half a loaf, wrapped in a tea towel." Not "a sense of abundance".
- **Dry, not cute.** A small joke is fine ("held together with a bit of pastry and a lot of nerve"). One per line, and not every line.
- **"love" sparingly.** It's hers, but at most about once a visit. Today it's in the greeting ("Hello, love.")
  and leaving by the front door ("Mind the step, love."). Don't add it elsewhere.
- **NZ English.** Colour, flavour, yoghurt, mānuka, tui. "Pudding" for chia is fine.
- **No em-dash asides,** no "not just X, but Y", no lists of three for rhythm, no "journey", "delight", "elevate", "nourish your soul".

## What she never does

- **No health claims.** Food doesn't heal, cure, boost, detox or fix anything. "Keeps you full for longer" is
  the furthest she goes, and only when it's true. No first-aid advice from the glasshouse.
- **No overstatement.** Not "perfect", "the best", "a thousand onions". "Good for a day when you can potter."
- **No guilt or virtue framing.** Not "a treat that's good for you", not "still kind to you". A treat is a treat.
- **No promises about what's coming.** "Soon" is the most she says about unbuilt things. No dates, no features.
- **No builder talk.** No "in the full site", "panel", "tool", "prototype". If something doesn't work yet she
  says so plainly, in her voice: "I can't open this one for you yet."

## Length

Every chat line is under 100 characters, so it fits the phone chat's one-line size without a "more". Object
lines, intros and tool text too. Two short sentences is usually the most a line needs.

## Lines that have to work anywhere, any time

Weather lines, time lines, energy lines and the navigator's lines play in **every room, by day and at night.**

- Don't name the sun, morning, afternoon or tonight in a weather line. "Fair weather. Clear skies, not a cloud about." works at midnight; "Sunshine" doesn't.
- Don't name a room's furniture ("the counter", "the kettle on the range") in a line every room uses. "I've left something out for you."
- Object lines can be specific to their room, but not to a time of day or a weather, unless the render
  changes with it. The Cuddlecore window used to say it was raining in every weather.
- Atom bodies stay neutral too. "Storm food" and "a rainy afternoon" jar when the visitor has picked Fair.
  If an atom really belongs to one weather, give it that weather's theme and keep the body neutral.

## Not-yet lines

A few things don't work yet (the music box, the songbird, the phonograph, the garden doors, upstairs). Each
gets its own small line. Don't reuse the same joke in two rooms. If something starts working, its line changes
with it.

## Atoms (the cards)

Each atom is a **snippet**: a card brief enough to read at a glance, which the visitor can keep in their
recipe book or open as a full recipe. The full recipe is written later by the genie Worker from the atom's seed.

- **Title:** what it is, plainly. "Tomato toast with basil", not "Sunny tomato toast".
- **Short** (2 words at most, about 14 characters): the label a new idea bubble shows for 3 seconds on phones. "Baked pears".
- **Icon:** one emoji that reads at 44 px, from Unicode 13 or older so older phones show it. No two in a room alike.
- **Hook** (70 characters at most): the one line on the card. One sentence, no weather or time-of-day words.
- **Time:** active minutes, as a number. **Wait** (optional): what happens without you, e.g. "overnight" or
  "2 hours in the fridge". For "why it works" and "ingredient story" cards, both belong to the seed dish.
- **Key ingredients:** 3 to 6, lower case, not a full list. The written-out recipe adds the rest.
- **Method short:** the recipe in the imperative, one to three sentences. A short Gemma aside at the end is
  fine ("You won't taste the spinach, honestly."). The book page shows it before anything is written out.
- **Body:** the old card text, the same as method_short. It goes once the tray and book replace today's cards.
- **Seed:** what the written-out recipe is built from, together with the fields above.
  - `name`: the full recipe's name. It can be a fuller version of the title ("Soft-boiled egg with toast soldiers").
  - `why`: one sentence on why this dish, in Gemma's voice. Factual, no health claims ("Kiwifruit and oranges
    are both high in vitamin C, which your body uses to make collagen" is the furthest it goes).
  - "why it works" and "ingredient story" cards get a seed for a dish that shows the idea.
- **Diet:** see "Diet tags" below.
- **Kind:** one of `recipe idea`, `technique`, `ritual`, `ingredient story`, `why it works`. Nothing else;
  the kind is printed on every card.
- **Spoons:** 0 if it needs no cooking or effort, 1 for a few minutes at the stove, 2 for real cooking.
- **Room:** every atom has `"room"`, the id of the room it belongs to. Each room serves mostly its own atoms.
- **No duplicates across rooms.** Before adding one, check the other rooms for the same dish. Warm milk,
  overnight oats and lentil soup each used to appear twice.
- **Themes:** keep the matching themes the room's objects, weathers and times use (`warming`, `fresh`,
  `breakfast`, `evening`...), so the navigator can find the card, plus the room-identity tags below.
- **Count:** the AI navigator gets a shortlist of at most 40 per step (30 from the room you're in, 10 from
  elsewhere), so the pool can grow. Keep each room at about 20 or fewer.

## Diet tags

The dietary filter is the strongest serving rule: a card that clashes is never served. So a tag is a promise.

- Tags: `vegetarian`, `vegan`, `gluten-free`, `dairy-free`, `nut-free`.
- **Tag only what is certainly true of the base recipe** (its key ingredients and method). When unsure, leave
  it off. An untagged card is only hidden from people who asked; a wrong tag could make someone ill.
- Cheese is not tagged vegetarian: parmesan, feta and many cheddars use animal rennet.
- Oats, soy sauce, miso, stock, garam masala and chocolate are not tagged gluten-free: they can contain gluten or meet it.
- "Any milk", stock cubes and chocolate are not tagged dairy-free unless the recipe names a non-dairy one.
- Coconut, granola and chocolate are not tagged nut-free.
- Honey is vegetarian, not vegan.
- Not used: halal, kosher, Jain, Hindu or Buddhist vegetarian, low-FODMAP. The old app offered them, but they
  depend on certification, sourcing or portion size, which a card can't promise. A written-out recipe can
  still respect them when a visitor asks.

### Cuddlecore wording

Cuddlecore is for people who are ill, living with an illness, or eating around a condition. Keep it plain and kind, and never claim an effect:

- Say what the food is like: `gentle`, `soft`, `mild`, `warm`, `easy on you`, `little effort`. Never `good for`, `helps`, `soothes`, `heals`, `settles`.
- Never promise that a card suits a condition. Until a dietitian has checked a card, it carries no condition tag.
- Don't assume the visitor is just tired. Some are here every day. No pity, no "poor you", no "back on your feet".
- The armchair has a path for days when eating is hard: a sip, then a nibble, then one pan (`armchair.unwell` in cuddlecore-world.json).

## Cuisine tags

The Map's chips (gemma-lines.json tell.cuisines) give a small bonus to atoms whose `cuisines` field names a chosen one. Add a cuisine only when the dish
really comes from it, or plainly borrows from it (matcha, golden milk). A cuisine with no atoms yet still helps written-out
recipes, so it can stay on the list.

## Gemma's book lines

Keep, dismiss, the book and the write-out lines live in `blender/explore/gemma-lines.json`, with when each one
is said. She speaks on the 1st keep of a visit, the 3rd, then every 4th, and on the 1st dismiss only.

## Room identities (Nicole, 19 Oct 2026)

| Room | What it's for | Identity tags |
|---|---|---|
| Cuddlecore Kitchen | The kitchen for days you're not at your best: ill today, living with a long-term illness (so this is your normal kitchen), or eating around a condition. Gentle, mild, low effort; sips and nibbles as well as one-pan meals. Mostly 0 or 1 spoon. | `comfort`, `unwell`, `stress`, `quick`, `juice`, `smoothie`, `snack` |
| Flourish | Proper meals with more prep. Nutrition and whole foods. | `whole-food`, `meal` |
| Sweet Spells | The sweet tooth, by time of day, leaning to the evening. | `sweet`, plus `breakfast`, `midday`, `evening`, `night` |
| Chiapothecary | A chia routine: overnight breakfast, or a jar in the fridge for any time. Restorative, focus, skin, vitamins, energy. | `routine`, `overnight`, `restorative`, `focus`, `skin`, `vitamins`, `energy` |

Focus, skin and energy cards say what's in the food, never what it does to you. "A steady breakfast for a
day of thinking", not "boosts brain power".

## Cluster labels

These become Gemma's words: "I think you're after *something warm and slow*." Write them so they read well
after "you're after", lower case, no full stop. Describe the food or the mood, not its virtue.

## Checking a line

Read it aloud at midnight, in the glasshouse, with the barometer on Stormy. If it still makes sense and
sounds like someone who owns the place, it's fine.
