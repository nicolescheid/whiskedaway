/**
 * Scene definitions for all 7 environments.
 * Coordinates use percentages (0-100) relative to the scene stage, which matches the 1400×800
 * SVG viewBox (so x% = svgX / 14, y% = svgY / 8).
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
        x: 12.5, y: 31.2, width: 10.7, height: 46.2,
        label: 'Cuddlecore Kitchen',
        icon: '🍵',
        doorColor: 'var(--berry)',
      },
      {
        id: 'door-flourish',
        type: 'door',
        navigateTo: 'flourish',
        x: 25.4, y: 31.2, width: 10.7, height: 46.2,
        label: 'Flourish Kitchen',
        icon: '🌱',
        doorColor: 'var(--golden)',
      },
      {
        id: 'door-cravings',
        type: 'door',
        navigateTo: 'cravings',
        x: 38.2, y: 31.2, width: 10.7, height: 46.2,
        label: 'Cravings Decoded',
        icon: '🔮',
        doorColor: 'var(--purple)',
      },
      {
        id: 'door-sweet-spells',
        type: 'door',
        navigateTo: 'sweet-spells',
        x: 51.1, y: 31.2, width: 10.7, height: 46.2,
        label: 'Sweet Spells',
        icon: '🧁',
        doorColor: 'var(--rose)',
      },
      {
        id: 'door-chiapothecary',
        type: 'door',
        navigateTo: 'chiapothecary',
        x: 63.9, y: 31.2, width: 10.7, height: 46.2,
        label: 'Chiapothecary',
        icon: '🧪',
        doorColor: 'var(--herb)',
      },
      {
        id: 'door-academy',
        type: 'door',
        navigateTo: 'academy',
        x: 76.8, y: 31.2, width: 10.7, height: 46.2,
        label: 'Nourish Academy',
        icon: '📚',
        doorColor: 'var(--teal)',
      },
    ],
    gemmaPosition: { x: 50, y: 84 },
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
        x: 3.6, y: 17.5, width: 21.4, height: 25,
        label: "How you're feeling",
        icon: '🫙',
        hint: 'Click the jars to share what\'s going on',
      },
      {
        id: 'energy-candles',
        type: 'interactive',
        overlay: 'energy',
        x: 27.9, y: 12.5, width: 8.2, height: 14.4,
        label: 'Energy level',
        icon: '🕯️',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 55.7, y: 12.5, width: 17.9, height: 31.2,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'pantry-cabinet',
        type: 'interactive',
        overlay: 'pantry',
        x: 76.4, y: 15, width: 14.3, height: 40,
        label: 'Your pantry',
        icon: '🗄️',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 28.6, y: 30, width: 5.7, height: 8.1,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 34.3, y: 36.2, width: 14.3, height: 20,
        label: 'Find Comfort',
        icon: '🍲',
        submitLabel: '🍵 Find Comfort',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 3.6, height: 37.5,
        pin: 'left', // stays reachable when narrow windows crop the left edge
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 54, y: 76 },
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
        x: 4.3, y: 10, width: 20, height: 30,
        label: 'Your goal',
        icon: '🎯',
      },
      {
        id: 'meal-clock',
        type: 'interactive',
        overlay: 'mealType',
        x: 27.5, y: 8.1, width: 7.9, height: 13.8,
        label: 'Meal type',
        icon: '🕐',
      },
      {
        id: 'effort-hourglass',
        type: 'interactive',
        overlay: 'effort',
        x: 43.6, y: 9, width: 5.7, height: 15.4,
        label: 'Effort level',
        icon: '⏳',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 58.6, y: 12.5, width: 16.4, height: 31.2,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'pantry-cabinet',
        type: 'interactive',
        overlay: 'pantry',
        x: 78.6, y: 15, width: 14.3, height: 40,
        label: 'Your pantry',
        icon: '🗄️',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 71.4, y: 5, width: 5.7, height: 7.5,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 34.3, y: 40, width: 18.6, height: 16.2,
        label: 'Build Your Meal',
        icon: '🍳',
        submitLabel: '🌱 Build Your Meal',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 3.6, height: 37.5,
        pin: 'left', // stays reachable when narrow windows crop the left edge
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 25, y: 76 },
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
        x: 31.8, y: 23.8, width: 10.7, height: 17.5,
        label: 'Describe your craving',
        icon: '🔮',
      },
      {
        id: 'craving-tags',
        type: 'interactive',
        overlay: 'cravingTags',
        x: 4.3, y: 16.2, width: 20, height: 25,
        label: 'Craving type',
        icon: '🏷️',
      },
      {
        id: 'mood-lanterns',
        type: 'interactive',
        overlay: 'context',
        x: 57.9, y: 10, width: 14.6, height: 23.1,
        label: 'What\'s happening',
        icon: '🏮',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 79.3, y: 8.8, width: 5.7, height: 8.1,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 30, y: 62.5, width: 15.7, height: 12.5,
        label: 'Decode It',
        icon: '✨',
        submitLabel: '🔮 Decode My Craving',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 3.6, height: 37.5,
        pin: 'left', // stays reachable when narrow windows crop the left edge
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 75, y: 72 },
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
        x: 3.6, y: 12.5, width: 20, height: 30,
        label: 'What sounds good',
        icon: '🍬',
      },
      {
        id: 'occasion-calendar',
        type: 'interactive',
        overlay: 'occasion',
        x: 26.4, y: 7.8, width: 11.4, height: 17,
        label: 'The occasion',
        icon: '📅',
      },
      {
        id: 'effort-hourglass',
        type: 'interactive',
        overlay: 'effort',
        x: 43.6, y: 9, width: 5.7, height: 15.4,
        label: 'Effort level',
        icon: '⏳',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 60.7, y: 12.5, width: 16.4, height: 31.2,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 80, y: 8.8, width: 5.7, height: 8.1,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 34.3, y: 40, width: 12.9, height: 14.4,
        label: 'Cast the Spell',
        icon: '✨',
        submitLabel: '🧁 Cast Sweet Spell',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 3.6, height: 37.5,
        pin: 'left', // stays reachable when narrow windows crop the left edge
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 72, y: 74 },
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
        x: 3.6, y: 12.5, width: 20, height: 30,
        label: 'Choose your vibe',
        icon: '🧪',
      },
      {
        id: 'milk-bottles',
        type: 'interactive',
        overlay: 'basePreference',
        x: 27.1, y: 11.2, width: 12.9, height: 22.5,
        label: 'Base preference',
        icon: '🥛',
      },
      {
        id: 'texture-flask',
        type: 'interactive',
        overlay: 'texture',
        x: 45, y: 9.8, width: 7.1, height: 15,
        label: 'Texture level',
        icon: '⚗️',
      },
      {
        id: 'dietary-shelf',
        type: 'interactive',
        overlay: 'dietary',
        x: 60.7, y: 12.5, width: 16.4, height: 31.2,
        label: 'Dietary needs',
        icon: '📋',
      },
      {
        id: 'pantry-cabinet',
        type: 'interactive',
        overlay: 'pantry',
        x: 80, y: 15, width: 14.3, height: 40,
        label: 'Your pantry',
        icon: '🗄️',
      },
      {
        id: 'locale-map',
        type: 'interactive',
        overlay: 'locale',
        x: 71.4, y: 5, width: 5.7, height: 7.5,
        label: 'Location',
        icon: '🗺️',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 32.1, y: 40.6, width: 12.9, height: 14.4,
        label: 'Brew It',
        icon: '🫧',
        submitLabel: '🧪 Brew My Pudding',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 3.6, height: 37.5,
        pin: 'left', // stays reachable when narrow windows crop the left edge
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 25, y: 76 },
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
        x: 3.6, y: 6.2, width: 27.1, height: 50,
        label: 'Browse topics',
        icon: '📖',
      },
      {
        id: 'chalkboard',
        type: 'interactive',
        overlay: 'question',
        x: 37.1, y: 7.5, width: 32.1, height: 38.1,
        label: 'Ask a question',
        icon: '📝',
      },
      {
        id: 'cauldron',
        type: 'submit',
        x: 38.6, y: 47.5, width: 15.7, height: 9.4,
        label: 'Learn',
        icon: '📚',
        submitLabel: '📚 Teach Me, Gemma',
      },
      {
        id: 'exit-door',
        type: 'door',
        navigateTo: 'inn-exterior',
        x: 0, y: 30, width: 3.6, height: 37.5,
        pin: 'left', // stays reachable when narrow windows crop the left edge
        label: 'Back to the inn',
        icon: '🚪',
      },
    ],
    gemmaPosition: { x: 78, y: 78 },
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
