import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import {
  NutritionProfileRequest,
  NutritionProfileValue,
} from '@app/core/shared/data-access/user/nutrition-profile.model';
import {
  createNutritionProfileForm,
  nutritionProfileRequestFromForm,
  profileToFormValue,
} from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.factory';

/** Route-scoped editable draft; it is never a second saved-profile cache. */
@Injectable()
export class NutritionProfileEditorState {
  private readonly context = inject(MealPlanContextStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly initializedSignal = signal(false);
  private readonly dirtySignal = signal(false);
  private readonly draftVersionSignal = signal(0);
  private readonly reviewedRevisionSignal = signal<string | null>(null);
  private baseline = JSON.stringify(profileToFormValue(null));
  private suppressChanges = false;

  readonly form = createNutritionProfileForm();
  readonly initialized = this.initializedSignal.asReadonly();
  readonly dirty = this.dirtySignal.asReadonly();
  readonly draftVersion = this.draftVersionSignal.asReadonly();
  readonly reviewedRevision = this.reviewedRevisionSignal.asReadonly();
  readonly canSave = computed(() => this.initializedSignal() && this.dirtySignal() && this.form.valid);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.suppressChanges) return;
      this.draftVersionSignal.update(version => version + 1);
      this.dirtySignal.set(JSON.stringify(this.form.getRawValue()) !== this.baseline);
    });
    this.context.reset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.clear());
    this.destroyRef.onDestroy(() => this.clear());
  }

  initialize(profile: NutritionProfileValue | null, revision: string): void {
    if (this.initializedSignal()) return;
    const confirmedValue = profileToFormValue(profile);
    this.baseline = JSON.stringify(confirmedValue);
    this.reviewedRevisionSignal.set(revision);
    this.initializedSignal.set(true);

    if (this.draftVersionSignal() > 0) {
      this.dirtySignal.set(JSON.stringify(this.form.getRawValue()) !== this.baseline);
      return;
    }
    this.replaceFormValue(confirmedValue);
  }

  request(): NutritionProfileRequest | null {
    return nutritionProfileRequestFromForm(this.form);
  }

  review(profile: NutritionProfileValue | null, revision: string): void {
    this.baseline = JSON.stringify(profileToFormValue(profile));
    this.reviewedRevisionSignal.set(revision);
    this.dirtySignal.set(JSON.stringify(this.form.getRawValue()) !== this.baseline);
  }

  markInvalidForReview(): void {
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
  }

  acknowledge(
    submittedDraftVersion: number,
    confirmedProfile: NutritionProfileValue | null,
    revision: string
  ): void {
    const confirmedValue = profileToFormValue(confirmedProfile);
    this.baseline = JSON.stringify(confirmedValue);
    this.reviewedRevisionSignal.set(revision);
    if (this.draftVersionSignal() !== submittedDraftVersion) {
      this.dirtySignal.set(JSON.stringify(this.form.getRawValue()) !== this.baseline);
      return;
    }
    this.replaceFormValue(confirmedValue);
  }

  clear(): void {
    this.initializedSignal.set(false);
    this.reviewedRevisionSignal.set(null);
    this.baseline = JSON.stringify(profileToFormValue(null));
    this.suppressChanges = true;
    this.form.reset(profileToFormValue(null), { emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.suppressChanges = false;
    this.draftVersionSignal.set(0);
    this.dirtySignal.set(false);
  }

  private replaceFormValue(value: ReturnType<typeof profileToFormValue>): void {
    this.suppressChanges = true;
    this.form.reset(value, { emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.updateValueAndValidity({ emitEvent: false });
    this.suppressChanges = false;
    this.draftVersionSignal.set(0);
    this.dirtySignal.set(false);
  }
}
