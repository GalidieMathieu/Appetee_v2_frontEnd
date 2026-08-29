/**
 * Shared recipe contracts used by API, caches, authoring, discovery, and the recipe experience.
 * UI orchestration consumes these contracts without moving DTO or mutation state into shared UI.
 */
import { Diet } from '../diets/diet.model';
import { Ingredient, IngredientAdminDetailDto } from '../ingredients/ingredient.model';

//########## Shared ############
export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard';
export type RecipeMaximumDifficulty = Exclude<RecipeDifficulty, 'Hard'>;
export type RecipeBadge =
  | 'High Protein'
  | 'Low Calorie'
  | 'Low Carb'
  | 'High Fiber'
  | 'Quick Meal'
  | 'Meal Prep'
  | 'Freezer Friendly'
  | 'Budget Friendly'
  | 'Few Ingredients';
export type RecipeFeaturedOrder = 1 | 2 | 3;

export interface RecipeNutrition {
  caloriesTotal: number;
  proteinTotal: number;
  carbsTotal: number;
}

export interface RecipePerServingNutrition {
  caloriesPerServing: number;
  proteinPerServing: number;
}

export interface RecipeInstructionStep {
  title: string;
  instruction: string;
}

//########## DTO ############
/** Existing create/update summary response retained for authoring consumers. */
export interface RecipeSummaryDto extends RecipeNutrition, RecipePerServingNutrition {
  id: number;
  name: string;
  previewImageUrl: string | null;
  prepTimeMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  badges: RecipeBadge[] | null;
  diets: Diet[] | null;
  estimatedCostPerServing: number | null;
  ingredients: Ingredient[];
}

/** Compatibility alias retained for existing authoring screens. */
export type RecipeSummary = RecipeSummaryDto;

export interface FeaturedIngredientDto {
  id: number;
  name: string;
  featuredOrder: RecipeFeaturedOrder;
}

/** Bounded discovery projection; it never contains full recipe details. */
export interface RecipeCardDto {
  id: number;
  name: string;
  cardImageUrl: string | null;
  totalTimeMinutes: number;
  caloriesPerServing: number;
  estimatedCostPerServing: number;
  badges: RecipeBadge[];
  featuredIngredients: FeaturedIngredientDto[];
  isSaved: boolean;
}

export interface RecipeDiscoveryPageDto {
  items: RecipeCardDto[];
  /** Opaque server-issued continuation token. */
  nextCursor: string | null;
  hasMore: boolean;
}

export interface RecipePreviewIngredientDto {
  id: number;
  name: string;
}

/** Complete lightweight Preview entity; it intentionally excludes authoring/cooking details. */
export interface RecipePreviewDto {
  id: number;
  name: string;
  description: string;
  previewImageUrl: string | null;
  totalTimeMinutes: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  estimatedCostPerServing: number;
  badges: RecipeBadge[];
  ingredients: RecipePreviewIngredientDto[];
  isSaved: boolean;
}

/** Internal shared-mutation state kept in the model rather than declared inside a facade. */
export interface FavoriteMutationState {
  readonly recipeGeneration: number;
  readonly previewGeneration: number;
  readonly desiredSaved: boolean;
}

/** Session-generation-scoped saved-state override shared by every Recipe Card surface. */
export interface FavoriteMembershipState {
  readonly previewGeneration: number;
  readonly isSaved: boolean;
}

export interface FavoriteMutationFeedback {
  readonly recipeId: number;
  readonly message: string;
}

/** Applied user-visible criteria for the currently cached discovery chain. */
export interface RecipeDiscoveryCriteria {
  readonly search: string;
  readonly ingredientIds: readonly number[];
  readonly requireAllIngredients: boolean;
  readonly badges: readonly RecipeBadge[];
  readonly maxTotalMinutes: number | null;
  readonly maxDifficulty: RecipeMaximumDifficulty | null;
  readonly savedOnly: boolean;
}

export interface RecipeIngredientDetailDto {
  ingredientId: number;
  quantity: number | null;
  unit: string | null;
  featuredOrder: RecipeFeaturedOrder | null;
  ingredient: IngredientAdminDetailDto;
}

export interface RecipeDetailDto extends Omit<RecipeSummaryDto, 'ingredients'> {
  description: string;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  instructions: RecipeInstructionStep[];
  ingredients: RecipeIngredientDetailDto[];
}

//########## Request ############
export interface RecipeIngredientRequest {
  ingredientId: number;
  quantity: number | null;
  unit: string | null;
  featuredOrder: RecipeFeaturedOrder | null;
}

export interface RecipeDetailRequest {
  name: string;
  description: string;
  image: File | null;
  instructions: RecipeInstructionStep[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  badges: RecipeBadge[];
  dietIds: number[];
  ingredients: RecipeIngredientRequest[];
}
