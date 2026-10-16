/**
 * Context-aware dialogue for Gemma NPC.
 * Lines vary by kitchen, interaction state, time of day, and visit history.
 */

const greetings = {
  'inn-exterior': {
    firstVisit: [
      "Welcome to the WhiskedAway Inn! I'm Gemma, your kitchen genie. Each door leads to a different kind of nourishment. Where does your heart want to go?",
      "Hello lovely! First time here? Every kitchen has its own magic. Just pick a door that calls to you.",
    ],
    returning: [
      "Welcome back! I've been keeping the kitchens warm for you.",
      "Oh, you're here again! I had a feeling. Which kitchen today?",
      "The inn has missed you! Your favourite kitchens are ready and waiting.",
    ],
    lateNight: [
      "Burning the midnight oil? The Cuddlecore kitchen has something warm for you...",
      "Late night visit? I know just the thing. The kitchens are quiet and cozy right now.",
    ],
    morning: [
      "Good morning! Starting the day right? The Flourish kitchen has some energising ideas.",
      "Morning sunshine! Ready to nourish your day?",
    ],
  },

  cuddlecore: {
    greeting: [
      "Oh lovely, you're not feeling your best? Let me help you find something gentle and nourishing...",
      "This is the softest kitchen in the inn. Tell me what's going on, and I'll find something that helps.",
    ],
    hints: [
      "Try clicking the jars to share how you're feeling.",
      "The candles show your energy level — how many spoons do you have today?",
      "Check the pantry — I'll work with whatever you have on hand.",
      "When you're ready, the pot in the centre will conjure something comforting.",
    ],
    afterSubmit: [
      "I hope this brings you some comfort. Remember, gentle nourishment is powerful medicine.",
    ],
  },

  flourish: {
    greeting: [
      "Ready to build something amazing? Let's create a meal that fuels your best self!",
      "Welcome to the Flourish kitchen! What are you working towards today?",
    ],
    hints: [
      "The goal board helps me understand what you're building towards.",
      "Check the clock for what meal you're planning.",
      "The hourglass sets how much time and effort you want to spend.",
      "Ready? The pan will cook up exactly what you need!",
    ],
    afterSubmit: [
      "There you go! A meal designed to help you flourish.",
    ],
  },

  cravings: {
    greeting: [
      "Craving something? Let's decode what your body is really asking for...",
      "The crystal ball sees all cravings. Tell me what's calling to you.",
    ],
    hints: [
      "Gaze into the crystal ball and describe what you're craving.",
      "The tags help me narrow down the type of craving.",
      "The lanterns reveal what's behind the craving — stress, tiredness, emotions...",
      "Ready for answers? Let the crystal ball decode it.",
    ],
    afterSubmit: [
      "Every craving has a story. Now you know what your body was really saying.",
    ],
  },

  'sweet-spells': {
    greeting: [
      "Every treat can be a nourishing one! What kind of sweetness are you dreaming of?",
      "Welcome to the sweetest room in the inn! What shall we conjure?",
    ],
    hints: [
      "Browse the candy jars for the type of sweetness you want.",
      "The calendar helps me match the treat to the moment.",
      "The hourglass tells me how much effort you want to put in.",
      "When you're ready, cast the spell and let the magic happen!",
    ],
    afterSubmit: [
      "Sweet magic, no guilt attached! Every spell here is designed to nourish.",
    ],
  },

  chiapothecary: {
    greeting: [
      "Welcome to the lab! Let's concoct the perfect chia pudding for your mood...",
      "The Chiapothecary is ready for experiments! What vibe are we going for?",
    ],
    hints: [
      "The potions set the vibe — energising, calming, indulgent...",
      "Choose your base from the milk bottles.",
      "The flask controls how thick you want it.",
      "Ready to brew? The beaker will mix your perfect pudding!",
    ],
    afterSubmit: [
      "Your potion is ready! Chia puddings are tiny powerhouses of nourishment.",
    ],
  },

  academy: {
    greeting: [
      "Welcome to the Academy! Browse the shelves for a topic, or write your question on the chalkboard.",
      "Knowledge is the most powerful ingredient. What would you like to learn today?",
    ],
    hints: [
      "The bookshelf has topics curated just for you.",
      "Or write any question on the chalkboard — I love a good puzzle.",
      "When you're ready, I'll teach you everything I know!",
    ],
    afterSubmit: [
      "I hope that helped! Knowledge turns every meal into something more.",
    ],
  },
};

/**
 * Get contextual dialogue for Gemma.
 */
export function getGemmaGreeting(sceneId, { isReturning = false, timeOfDay = 'afternoon' } = {}) {
  const sceneDialogue = greetings[sceneId];
  if (!sceneDialogue) return "Hello! How can I help?";

  // Inn exterior has special time/return-based greetings
  if (sceneId === 'inn-exterior') {
    if (timeOfDay === 'lateNight' && sceneDialogue.lateNight) {
      return pickRandom(sceneDialogue.lateNight);
    }
    if (timeOfDay === 'morning' && sceneDialogue.morning) {
      return pickRandom(sceneDialogue.morning);
    }
    if (isReturning && sceneDialogue.returning) {
      return pickRandom(sceneDialogue.returning);
    }
    return pickRandom(sceneDialogue.firstVisit);
  }

  // Kitchen greetings
  return pickRandom(sceneDialogue.greeting || []);
}

/**
 * Get a contextual hint based on what the user hasn't interacted with yet.
 */
export function getGemmaHint(sceneId, interactedObjects = []) {
  const sceneDialogue = greetings[sceneId];
  if (!sceneDialogue?.hints) return null;

  // Return hints for objects not yet interacted with
  const unshownHints = sceneDialogue.hints.filter(
    (_, i) => !interactedObjects.includes(i)
  );

  return unshownHints.length > 0 ? unshownHints[0] : null;
}

/**
 * Get post-submit message.
 */
export function getGemmaAfterSubmit(sceneId) {
  const sceneDialogue = greetings[sceneId];
  return pickRandom(sceneDialogue?.afterSubmit || ["I hope you enjoy this!"]);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || '';
}
