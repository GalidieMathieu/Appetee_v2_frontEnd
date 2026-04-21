import {
  RecipeBadge,
  RecipeDifficulty,
  RecipeSummary,
} from '@app/core/shared/data-access/recipes/recipe.model';

import {
  MealPlanCard,
  MealPlanDetail,
  MealPlanSuggestionSort,
  MealPlanTarget,
} from './meal-plan.model';

const difficultyRank: Record<RecipeDifficulty, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

function hasRecipeBadge(recipe: RecipeSummary, badge: RecipeBadge): boolean {
  return recipe.badges?.includes(badge) ?? false;
}

export function matchesMealPlanTarget(recipe: RecipeSummary, target: MealPlanTarget): boolean {
  if (
    target.maxPrepTimeMinutes !== null &&
    recipe.prepTimeMinutes > target.maxPrepTimeMinutes
  ) {
    return false;
  }

  if (
    target.difficulty !== null &&
    difficultyRank[recipe.difficulty] > difficultyRank[target.difficulty]
  ) {
    return false;
  }

  if (target.freezerFriendlyOnly && !hasRecipeBadge(recipe, 'freezer-friendly')) {
    return false;
  }

  if (target.dietIds.length > 0) {
    const hasMatchingDiet =
      recipe.diets?.some(diet => target.dietIds.includes(diet.id)) ?? false;
    if (!hasMatchingDiet) {
      return false;
    }
  }

  if (target.ingredientRestrictionIds.length > 0) {
    const hasRestrictedIngredient = recipe.ingredients.some(ingredient =>
      target.ingredientRestrictionIds.includes(ingredient.id)
    );
    if (hasRestrictedIngredient) {
      return false;
    }
  }

  return true;
}

export function sortRecipesForDiscovery(
  recipes: RecipeSummary[],
  sortBy: MealPlanSuggestionSort
): RecipeSummary[] {
  const nextRecipes = [...recipes];

  switch (sortBy) {
    case 'cheapest':
      return nextRecipes.sort(
        (left, right) =>
          (left.estimatedCostPerServing ?? Number.MAX_SAFE_INTEGER) -
          (right.estimatedCostPerServing ?? Number.MAX_SAFE_INTEGER)
      );
    case 'highest-protein':
      return nextRecipes.sort((left, right) => right.proteinTotal - left.proteinTotal);
    case 'freezer-friendly':
      return nextRecipes.sort((left, right) => {
        const leftIsFreezerFriendly = hasRecipeBadge(left, 'freezer-friendly');
        const rightIsFreezerFriendly = hasRecipeBadge(right, 'freezer-friendly');

        if (leftIsFreezerFriendly === rightIsFreezerFriendly) {
          return right.proteinTotal - left.proteinTotal;
        }

        return leftIsFreezerFriendly ? -1 : 1;
      });
    case 'easiest':
      return nextRecipes.sort((left, right) => {
        const difficultyDelta =
          difficultyRank[left.difficulty] - difficultyRank[right.difficulty];
        return difficultyDelta !== 0
          ? difficultyDelta
          : left.prepTimeMinutes - right.prepTimeMinutes;
      });
    case 'fastest':
      return nextRecipes.sort((left, right) => left.prepTimeMinutes - right.prepTimeMinutes);
  }
}

export function toMealPlanCard(detail: MealPlanDetail): MealPlanCard {
  const {
    id,
    name,
    durationDays,
    mealsPerDay,
    caloriesPerDay,
    proteinPerDay,
    estimatedTotalPrice,
    lastUpdated,
    badges,
  } = detail;

  return {
    id,
    name,
    durationDays,
    mealsPerDay,
    caloriesPerDay,
    proteinPerDay,
    estimatedTotalPrice,
    lastUpdated,
    badges,
  };
}
