/** Presentation copy only. The API owns the warning conditions and nutrition values. */
const WARNING_TEXT: Readonly<Record<string, string>> = {
    equation_population_extrapolation: 'This equation was developed for recreational athletes aged 18–35. Use beyond that age or activity profile is an extrapolation; estimates vary.',
    carbohydrate_below_preferred: 'Carbohydrate is below the preferred activity-level guidance to fit the energy target while protecting protein. The preferred carbohydrate level has not been reached.',
    recipe_fat_unknown: 'Fat is unknown for a recipe; it has not been treated as zero.',
    recipe_unavailable: 'A recipe is unavailable. Its saved serving quantity remains, but its nutrition is unknown.',
};
export function mealPlanWarningText(code: string): string {
    return WARNING_TEXT[code] ?? `Warning: ${code.replaceAll('_', ' ')}`;
}
