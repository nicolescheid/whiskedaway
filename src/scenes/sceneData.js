/**
 * Scene definitions for all 7 environments.
 * Coordinates use percentages (0-100) relative to viewport.
 */

export const scenes = {
  'inn-exterior': {
    id: 'inn-exterior',
    name: 'The WhiskedAway Inn',
    accentColor: 'var(--amber)',
    hotspots: [
      {
        id: 'door-cuddlecore',
        type: 'door',
        navigateTo: 'cuddlecore',
        x: 5, y: 35, width: 12, height: 32,
        label: 'Cuddlecore Kitchen',
        icon: '🍵',
        doorColor: 'var(--berry)',
      },
      {
        id: 'door-flourish',
        type: 'door',
        navigateTo: 'flourish',
        x: 20, y: 35, width: 12, height: 32,
        label: 'Flourish Kitchen',
        icon: '🌱',
        doorColor: 'var(--golden)',
      },
      {
        id: 'door-cravings',
        type: 'door',
        navigateTo: 'cravings',
        x: 36, y: 35, width: 12, height: 32,
        label: 'Cravings Decoded',
        icon: '🔮',
        doorColor: 'var(--purple)',
      },
      {
        id: 'door-sweet-spells',
        type: 'door',
        navigateTo: 'sweet-spells',
        x: 52, y: 35, width: 12, height: 32,
        label: 'Sweet Spells',
        icon: '🧁',
        doorColor: 'var(--rose)',
      },
      {
        id: 'door-chiapothecary',
        type: 'door',
        navigateTo: 'chiapothecary',
        x: 68, y: 35, width: 12, height: 32,
        label: 'Chiapothecary',
        icon: '🧪',
        doorColor: 'var(--herb)',
      },
      {
        id: 'door-academy',
        type: 'door',
        navigateTo: 'academy',
        x: 83, y: 35, width: 12, height: 32,
        label: 'Nourish Academy',
        icon: '📚',
        doorColor: 'var(--teal)',
      },
    ],
    gemmaPosition: { x: 45, y: 72 },
    gemmaGreeting: "Welcome to the WhiskedAway Inn! Each door leads to a different kitchen. Where does your heart want to go today?",
    ambientEffects: ['warm-glow', 'particles'],
  },

  cuddlecore: {
    id: 'cuddlecore',
    name: 'Cuddlecore Kitchen',
    tomeId: 'cuddlecore',
    route: '/cuddlecore',
    accentColor: 'var(--berry)',
    accentColorRGB: [139, 77, 92],
    tomeEmoji: '🍵',
    hotspots: [
      {
        id: 'symptom-jars',
        type: 'interactive',
        overlay: 'symptoms',
        x: 6, y: 18, width: 18, height: 28,
        label: "How you're feeling",
        icon: '🫙',
        hint: 'Click the jars to share what\'s going on',
      },
      {
        id: 'energy-candles',
        type: 'interactive',
        overlay: 'energy',
        x: 28, y: 15, width: 14, height: 20,
        label: 'Energy level',
        icon: '🕯️',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 55, y: 12, width: 16, height: 28,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'pantry-cabinet',
        type: 'interactive',
        overlay: 'pantry',
        x: 75, y: 15, width: 14, height: 30,
        label: 'Your pantry',
        icon: '🗄️',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 44, y: 8, width: 10, height: 14,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 38, y: 55, width: 22, height: 24,
        label: 'Find Comfort',
        icon: '🍲',
        submitLabel: '🍵 Find Comfort',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 5, height: 35,
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 68, y: 65 },
    gemmaGreeting: "Oh lovely, you're not feeling your best? Let me help you find something gentle and nourishing...",
    ambientEffects: ['steam', 'candle-flicker', 'rain'],
  },

  flourish: {
    id: 'flourish',
    name: 'Flourish Kitchen',
    tomeId: 'flourish',
    route: '/flourish',
    accentColor: 'var(--golden)',
    accentColorRGB: [212, 168, 75],
    tomeEmoji: '🌱',
    hotspots: [
      {
        id: 'goal-board',
        type: 'interactive',
        overlay: 'goal',
        x: 6, y: 12, width: 20, height: 30,
        label: 'Your goal',
        icon: '🎯',
      },
      {
        id: 'meal-clock',
        type: 'interactive',
        overlay: 'mealType',
        x: 30, y: 10, width: 12, height: 16,
        label: 'Meal type',
        icon: '🕐',
      },
      {
        id: 'effort-hourglass',
        type: 'interactive',
        overlay: 'effort',
        x: 45, y: 12, width: 10, height: 20,
        label: 'Effort level',
        icon: '⏳',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 58, y: 12, width: 16, height: 28,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'pantry-cabinet',
        type: 'interactive',
        overlay: 'pantry',
        x: 78, y: 15, width: 14, height: 30,
        label: 'Your pantry',
        icon: '🗄️',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 72, y: 8, width: 10, height: 14,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 38, y: 55, width: 22, height: 24,
        label: 'Build Your Meal',
        icon: '🍳',
        submitLabel: '🌱 Build Your Meal',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 5, height: 35,
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 25, y: 68 },
    gemmaGreeting: "Ready to build something amazing? Let's create a meal that fuels your best self!",
    ambientEffects: ['particles', 'warm-glow'],
  },

  cravings: {
    id: 'cravings',
    name: 'Cravings Decoded',
    tomeId: 'cravings-decoded',
    route: '/cravings',
    accentColor: 'var(--purple)',
    accentColorRGB: [124, 92, 139],
    tomeEmoji: '🔮',
    hotspots: [
      {
        id: 'crystal-ball',
        type: 'interactive',
        overlay: 'cravingInput',
        x: 30, y: 20, width: 20, height: 28,
        label: 'Describe your craving',
        icon: '🔮',
      },
      {
        id: 'craving-tags',
        type: 'interactive',
        overlay: 'cravingTags',
        x: 8, y: 18, width: 18, height: 25,
        label: 'Craving type',
        icon: '🏷️',
      },
      {
        id: 'mood-lanterns',
        type: 'interactive',
        overlay: 'context',
        x: 58, y: 15, width: 18, height: 25,
        label: 'What\'s happening',
        icon: '🏮',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 80, y: 10, width: 10, height: 14,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 35, y: 55, width: 22, height: 24,
        label: 'Decode It',
        icon: '✨',
        submitLabel: '🔮 Decode My Craving',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 5, height: 35,
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 75, y: 65 },
    gemmaGreeting: "Craving something? Let's decode what your body is really asking for...",
    ambientEffects: ['candle-flicker', 'particles'],
  },

  'sweet-spells': {
    id: 'sweet-spells',
    name: 'Sweet Spells Kitchen',
    tomeId: 'sweet-spells',
    route: '/sweet-spells',
    accentColor: 'var(--rose)',
    accentColorRGB: [194, 122, 140],
    tomeEmoji: '🧁',
    hotspots: [
      {
        id: 'candy-jars',
        type: 'interactive',
        overlay: 'sweetCraving',
        x: 6, y: 15, width: 18, height: 28,
        label: 'What sounds good',
        icon: '🍬',
      },
      {
        id: 'occasion-calendar',
        type: 'interactive',
        overlay: 'occasion',
        x: 28, y: 10, width: 14, height: 18,
        label: 'The occasion',
        icon: '📅',
      },
      {
        id: 'effort-hourglass',
        type: 'interactive',
        overlay: 'effort',
        x: 46, y: 12, width: 10, height: 20,
        label: 'Effort level',
        icon: '⏳',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 60, y: 12, width: 16, height: 28,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 80, y: 10, width: 10, height: 14,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 35, y: 55, width: 22, height: 24,
        label: 'Cast the Spell',
        icon: '✨',
        submitLabel: '🧁 Cast Sweet Spell',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 5, height: 35,
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 72, y: 68 },
    gemmaGreeting: "Every treat can be a nourishing one! What kind of sweetness are you dreaming of?",
    ambientEffects: ['warm-glow', 'particles'],
  },

  chiapothecary: {
    id: 'chiapothecary',
    name: 'The Chiapothecary',
    tomeId: 'chiapothecary',
    route: '/chiapothecary',
    accentColor: 'var(--herb)',
    accentColorRGB: [92, 124, 92],
    tomeEmoji: '🧪',
    hotspots: [
      {
        id: 'vibe-potions',
        type: 'interactive',
        overlay: 'vibe',
        x: 6, y: 15, width: 18, height: 28,
        label: 'Choose your vibe',
        icon: '🧪',
      },
      {
        id: 'milk-bottles',
        type: 'interactive',
        overlay: 'basePreference',
        x: 28, y: 12, width: 14, height: 22,
        label: 'Base preference',
        icon: '🥛',
      },
      {
        id: 'texture-flask',
        type: 'interactive',
        overlay: 'texture',
        x: 46, y: 14, width: 10, height: 20,
        label: 'Texture level',
        icon: '⚗️',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 60, y: 12, width: 16, height: 28,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'pantry-cabinet',
        type: 'interactive',
        overlay: 'pantry',
        x: 80, y: 15, width: 14, height: 30,
        label: 'Your pantry',
        icon: '🗄️',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 72, y: 8, width: 10, height: 14,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 35, y: 55, width: 22, height: 24,
        label: 'Brew It',
        icon: '🫧',
        submitLabel: '🧪 Brew My Pudding',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 5, height: 35,
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 25, y: 65 },
    gemmaGreeting: "Welcome to the lab! Let's concoct the perfect chia pudding for your mood...",
    ambientEffects: ['bubble', 'candle-flicker'],
  },

  academy: {
    id: 'academy',
    name: 'Nourish Academy',
    tomeId: 'nourish-academy',
    route: '/academy',
    accentColor: 'var(--teal)',
    accentColorRGB: [74, 124, 124],
    tomeEmoji: '📚',
    hotspots: [
      {
        id: 'bookshelf',
        type: 'interactive',
        overlay: 'topic',
        x: 8, y: 10, width: 25, height: 40,
        label: 'Browse topics',
        icon: '📖',
      },
      {
        id: 'chalkboard',
        type: 'interactive',
        overlay: 'question',
        x: 40, y: 10, width: 30, height: 35,
        label: 'Ask a question',
        icon: '📝',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 35, y: 58, width: 22, height: 22,
        label: 'Learn',
        icon: '📚',
        submitLabel: '📚 Teach Me, Gemma',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 5, height: 35,
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 75, y: 60 },
    gemmaGreeting: "Welcome to the Academy! Browse the shelves for a topic, or write your question on the chalkboard.",
    ambientEffects: ['candle-flicker', 'particles'],
  },
};

/**
 * Get a scene definition by ID.
 */
export function getScene(sceneId) {
  return scenes[sceneId] || null;
}

/**
 * Get all kitchen scenes (exclude inn exterior).
 */
export function getKitchenScenes() {
  return Object.values(scenes).filter(s => s.id !== 'inn-exterior');
}

/**
 * Get scene ID from a route path.
 */
export function getSceneIdFromRoute(path) {
  const routeMap = {
    '/': 'inn-exterior',
    '/cuddlecore': 'cuddlecore',
    '/flourish': 'flourish',
    '/cravings': 'cravings',
    '/sweet-spells': 'sweet-spells',
    '/chiapothecary': 'chiapothecary',
    '/academy': 'academy',
  };
  return routeMap[path] || 'inn-exterior';
}

/**
 * Get route path from scene ID.
 */
export function getRouteFromSceneId(sceneId) {
  if (sceneId === 'inn-exterior') return '/';
  const scene = scenes[sceneId];
  return scene?.route || '/';
}
