/** Shared bounded recipe-search normalization used before emitting UI intent or serializing criteria. */
export const RECIPE_SEARCH_MAX_LENGTH = 100;

export function normalizeRecipeSearchValue(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, RECIPE_SEARCH_MAX_LENGTH)
    .trimEnd();
}
