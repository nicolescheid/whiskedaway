/**
 * Derives a "taste portrait" from raw behavioral events.
 * The system builds understanding without asking a single direct question.
 */

import { getEvents, getProfile, saveProfile } from './storageManager';

/**
 * Analyze all events and derive a comprehensive profile.
 * Called on kitchen enter and after recipe generation.
 */
export function analyzeAndUpdateProfile() {
  const events = getEvents();
  if (events.length === 0) return getEmptyProfile();

  const profile = {
    // Kitchen affinity — which kitchens visited most
    kitchenAffinity: computeKitchenAffinity(events),

    // Time patterns — when do they cook/browse
    timePatterns: computeTimePatterns(events),

    // Dietary defaults — last-used dietary preferences
    dietaryDefaults: computeDietaryDefaults(events),

    // Pantry history — commonly entered ingredients
    pantryHistory: computePantryHistory(events),

    // Preferred locale — last used location
    preferredLocale: computePreferredLocale(events),

    // Sourcing preference — last used
    sourcingPref: computeSourcingPref(events),

    // Taste signals — derived behavioral indicators
    tasteSignals: computeTasteSignals(events),

    // Session stats
    totalSessions: countSessions(events),
    firstSeen: events[0]?.timestamp || Date.now(),
    isReturning: countSessions(events) > 1,
  };

  saveProfile(profile);
  return profile;
}

/**
 * Get current profile without recalculating.
 */
export function getCurrentProfile() {
  return getProfile() || getEmptyProfile();
}

/**
 * Package a slim context object to append to API payloads.
 * The backend can use this to personalize responses.
 */
export function getContextForAPI() {
  const profile = getCurrentProfile();
  if (!profile || !profile.isReturning) return null;

  return {
    returning_user: true,
    kitchen_affinity: profile.kitchenAffinity,
    taste_signals: profile.tasteSignals,
    visit_count: profile.totalSessions,
  };
}

/**
 * Get dietary defaults to pre-populate forms.
 */
export function getDietaryDefaults() {
  const profile = getCurrentProfile();
  return profile?.dietaryDefaults || { dietary: [], allergies: '' };
}

/**
 * Get commonly used pantry items for suggestions.
 */
export function getPantryHistory() {
  const profile = getCurrentProfile();
  return profile?.pantryHistory || [];
}

/**
 * Get preferred locale.
 */
export function getPreferredLocale() {
  const profile = getCurrentProfile();
  return profile?.preferredLocale || 'NZ';
}

/**
 * Get sourcing preference.
 */
export function getPreferredSourcing() {
  const profile = getCurrentProfile();
  return profile?.sourcingPref || 'supermarket_only';
}

// --- Internal computation functions ---

function getEmptyProfile() {
  return {
    kitchenAffinity: {},
    timePatterns: { morning: 0, afternoon: 0, evening: 0, lateNight: 0 },
    dietaryDefaults: { dietary: [], allergies: '' },
    pantryHistory: [],
    preferredLocale: 'NZ',
    sourcingPref: 'supermarket_only',
    tasteSignals: { comfortSeeking: 0, adventurous: 0, healthFocused: 0 },
    totalSessions: 0,
    firstSeen: Date.now(),
    isReturning: false,
  };
}

function computeKitchenAffinity(events) {
  const counts = {};
  events
    .filter(e => e.type === 'kitchen_enter')
    .forEach(e => {
      counts[e.kitchen] = (counts[e.kitchen] || 0) + 1;
    });
  return counts;
}

function computeTimePatterns(events) {
  const patterns = { morning: 0, afternoon: 0, evening: 0, lateNight: 0 };
  events
    .filter(e => e.type === 'session_start' || e.type === 'kitchen_enter')
    .forEach(e => {
      if (e.timeOfDay && patterns[e.timeOfDay] !== undefined) {
        patterns[e.timeOfDay]++;
      }
    });
  return patterns;
}

function computeDietaryDefaults(events) {
  // Find the most recent dietary_set event
  const dietaryEvents = events.filter(e => e.type === 'dietary_set');
  if (dietaryEvents.length === 0) return { dietary: [], allergies: '' };
  const latest = dietaryEvents[dietaryEvents.length - 1];
  return latest.value || { dietary: [], allergies: '' };
}

function computePantryHistory(events) {
  // Count frequency of all pantry items across sessions
  const freq = {};
  events
    .filter(e => e.type === 'pantry_add')
    .forEach(e => {
      (e.items || []).forEach(item => {
        const normalized = item.toLowerCase().trim();
        freq[normalized] = (freq[normalized] || 0) + 1;
      });
    });

  // Return top 20 most common items
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([item]) => item);
}

function computePreferredLocale(events) {
  const localeEvents = events.filter(e => e.type === 'locale_set');
  if (localeEvents.length === 0) return 'NZ';
  return localeEvents[localeEvents.length - 1].locale;
}

function computeSourcingPref(events) {
  const sourcingEvents = events
    .filter(e => e.type === 'option_select' && e.field === 'sourcing_preference');
  if (sourcingEvents.length === 0) return 'supermarket_only';
  return sourcingEvents[sourcingEvents.length - 1].value;
}

function computeTasteSignals(events) {
  const kitchenEnters = events.filter(e => e.type === 'kitchen_enter');
  const total = kitchenEnters.length || 1;

  const comfortKitchens = kitchenEnters.filter(
    e => e.kitchen === 'cuddlecore' || e.kitchen === 'sweet-spells'
  ).length;

  const adventurousKitchens = kitchenEnters.filter(
    e => e.kitchen === 'chiapothecary' || e.kitchen === 'cravings'
  ).length;

  const healthKitchens = kitchenEnters.filter(
    e => e.kitchen === 'flourish' || e.kitchen === 'academy'
  ).length;

  return {
    comfortSeeking: Math.round((comfortKitchens / total) * 100) / 100,
    adventurous: Math.round((adventurousKitchens / total) * 100) / 100,
    healthFocused: Math.round((healthKitchens / total) * 100) / 100,
  };
}

function countSessions(events) {
  const sessionIds = new Set(events.map(e => e.sessionId).filter(Boolean));
  return sessionIds.size;
}
