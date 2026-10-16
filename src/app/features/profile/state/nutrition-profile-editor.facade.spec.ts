import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { NutritionProfileFacade } from '@app/core/shared/data-access/user/nutrition-profile.facade';
import { NutritionProfileDto } from '@app/core/shared/data-access/user/nutrition-profile.model';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { Router } from '@angular/router';
import { NutritionProfileEditorFacade } from './nutrition-profile-editor.facade';
import { NutritionProfileEditorState } from './nutrition-profile-editor.state';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';

describe('NutritionProfileEditorFacade', () => {
  const load = vi.fn();
  const update = vi.fn();
  const resumeAfterReview = vi.fn();
  const savedProfile = signal(profileValue());
  const request = signal({ status: 'success', error: null });
  const getMe = vi.fn();
  const updateMe = vi.fn();
  const deleteMe = vi.fn();
  const navigateByUrl = vi.fn(() => Promise.resolve(true));
  const userError = new BehaviorSubject<string | null>(null);
  let facade: NutritionProfileEditorFacade;

  beforeEach(() => {
    load.mockReset();
    update.mockReset();
    resumeAfterReview.mockReset();
    resumeAfterReview.mockReturnValue(true);
    getMe.mockReset();
    updateMe.mockReset();
    deleteMe.mockReset();
    navigateByUrl.mockClear();
    userError.next(null);
    savedProfile.set(profileValue());
    load.mockReturnValue(of({ revision: '8', profile: profileValue() }));
    getMe.mockReturnValue(of({ username: 'chef', imageUrl: null }));
    TestBed.configureTestingModule({
      providers: [
        NutritionProfileEditorState,
        NutritionProfileEditorFacade,
        {
          provide: NutritionProfileFacade,
          useValue: { load, update, resumeAfterReview, store: { profile: savedProfile, request } },
        },
        {
          provide: UserFacade,
          useValue: {
            getMe$: getMe,
            updateMe$: updateMe,
            deleteMe$: deleteMe,
            error$: userError.asObservable(),
          },
        },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    facade = TestBed.inject(NutritionProfileEditorFacade);
  });

  it('loads once and initializes the route draft from the confirmed source', () => {
    facade.enter();
    facade.enter();
    expect(load).toHaveBeenCalledTimes(1);
    expect(facade.initialized()).toBe(true);
    expect(facade.form.controls.heightCm.value).toBe(168.5);
  });

  it('preserves the draft and shows a settled error after a failed save', () => {
    facade.enter();
    facade.form.controls.weightKg.setValue(70);
    update.mockReturnValue(of({
      operationId: 1,
      kind: 'updateNutritionProfile',
      outcome: 'failed',
      revision: null,
    }));
    facade.save();

    expect(facade.form.controls.weightKg.value).toBe(70);
    expect(facade.dirty()).toBe(true);
    expect(facade.errorMessage()).toContain('entered values are still here');
  });

  it('resets the acknowledged draft only after core reports confirmation', () => {
    facade.enter();
    facade.form.controls.weightKg.setValue(70);
    savedProfile.set({ ...profileValue(), weightKg: 70 });
    update.mockReturnValue(of({
      operationId: 1,
      kind: 'updateNutritionProfile',
      outcome: 'confirmed',
      revision: '9',
    }));
    facade.save();

    expect(facade.dirty()).toBe(false);
    expect(facade.successMessage()).toContain('has been saved');
  });

  it('does not change any plan target data while saving a profile', () => {
    facade.enter();
    facade.form.controls.weightKg.setValue(70);
    update.mockReturnValue(of({
      operationId: 1,
      kind: 'updateNutritionProfile',
      outcome: 'confirmed',
      revision: '9',
    }));
    facade.save();

    expect(update).toHaveBeenCalledTimes(1);
    expect(Object.keys(update.mock.calls[0]?.[0] ?? {})).toEqual([
      'calculationSex', 'birthYear', 'heightCm', 'weightKg',
    ]);
  });

  it('keeps the existing username/image request claim-scoped', () => {
    facade.enter();
    updateMe.mockReturnValue(of({ username: 'new-chef', imageUrl: null }));
    facade.accountForm.setValue({ username: ' new-chef ', imageUrl: '' });
    facade.saveAccountProfile();

    expect(updateMe).toHaveBeenCalledWith({ username: 'new-chef', imageUrl: null });
    expect(facade.accountSuccessMessage()).toContain('updated');
  });

  it('keeps existing account deletion claim-scoped and navigates only after success', () => {
    facade.enter();
    deleteMe.mockReturnValue(of(void 0));
    facade.deleteForm.controls.confirmation.setValue('DELETE');
    facade.deleteAccount();

    expect(deleteMe).toHaveBeenCalledWith();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login', { replaceUrl: true });
  });

  it('maps server field paths without losing draft values and exposes diagnostic references', () => {
    facade.enter();
    facade.form.controls.weightKg.setValue(70);
    update.mockReturnValue(of({ outcome: 'failed', revision: null, code: 'validation_failed',
      traceId: 'test-trace', errors: { birthYear: ['Review your age.'], weightKg: ['Review weight.'] } }));
    facade.save();
    expect(facade.fieldErrors().ageYears).toEqual(['Review your age.']);
    expect(facade.fieldErrors().weightKg).toEqual(['Review weight.']);
    expect(facade.diagnostic()).toContain('test-trace');
    expect(facade.form.controls.weightKg.value).toBe(70);
  });

  for (const outcome of ['conflict', 'unknownOutcome']) {
    it(`requires refresh and explicit review after ${outcome}, with no automatic write`, () => {
      facade.enter();
      facade.form.controls.weightKg.setValue(70);
      update.mockReturnValue(of({ outcome, revision: null }));
      facade.save();
      facade.save();
      expect(update).toHaveBeenCalledTimes(1);
      expect(facade.requiresReview()).toBe(true);
      load.mockReturnValue(of({ revision: '9', profile: { ...profileValue(), weightKg: 69 } }));
      savedProfile.set({ ...profileValue(), weightKg: 69 });
      facade.retryLoad();
      expect(facade.form.controls.weightKg.value).toBe(70);
      expect(resumeAfterReview).not.toHaveBeenCalled();
      facade.confirmReview();
      expect(resumeAfterReview).toHaveBeenCalledWith('9');
      expect(update).toHaveBeenCalledTimes(1);
      facade.save();
      expect(update.mock.calls[1]?.[1]).toBe('9');
    });
  }

  it('keeps query errors separate from the failed mutation while preserving the draft', () => {
    facade.enter();
    facade.form.controls.weightKg.setValue(70);
    update.mockReturnValue(of({ outcome: 'conflict', revision: null }));
    facade.save();
    const failure = facade.errorMessage();
    load.mockReturnValue(throwError(() => new Error('Read failed')));
    facade.retryLoad();
    expect(facade.queryError()).toBeTruthy();
    expect(facade.errorMessage()).toBe(failure);
    expect(facade.form.controls.weightKg.value).toBe(70);
    expect(facade.refreshedRevision()).toBeNull();
  });

  it('clears route state on reset and ignores a late read, then supports re-entry', () => {
    const late = new Subject<NutritionProfileDto>();
    load.mockReturnValue(late);
    facade.enter();
    facade.form.controls.weightKg.setValue(70);
    TestBed.inject(MealPlanContextStore).reset();
    late.next({ revision: '8', profile: profileValue() });
    expect(facade.initialized()).toBe(false);
    expect(facade.form.controls.weightKg.value).toBeNull();
    load.mockReturnValue(of({ revision: '9', profile: null }));
    facade.enter();
    expect(facade.initialized()).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not announce newer unsaved values as saved', () => {
    facade.enter();
    const result = new Subject<{ outcome: string; revision: string }>();
    update.mockReturnValue(result);
    facade.form.controls.weightKg.setValue(70);
    facade.save();
    facade.form.controls.weightKg.setValue(71);
    savedProfile.set({ ...profileValue(), weightKg: 70 });
    result.next({ outcome: 'confirmed', revision: '9' });
    expect(facade.form.controls.weightKg.value).toBe(71);
    expect(facade.successMessage()).toContain('newer changes are not saved');
  });

  function profileValue() {
    return {
      calculationSex: 'female' as const,
      birthYear: 1990,
      heightCm: 168.5,
      weightKg: 64.25,
    };
  }
});
