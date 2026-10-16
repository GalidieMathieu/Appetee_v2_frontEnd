export type MealPlanTask = 'day' | 'meal' | 'recipe-picker' | 'manual';
export type MealPlanSelection = {
    kind: 'none';
} | {
    kind: 'saved';
    mealId: number;
} | {
    kind: 'virtual';
    defaultSlot: number;
};
export interface WeekDateView {
    date: string;
    savedMealCount: number | null;
    caloriesKcal: number | null;
}
