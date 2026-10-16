import { TestBed } from '@angular/core/testing';

import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { NutritionProfileEditorState } from './nutrition-profile-editor.state';

describe('NutritionProfileEditorState', () => {
  let state: NutritionProfileEditorState;
  let context: MealPlanContextStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NutritionProfileEditorState] });
    state = TestBed.inject(NutritionProfileEditorState);
    context = TestBed.inject(MealPlanContextStore);
  });

  it('prefills a saved profile without making the draft dirty', () => {
    state.initialize(profileValue(), '8');
    expect(state.form.getRawValue()).toMatchObject({
      calculationSex: 'female',
      heightCm: 168.5,
      weightKg: 64.25,
    });
    expect(state.dirty()).toBe(false);
    expect(state.reviewedRevision()).toBe('8');
  });

  it('does not let a late GET overwrite values typed before initialization', () => {
    state.form.controls.heightCm.setValue(180);
    state.initialize(profileValue(), '8');

    expect(state.form.controls.heightCm.value).toBe(180);
    expect(state.dirty()).toBe(true);
    expect(state.reviewedRevision()).toBe('8');
  });

  it('keeps a newer draft when acknowledging an older submitted version', () => {
    state.initialize(profileValue(), '8');
    state.form.controls.weightKg.setValue(65);
    const submittedVersion = state.draftVersion();
    state.form.controls.weightKg.setValue(66);

    state.acknowledge(submittedVersion, { ...profileValue(), weightKg: 65 }, '9');
    expect(state.form.controls.weightKg.value).toBe(66);
    expect(state.dirty()).toBe(true);
  });

  it('clears the draft on identity reset', () => {
    state.initialize(profileValue(), '8');
    state.form.controls.weightKg.setValue(70);
    context.reset();

    expect(state.initialized()).toBe(false);
    expect(state.form.controls.weightKg.value).toBeNull();
    expect(state.dirty()).toBe(false);
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
