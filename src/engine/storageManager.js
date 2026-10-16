/**
 * localStorage wrapper with schema versioning and size-aware trimming.
 * Two stores: raw events (append-only) and derived profile (computed snapshot).
 */

const EVENTS_KEY = 'whiskedaway_events';
const PROFILE_KEY = 'whiskedaway_profile';
const SCHEMA_VERSION = 1;
const MAX_EVENTS = 500; // trim oldest events beyond this

function getStore(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    if (parsed.schema_version !== SCHEMA_VERSION) {
      // Future: migration logic here
      return defaultValue;
    }
    return parsed;
  } catch {
    return defaultValue;
  }
}

function setStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // localStorage full — trim events and retry
    if (key === EVENTS_KEY) {
      const trimmed = { ...data, events: data.events.slice(-Math.floor(MAX_EVENTS / 2)) };
      try {
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch {
        // Give up silently — behavioral tracking is non-critical
      }
    }
  }
}

// --- Events Store ---

export function getEvents() {
  const store = getStore(EVENTS_KEY, { schema_version: SCHEMA_VERSION, events: [] });
  return store.events;
}

export function saveEvent(event) {
  const store = getStore(EVENTS_KEY, { schema_version: SCHEMA_VERSION, events: [] });
  store.events.push(event);

  // Trim if over limit
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(-MAX_EVENTS);
  }

  setStore(EVENTS_KEY, store);
}

// --- Profile Store ---

export function getProfile() {
  return getStore(PROFILE_KEY, null);
}

export function saveProfile(profile) {
  setStore(PROFILE_KEY, {
    schema_version: SCHEMA_VERSION,
    ...profile,
    lastUpdated: Date.now(),
  });
}

// --- Utilities ---

export function clearAll() {
  localStorage.removeItem(EVENTS_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

export function getUIPreferences() {
  try {
    const raw = localStorage.getItem('whiskedaway_ui');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUIPreferences(prefs) {
  try {
    localStorage.setItem('whiskedaway_ui', JSON.stringify(prefs));
  } catch {
    // Non-critical
  }
}
