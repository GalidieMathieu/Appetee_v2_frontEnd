import { TestBed } from '@angular/core/testing';
import { NutritionSummaryComponent } from './nutrition-summary.component';
import { KNOWN_NUTRIENTS, UNKNOWN_FAT_NUTRIENTS } from '@app/core/shared/data-access/meal-plan/testing/meal-plan.fixtures';
describe('NutritionSummaryComponent', () => {
  it('uses signed server remaining and does not coerce unknown values', () => { const fixture = TestBed.createComponent(NutritionSummaryComponent); fixture.componentRef.setInput('totals', UNKNOWN_FAT_NUTRIENTS); fixture.componentRef.setInput('targets', KNOWN_NUTRIENTS); fixture.componentRef.setInput('remaining', { ...KNOWN_NUTRIENTS, caloriesKcal: -75, fatG: null }); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('-75 kcal'); expect(fixture.nativeElement.textContent).toContain('over target'); expect(fixture.nativeElement.textContent).toContain('Unknown'); });
  it('hides target and remaining displays when no targets apply', () => { const fixture = TestBed.createComponent(NutritionSummaryComponent); fixture.componentRef.setInput('totals', KNOWN_NUTRIENTS); fixture.detectChanges(); expect(fixture.nativeElement.textContent).not.toContain('Remaining'); expect(fixture.nativeElement.textContent).toContain('No nutrition targets'); });
  it('bounds decorative progress without changing server values or inventing unknown progress', () => {
    const fixture = TestBed.createComponent(NutritionSummaryComponent);
    fixture.componentRef.setInput('totals', { caloriesKcal: 120, proteinG: 0, carbsG: 25, fatG: null });
    fixture.componentRef.setInput('targets', { caloriesKcal: 100, proteinG: 0, carbsG: 50, fatG: 20 });
    fixture.componentRef.setInput('remaining', { caloriesKcal: -20, proteinG: 0, carbsG: 25, fatG: null });
    fixture.detectChanges();
    expect(fixture.componentInstance.metrics().map(metric => metric.progress)).toEqual([100, null, 50, null]);
    expect(fixture.nativeElement.querySelectorAll('.metric-track')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.calories .metric-remaining').textContent).toContain('Remaining -20 kcal (over target)');
    expect(fixture.nativeElement.querySelector('details')).toBeNull();
    expect(fixture.nativeElement.querySelector('.calories dd').textContent).toContain('120');
  });
  it('keeps compact item macros labelled and retains unknown instead of a zero', () => {
    const fixture = TestBed.createComponent(NutritionSummaryComponent);
    fixture.componentRef.setInput('totals', UNKNOWN_FAT_NUTRIENTS); fixture.componentRef.setInput('presentation', 'inline'); fixture.componentRef.setInput('showNoTargetsNotice', false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.protein dd').textContent).toContain('g P');
    expect(fixture.nativeElement.querySelector('.fat dd').textContent).toContain('Unknown');
    expect(fixture.nativeElement.querySelector('details')).toBeNull();
  });
});
