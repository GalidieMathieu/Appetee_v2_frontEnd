import { Injectable, signal } from '@angular/core';
import { CopyMode } from '../models/copy-intent.model';
import { calendarDate, shiftCalendarDate } from './meal-plan-workspace.state';
export function copyRange(date: string, mode: CopyMode): { from: string; through: string } | null {
  const parsed = calendarDate(date); if (!parsed || mode === 'week' && parsed.getDay() !== 1) return null;
  const through = mode === 'week' ? shiftCalendarDate(date, 6) : date;
  return through ? { from: date, through } : null;
}
@Injectable()
export class CopyFlowState {
  readonly mode = signal<CopyMode>('day');
  readonly source = signal(''); readonly destination = signal('');
  readonly reviewedRevision = signal<string | null>(null);
  readonly confirmed = signal(false);
  readonly message = signal<string | null>(null);
  private sequence = 0;
  begin(mode: CopyMode, source: string): void { this.clear(); this.mode.set(mode); this.source.set(source); }
  setDestination(date: string): void { this.sequence++; this.destination.set(date); this.invalidate(); }
  invalidate(): void { this.reviewedRevision.set(null); this.confirmed.set(false); this.message.set(null); }
  nextReview(): number { this.invalidate(); return ++this.sequence; }
  current(sequence: number): boolean { return sequence === this.sequence; }
  clear(): void { this.sequence++; this.source.set(''); this.destination.set(''); this.invalidate(); }
}
