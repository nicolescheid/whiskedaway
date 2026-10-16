/**
 * Silent behavioral event recorder.
 * Every interaction is a data point — no questionnaires, just choices.
 */

import { saveEvent } from './storageManager';

let currentSessionId = null;

function getSessionId() {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return currentSessionId;
}

function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'lateNight';
}

function createEvent(type, data) {
  const now = new Date();
  return {
    type,
    timestamp: now.getTime(),
    hour: now.getHours(),
    dayOfWeek: now.getDay(),
    timeOfDay: getTimeOfDay(now.getHours()),
    sessionId: getSessionId(),
    ...data,
  };
}

// --- Public Tracking Functions ---

export function trackSessionStart() {
  currentSessionId = null; // reset for new session
  saveEvent(createEvent('session_start', {}));
}

export function trackKitchenEnter(kitchen) {
  saveEvent(createEvent('kitchen_enter', { kitchen }));
}

export function trackKitchenExit(kitchen) {
  saveEvent(createEvent('kitchen_exit', { kitchen }));
}

export function trackObjectInteract(kitchen, objectId, objectLabel) {
  saveEvent(createEvent('object_interact', { kitchen, objectId, objectLabel }));
}

export function trackOptionSelect(kitchen, field, value) {
  saveEvent(createEvent('option_select', { kitchen, field, value }));
}

export function trackDietarySet(dietaryData) {
  saveEvent(createEvent('dietary_set', { value: dietaryData }));
}

export function trackPantryAdd(items) {
  saveEvent(createEvent('pantry_add', { items }));
}

export function trackLocaleSet(locale) {
  saveEvent(createEvent('locale_set', { locale }));
}

export function trackRecipeGenerated(kitchen, recipeNames) {
  saveEvent(createEvent('recipe_generated', { kitchen, recipeNames }));
}

export function trackQuickModeToggle(mode) {
  saveEvent(createEvent('ui_mode_change', { mode }));
}
