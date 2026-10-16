import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';

import { genieFetch } from '../lib/genie';

/**
 * Shared hook for submitting kitchen forms to the Cloudflare Worker.
 * Handles loading state, error handling, and behavioral tracking.
 */
export default function useKitchenSubmit(kitchenId) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { trackRecipeGenerated } = useProfile();

  const submit = useCallback(async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await genieFetch('/', payload);

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
      setError(err.message);
      return null;
    } finally {
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
