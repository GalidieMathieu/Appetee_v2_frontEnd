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

export interface RecipeIdentityDto {
  id: number;
  name: string;
}

export interface RecipeDescriptionDto {
  description: string;
}

export interface RecipeTotalTimeDto {
  totalTimeMinutes: number;
}

//########## DTO ############
/** Existing create/update summary response retained for authoring consumers. */
export interface RecipeSummaryDto
  extends RecipeIdentityDto, RecipeNutrition, RecipePerServingNutrition {
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

export interface FeaturedIngredientDto extends RecipeIdentityDto {
  featuredOrder: RecipeFeaturedOrder;
}

/** Fields shared by bounded recipe list and Preview projections. */
export interface RecipeListProjectionDto extends RecipeIdentityDto, RecipeTotalTimeDto {
  caloriesPerServing: number;
  estimatedCostPerServing: number;
  badges: RecipeBadge[];
  isSaved: boolean;
}

/** Bounded discovery projection; it never contains full recipe details. */
export interface RecipeCardDto extends RecipeListProjectionDto {
  cardImageUrl: string | null;
  featuredIngredients: FeaturedIngredientDto[];
}

/** Meal Plan picker projection; ordinary discovery remains on RecipeCardDto. */
export interface RecipeCardAdvance extends RecipeCardDto, RecipeDescriptionDto {
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number | null;
}

export interface RecipePageDto<TRecipe extends RecipeCardDto> {
  items: TRecipe[];
  /** Opaque server-issued continuation token. */
  nextCursor: string | null;
  hasMore: boolean;
}

export type RecipeDiscoveryPageDto = RecipePageDto<RecipeCardDto>;
export type RecipeMealPlanPageDto = RecipePageDto<RecipeCardAdvance>;

export interface RecipePreviewIngredientDto extends RecipeIdentityDto {}

/** Complete lightweight Preview entity; it intentionally excludes authoring/cooking details. */
export interface RecipePreviewDto extends RecipeListProjectionDto, RecipeDescriptionDto {
  previewImageUrl: string | null;
  proteinPerServing: number;
  ingredients: RecipePreviewIngredientDto[];
}

/** Ordered ingredient projection used only by the complete Cooking View read model. */
export interface RecipeCookingIngredientDto extends RecipeIdentityDto {
  quantity: number;
  unit: string;
  displayOrder: number;
}

/** Authored Cooking View step with an explicit one-based display order. */
export interface RecipeCookingStepDto {
  order: number;
  title: string;
  instruction: string;
}

/**
 * Server-authorized base recipe values for Cooking Mode.
 * Temporary servings, scaling, checklist, step, and timer state never belong in this DTO.
 */
export interface RecipeCookingViewDto
  extends RecipeIdentityDto, RecipeDescriptionDto, RecipeTotalTimeDto, RecipeNutrition {
  imageUrl: string | null;
  baseServings: number;
  badges: readonly RecipeBadge[];
  ingredients: readonly RecipeCookingIngredientDto[];
  steps: readonly RecipeCookingStepDto[];
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

/** Successful shared favorite mutation notification for identity-scoped list consumers. */
export interface RecipeFavoriteChange {
  readonly recipeId: number;
  readonly isSaved: boolean;
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

export interface RecipeDetailDto
  extends Omit<RecipeSummaryDto, 'ingredients'>, RecipeDescriptionDto, RecipeTotalTimeDto {
  cookTimeMinutes: number;
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
