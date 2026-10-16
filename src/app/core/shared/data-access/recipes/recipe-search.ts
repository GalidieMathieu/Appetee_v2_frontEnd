/** Shared bounded search normalization; no UI, query state or transport dependency. */
export const RECIPE_SEARCH_MAX_LENGTH = 100;
export function normalizeRecipeSearchValue(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, RECIPE_SEARCH_MAX_LENGTH).trimEnd();
}
