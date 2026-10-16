/**
 * Coordinates Admin recipe multipart mutations and invalidates affected shared recipe read models.
 * Successful updates clear detail, Preview, Cooking View, and dependent query caches together.
 */
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, catchError, defer, filter, finalize, map, shareReplay, takeUntil, tap, timeout } from 'rxjs';
import { CapabilitiesStore } from '@app/core/auth/data-access/capabilities.store';
import { CatalogueStateStore } from '../../catalogue/catalogue-state.store';
import { CatalogueRecord } from '../../catalogue/catalogue-resource.model';
import { AbstractLoadFacade } from '../../generic-template/abstractLoadFacade';
import { AdminRecipeApi } from './admin-recipe.api';
import { AdminRecipeStore } from './admin-recipe.store';
import { RecipeDetailDto, RecipeDetailRequest, RecipeSummaryDto } from '../recipe.model';
import { RecipesFacade } from '../recipe.facade';
@Injectable({ providedIn: 'root' })
export class AdminRecipeFacade extends AbstractLoadFacade<null, AdminRecipeStore> {
    readonly catalogue = inject(CatalogueStateStore);
    private readonly capabilities = inject(CapabilitiesStore);
    private readonly reads = new Map<string, Observable<RecipeDetailDto>>();
    loadDetail(id: number): Observable<RecipeDetailDto> {
        return defer(() => {
            if (!this.capabilities.canRead())
                return EMPTY;
            const generation = this.catalogue.generation();
            const epoch = this.catalogue.recipeReadEpochs()[id] ?? 0;
            const key = `${generation}:${epoch}:${id}`;
            const existing = this.reads.get(key);
            if (existing)
                return existing;
            this.catalogue.recipeRequests.update(states => ({ ...states, [id]: { status: 'loading', error: null } }));
            let shared: Observable<RecipeDetailDto>;
            shared = this.api.getDetail(id).pipe(timeout(10000), filter(() => this.catalogue.generation() === generation && (this.catalogue.recipeReadEpochs()[id] ?? 0) === epoch), tap(record => {
                this.catalogue.recipes.update(records => ({ ...records, [id]: record }));
                const reviewedVersion = this.catalogue.reviewedVersions()[id];
                if (reviewedVersion !== undefined && record.resourceVersion !== reviewedVersion)
                    this.catalogue.reviewRequired.update(flags => ({ ...flags, [id]: true }));
                else if (!this.catalogue.reviewedEtags()[id]) {
                    this.catalogue.reviewedEtags.update(tokens => ({ ...tokens, [id]: record.etag }));
                    this.catalogue.reviewedVersions.update(versions => ({ ...versions, [id]: record.resourceVersion }));
                }
                this.catalogue.recipeRequests.update(states => ({ ...states, [id]: { status: 'success', error: null } }));
            }), map(record => record.resource), catchError((error: unknown) => {
                if (this.catalogue.generation() === generation && (this.catalogue.recipeReadEpochs()[id] ?? 0) === epoch) {
                    this.catalogue.invalidateRecipe(id, !(error instanceof HttpErrorResponse && error.status === 404));
                    this.catalogue.recipeRequests.update(states => ({ ...states, [id]: { status: 'error', error: this.toUserMessage(error), ...(error instanceof HttpErrorResponse ? { httpStatus: error.status } : {}) } }));
                }
                return EMPTY;
            }), takeUntil(this.catalogue.reset$), finalize(() => this.reads.delete(key)), shareReplay({ bufferSize: 1, refCount: false }));
            this.reads.set(key, shared);
            return shared;
        });
    }
    confirmReview(id: number): void {
        const record = this.catalogue.recipes()[id];
        if (!this.capabilities.canEdit() || !record || this.catalogue.recipeRequests()[id]?.status !== 'success')
            return;
        this.catalogue.reviewedEtags.update(tokens => ({ ...tokens, [id]: record.etag }));
        this.catalogue.reviewedVersions.update(versions => ({ ...versions, [id]: record.resourceVersion }));
        this.catalogue.reviewRequired.update(flags => ({ ...flags, [id]: false }));
    }
    confirmCreateReview(): void { if (this.capabilities.canWrite())
        this.catalogue.createOutcomeUnknown.set(false); }
    releaseEditor(id: number): void { this.catalogue.invalidateRecipe(id); }
    constructor(private readonly api: AdminRecipeApi, private readonly recipesFacade: RecipesFacade, store: AdminRecipeStore) {
        super(store);
    }
    createRecipeWithDetails(recipe: RecipeDetailRequest): Observable<RecipeSummaryDto> {
        if (!this.capabilities.canWrite() || this.catalogue.createOutcomeUnknown())
            return EMPTY;
        return this.runMutation(this.api.create(this.toRecipeFormData(recipe)));
    }
    updateRecipeWithDetails(id: number, recipe: RecipeDetailRequest): Observable<RecipeSummaryDto> {
        const etag = this.catalogue.reviewedEtags()[id];
        if (!this.capabilities.canEdit() || !etag || this.catalogue.reviewRequired()[id] || this.catalogue.recipeRequests()[id]?.status !== 'success') {
            this.setError('Load and explicitly review the protected saved recipe before updating.');
            return EMPTY;
        }
        return this.runMutation(this.api.update(id, this.toRecipeFormData(recipe), etag), id);
    }
    private runMutation(request$: Observable<CatalogueRecord<RecipeSummaryDto>>, changedId?: number): Observable<RecipeSummaryDto> {
        if (this.store.isLoading())
            return EMPTY;
        const generation = this.catalogue.generation();
        this.setLoading();
        return request$.pipe(timeout(10000), filter(() => this.catalogue.generation() === generation), tap(record => {
            if (changedId !== undefined) {
                this.recipesFacade.invalidateDetail(changedId);
                this.recipesFacade.invalidatePreview(changedId);
                this.recipesFacade.invalidateCookingView(changedId);
                this.catalogue.invalidateRecipe(changedId);
                this.catalogue.reviewedVersions.update(versions => ({ ...versions, [changedId]: record.resourceVersion }));
                this.loadDetail(changedId).subscribe();
            }
            this.recipesFacade.invalidateQueries();
        }), catchError((error: unknown) => {
            if (this.catalogue.generation() !== generation)
                return EMPTY;
            const status = error instanceof HttpErrorResponse ? error.status : undefined;
            if (changedId !== undefined && (status === 412 || status === 428 || status === 0 || status === undefined || status >= 500)) {
                this.catalogue.invalidateRecipe(changedId, true);
                this.catalogue.reviewRequired.update(flags => ({ ...flags, [changedId]: true }));
                this.setError(status === 412 ? 'This recipe changed. Your draft is preserved. Refresh and review the saved version before submitting again.'
                    : status === 428 ? 'The update precondition is missing. Reload and review the protected recipe; nothing will be retried.'
                        : 'The save outcome is unknown. Refresh and inspect the saved recipe before deciding whether to submit again.');
            }
            else {
                if (changedId !== undefined && status === 404) {
                    this.catalogue.invalidateRecipe(changedId);
                    this.catalogue.recipeRequests.update(states => ({ ...states, [changedId]: { status: 'error', error: 'This recipe is unavailable or deleted.', httpStatus: 404 } }));
                    this.recipesFacade.invalidateDetail(changedId);
                    this.recipesFacade.invalidatePreview(changedId);
                    this.recipesFacade.invalidateCookingView(changedId);
                }
                if (changedId === undefined && (status === 0 || status === undefined || status >= 500))
                    this.catalogue.createOutcomeUnknown.set(true);
                this.setError(this.toUserMessage(error));
            }
            return EMPTY;
        }), map(record => record.resource), takeUntil(this.catalogue.reset$), finalize(() => {
            if (this.catalogue.generation() === generation && this.store.isLoading())
                this.setSuccessWithNoData();
        }));
    }
    private toRecipeFormData(recipe: RecipeDetailRequest): FormData {
        const formData = new FormData();
        formData.append('name', recipe.name);
        formData.append('description', recipe.description);
        formData.append('prepTimeMinutes', recipe.prepTimeMinutes.toString());
        formData.append('cookTimeMinutes', recipe.cookTimeMinutes.toString());
        formData.append('totalTimeMinutes', recipe.totalTimeMinutes.toString());
        formData.append('servings', recipe.servings.toString());
        formData.append('difficulty', recipe.difficulty);
        if (recipe.image)
            formData.append('image', recipe.image);
        recipe.badges.forEach((value, index) => formData.append(`badges[${index}]`, value));
        recipe.instructions.forEach((value, index) => {
            formData.append(`instructions[${index}].title`, value.title);
            formData.append(`instructions[${index}].instruction`, value.instruction);
        });
        recipe.dietIds.forEach((value, index) => formData.append(`dietIds[${index}]`, value.toString()));
        recipe.ingredients.forEach((value, index) => {
            formData.append(`ingredients[${index}].ingredientId`, value.ingredientId.toString());
            if (value.quantity !== null) {
                formData.append(`ingredients[${index}].quantity`, value.quantity.toString());
            }
            if (value.unit !== null)
                formData.append(`ingredients[${index}].unit`, value.unit);
            if (value.featuredOrder !== null) {
                formData.append(`ingredients[${index}].featuredOrder`, value.featuredOrder.toString());
            }
        });
        return formData;
    }
}
