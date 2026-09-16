/**
 * Pure normalization, query-key, and URL helpers for Recipe Discovery criteria.
 * Phase 10 canonicalizes repeated ingredient IDs and the default-ALL composition mode here.
 */
import {
  RecipeBadge,
  RecipeDiscoveryCriteria,
  RecipeMaximumDifficulty,
} from '@app/core/shared/data-access/recipes/recipe.model';
import {
  RECIPE_SEARCH_MAX_LENGTH,
  normalizeRecipeSearchValue,
} from '@app/core/shared/ui/recipe-search-bar/recipe-search';

export { RECIPE_SEARCH_MAX_LENGTH };
export const RECIPE_INGREDIENT_LIMIT = 3;
/**
 * Frontend mirror of the documented API badge enum and presentation priority.
 * This is intentionally not loaded from the database: it is a small versioned API contract,
 * while the backend remains authoritative and validates every incoming value. Any contract
 * change must update both sides together; until then, an unknown backend value is not offered
 * as a filter by this client.
 */
export const RECIPE_BADGE_OPTIONS: readonly RecipeBadge[] = [
  'High Protein',
  'Low Calorie',
  'Low Carb',
  'High Fiber',
  'Quick Meal',
  'Meal Prep',
  'Freezer Friendly',
  'Budget Friendly',
  'Few Ingredients',
];
export const RECIPE_MAX_TOTAL_MINUTES_OPTIONS = [15, 30, 45, 60, 90] as const;
/** Hard means unrestricted, so only meaningful maximums are serialized to the API. */
export const RECIPE_MAX_DIFFICULTY_OPTIONS: readonly RecipeMaximumDifficulty[] = [
  'Easy',
  'Medium',
];

export interface RecipeDiscoveryCriteriaInput {
  readonly search?: string | null;
  readonly ingredientIds?: readonly (number | string)[];
  readonly requireAllIngredients?: boolean;
  readonly badges?: readonly string[];
  readonly maxTotalMinutes?: number | string | null;
  readonly maxDifficulty?: string | null;
  readonly savedOnly?: boolean;
}

/** Bounds and normalizes free text so URL, query key, and API values cannot diverge. */
export function normalizeRecipeSearch(value: string | null | undefined): string {
  return normalizeRecipeSearchValue(value);
}

/** Converts permissive URL/draft inputs into the one canonical applied-criteria shape. */
export function recipeDiscoveryCriteria(
  input: RecipeDiscoveryCriteriaInput = {}
): RecipeDiscoveryCriteria {
  const ingredientIds = normalizeIngredientIds(input.ingredientIds);
  return {
    search: normalizeRecipeSearch(input.search),
    ingredientIds,
    requireAllIngredients: ingredientIds.length > 0
      ? input.requireAllIngredients ?? true
      : true,
    badges: normalizeRecipeBadges(input.badges),
    maxTotalMinutes: normalizeMaxTotalMinutes(input.maxTotalMinutes),
    maxDifficulty: normalizeMaxDifficulty(input.maxDifficulty),
    savedOnly: input.savedOnly ?? false,
  };
}

/** Builds stable client cache identity from applied user intent, never cursor state. */
export function recipeDiscoveryQueryKey(criteria: RecipeDiscoveryCriteria): string {
  const normalized = recipeDiscoveryCriteria(criteria);
  return JSON.stringify({
    search: normalized.search.toLowerCase(),
    ingredientIds: normalized.ingredientIds,
    requireAllIngredients: normalized.requireAllIngredients,
    badges: normalized.badges,
    maxTotalMinutes: normalized.maxTotalMinutes,
    maxDifficulty: normalized.maxDifficulty,
    savedOnly: normalized.savedOnly,
  });
}

/** Keeps at most three distinct positive safe IDs in deterministic numeric order. */
export function normalizeIngredientIds(
  values: readonly (number | string)[] | null | undefined
): readonly number[] {
  const normalized = new Set<number>();
  for (const value of values ?? []) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) normalized.add(parsed);
  }
  return [...normalized].sort((left, right) => left - right).slice(0, RECIPE_INGREDIENT_LIMIT);
}

/** Removes unknown/duplicate badges and restores the documented API presentation order. */
export function normalizeRecipeBadges(
  values: readonly string[] | null | undefined
): readonly RecipeBadge[] {
  const selected = new Set(values ?? []);
  return RECIPE_BADGE_OPTIONS.filter(badge => selected.has(badge));
}

/** Accepts only the lightweight maximum-time values supported by the Phase 8 controls. */
export function normalizeMaxTotalMinutes(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return RECIPE_MAX_TOTAL_MINUTES_OPTIONS.includes(
    parsed as (typeof RECIPE_MAX_TOTAL_MINUTES_OPTIONS)[number]
  ) ? parsed : null;
}

/** Converts Easy/Medium to an inclusive maximum and treats Hard/unknown as unrestricted. */
export function normalizeMaxDifficulty(
  value: string | null | undefined
): RecipeMaximumDifficulty | null {
  return RECIPE_MAX_DIFFICULTY_OPTIONS.includes(value as RecipeMaximumDifficulty)
    ? value as RecipeMaximumDifficulty
    : null;
}

/** Parses only the canonical explicit true value; false/default is omitted from the URL. */
export function parseSavedOnly(value: string | null | undefined): boolean {
  return value === 'true';
}

/** The API defaults to ALL; only the canonical literal false selects ANY composition. */
export function parseRequireAllIngredients(value: string | null | undefined): boolean {
  return value !== 'false';
}

export interface RecipeDiscoveryQueryParams {
  readonly search: string | null;
  readonly ingredientIds: readonly number[] | null;
  readonly requireAllIngredients: false | null;
  readonly badges: readonly RecipeBadge[] | null;
  readonly maxTotalMinutes: number | null;
  readonly maxDifficulty: RecipeMaximumDifficulty | null;
  readonly savedOnly: true | null;
}

/** Serializes canonical applied criteria and uses null to remove default router parameters. */
export function recipeDiscoveryQueryParams(
  criteria: RecipeDiscoveryCriteria
): RecipeDiscoveryQueryParams {
  const normalized = recipeDiscoveryCriteria(criteria);
  return {
    search: normalized.search || null,
    ingredientIds: normalized.ingredientIds.length > 0
      ? normalized.ingredientIds
      : null,
    requireAllIngredients: normalized.ingredientIds.length > 0
      && !normalized.requireAllIngredients
      ? false
      : null,
    badges: normalized.badges.length > 0 ? normalized.badges : null,
    maxTotalMinutes: normalized.maxTotalMinutes,
    maxDifficulty: normalized.maxDifficulty,
    savedOnly: normalized.savedOnly ? true : null,
  };
}
