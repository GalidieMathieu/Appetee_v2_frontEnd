import { TestBed } from '@angular/core/testing';
import { AutosaveStatusComponent } from './autosave-status.component';
describe('AutosaveStatusComponent', () => {
  it('announces settled failures/confirmed saves, not every draft edit', () => {
    const fixture = TestBed.createComponent(AutosaveStatusComponent);
    fixture.componentRef.setInput('status', 'dirty'); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[aria-live]').getAttribute('aria-live')).toBe('off');
    fixture.componentRef.setInput('status', 'saved'); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toBe('Saved');
    fixture.componentRef.setInput('status', 'unknownOutcome'); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Outcome unknown'); expect(fixture.nativeElement.querySelector('[role=status]')).not.toBeNull();
  });
});
