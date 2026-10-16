import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { NutritionPlansStore } from '@app/core/shared/data-access/meal-plan/nutrition-plans.store';
import { nutritionPlanList } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
import { NutritionPlanEntryFacade } from './nutrition-plan-entry.facade';

describe('Nutrition Plan entry chooser', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    NutritionPlanEntryFacade, provideRouter([]),
    { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 } },
  ] }));
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it.each(['easy', 'intermediate'] as const)('routes %s only after an explicit selection, without submitting a plan', async mode => {
    const entry = TestBed.inject(NutritionPlanEntryFacade), dialogs = TestBed.inject(MatDialog);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    entry.openCreate(); entry.openCreate();
    expect(dialogs.openDialogs).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
    const closed = firstValueFrom(dialogs.openDialogs[0]!.afterClosed());
    dialogs.openDialogs[0]!.close(mode); await closed;
    expect(navigate).toHaveBeenCalledExactlyOnceWith(mode === 'easy'
      ? '/meal-plan/nutrition-plans/create/easy'
      : '/meal-plan/nutrition-plans/create/intermediate/profile');
  });
  it('cancel closes without navigation and restores the trigger focus', async () => {
    const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
    const entry = TestBed.inject(NutritionPlanEntryFacade), dialogs = TestBed.inject(MatDialog);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    entry.openCreate();
    const closed = firstValueFrom(dialogs.openDialogs[0]!.afterClosed());
    dialogs.openDialogs[0]!.close(); await closed;
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger); trigger.remove();
  });
  it('prevents entry at the confirmed plan cap', () => {
    const store = TestBed.inject(NutritionPlansStore), token = store.beginLoad(0)!;
    store.acceptList(token, nutritionPlanList(Array.from({ length: 50 }, (_, i) => i + 1)), 0);
    const entry = TestBed.inject(NutritionPlanEntryFacade);
    expect(entry.atCap()).toBe(true);
    entry.openCreate();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });
});
