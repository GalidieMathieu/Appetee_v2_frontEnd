import { Injectable, computed, signal } from '@angular/core';
import { ManualItemRequest } from '@app/core/shared/data-access/meal-plan/meal-plan-mutation.model';
import { PlannerItemDto } from '@app/core/shared/data-access/meal-plan/meal-plan.model';
import { createManualItemForm } from '../forms/manual-item-form.factory';
import { MANUAL_FIELDS, ManualField } from '../models/manual-item-draft.model';
@Injectable()
export class ManualItemDraftState {
  readonly form = createManualItemForm();
  readonly key = signal<string | null>(null);
  readonly revision = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly diagnostic = signal<string | null>(null);
  readonly errors = signal<Readonly<Record<string, readonly string[]>>>({});
  readonly attempted = signal(false);
  readonly focusAttempt = signal(0);
  readonly blocked = signal(false);
  readonly reviewRevision = signal<string | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly heading = computed(() => this.editingId() === null ? 'Add manual food' : 'Edit manual food');
  bind(key: string, revision: string, item?: Extract<PlannerItemDto, { type: 'manual' }>): void {
    if (this.key() === key) return; // Never replace a dirty form after GET.
    this.clear(); this.key.set(key); this.revision.set(revision); this.editingId.set(item?.id ?? null);
    if (item) this.form.reset({ name: item.name, caloriesKcal: String(item.nutrition.caloriesKcal ?? ''),
      proteinG: String(item.nutrition.proteinG ?? ''), carbsG: String(item.nutrition.carbsG ?? ''), fatG: String(item.nutrition.fatG ?? '') });
  }
  value(): ManualItemRequest | null {
    this.attempted.set(true); this.focusAttempt.update(value => value + 1); this.form.markAllAsTouched();
    if (this.form.invalid) return null;
    const value = this.form.getRawValue();
    return { name: value.name.trim().normalize('NFC'), caloriesKcal: Number(value.caloriesKcal),
      proteinG: Number(value.proteinG), carbsG: Number(value.carbsG), fatG: Number(value.fatG) };
  }
  feedback(field: ManualField): string | null {
    const control = this.form.controls[field];
    return this.errors()[field]?.[0] ?? this.errors()['manualItem.' + field]?.[0]
      ?? (control.touched || this.attempted() ? control.errors?.['manual'] ?? null : null);
  }
  readonly fields = MANUAL_FIELDS;
  clear(): void {
    this.form.reset({ name: '', caloriesKcal: '', proteinG: '', carbsG: '', fatG: '' });
    this.key.set(null); this.revision.set(null); this.editingId.set(null); this.attempted.set(false); this.focusAttempt.set(0);
    this.error.set(null); this.diagnostic.set(null); this.errors.set({}); this.blocked.set(false); this.reviewRevision.set(null);
  }
}
