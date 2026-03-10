export interface Ingredient {
    id: number;
    name: string;
  }
  
  export interface IngredientDialogResult {
    ingredientId: number | null;
    ingredientName: string;
    walmartProductId: string | null;
  }