import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { EntityRequestState } from '../generic-template/entity-cache-store';
import { CatalogueRecord } from './catalogue-resource.model';
import { RecipeDetailDto } from '../recipes/recipe.model';
import { IngredientAdminDetailDto } from '../ingredients/ingredient.model';
import { AdminRecipeStore } from '../recipes/admin/admin-recipe.store';
import { AdminIngredientStore } from '../ingredients/admin/admin-ingredient.store';
import { IngredientDetailsStore } from '../ingredients/admin/ingredient-details.store';
@Injectable({ providedIn: 'root' })
export class CatalogueStateStore {
    private readonly recipeMutations = inject(AdminRecipeStore);
    private readonly ingredientMutations = inject(AdminIngredientStore);
    private readonly ingredientDetails = inject(IngredientDetailsStore);
    readonly recipes = signal<Readonly<Record<number, CatalogueRecord<RecipeDetailDto>>>>({});
    readonly ingredients = signal<Readonly<Record<number, CatalogueRecord<IngredientAdminDetailDto>>>>({});
    readonly generation = signal(0);
    private readonly cleared = new Subject<void>();
    readonly reset$ = this.cleared.asObservable();
    readonly reviewedEtags = signal<Readonly<Record<number, string>>>({});
    readonly reviewRequired = signal<Readonly<Record<number, boolean>>>({});
    readonly recipeRequests = signal<Readonly<Record<number, EntityRequestState>>>({});
    readonly createOutcomeUnknown = signal(false);
    readonly ingredientCreateOutcomeUnknown = signal(false);
    readonly recipeReadEpochs = signal<Readonly<Record<number, number>>>({});
    readonly reviewedVersions = signal<Readonly<Record<number, string>>>({});
    invalidateRecipe(id: number, preserveReview = false): void { this.recipeReadEpochs.update(epochs => ({ ...epochs, [id]: (epochs[id] ?? 0) + 1 })); this.recipeRequests.update(states => ({ ...states, [id]: { status: 'idle', error: null } })); const { [id]: removed, ...rest } = this.recipes(); this.recipes.set(rest); if (!preserveReview) {
        const { [id]: tag, ...tokens } = this.reviewedEtags();
        this.reviewedEtags.set(tokens);
        const { [id]: version, ...versions } = this.reviewedVersions();
        this.reviewedVersions.set(versions);
        const { [id]: flag, ...flags } = this.reviewRequired();
        this.reviewRequired.set(flags);
    } }
    invalidateIngredient(id: number): void { const { [id]: removed, ...rest } = this.ingredients(); this.ingredients.set(rest); this.ingredientDetails.invalidate(id); }
    reset(): void { this.generation.update(value => value + 1); this.recipes.set({}); this.ingredients.set({}); this.reviewedEtags.set({}); this.reviewedVersions.set({}); this.reviewRequired.set({}); this.recipeRequests.set({}); this.recipeReadEpochs.set({}); this.createOutcomeUnknown.set(false); this.ingredientCreateOutcomeUnknown.set(false); this.recipeMutations.reset(); this.ingredientMutations.reset(); this.ingredientDetails.reset(); this.cleared.next(); }
}
