import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

import { NutritionProfileDto } from '../user/nutrition-profile.model';
import { NutritionProfileStore } from '../user/nutrition-profile.store';
import { MealPlanContextStore, MealPlanQueryToken } from './meal-plan-context.store';
import { PlannerMutationDto } from './meal-plan-mutation.model';
import { MealPlanMutationReceipt } from './meal-plan-mutation.model';
import { MealPlanRevision, MealPlannerRangeDto } from './meal-plan.model';
import { MealPlannerStore } from './meal-planner.store';
import { NutritionPlanDetailsStore } from './nutrition-plan-details.store';
import {
  NutritionPlanDetailDto,
  NutritionPlanListDto,
  NutritionPlanMutationDto,
} from './nutrition-plan.model';
import { NutritionPlansStore } from './nutrition-plans.store';

export type MealPlanReadObservation =
  | { readonly kind: 'planner'; readonly token: MealPlanQueryToken; readonly response: MealPlannerRangeDto }
  | { readonly kind: 'plans'; readonly token: MealPlanQueryToken; readonly response: NutritionPlanListDto }
  | { readonly kind: 'planDetail'; readonly token: MealPlanQueryToken; readonly response: NutritionPlanDetailDto }
  | { readonly kind: 'profile'; readonly token: MealPlanQueryToken; readonly response: NutritionProfileDto };

export type MealPlanChangedEvent =
  | { readonly kind: 'readAdvanced'; readonly revision: MealPlanRevision; readonly source: MealPlanReadObservation['kind'] }
  | { readonly kind: 'plannerMutation'; readonly revision: MealPlanRevision; readonly affectedDates: readonly string[] }
  | { readonly kind: 'nutritionPlanMutation'; readonly revision: MealPlanRevision; readonly planId: number | null; readonly deletedPlanId: number | null }
  | { readonly kind: 'profileMutation'; readonly revision: MealPlanRevision }
  | { readonly kind: 'recipeInvalidated' }
  | { readonly kind: 'reconciliationRequired' };

/** The sole cross-store owner for adopting reads, receipts, rebasing and invalidation. */
@Injectable({ providedIn: 'root' })
export class MealPlanSyncService {
  private readonly context = inject(MealPlanContextStore);
  private readonly planner = inject(MealPlannerStore);
  private readonly plans = inject(NutritionPlansStore);
  private readonly details = inject(NutritionPlanDetailsStore);
  private readonly profile = inject(NutritionProfileStore);
  private readonly changedSubject = new Subject<MealPlanChangedEvent>();

  readonly changed$ = this.changedSubject.asObservable();

  observeRead(observation: MealPlanReadObservation): boolean {
    const readEpoch = this.context.readEpoch();
    const accepted = this.acceptOwnQuery(observation, readEpoch);
    if (!accepted) return false;

    const revision = observation.response.revision;
    const currentRevision = this.context.revision();
    if (!isRevision(revision)) {
      this.requireReconciliation();
      return false;
    }
    if (currentRevision !== null && compareRevisions(revision, currentRevision) < 0) {
      this.invalidateSource(observation);
      return true;
    }

    const advanced = currentRevision !== null && compareRevisions(revision, currentRevision) > 0;
    if (advanced) this.context.advanceReadEpoch();
    this.adoptReadContext(observation);
    if (advanced) {
      this.invalidateOlderProjections(revision, observation);
      this.changedSubject.next({ kind: 'readAdvanced', revision, source: observation.kind });
    }
    return true;
  }

  applyPlannerReceipt(
    expectedRevision: MealPlanRevision,
    receipt: PlannerMutationDto,
    identityGeneration: number
  ): boolean {
    if (!this.canApplyReceipt(expectedRevision, receipt.revision, identityGeneration)) return false;

    this.planner.applyPlannerReceipt(expectedRevision, receipt);
    this.plans.rebaseFresh(expectedRevision, receipt.revision);
    this.details.rebaseFresh(expectedRevision, receipt.revision);
    this.profile.rebaseFresh(expectedRevision, receipt.revision);
    this.context.replaceConfirmedContext(receipt.revision, receipt.settings, identityGeneration);
    this.changedSubject.next({
      kind: 'plannerMutation',
      revision: receipt.revision,
      affectedDates: receipt.days.map(day => day.date),
    });
    return true;
  }

  applyNutritionPlanReceipt(
    expectedRevision: MealPlanRevision,
    receipt: NutritionPlanMutationDto,
    identityGeneration: number
  ): boolean {
    if (!this.canApplyReceipt(expectedRevision, receipt.revision, identityGeneration)) return false;

    if (receipt.plannerInvalidated) this.planner.invalidateAll();
    else this.planner.rebaseFresh(expectedRevision, receipt.revision);
    this.plans.invalidate();

    const planId = receipt.plan?.id ?? null;
    if (receipt.plan !== null) {
      this.details.upsert({
        id: receipt.plan.id,
        plan: receipt.plan,
        revision: receipt.revision,
        profileDiffers: false,
      });
    }
    if (receipt.deletedPlanId !== null) this.details.invalidate(receipt.deletedPlanId);
    this.details.rebaseFresh(
      expectedRevision,
      receipt.revision,
      planId ?? receipt.deletedPlanId
    );

    if (receipt.profile !== null) {
      this.profile.replaceConfirmed(receipt.profile, receipt.revision, identityGeneration);
      this.details.invalidateAll(planId);
    } else {
      this.profile.rebaseFresh(expectedRevision, receipt.revision);
    }
    this.context.replaceConfirmedContext(receipt.revision, receipt.settings, identityGeneration);
    this.changedSubject.next({
      kind: 'nutritionPlanMutation',
      revision: receipt.revision,
      planId,
      deletedPlanId: receipt.deletedPlanId,
    });
    return true;
  }

  applyProfileReceipt(
    expectedRevision: MealPlanRevision,
    receipt: NutritionProfileDto,
    identityGeneration: number
  ): boolean {
    if (!this.canApplyReceipt(expectedRevision, receipt.revision, identityGeneration)) return false;

    this.profile.replaceConfirmed(receipt.profile, receipt.revision, identityGeneration);
    this.details.invalidateAll();
    this.planner.rebaseFresh(expectedRevision, receipt.revision);
    this.plans.rebaseFresh(expectedRevision, receipt.revision);
    this.context.replaceConfirmedRevision(receipt.revision, identityGeneration);
    this.changedSubject.next({ kind: 'profileMutation', revision: receipt.revision });
    return true;
  }

  invalidateRecipes(): void {
    this.planner.invalidateAll();
    this.changedSubject.next({ kind: 'recipeInvalidated' });
  }

  applyMutationReceipt(
    kind: import('./meal-plan-mutation.model').MealPlanMutationKind,
    expectedRevision: MealPlanRevision,
    receipt: MealPlanMutationReceipt,
    identityGeneration: number
  ): boolean {
    if (kind === 'updateNutritionProfile') {
      if (isProfileReceipt(receipt)) {
        return this.applyProfileReceipt(expectedRevision, receipt, identityGeneration);
      }
      return this.rejectMalformedReceipt(identityGeneration);
    }
    if (isPlannerKind(kind)) {
      if (isPlannerReceipt(receipt)) {
        return this.applyPlannerReceipt(expectedRevision, receipt, identityGeneration);
      }
      return this.rejectMalformedReceipt(identityGeneration);
    }
    if (isNutritionPlanReceipt(receipt)) {
      return this.applyNutritionPlanReceipt(expectedRevision, receipt, identityGeneration);
    }
    return this.rejectMalformedReceipt(identityGeneration);
  }

  private acceptOwnQuery(observation: MealPlanReadObservation, readEpoch: number): boolean {
    switch (observation.kind) {
      case 'planner':
        return this.planner.acceptRange(observation.token, observation.response, readEpoch);
      case 'plans':
        return this.plans.acceptList(observation.token, observation.response, readEpoch);
      case 'planDetail':
        return this.details.acceptDetail(observation.token, observation.response, readEpoch);
      case 'profile':
        return this.profile.acceptProfile(observation.token, observation.response, readEpoch);
    }
  }

  private adoptReadContext(observation: MealPlanReadObservation): void {
    const generation = observation.token.identityGeneration;
    if (observation.kind === 'profile') {
      this.context.replaceConfirmedRevision(observation.response.revision, generation);
    } else {
      this.context.replaceConfirmedContext(
        observation.response.revision,
        observation.response.settings,
        generation
      );
    }
  }

  private invalidateSource(observation: MealPlanReadObservation): void {
    switch (observation.kind) {
      case 'planner': this.planner.invalidate(observation.token.queryKey); break;
      case 'plans': this.plans.invalidate(); break;
      case 'planDetail': this.details.invalidate(observation.response.plan.id); break;
      case 'profile': this.profile.invalidate(); break;
    }
  }

  private invalidateOlderProjections(
    revision: MealPlanRevision,
    source: MealPlanReadObservation
  ): void {
    this.planner.invalidateOlderThan(
      revision,
      source.kind === 'planner' ? source.token.queryKey : null
    );
    if (source.kind !== 'plans') this.plans.invalidateIfOlderThan(revision);
    this.details.invalidateOlderThan(
      revision,
      source.kind === 'planDetail' ? source.response.plan.id : null
    );
    if (source.kind !== 'profile') this.profile.invalidateIfOlderThan(revision);
  }

  private canApplyReceipt(
    expectedRevision: MealPlanRevision,
    receiptRevision: MealPlanRevision,
    identityGeneration: number
  ): boolean {
    const current = this.context.revision();
    if (!this.context.isGenerationCurrent(identityGeneration)) return false;
    if (current !== expectedRevision
      || !isKnownOwnWriteTransition(expectedRevision, receiptRevision)) {
      this.requireReconciliation();
      return false;
    }
    return true;
  }

  private rejectMalformedReceipt(identityGeneration: number): false {
    if (this.context.isGenerationCurrent(identityGeneration)) this.requireReconciliation();
    return false;
  }

  private requireReconciliation(): void {
    const generation = this.context.identityGeneration();
    this.context.advanceReadEpoch();
    this.context.invalidateConfirmedContext(generation);
    this.planner.invalidateAll();
    this.plans.invalidate();
    this.details.invalidateAll();
    this.profile.invalidate();
    this.changedSubject.next({ kind: 'reconciliationRequired' });
  }
}

function isRevision(value: string): boolean {
  return /^(0|[1-9]\d*)$/.test(value);
}

function compareRevisions(left: string, right: string): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function isKnownOwnWriteTransition(previous: string, next: string): boolean {
  if (!isRevision(previous) || !isRevision(next)) return false;
  const previousValue = BigInt(previous);
  const nextValue = BigInt(next);
  return nextValue === previousValue || nextValue === previousValue + 1n;
}

function isPlannerKind(kind: import('./meal-plan-mutation.model').MealPlanMutationKind): boolean {
  return kind === 'createMeal'
    || kind === 'renameMeal'
    || kind === 'deleteMeal'
    || kind === 'reorderMeals'
    || kind === 'addRecipeItem'
    || kind === 'setRecipeQuantity'
    || kind === 'addManualItem'
    || kind === 'updateManualItem'
    || kind === 'deleteItem'
    || kind === 'reorderItems'
    || kind === 'copyDay'
    || kind === 'copyWeek';
}

function isPlannerReceipt(receipt: MealPlanMutationReceipt): receipt is PlannerMutationDto {
  return 'days' in receipt && 'createdMealId' in receipt;
}

function isNutritionPlanReceipt(
  receipt: MealPlanMutationReceipt
): receipt is NutritionPlanMutationDto {
  return 'plannerInvalidated' in receipt && 'deletedPlanId' in receipt;
}

function isProfileReceipt(receipt: MealPlanMutationReceipt): receipt is NutritionProfileDto {
  return 'profile' in receipt && !('settings' in receipt);
}
