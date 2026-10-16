import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { CopyDayDialogComponent } from './copy-day-dialog.component';
describe('Copy day review presentation', () => {
  it('requires reviewed replacement acknowledgement and disables repeated/pending confirmation', () => {
    const view = signal<any>({ source: '2026-10-12', destination: '2026-10-19', rows: [], ready: true, pending: false, loading: false, requiresReplacement: true, confirmed: false, error: null });
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { view } }, { provide: MatDialogRef, useValue: { close: vi.fn() } }] });
    const fixture = TestBed.createComponent(CopyDayDialogComponent); fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('mat-dialog-actions button:last-child');
    expect(button.disabled).toBe(true); view.update(value => ({ ...value, confirmed: true })); fixture.detectChanges(); expect(button.disabled).toBe(false);
    view.update(value => ({ ...value, pending: true })); fixture.detectChanges(); expect(button.disabled).toBe(true);
  });
});
