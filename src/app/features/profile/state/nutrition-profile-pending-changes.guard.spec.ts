import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { NutritionProfileEditorFacade } from './nutrition-profile-editor.facade';
import { nutritionProfilePendingChangesGuard } from './nutrition-profile-pending-changes.guard';

describe('nutritionProfilePendingChangesGuard', () => {
  const hasPendingChanges = vi.fn();
  const saving = vi.fn();
  const requiresReview = vi.fn();
  const discard = vi.fn();
  const confirm = vi.fn();

  beforeEach(() => {
    hasPendingChanges.mockReset();
    saving.mockReset();
    requiresReview.mockReset();
    discard.mockReset();
    confirm.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NutritionProfileEditorFacade,
          useValue: { hasPendingChanges, saving, requiresReview, discard },
        },
        { provide: DOCUMENT, useValue: { defaultView: { confirm } } },
      ],
    });
  });

  it('allows leaving when there is no nutrition draft', () => {
    hasPendingChanges.mockReturnValue(false);
    expect(runGuard()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not claim an in-flight write can be discarded', () => {
    hasPendingChanges.mockReturnValue(true);
    saving.mockReturnValue(true);
    expect(runGuard()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('offers discard for an unsaved draft and clears it only when confirmed', () => {
    hasPendingChanges.mockReturnValue(true);
    saving.mockReturnValue(false);
    confirm.mockReturnValue(true);
    expect(runGuard()).toBe(true);
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('requires reconciliation before leaving an uncertain or conflicted save', () => {
    hasPendingChanges.mockReturnValue(true);
    requiresReview.mockReturnValue(true);
    expect(runGuard()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  function runGuard(): unknown {
    return TestBed.runInInjectionContext(() => nutritionProfilePendingChangesGuard(
      {} as never,
      {} as never,
      {} as never,
      {} as never
    ));
  }
});
