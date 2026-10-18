import { useState, useCallback, useRef } from 'react';
import { useProfile } from '../contexts/ProfileContext';

import { genieFetch } from '../lib/genie';
import { track } from '../lib/analytics.js';

/**
 * Shared hook for submitting kitchen forms to the Cloudflare Worker.
 * Handles loading state, error handling, and behavioral tracking.
 */
export default function useKitchenSubmit(kitchenId) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { trackRecipeGenerated } = useProfile();
  const inFlight = useRef(false);   // each submit is a paid call: ignore clicks while one is cooking

  const submit = useCallback(async (payload) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setLoading(true);
    setError(null);

    // Counted: that a recipe was asked for and how it went. Never what was in the form.
    track('recipe_request', { scene: kitchenId });
    let answered = false;
    try {
      const response = await genieFetch('/', payload);

      answered = true;
      track('recipe_result', { scene: kitchenId, outcome: response.ok ? 'ok'
        : response.status === 429 ? 'rate_limited' : response.status === 403 ? 'bot_check' : 'error' });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const data = await response.json();
      setResult(data);

      // Track recipe generation
      const recipeNames = extractRecipeNames(data);
      if (recipeNames.length > 0) {
        trackRecipeGenerated(kitchenId, recipeNames);
      }

      return data;
    } catch (err) {
      if (!answered) track('recipe_result', { scene: kitchenId, outcome: 'error' });
      setError(err.message);
      return null;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [kitchenId, trackRecipeGenerated]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, submit, clearResult };
}

function extractRecipeNames(data) {
  const names = [];
  if (data?.recipe?.name) names.push(data.recipe.name);
  if (data?.base_recipe?.name) names.push(data.base_recipe.name);
  if (data?.recipes) {
    data.recipes.forEach(r => { if (r.name) names.push(r.name); });
  }
  if (data?.lesson?.title) names.push(data.lesson.title);
  return names;
}
