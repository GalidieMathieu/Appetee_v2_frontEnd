export interface Ingredient {
    id: number;
    name: string;
  }
  
  export interface IngredientDialogResult {
    ingredientId: number | null;
    ingredientName: string;
    walmartProductId: string | null;
  }

  export type IngredientAdminDetailDto = {
    id: number;
    name: string;
    basis: number;
    caloriesKcal: number;
    proteinG: number | null;
    fatG: number | null;
    carbsG: number | null;
    sugarG: number | null;
    fiberG: number | null;
    sodiumMg: number | null;
    vitaminCMg: number | null;
    ironMg: number | null;
  };

  //For Creation
  export type IngredientAdminDetailRequest = {
    name: string;
    basis: number;
    caloriesKcal: number;
    proteinG: number | null;
    fatG: number | null;
    carbsG: number | null;
    sugarG: number | null;
    fiberG: number | null;
    sodiumMg: number | null;
    vitaminCMg: number | null;
    ironMg: number | null;
  };