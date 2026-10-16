import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, finalize, take, takeUntil } from 'rxjs';

import { NutritionProfileFacade } from '@app/core/shared/data-access/user/nutrition-profile.facade';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { User } from '@app/core/shared/data-access/user/user.model';
import { NutritionProfileFieldErrors } from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.model';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { NutritionProfileEditorState } from './nutrition-profile-editor.state';

/** Profile-route orchestration for loading, saving and preserving the nutrition draft. */
@Injectable()
export class NutritionProfileEditorFacade {
  private readonly core = inject(NutritionProfileFacade);
  private readonly userFacade = inject(UserFacade);
  private readonly router = inject(Router);
  private readonly state = inject(NutritionProfileEditorState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly context = inject(MealPlanContextStore);
  private readonly exit$ = new Subject<void>();
  private entered = false;

  readonly form = this.state.form;
  readonly dirty = this.state.dirty;
  readonly initialized = this.state.initialized;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly fieldErrors = signal<NutritionProfileFieldErrors>({});
  readonly queryError = signal<string | null>(null);
  readonly requiresReview = signal(false);
  readonly refreshedRevision = signal<string | null>(null);
  readonly savedProfile = this.core.store.profile;
  readonly diagnostic = signal<string | null>(null);
  readonly isAccountLoading = signal(true);
  readonly isAccountSubmitting = signal(false);
  readonly hasAccountProfile = signal(false);
  readonly accountErrorMessage = signal<string | null>(null);
  readonly accountSuccessMessage = signal<string | null>(null);
  readonly isDeleteConfirmationOpen = signal(false);
  readonly isDeleting = signal(false);
  readonly deleteErrorMessage = signal<string | null>(null);
  readonly accountForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    imageUrl: new FormControl('', { nonNullable: true, validators: [optionalHttpUrlValidator] }),
  });
  readonly deleteForm = new FormGroup({
    confirmation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^DELETE$/)],
    }),
  });

  constructor() {
    this.context.reset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.leave());
  }

  leave(): void {
    this.exit$.next();
    this.entered = false;
    this.state.clear();
    this.requiresReview.set(false);
    this.refreshedRevision.set(null);
    this.queryError.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.diagnostic.set(null);
    this.fieldErrors.set({});
    this.accountForm.reset({ username: '', imageUrl: '' });
    this.deleteForm.reset();
    this.hasAccountProfile.set(false);
    this.accountErrorMessage.set(null);
    this.accountSuccessMessage.set(null);
    this.isDeleteConfirmationOpen.set(false);
    this.deleteErrorMessage.set(null);
  }

  enter(): void {
    if (this.entered) return;
    this.entered = true;
    this.loadAccountProfile();
    this.loadNutritionProfile();
  }

  retryLoad(): void {
    this.loadNutritionProfile();
  }

  confirmReview(): void {
    const revision = this.refreshedRevision();
    if (revision === null || !this.core.resumeAfterReview(revision)) {
      this.queryError.set('Refresh again before reviewing this profile.');
      return;
    }
    this.state.review(this.savedProfile(), revision);
    this.requiresReview.set(false);
    this.refreshedRevision.set(null);
    this.errorMessage.set(null);
    this.diagnostic.set(null);
  }

  private loadNutritionProfile(): void {
    this.loading.set(true);
    this.queryError.set(null);
    this.refreshedRevision.set(null);
    this.core.load().pipe(
      take(1),
      finalize(() => this.loading.set(false)),
      takeUntil(this.exit$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: response => {
        this.state.initialize(response.profile, response.revision);
        if (this.requiresReview()) this.refreshedRevision.set(response.revision);
      },
      error: () => {
        this.queryError.set(
          this.core.store.request().error ?? 'We could not load your nutrition profile.'
        );
      },
    });
  }

  saveAccountProfile(): void {
    this.accountSuccessMessage.set(null);
    this.accountErrorMessage.set(null);
    if (this.accountForm.invalid || this.isAccountSubmitting() || this.isDeleting()) {
      this.accountForm.markAllAsTouched();
      return;
    }
    const value = this.accountForm.getRawValue();
    this.isAccountSubmitting.set(true);
    this.userFacade.updateMe$({
      username: value.username.trim(),
      imageUrl: value.imageUrl.trim() || null,
    }).pipe(
      take(1),
      finalize(() => this.isAccountSubmitting.set(false)),
      takeUntil(this.exit$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: profile => {
        this.populateAccountForm(profile);
        this.accountSuccessMessage.set('Your profile has been updated.');
      },
      error: () => this.readAccountError(),
    });
  }

  retryAccountLoad(): void {
    this.loadAccountProfile();
  }

  openDeleteConfirmation(): void {
    if (this.isAccountSubmitting() || this.isDeleting()) return;
    this.deleteForm.reset();
    this.deleteErrorMessage.set(null);
    this.isDeleteConfirmationOpen.set(true);
  }

  cancelDeleteConfirmation(): void {
    if (this.isDeleting()) return;
    this.isDeleteConfirmationOpen.set(false);
    this.deleteForm.reset();
    this.deleteErrorMessage.set(null);
  }

  deleteAccount(): void {
    if (this.deleteForm.invalid || this.isDeleting()) {
      this.deleteForm.markAllAsTouched();
      return;
    }
    this.deleteErrorMessage.set(null);
    this.isDeleting.set(true);
    this.userFacade.deleteMe$().pipe(
      take(1),
      finalize(() => this.isDeleting.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => void this.router.navigateByUrl('/auth/login', { replaceUrl: true }),
      error: () => this.readDeleteError(),
    });
  }

  save(): void {
    if (this.saving() || this.loading() || this.requiresReview()) return;
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.fieldErrors.set({});
    this.diagnostic.set(null);
    const request = this.state.request();
    const revision = this.state.reviewedRevision();
    if (request === null || revision === null || this.saving()) {
      this.state.markInvalidForReview();
      if (revision === null) this.errorMessage.set('Refresh your nutrition profile before saving.');
      return;
    }

    const submittedDraftVersion = this.state.draftVersion();
    this.saving.set(true);
    this.core.update(request, revision).pipe(
      take(1),
      finalize(() => this.saving.set(false)),
      takeUntil(this.exit$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      if (result.outcome === 'confirmed' && result.revision !== null) {
        this.state.acknowledge(
          submittedDraftVersion,
          this.core.store.profile(),
          result.revision
        );
        this.successMessage.set(this.dirty()
          ? 'The submitted values were saved. Your newer changes are not saved yet.'
          : 'Your nutrition profile has been saved.');
        return;
      }
      this.requiresReview.set(result.outcome === 'conflict' || result.outcome === 'unknownOutcome');
      this.fieldErrors.set(mapFieldErrors(result.errors));
      this.diagnostic.set([result.code, result.traceId].filter(Boolean).join(' · ') || null);
      this.errorMessage.set(mutationMessage(result.outcome));
    });
  }

  hasPendingChanges(): boolean {
    return this.dirty() || this.saving() || this.requiresReview();
  }

  discard(): void {
    this.leave();
  }

  private loadAccountProfile(): void {
    this.isAccountLoading.set(true);
    this.hasAccountProfile.set(false);
    this.accountErrorMessage.set(null);
    this.userFacade.getMe$().pipe(
      take(1),
      finalize(() => this.isAccountLoading.set(false)),
      takeUntil(this.exit$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: profile => this.populateAccountForm(profile),
      error: () => this.readAccountError(),
    });
  }

  private populateAccountForm(profile: User): void {
    this.accountForm.reset({ username: profile.username, imageUrl: profile.imageUrl ?? '' });
    this.hasAccountProfile.set(true);
  }

  private readAccountError(): void {
    this.userFacade.error$.pipe(take(1)).subscribe(message => {
      this.accountErrorMessage.set(message ?? 'Something went wrong. Please try again.');
    });
  }

  private readDeleteError(): void {
    this.userFacade.error$.pipe(take(1)).subscribe(message => {
      this.deleteErrorMessage.set(
        message ?? 'We could not delete your account. Your account remains active; please try again.'
      );
    });
  }
}

function mutationMessage(outcome: string): string {
  switch (outcome) {
    case 'conflict':
      return 'This profile changed elsewhere. Refresh and review your values before saving again.';
    case 'unknownOutcome':
      return 'The save result is uncertain. Refresh to reconcile before trying again.';
    case 'failed':
      return 'We could not save your nutrition profile. Your entered values are still here.';
    case 'cancelled':
      return 'The save was cancelled. Your entered values are still here.';
    default:
      return 'The nutrition profile was not saved.';
  }
}

function mapFieldErrors(errors?: Readonly<Record<string, readonly string[]>>): NutritionProfileFieldErrors {
  if (!errors) return {};
  return {
    calculationSex: errors['calculationSex'],
    ageYears: errors['birthYear'],
    heightCm: errors['heightCm'],
    weightKg: errors['weightKg'],
    adultConfirmed: errors['adultConfirmed'],
  };
}

function optionalHttpUrlValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : { invalidUrl: true };
  } catch {
    return { invalidUrl: true };
  }
}
