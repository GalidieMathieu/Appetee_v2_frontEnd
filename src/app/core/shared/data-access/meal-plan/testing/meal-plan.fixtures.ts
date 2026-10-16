import { MealPlannerRangeDto, NutrientsDto } from '../meal-plan.model';
import {
  NutritionPlanDetailDto,
  NutritionPlanDto,
  NutritionPlanListDto,
  NutritionPlanSummaryDto,
} from '../nutrition-plan.model';
import { NutritionProfileDto } from '../../user/nutrition-profile.model';

export const KNOWN_NUTRIENTS: NutrientsDto = {
  caloriesKcal: 500,
  proteinG: 35,
  carbsG: 55,
  fatG: 16,
};

export const UNKNOWN_FAT_NUTRIENTS: NutrientsDto = {
  caloriesKcal: 500,
  proteinG: 35,
  carbsG: 55,
  fatG: null,
};

export function nutritionPlanSummary(id = 1): NutritionPlanSummaryDto {
  return {
    id,
    name: `Plan ${id}`,
    mode: 'intermediate',
    defaultMealsPerDay: 4,
    goal: 'maintain',
    activityLevel: 'active',
    targets: KNOWN_NUTRIENTS,
    calculationPolicyVersion: '2026.1',
    calculatedAt: '2026-10-04T18:00:00Z',
    createdAt: '2026-10-04T18:00:00Z',
    updatedAt: '2026-10-04T18:00:00Z',
  };
}

export function nutritionPlan(id = 1): NutritionPlanDto {
  return {
    ...nutritionPlanSummary(id),
    calculationInputs: {
      calculationSex: 'female',
      birthYear: 1990,
      heightCm: 168.5,
      weightKg: 64.25,
      ageYears: 36,
      goal: 'maintain',
      activityLevel: 'active',
    },
    rmrKcal: 1400,
    maintenanceKcal: 2200,
    warnings: [],
  };
}

export function nutritionPlanList(ids: readonly number[] = [1]): NutritionPlanListDto {
  return {
    revision: '8',
    settings: {
      currentNutritionPlanId: ids[0] ?? null,
      currentPlan: ids[0] === undefined ? null : {
        id: ids[0],
        name: `Plan ${ids[0]}`,
        mode: 'intermediate',
        defaultMealsPerDay: 4,
        targets: KNOWN_NUTRIENTS,
        calculationPolicyVersion: '2026.1',
      },
    },
    plans: ids.map(id => nutritionPlanSummary(id)),
  };
}

export function nutritionPlanDetail(id = 1): NutritionPlanDetailDto {
  return {
    revision: '8',
    settings: nutritionPlanList([id]).settings,
    plan: nutritionPlan(id),
    profileDiffers: false,
  };
}

export function nutritionProfile(profilePresent = true): NutritionProfileDto {
  return {
    revision: '8',
    profile: profilePresent ? {
      calculationSex: 'female',
      birthYear: 1990,
      heightCm: 168.5,
      weightKg: 64.25,
    } : null,
  };
}

export function plannerRange(
  from: string,
  through: string = from,
  revision = '8'
): MealPlannerRangeDto {
  return {
    revision,
    settings: nutritionPlanList([1]).settings,
    from,
    through,
    days: [{
      date: from,
      id: 10,
      persistence: 'saved',
      savedMealCount: 1,
      meals: [{
        id: 20,
        key: 'meal:20',
        isVirtual: false,
        defaultSlot: null,
        name: 'Lunch',
        sortOrder: 1,
        items: [{
          id: 30,
          type: 'recipe',
          sortOrder: 1,
          recipeId: 40,
          quantity: 1,
          availability: 'available',
          name: 'Recipe with unknown fat',
          perServing: UNKNOWN_FAT_NUTRIENTS,
          nutrition: UNKNOWN_FAT_NUTRIENTS,
          warnings: ['fat_unknown'],
        }],
        totals: UNKNOWN_FAT_NUTRIENTS,
        warnings: ['fat_unknown'],
      }],
      totals: UNKNOWN_FAT_NUTRIENTS,
      targets: KNOWN_NUTRIENTS,
      remaining: UNKNOWN_FAT_NUTRIENTS,
      warnings: ['fat_unknown'],
    }],
  };
}

