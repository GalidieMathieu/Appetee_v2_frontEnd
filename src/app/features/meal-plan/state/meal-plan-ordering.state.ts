import { Injectable, signal } from '@angular/core';
export function movedIds(ids: readonly number[], from: number, to: number): readonly number[] | null {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length
    || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || id <= 0)) return null;
  const next = [...ids], [id] = next.splice(from, 1); next.splice(to, 0, id!); return next;
}
@Injectable()
export class MealPlanOrderingState {
  readonly ids = signal<readonly number[] | null>(null);
  readonly parent = signal<string | null>(null);
  readonly revision = signal<string | null>(null);
  readonly announcement = signal('');
  readonly focus = signal<{ kind: 'meal' | 'item'; id: number; sequence: number } | null>(null);
  private sequence = 0;
  clear(): void { this.ids.set(null); this.parent.set(null); this.revision.set(null); }
  reset(): void { this.clear(); this.announcement.set(''); this.focus.set(null); }
  settled(kind: 'meal' | 'item', id: number, position: number, count: number, confirmed: boolean): void {
    this.clear(); this.announcement.set(confirmed ? `Moved ${kind} to position ${position + 1} of ${count}.` : 'Could not save order. The confirmed order is restored.');
    this.focus.set({ kind, id, sequence: ++this.sequence });
  }
}
