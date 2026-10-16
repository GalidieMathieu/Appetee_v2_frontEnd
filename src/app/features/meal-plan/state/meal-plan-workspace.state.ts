import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ParamMap } from '@angular/router';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { MealPlanSelection, MealPlanTask } from '../models/meal-plan-workspace.model';
export function localCalendarDate(date = new Date()): string {
    return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}
export function calendarDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01' || value > '9999-12-31')
        return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year!, month! - 1, day!, 12);
    return localCalendarDate(date) === value ? date : null;
}
export function shiftCalendarDate(value: string, days: number): string | null {
    const date = calendarDate(value);
    if (!date)
        return null;
    date.setDate(date.getDate() + days);
    const shifted = localCalendarDate(date);
    return calendarDate(shifted) ? shifted : null;
}
@Injectable()
export class MealPlanWorkspaceState {
    private readonly context = inject(MealPlanContextStore);
    private readonly destroyRef = inject(DestroyRef);
    readonly date = signal(localCalendarDate());
    readonly task = signal<MealPlanTask>('day');
    readonly selection = signal<MealPlanSelection>({ kind: 'none' });
    readonly manualItemId = signal<number | null>(null);
    private readonly aliases = new Map<string, number>();
    rememberMaterialization(date: string, slot: number, id: number): void { this.aliases.set(date + ':' + slot, id); }
    alias(date: string, slot: number): number | null { return this.aliases.get(date + ':' + slot) ?? null; }
    clearAliases(): void { this.aliases.clear(); }
    readonly week = computed(() => {
        const date = calendarDate(this.date())!;
        const offset = (date.getDay() + 6) % 7;
        date.setDate(date.getDate() - offset);
        const rawFrom = localCalendarDate(date);
        date.setDate(date.getDate() + 6);
        const rawThrough = localCalendarDate(date);
        return { from: rawFrom < '1000-01-01' ? '1000-01-01' : rawFrom, through: rawThrough > '9999-12-31' ? '9999-12-31' : rawThrough };
    });
    readonly dates = computed(() => {
        const dates: string[] = [];
        let date: string | null = this.week().from;
        while (date !== null && date <= this.week().through && dates.length < 7) {
            dates.push(date);
            date = shiftCalendarDate(date, 1);
        }
        return dates;
    });
    constructor() { this.context.reset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.clear()); }
    parse(params: ParamMap): boolean {
        const raw = params.get('date');
        const date = raw && calendarDate(raw) ? raw : localCalendarDate();
        this.date.set(date);
        const id = params.get('mealId');
        const slot = params.get('defaultSlot');
        const task = params.get('task') ?? 'day';
        const item = params.get('itemId');
        const integer = (text: string | null, max: number) => text !== null && /^[1-9]\d*$/.test(text) && Number(text) <= max;
        const validSelection = !(id && slot) && (id === null || integer(id, 2147483647)) && (slot === null || integer(slot, 8));
        const validItem = item === null || task === 'manual' && integer(item, 2147483647) && id !== null && slot === null;
        this.manualItemId.set(task === 'manual' && validItem && item !== null ? Number(item) : null);
        if ((task === 'meal' || task === 'recipe-picker' || task === 'manual') && validSelection && validItem && (id || slot)) {
            this.task.set(task);
            this.selection.set(id ? { kind: 'saved', mealId: Number(id) } : { kind: 'virtual', defaultSlot: Number(slot) });
        }
        else {
            this.task.set('day');
            this.selection.set({ kind: 'none' });
        }
        return raw !== date || !['day', 'meal', 'recipe-picker', 'manual'].includes(task) || !validSelection || !validItem
            || (task !== 'day' && !(id || slot)) || (task === 'day' && !!(id || slot))
            || ['date', 'task', 'mealId', 'defaultSlot', 'itemId'].some(key => params.getAll(key).length > 1);
    }
    query() {
        const selection = this.selection();
        return { date: this.date(), task: this.task(),
            mealId: selection.kind === 'saved' ? selection.mealId : null, defaultSlot: selection.kind === 'virtual' ? selection.defaultSlot : null,
            ...(this.task() === 'manual' && this.manualItemId() !== null ? { itemId: this.manualItemId() } : {}) };
    }
    clear(): void { this.date.set(localCalendarDate()); this.task.set('day'); this.selection.set({ kind: 'none' }); this.manualItemId.set(null); this.aliases.clear(); }
}
