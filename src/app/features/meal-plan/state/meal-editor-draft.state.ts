import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { PlannerMealDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';
export type AutosaveViewStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'conflict' | 'unknownOutcome';
export function validMealName(value: string): boolean {
  const name = value.trim().normalize('NFC');
  return Array.from(name).length >= 1 && Array.from(name).length <= 80 && !/[\p{Cc}\p{Cs}\u2028\u2029]/u.test(value);
}
export function validRecipeQuantity(value: string | number): boolean {
  return String(value).trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20;
}
export interface QuantityDraft {
  readonly value: string | number;
  readonly baseline: number;
  readonly version: number;
  readonly submitted: number | null;
}

/** Versioned, temporary scalar overlays only; never holds meal DTOs or nutrient totals. */
@Injectable()
export class MealEditorDraftState {
  readonly changes$ = new Subject<void>();
  readonly key = signal<string | null>(null);
  readonly name = signal('');
  readonly baselineName = signal('');
  readonly nameVersion = signal(0);
  readonly submittedName = signal<number | null>(null);
  readonly quantities = signal<Readonly<Record<number, QuantityDraft>>>({});
  readonly revision = signal<string | null>(null);
  readonly pendingVersions = signal<readonly string[]>([]);
  readonly status = signal<AutosaveViewStatus>('idle');
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Readonly<Partial<Record<string, readonly string[]>>>>({});
  readonly diagnostic = signal<string | null>(null);
  readonly blocked = signal(false);
  readonly validationAttempt = signal(false);
  readonly hasNameChange = computed(() => this.name().trim().normalize('NFC') !== this.baselineName());
  readonly dirty = computed(() => this.hasNameChange() || Object.values(this.quantities()).some(item => Number(item.value) !== item.baseline || !validRecipeQuantity(item.value)));
  readonly valid = computed(() => validMealName(this.name()) && Object.values(this.quantities()).every(item => validRecipeQuantity(item.value)));
  readonly saving = computed(() => this.pendingVersions().length > 0);
  readonly viewStatus = computed<AutosaveViewStatus>(() => this.blocked() ? this.status()
    : this.saving() ? 'saving' : this.dirty() ? 'dirty' : this.status());
  bind(meal: PlannerMealDto, revision: string): void {
    if (this.key() !== meal.key) { this.clear(); this.key.set(meal.key); this.name.set(meal.name); this.baselineName.set(meal.name); this.revision.set(revision); }
    else {
      if (this.revision() !== revision && this.dirty()) this.fail('conflict', 'Saved context changed. Refresh and review your draft before submitting again.');
      if (!this.hasNameChange() && !this.saving()) { this.name.set(meal.name); this.baselineName.set(meal.name); }
      if (!this.dirty() && !this.blocked()) this.revision.set(revision);
    }
    const quantities: Record<number, QuantityDraft> = {};
    for (const item of meal.items) if (item.type === 'recipe') {
      const draft = this.quantities()[item.id];
      quantities[item.id] = draft && (Number(draft.value) !== draft.baseline || draft.submitted !== null || !validRecipeQuantity(draft.value))
        ? draft : { value: item.quantity, baseline: item.quantity, version: draft?.version ?? 0, submitted: null };
    }
    this.quantities.set(quantities);
  }
  rekey(key: string): void { this.key.set(key); }
  setName(name: string): void {
    this.name.set(name); this.nameVersion.update(version => version + 1);
    if (this.valid()) this.validationAttempt.set(false);
    if (!this.blocked()) this.status.set('dirty');
    this.changes$.next();
  }
  setQuantity(id: number, value: string | number): void {
    const item = this.quantities()[id]; if (!item) return;
    this.quantities.update(state => ({ ...state, [id]: { ...item, value, version: item.version + 1 } }));
    if (this.valid()) this.validationAttempt.set(false);
    if (!this.blocked()) this.status.set('dirty');
  }
  begin(key: string): void { this.pendingVersions.update(keys => [...keys, key]); }
  settle(key: string): void { this.pendingVersions.update(keys => keys.filter(value => value !== key)); }
  ackName(version: number, value: string, revision: string): void {
    this.baselineName.set(value);
    if (this.nameVersion() === version) this.name.set(value);
    this.revision.set(revision); this.status.set('saved'); this.error.set(null);
  }
  ackQuantity(id: number, version: number, value: number, revision: string): void {
    const item = this.quantities()[id];
    if (item) this.quantities.update(state => ({ ...state, [id]: { ...item, baseline: value, value: item.version === version ? value : item.value } }));
    this.revision.set(revision); this.status.set('saved'); this.error.set(null);
  }
  fail(status: 'failed' | 'conflict' | 'unknownOutcome', message: string): void {
    this.blocked.set(true); this.status.set(status); this.error.set(message);
  }
  reviewed(revision: string, meal: PlannerMealDto): void {
    this.baselineName.set(meal.name);
    const quantities = { ...this.quantities() };
    for (const item of meal.items) if (item.type === 'recipe' && quantities[item.id]) quantities[item.id] = { ...quantities[item.id]!, baseline: item.quantity, submitted: null };
    this.quantities.set(quantities); this.revision.set(revision); this.blocked.set(false); this.error.set(null);
    this.fieldErrors.set({}); this.diagnostic.set(null); this.submittedName.set(null); this.status.set(this.dirty() ? 'dirty' : 'idle');
  }
  clear(): void {
    this.key.set(null); this.name.set(''); this.baselineName.set(''); this.nameVersion.set(0);
    this.submittedName.set(null); this.quantities.set({}); this.pendingVersions.set([]);
    this.revision.set(null); this.status.set('idle'); this.error.set(null); this.fieldErrors.set({});
    this.diagnostic.set(null); this.blocked.set(false);
    this.validationAttempt.set(false);
  }
}
