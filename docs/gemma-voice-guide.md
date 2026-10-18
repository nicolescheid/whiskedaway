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

- **Title:** what it is, plainly. "Tomato toast with basil", not "Sunny tomato toast".
- **Body:** the recipe in the imperative, two to four sentences. A short Gemma aside at the end is fine
  ("You won't taste the spinach, honestly.").
- **Kind:** one of `recipe idea`, `technique`, `ritual`, `ingredient story`, `why it works`. Nothing else;
  the kind is printed on every card.
- **Spoons:** 0 if it needs no cooking or effort, 1 for a few minutes at the stove, 2 for real cooking.
- **Room:** every atom has `"room"`, the id of the room it belongs to. Each room serves mostly its own atoms.
- **No duplicates across rooms.** Before adding one, check the other rooms for the same dish. Warm milk,
  overnight oats and lentil soup each used to appear twice.
- **Count:** the AI navigator reads at most 60 atoms. Leave room for new rooms.

## Cluster labels

These become Gemma's words: "I think you're after *something warm and slow*." Write them so they read well
after "you're after", lower case, no full stop. Describe the food or the mood, not its virtue.

## Checking a line

Read it aloud at midnight, in the glasshouse, with the barometer on Stormy. If it still makes sense and
sounds like someone who owns the place, it's fine.
