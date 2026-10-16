import { FieldErrorLinkDirective } from './field-error-link.directive';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterRenderEffect, inject, viewChild } from '@angular/core';
import { MealPlanWorkspaceFacade } from '../state/meal-plan-workspace.facade';
import { WeekStripComponent } from './week-strip.component';
import { SelectedDayPanelComponent } from './selected-day-panel.component';
import { mealPlanWarningText } from '../models/meal-plan-display.model';
import { MealEditorComponent } from './meal-editor.component';
import { RecipePickerComponent } from './recipe-picker.component';
import { AutosaveStatusComponent } from './autosave-status.component';
import { ManualItemEditorComponent } from './manual-item-editor.component';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
@Component({ selector: 'app-meal-planner', standalone: true, imports: [FieldErrorLinkDirective, WeekStripComponent, SelectedDayPanelComponent, MealEditorComponent, RecipePickerComponent, AutosaveStatusComponent, ManualItemEditorComponent, MatIconModule, DatePipe], templateUrl: './meal-planner.page.html', styleUrl: './meal-planner.page.scss', changeDetection: ChangeDetectionStrategy.OnPush, host: { '(window:focus)': 'vm.refresh()', '(window:beforeunload)': 'warnOnRefresh($event)' } })
export class MealPlannerPage implements OnDestroy {
    readonly vm = inject(MealPlanWorkspaceFacade);
    readonly warningText = mealPlanWarningText;
    private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
    private readonly taskHeading = viewChild<ElementRef<HTMLElement>>('taskHeading');
    private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
    private readonly content: ElementRef<HTMLElement> = inject(ElementRef);
    warnOnRefresh(event: BeforeUnloadEvent): void {
        if (this.vm.drafts.dirty() || this.vm.manual.form.dirty || this.vm.pending()) { event.preventDefault(); event.returnValue = ''; }
    }
    constructor() {
        this.vm.enter();
        afterRenderEffect(() => { if (this.vm.drafts.error() || this.vm.drafts.validationAttempt()) this.focusTarget(this.errorSummary()?.nativeElement); });
        let previousMeal: string | null = null;
        let previousTask: string | null = null;
        let previousKey: string | null = null;
        let previousManual: number | null = null;
        afterRenderEffect(() => {
            const task = this.vm.task();
            const meal = this.vm.selectedMeal();
            const heading = this.taskHeading();
            if (task !== 'day' && meal && heading) {
                if (previousTask !== task || previousKey !== meal.key) {
                    const selector = previousTask === 'manual' ? previousManual === null ? 'app-meal-editor .add-manual' : '[data-edit-manual="' + previousManual + '"]' : 'app-meal-editor .add-recipe';
                    const trigger = (previousTask === 'recipe-picker' || previousTask === 'manual') && task === 'meal' && previousKey === meal.key
                        ? this.content.nativeElement.querySelector<HTMLButtonElement>(selector) : null;
                    this.focusTarget(trigger && !trigger.disabled ? trigger : heading.nativeElement);
                }
                previousMeal = meal.name;
                previousTask = task;
                previousKey = meal.key;
                previousManual = task === 'manual' ? this.vm.manual.editingId() : null;
            }
            else if (task === 'day' && previousTask !== task && this.heading()) {
                const buttons = Array.from(this.content.nativeElement.querySelectorAll<HTMLButtonElement>('[aria-label]'));
                const trigger = previousMeal ? buttons.find(button => button.getAttribute('aria-label') === 'View ' + previousMeal) : null;
                this.focusTarget(trigger ?? this.heading()?.nativeElement);
                previousMeal = null;
                previousKey = null;
                previousTask = task;
            }
        });
        let lastOrderFocus = 0;
        afterRenderEffect(() => {
            const focus = this.vm.ordering.focus();
            this.vm.actionsReady(); // Wait for the latest enabled/disabled control rendering.
            if (focus && focus.sequence !== lastOrderFocus) {
                const button = this.content.nativeElement.querySelector<HTMLButtonElement>('[data-order-' + focus.kind + '="' + focus.id + '"]');
                const row = this.content.nativeElement.querySelector<HTMLElement>('[data-order-row-' + focus.kind + '="' + focus.id + '"]');
                this.focusTarget(button && !button.disabled ? button : row ?? this.heading()?.nativeElement);
                lastOrderFocus = focus.sequence;
            }
        });
    }
    private focusTarget(target: HTMLElement | undefined): void {
        target?.focus();
        // Keep the focused task/trigger clear of the existing sticky app header.
        target?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    }
    ngOnDestroy(): void { this.vm.leave(); }
}
