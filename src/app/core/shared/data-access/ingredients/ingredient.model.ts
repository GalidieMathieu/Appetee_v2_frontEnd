export type IngredientBasisUnit = 'g' | 'ml';

//########## DTO ############
export interface Ingredient {
  id: number;
  name: string;
}

export type IngredientAdminDetailDto = {
  id: number;
  name: string;
  basis: number;
  basisUnit: IngredientBasisUnit;
  price: number | null;
  caloriesKcal: number;
  imageUrl: string | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  sugarG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  vitaminCMg: number | null;
  ironMg: number | null;
};

//########## Request ############
export type IngredientAdminDetailRequest = {
  name: string;
  basis: number;
  basisUnit: IngredientBasisUnit;
  price: number | null;
  caloriesKcal: number;
  image: File;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  sugarG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  vitaminCMg: number | null;
  ironMg: number | null;
};

//########## Page ############
export interface IngredientDialogResult {
  ingredientId: number;
  quantity: number | null;
  unit: string | null;
}
