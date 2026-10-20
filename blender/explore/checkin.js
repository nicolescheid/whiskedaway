// The check-in's answers (checkin-views.md, Recommended V1): how long you've got, how many you're cooking for, and how at home
// you are in a kitchen. One home per answer, many doors to it: the foyer desk's sheet, the tags under the chat and the notebook all
// set the same visit-store key, show the same tag and get the same line from Gemma. Visit-only, like everything in the store.
//   visit 'time':       'quick' | 'half' | 'hour' | 'any'     about 15 / 30 / 60 active minutes, or no rush
//   visit 'servings':   '1'…'6' | 'crowd'                    a crowd writes out for 8
//   visit 'confidence': 'starting' | 'happy' | 'confident'
// Words come from gemma-lines.json `tell.checkin` (content editor); these stand in until then.

export const TIME_LIMIT = { quick: 15, half: 30, hour: 60, any: null };
export const SERVINGS = ['1', '2', '3', '4', '5', '6', 'crowd'];
export const servingsNumber = v => (v === 'crowd' ? 8 : Number(v) >= 1 ? Math.round(Number(v)) : null);

const DEFAULTS = {
  title: 'Check in', helper: 'Tell me a little, or skip any of it. You can change it later.', more: 'A bit more',
  rows: { energy: 'Light your candle', time: "When it comes to cooking today, how's your patience?", servings: "Who's eating?", confidence: 'How do you feel in the kitchen?',
          weather: "What's it like out?" },
  energyHelper: '',
  time: { quick: "I'm short on patience", half: 'A little patience', hour: 'Plenty of patience', any: "I've got all the time in the world" },
  // not answered, the line under the control, and the words at either end of the dial
  unset: { time: 'Not answered. Pull the string to answer.', confidence: 'Not answered. Turn the dial to answer.' },
  hint: { time: 'Pull the string out.', confidence: 'Turn the dial.' },
  ends: { time: ['', ''], confidence: ["I'm a cautious cook", "I'm a confident chef"] },
  servings: { 1: 'Just me', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', crowd: 'A crowd' },
  confidence: { starting: "I'm a cautious cook", happy: 'I know my way around', confident: "I'm a confident chef" },
  confidenceHelper: 'Energy is today. This is how at home you are cooking.',
  ack: { checkin: "Thanks, love. I'll keep all that in mind.", time: "{t}. I'll keep it to that.", servings: "Cooking for {n}. I'll scale things.",
         servingsOne: "Just you, then. I'll keep it small.", confidence: '{c}. Noted.' },
  told: { time: "You've got {t}.", timeAny: "You're in no rush.", servings: "You're cooking for {n}.", servingsOne: "You're cooking for one.",
          confidence: "In the kitchen: {c}." },
  why: { time: "you've got {t}" },
};

/** The content editor's words over the stand-ins (shallow per block) */
export function checkinWords(lines = {}) {
  const c = lines.checkin || {};
  const out = { ...DEFAULTS, ...c };
  for (const k of ['rows', 'time', 'servings', 'confidence', 'ack', 'told', 'why', 'unset', 'hint', 'ends']) out[k] = { ...DEFAULTS[k], ...(c[k] || {}) };
  return out;
}

/** "about 15 minutes" for a why ("Because you've got about 15 minutes"), from the time label */
export const timeWords = (W, v) => (v && v !== 'any' ? W.time[v].replace(/^./, ch => ch.toLowerCase()) : '');
export const servingsWords = (W, v) => String(W.servings[v] || v).toLowerCase();        // "Cooking for four.

/** Gemma's line for a newly set answer, or null when it isn't one of these */
export function ackLine(W, key, value) {
  if (key === 'time') return value ? W.ack.time.replace('{t}', W.time[value]) : null;
  if (key === 'servings') return value === '1' ? W.ack.servingsOne : value ? W.ack.servings.replace('{n}', servingsWords(W, value)) : null;
  if (key === 'confidence') return value ? W.ack.confidence.replace('{c}', W.confidence[value]) : null;
  return null;
}

/** The notebook's "What you've told me" line for an answer */
export function toldLine(W, key, value) {
  if (!value) return '';
  if (key === 'time') return value === 'any' ? W.told.timeAny : W.told.time.replace('{t}', timeWords(W, value));
  if (key === 'servings') return value === '1' ? W.told.servingsOne : W.told.servings.replace('{n}', servingsWords(W, value));
  if (key === 'confidence') return W.told.confidence.replace('{c}', W.confidence[value] || value);   // {c} stays as the label
  return '';
}
