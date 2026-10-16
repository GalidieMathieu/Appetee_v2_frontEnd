import { Injectable } from '@angular/core';

import { EntityCacheStore } from '../generic-template/entity-cache-store';
import { MealPlanQueryToken } from './meal-plan-context.store';
import { MealPlanRevision } from './meal-plan.model';
import { NutritionPlanDetailDto, NutritionPlanDto } from './nutrition-plan.model';

export interface NutritionPlanDetailRecord {
  readonly id: number;
  readonly plan: NutritionPlanDto;
  readonly revision: MealPlanRevision;
  readonly profileDiffers: boolean;
}

/** Root cache containing only complete plan detail responses, independently keyed by plan ID. */
@Injectable({ providedIn: 'root' })
export class NutritionPlanDetailsStore extends EntityCacheStore<NutritionPlanDetailRecord> {
  private readonly requestSequenceById = new Map<number, number>();

  beginLoad(planId: number, readEpoch: number): MealPlanQueryToken | null {
    if (this.requestState(planId).status === 'loading') return null;
    const requestSequence = (this.requestSequenceById.get(planId) ?? 0) + 1;
    this.requestSequenceById.set(planId, requestSequence);
    this.setLoading(planId);
    return {
      identityGeneration: this.generation(),
      queryKey: this.queryKey(planId),
      requestSequence,
      readEpoch,
      invalidationVersion: this.invalidationVersion(planId),
    };
  }

  acceptDetail(
    token: MealPlanQueryToken,
    response: NutritionPlanDetailDto,
    currentReadEpoch: number
  ): boolean {
    const planId = response.plan.id;
    if (!this.isTokenCurrent(token, planId, currentReadEpoch)) return false;
    this.upsert({
      id: planId,
      plan: response.plan,
      revision: response.revision,
      profileDiffers: response.profileDiffers,
    });
    return true;
  }

  failLoad(
    planId: number,
    token: MealPlanQueryToken,
    message: string,
    currentReadEpoch: number,
    httpStatus?: number
  ): boolean {
    if (!this.isTokenCurrent(token, planId, currentReadEpoch)) return false;
    this.setError(planId, message, httpStatus);
    return true;
  }

  override reset(): void {
    super.reset();
    this.requestSequenceById.clear();
  }

  invalidateAll(exceptId: number | null = null): void {
    for (const id of Object.keys(this.entitiesById()).map(Number)) {
      if (id !== exceptId) this.invalidate(id);
    }
  }

  invalidateOlderThan(revision: MealPlanRevision, exceptId: number | null = null): void {
    for (const record of Object.values(this.entitiesById())) {
      if (record.id !== exceptId && BigInt(record.revision) < BigInt(revision)) {
        this.invalidate(record.id);
      }
    }
  }

  rebaseFresh(
    expectedRevision: MealPlanRevision,
    revision: MealPlanRevision,
    exceptId: number | null = null
  ): void {
    for (const record of Object.values(this.entitiesById())) {
      if (record.id !== exceptId && record.revision === expectedRevision) {
        this.upsert({ ...record, revision });
      }
    }
  }

  private isTokenCurrent(
    token: MealPlanQueryToken,
    planId: number,
    currentReadEpoch: number
  ): boolean {
    return token.queryKey === this.queryKey(planId)
      && token.requestSequence === this.requestSequenceById.get(planId)
      && token.readEpoch === currentReadEpoch
      && this.isRequestCurrent(
        planId,
        token.identityGeneration,
        token.invalidationVersion
      );
  }

  private queryKey(planId: number): string {
    return `nutrition-plan:${planId}`;
  }
}
