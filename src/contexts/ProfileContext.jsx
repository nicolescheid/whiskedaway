import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { trackSessionStart, trackKitchenEnter, trackKitchenExit, trackObjectInteract, trackOptionSelect, trackDietarySet, trackPantryAdd, trackLocaleSet, trackRecipeGenerated, trackQuickModeToggle } from '../engine/behaviorTracker';
import { analyzeAndUpdateProfile, getCurrentProfile, getContextForAPI, getDietaryDefaults, getPantryHistory, getPreferredLocale, getPreferredSourcing } from '../engine/profileAnalyzer';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(() => getCurrentProfile());

  // Start session on mount
  useEffect(() => {
    trackSessionStart();
    refreshProfile();
  }, []);

  const refreshProfile = useCallback(() => {
    const updated = analyzeAndUpdateProfile();
    setProfile(updated);
  }, []);

  const value = {
    profile,
    refreshProfile,

    // Tracking actions (fire-and-forget, profile refreshes on key events)
    trackKitchenEnter: useCallback((kitchen) => {
      trackKitchenEnter(kitchen);
      refreshProfile();
    }, [refreshProfile]),

    trackKitchenExit: useCallback((kitchen) => {
      trackKitchenExit(kitchen);
    }, []),

    trackObjectInteract: useCallback((kitchen, objectId, objectLabel) => {
      trackObjectInteract(kitchen, objectId, objectLabel);
    }, []),

    trackOptionSelect: useCallback((kitchen, field, value) => {
      trackOptionSelect(kitchen, field, value);
    }, []),

    trackDietarySet: useCallback((dietaryData) => {
      trackDietarySet(dietaryData);
    }, []),

    trackPantryAdd: useCallback((items) => {
      trackPantryAdd(items);
    }, []),

    trackLocaleSet: useCallback((locale) => {
      trackLocaleSet(locale);
    }, []),

    trackRecipeGenerated: useCallback((kitchen, recipeNames) => {
      trackRecipeGenerated(kitchen, recipeNames);
      refreshProfile();
    }, [refreshProfile]),

    trackQuickModeToggle: useCallback((mode) => {
      trackQuickModeToggle(mode);
    }, []),

    // Profile queries
    getDietaryDefaults,
    getPantryHistory,
    getPreferredLocale,
    getPreferredSourcing,
    getContextForAPI,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}

export default ProfileContext;
