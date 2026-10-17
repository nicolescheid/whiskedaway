# WhiskedAway: exploratory navigation

*Concept note, October 2026. Living document.*

## What WhiskedAway is for

WhiskedAway is an experiment in **AI-powered navigation**, not a recipe app. The question it asks:

> What if a content website noticed *how* you were exploring it, and showed you what made
> sense *given that exploration*, instead of making you translate your need into its menu?

It isn't personalisation in the commercial sense. Nothing is profiled, sold or optimised for
conversion. Gemma is a host, not a funnel. The experiment is about navigation itself: what a
content website *is* when its structure can respond.

## Where it is today

The Inn looks exploratory, but it's still traditional navigation in costume. The jars, candles
and map are buttons with a metaphor painted on: each one maps 1:1 to a fixed form panel, and
clicking the jars opens the same symptoms form every time, whatever you did before.

There's already a behaviour layer (`src/engine/`). It records kitchen visits, object clicks and
form choices, and builds a long-lived "taste portrait" in localStorage. Today that only
pre-fills forms and changes Gemma's greeting. It's also built the commercial way: an
accumulating, cross-session profile of a person.

## The shift: from profile to trail

| | Profiling (what we're moving away from) | Exploration (what we're testing) |
|---|---|---|
| **Unit** | The person | The current visit's **trail** |
| **Question** | "Who is this user?" | "What is this wander *about*?" |
| **Memory** | Accumulates indefinitely | Lives for the session; visible; one tap to clear |
| **Output** | Ranking, targeting | What the room reveals, what Gemma says, what content surfaces |
| **Legibility** | Hidden | Always explains itself ("because you lingered by the window…") |

A trail is the sequence of things you touched, looked at for a while, opened, and set aside.
It's a hypothesis about intent that's allowed to be wrong, and to change direction mid-visit.

## Two layers

**1. The map (fixed navigation).** It's always there, always the same, and never reshuffled. It
holds every kitchen, every tool (feelings, energy, dietary needs, pantry, location) and a
straight path to "just give me a recipe". It's the floor you can always stand on. Quick Mode is
its fullest form. Nothing in the exploratory layer is ever the *only* way to reach something.

**2. The wander (exploratory layer).** This is the room itself. Objects are no longer buttons;
they are **carriers of meaning**. Each has a few themes (the rain-streaked window: *rain, slow,
warming, broth*; the armchair: *rest, no-cook, low spoons*). The AI reads the trail across
those themes and decides three things:

- **Reveal:** which untouched objects start to glow, because they're the natural next step.
  The room gently rearranges its attention, not its furniture.
- **Say:** one line from Gemma that names the pattern softly ("Rain, honey, the armchair… you
  want something warm you don't have to stand up for?"), with an easy out.
- **Serve:** a small number of content pieces that fit the wander. Each one says *why* it's
  here.

The same jar of ginger means something different after the window and the armchair (warming,
low effort) than after the cutting board and the plant (fresh, zingy, cooking). **The object
stays fixed; its meaning resolves in context.** That's the core of it.

## Content has to become atoms

You can only navigate by exploration if the content comes in pieces small enough to recombine.
Each kitchen needs a corpus of **content atoms**: a recipe idea, an ingredient story, a
technique, a comfort ritual, a "why this works". Each is short, tagged with themes, and tagged
with effort ("spoons").

- **Curated atoms are the ground truth.** The AI *chooses and connects*; it doesn't invent
  the content. This keeps it accurate and keeps Gemma's ethics (no medical claims) enforceable.
- **Generated connective tissue.** Gemma's lines and the "why" explanations are generated, and
  full recipes can still be generated on request at the pot. That's the existing Worker.

## Rules of good exploration

1. **No dead ends.** Every reveal leads somewhere; the map is always one tap away.
2. **Explain everything.** Every served piece shows its reason. No reason, no serve.
3. **Low confidence means offer a fork, not a guess.** "Warming soup, or something fresh?"
4. **Forgetting is a feature.** The trail is session-only, visible as Gemma's notebook, and
   clearable. Nothing is sent anywhere except, in AI mode, the trail itself, which is
   anonymous and unstored.
5. **The room may change its attention, never its layout.** Spatial memory is what makes it
   navigable.
6. **Choose only from what exists.** The AI picks object and atom IDs from the lists it's given;
   anything else is discarded.

## The 360° rooms make this richer

In a panorama, *where you look* is a signal. Holding your view near an object for a moment
counts as lingering, which is quieter than a click. Photoreal rooms also make "uncommitted"
objects (the window, the cat, the armchair) feel natural to explore, and those are exactly the
objects that carry mood rather than function.

## Weather as a dial (Nicole, 17 Oct 2026)

The view through the window colours what a visitor wants, so the visitor should be able to
**change the weather** to match how they feel, not how it is outside.

- **The control is in the world:** an old inn barometer on the wall, its dial reading *Stormy ·
  Rain · Change · Fair · Very Dry*. Turning it changes the sky. The window stays a mood object.
- **The whole room re-lights:** each weather is its own render (sun across the floor, a storm
  with the candles carrying the room), cross-faded in the viewer. The window views come from
  ChatGPT with identical framing (see `art-brief-cuddlecore-window.md`).
- **It's a trail signal:** a weather choice is a strong, deliberate event. *Fair* leans to fresh,
  bright and no-cook; *Stormy* to hearty, warming and slow; *Very Dry* to cooling and hydrating;
  *Change* (mist) to gentle and quiet. Gemma names it lightly, and it never overrides what the
  visitor does next.
- **Mood, not forecast:** each room starts on its own weather. Using the visitor's real local
  weather could come later, only as an explicit opt-in.

## The prototype (blender/explore.html)

One room, Cuddlecore, as a 360° panorama:

- **Objects:** the 7 navigation objects (which still open their fixed tool) plus ambient objects
  (window, armchair, plant, oil lamp, cutting board, bowl, basket), all with themes.
- **Trail:** touches, lingers (gaze dwell) and opened or dismissed atoms, kept in
  sessionStorage and shown in Gemma's notebook.
- **Engine:** after each meaningful event, the trail goes to a navigator that returns a
  hypothesis, a confidence, objects to reveal, a Gemma line, atoms to serve, and a reason for
  each.
  - **Local mode** (default): deterministic theme-weighting in the browser, so the loop works
    with no network.
  - **AI mode** (`?ai=<worker-url>`): the Worker's `/navigate` route asks Claude to read the trail,
    constrained to the given IDs and a JSON schema. It falls back to local mode on any error.
- **Map:** a fixed panel listing every object and tool, always available.

### What we're trying to learn

- Does the content that surfaces *feel like it understood the wander*, or like a guess?
- Do people notice the glow and follow it, or ignore it?
- Is the "why" reassuring or creepy? Where's the line?
- Does local theme-weighting already get 80% of the way, so the AI's value is the *language*
  (naming the pattern, the forks), or does the AI change *what* is served?

### First findings (17 Oct 2026, four scripted wanders)

| Wander | Local engine | AI navigator (Claude Opus 5.5, low effort) |
|---|---|---|
| Rain → armchair → jars | Forks between "warm and slow" and "rest" | Combines them: "something warm you don't have to stand up for"; serves honey-ginger tea and toast soldiers |
| Rain + plant (ambiguous) | Forks, but still serves two pieces | Forks and serves nothing: "or you can just keep poking about" |
| Chose fresh, then "not this" on cucumber water | Herb salt and congee | Reads the dismissal as "fresh, but not a cold drink"; serves herb salt and explains why |
| Plant → chopping board | Herb salt and cucumber water | Same picks, with far more specific reasons |

- **The AI changes *what* is served, not just the wording.** It combines readings that are
  compatible, holds back when unsure, and treats "not this" as information.
- **Latency is the cost:** 6–9 seconds per step, against instant for the local engine. The
  prototype now runs as a hybrid: the room responds at once with the local reading (glow and
  Gemma's line), then the AI refines it and serves. `NAVIGATOR_MODEL` on the Worker can trade
  quality for speed (e.g. Claude Haiku 5.5) if the wait feels too long.

## Open questions

- How should a trail carry from room to room? Should the hallway doors respond to it?
- Should a returning visitor's previous wander exist at all? Today's `profileAnalyzer`
  says yes; this concept leans no, or only as an opt-in "pick up where you left off".
- What should "serve" look like spatially: a card, an object appearing on the counter, Gemma
  holding something out?
