import { TestBed } from '@angular/core/testing';
import { ManualItemDraftState } from '../state/manual-item-draft.state';
import { ManualItemEditorComponent } from './manual-item-editor.component';
describe('Manual food presentation', () => {
  it('does not steal field focus when a previously submitted form becomes invalid during correction', () => {
    const fixture = TestBed.createComponent(ManualItemEditorComponent), state = new ManualItemDraftState();
    fixture.componentRef.setInput('draft', state); fixture.detectChanges(); state.value(); fixture.detectChanges();
    state.form.setValue({ name: 'Food', caloriesKcal: '100', proteinG: '1', carbsG: '2', fatG: '3' }); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#manual-proteinG'); input.focus();
    state.form.controls.proteinG.setValue('0'); fixture.detectChanges(); expect(document.activeElement).toBe(input);
  });
  it('labels units, focuses linked invalid feedback and emits a deliberate submit/cancel', () => {
    const fixture = TestBed.createComponent(ManualItemEditorComponent), state = new ManualItemDraftState();
    fixture.componentRef.setInput('draft', state); fixture.componentRef.setInput('ready', true); fixture.detectChanges();
    let submits = 0, cancels = 0; fixture.componentInstance.submitEntry.subscribe(() => { submits++; state.value(); }); fixture.componentInstance.cancel.subscribe(() => cancels++);
    fixture.nativeElement.querySelector('button[type=submit]').click(); fixture.detectChanges();
    expect(submits).toBe(1); expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[role=alert]'));
    expect(fixture.nativeElement.querySelectorAll('[role=alert] a')).toHaveLength(5);
    expect(fixture.nativeElement.textContent).toContain('Total for this entry'); expect(fixture.nativeElement.textContent).toContain('Protein (g)');
    fixture.nativeElement.querySelector('button[type=button]').click(); expect(cancels).toBe(1);
  });
});
