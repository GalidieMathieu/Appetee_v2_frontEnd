/**
 * Pure criteria tests for canonical URL round-trips and stable discovery query identity.
 * Phase 10 covers ingredient ID normalization, default ALL mode, URL round-trips, and query keys.
 */
import {
  RECIPE_SEARCH_MAX_LENGTH,
  normalizeMaxDifficulty,
  normalizeMaxTotalMinutes,
  normalizeIngredientIds,
  normalizeRecipeSearch,
  normalizeRecipeBadges,
  parseSavedOnly,
  parseRequireAllIngredients,
  recipeDiscoveryCriteria,
  recipeDiscoveryQueryParams,
  recipeDiscoveryQueryKey,
} from './recipe-discovery-search';

describe('recipe discovery search criteria', () => {
  it('trims, collapses whitespace, and bounds URL-provided search text', () => {
    expect(normalizeRecipeSearch('  chicken\n\t rice  ')).toBe('chicken rice');
    expect(normalizeRecipeSearch(`  ${'a'.repeat(120)}  `)).toHaveLength(
      RECIPE_SEARCH_MAX_LENGTH
    );
  });

  it('creates a deterministic case-insensitive query key', () => {
    const first = recipeDiscoveryQueryKey(recipeDiscoveryCriteria({
      search: ' Chicken   Rice ',
      ingredientIds: [34, 12, 34],
      badges: ['Quick Meal', 'High Protein', 'Quick Meal'],
    }));
    const second = recipeDiscoveryQueryKey(recipeDiscoveryCriteria({
      search: 'chicken rice',
      ingredientIds: [12, 34],
      badges: ['High Protein', 'Quick Meal'],
    }));

    expect(first).toBe(second);
  });

  it('round-trips canonical search and omits an empty default from URL params', () => {
    const serialized = recipeDiscoveryQueryParams(
      recipeDiscoveryCriteria({ search: '  chick   peas ' })
    );

    expect(serialized).toEqual({
      search: 'chick peas',
      ingredientIds: null,
      requireAllIngredients: null,
      badges: null,
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: null,
    });
    expect(recipeDiscoveryCriteria({ search: serialized.search })).toEqual({
      search: 'chick peas',
      ingredientIds: [],
      requireAllIngredients: true,
      badges: [],
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: false,
    });
    expect(recipeDiscoveryQueryParams(recipeDiscoveryCriteria({ search: '   ' }))).toEqual({
      search: null,
      ingredientIds: null,
      requireAllIngredients: null,
      badges: null,
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: null,
    });
  });

  it('round-trips savedOnly=true, omits false, and includes membership in the query key', () => {
    const savedCriteria = recipeDiscoveryCriteria({ search: 'chicken', savedOnly: true });

    expect(parseSavedOnly('true')).toBe(true);
    expect(parseSavedOnly('false')).toBe(false);
    expect(parseSavedOnly('yes')).toBe(false);
    expect(recipeDiscoveryQueryParams(savedCriteria)).toEqual({
      search: 'chicken',
      ingredientIds: null,
      requireAllIngredients: null,
      badges: null,
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: true,
    });
    expect(recipeDiscoveryQueryKey(savedCriteria)).not.toBe(
      recipeDiscoveryQueryKey(recipeDiscoveryCriteria({ search: 'chicken' }))
    );
  });

  it('canonicalizes all nine badge values and serializes repeated filter parameters', () => {
    const criteria = recipeDiscoveryCriteria({
      badges: ['Quick Meal', 'invalid', 'High Protein', 'Quick Meal'],
      maxTotalMinutes: '45',
      maxDifficulty: 'Medium',
    });

    expect(criteria.badges).toEqual(['High Protein', 'Quick Meal']);
    expect(recipeDiscoveryQueryParams(criteria)).toEqual({
      search: null,
      ingredientIds: null,
      requireAllIngredients: null,
      badges: ['High Protein', 'Quick Meal'],
      maxTotalMinutes: 45,
      maxDifficulty: 'Medium',
      savedOnly: null,
    });
  });

  it('removes malformed filters and treats Hard as the unrestricted difficulty default', () => {
    expect(normalizeRecipeBadges(['Low Carb', 'unknown'])).toEqual(['Low Carb']);
    expect(normalizeMaxTotalMinutes('44')).toBeNull();
    expect(normalizeMaxTotalMinutes('90')).toBe(90);
    expect(normalizeMaxDifficulty('Hard')).toBeNull();
    expect(normalizeMaxDifficulty('Impossible')).toBeNull();
  });

  it('normalizes repeated ingredient IDs and round-trips the nondefault ANY mode', () => {
    const criteria = recipeDiscoveryCriteria({
      ingredientIds: ['34', '12', '34', '-1', 'invalid', '99', '101'],
      requireAllIngredients: false,
    });

    expect(normalizeIngredientIds([34, 12, 34, 99, 101])).toEqual([12, 34, 99]);
    expect(criteria.ingredientIds).toEqual([12, 34, 99]);
    expect(criteria.requireAllIngredients).toBe(false);
    expect(parseRequireAllIngredients(null)).toBe(true);
    expect(parseRequireAllIngredients('true')).toBe(true);
    expect(parseRequireAllIngredients('false')).toBe(false);
    expect(recipeDiscoveryQueryParams(criteria)).toEqual({
      search: null,
      ingredientIds: [12, 34, 99],
      requireAllIngredients: false,
      badges: null,
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: null,
    });
    expect(recipeDiscoveryCriteria({ requireAllIngredients: false })).toMatchObject({
      ingredientIds: [],
      requireAllIngredients: true,
    });
  });

  it('preserves literal LIKE metacharacters for safe backend parameter handling', () => {
    expect(recipeDiscoveryCriteria({ search: '100% _ \\ soup' })).toEqual({
      search: '100% _ \\ soup',
      ingredientIds: [],
      requireAllIngredients: true,
      badges: [],
      maxTotalMinutes: null,
      maxDifficulty: null,
      savedOnly: false,
    });
  });
});
