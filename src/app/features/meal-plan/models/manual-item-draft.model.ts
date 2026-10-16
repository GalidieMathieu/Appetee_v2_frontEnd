export type ManualField = 'name' | 'caloriesKcal' | 'proteinG' | 'carbsG' | 'fatG';
export const MANUAL_FIELDS: readonly { key: ManualField; label: string; max?: number }[] = [
  { key: 'name', label: 'Food name' }, { key: 'caloriesKcal', label: 'Calories (kcal)', max: 20000 },
  { key: 'proteinG', label: 'Protein (g)', max: 5000 }, { key: 'carbsG', label: 'Carbs (g)', max: 5000 }, { key: 'fatG', label: 'Fat (g)', max: 5000 },
];
