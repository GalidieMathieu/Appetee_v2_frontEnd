export interface Ingredient {
    id: number;
    name: string;
  }
  
  export interface IngredientDialogResult {
    ingredientId: number;
    quantity: number | null;
    unit: string | null;
  }

  export type IngredientAdminDetailDto = {
    id: number;
    name: string;
    basis: number;
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

  //For Creation
  export type IngredientAdminDetailRequest = {
    name: string;
    basis: number;
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
