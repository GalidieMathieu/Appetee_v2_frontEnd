/**
 * Reusable Cooking Mode presentation and temporary in-route session state for one immutable recipe.
 * Scaling, checklist, step, and stopwatch changes are display-only and never mutate cached/API data.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  RecipeCookingIngredientDto,
  RecipeCookingViewDto,
} from '@app/core/shared/data-access/recipes/recipe.model';

interface CookingTimerState {
  readonly accumulatedMs: number;
  readonly startedAtMs: number | null;
  readonly running: boolean;
}

const STOPPED_TIMER: CookingTimerState = {
  accumulatedMs: 0,
  startedAtMs: null,
  running: false,
};
const MAX_SERVINGS = 20;
const TIMER_REFRESH_MS = 250;

@Component({
  selector: 'app-recipe-cooking-mode',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './recipe-cooking-mode.component.html',
  styleUrl: './recipe-cooking-mode.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RecipeCookingModeComponent implements OnInit, OnDestroy {
  readonly recipe = input.required<RecipeCookingViewDto>();
  readonly exitRequested = output<void>();

  protected readonly selectedServings = signal(1);
  protected readonly currentStepIndex = signal(0);
  protected readonly checkedIngredientIds = signal<ReadonlySet<number>>(new Set());
  protected readonly timerState = signal<CookingTimerState>(STOPPED_TIMER);
  private readonly timerDisplayNowMs = signal(Date.now());
  private timerRefreshHandle: ReturnType<typeof setInterval> | null = null;

  protected readonly orderedIngredients = computed(() =>
    [...this.recipe().ingredients].sort(
      (left, right) => left.displayOrder - right.displayOrder
    )
  );
  protected readonly orderedSteps = computed(() =>
    [...this.recipe().steps].sort((left, right) => left.order - right.order)
  );
  protected readonly scaleFactor = computed(() =>
    this.selectedServings() / this.recipe().baseServings
  );
  protected readonly maximumServings = computed(() =>
    Math.max(MAX_SERVINGS, clampWholeServings(this.recipe().baseServings))
  );
  protected readonly scaledCalories = computed(() =>
    Math.round(this.recipe().caloriesTotal * this.scaleFactor())
  );
  protected readonly scaledProtein = computed(() =>
    formatDecimal(this.recipe().proteinTotal * this.scaleFactor(), 1)
  );
  protected readonly scaledCarbs = computed(() =>
    formatDecimal(this.recipe().carbsTotal * this.scaleFactor(), 1)
  );
  protected readonly activeStep = computed(() =>
    this.orderedSteps()[this.currentStepIndex()] ?? null
  );
  protected readonly isFinalStep = computed(() =>
    this.orderedSteps().length > 0
      && this.currentStepIndex() === this.orderedSteps().length - 1
  );
  protected readonly progressPercent = computed(() => {
    const total = this.orderedSteps().length;
    return total === 0 ? 0 : ((this.currentStepIndex() + 1) / total) * 100;
  });
  protected readonly elapsedMs = computed(() => {
    const state = this.timerState();
    const displayNow = this.timerDisplayNowMs();
    return state.running && state.startedAtMs !== null
      ? state.accumulatedMs + Math.max(0, displayNow - state.startedAtMs)
      : state.accumulatedMs;
  });
  protected readonly formattedElapsed = computed(() => formatElapsed(this.elapsedMs()));
  protected readonly timerActionLabel = computed(() => {
    if (this.timerState().running) return 'Pause';
    return this.timerState().accumulatedMs > 0 ? 'Resume' : 'Start';
  });
  protected readonly resolvedImageUrl = computed(() =>
    this.recipe().imageUrl ?? 'assets/icons/chef-hat.png'
  );

  ngOnInit(): void {
    this.selectedServings.set(clampWholeServings(this.recipe().baseServings));
  }

  ngOnDestroy(): void {
    this.stopRefreshInterval();
  }

  protected decreaseServings(): void {
    this.selectedServings.update(value => Math.max(1, value - 1));
  }

  protected increaseServings(): void {
    this.selectedServings.update(value => Math.min(this.maximumServings(), value + 1));
  }

  protected scaledIngredientQuantity(ingredient: RecipeCookingIngredientDto): string {
    return formatDecimal(ingredient.quantity * this.scaleFactor(), 2);
  }

  protected toggleIngredient(ingredientId: number): void {
    this.checkedIngredientIds.update(current => {
      const next = new Set(current);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }

  protected previousStep(): void {
    this.currentStepIndex.update(index => Math.max(0, index - 1));
  }

  protected nextStep(): void {
    this.currentStepIndex.update(index =>
      Math.min(this.orderedSteps().length - 1, index + 1)
    );
  }

  protected selectStep(index: number): void {
    if (index < 0 || index >= this.orderedSteps().length) return;
    this.currentStepIndex.set(index);
  }

  protected cookAgain(): void {
    this.currentStepIndex.set(0);
    this.checkedIngredientIds.set(new Set());
    this.resetTimer();
  }

  protected toggleTimer(): void {
    if (this.timerState().running) this.pauseTimer();
    else this.startTimer();
  }

  protected resetTimer(): void {
    this.stopRefreshInterval();
    this.timerState.set(STOPPED_TIMER);
    this.timerDisplayNowMs.set(Date.now());
  }

  /** Resumes from accumulated duration while wall-clock timestamps remain authoritative. */
  private startTimer(): void {
    const now = Date.now();
    this.timerDisplayNowMs.set(now);
    this.timerState.update(state => ({ ...state, startedAtMs: now, running: true }));
    this.startRefreshInterval();
  }

  /** Captures wall-clock elapsed time so interval throttling cannot lose duration. */
  private pauseTimer(): void {
    const now = Date.now();
    const state = this.timerState();
    const accumulatedMs = state.startedAtMs === null
      ? state.accumulatedMs
      : state.accumulatedMs + Math.max(0, now - state.startedAtMs);
    this.stopRefreshInterval();
    this.timerState.set({ accumulatedMs, startedAtMs: null, running: false });
    this.timerDisplayNowMs.set(now);
  }

  private startRefreshInterval(): void {
    if (this.timerRefreshHandle !== null) return;
    this.timerRefreshHandle = setInterval(
      () => this.timerDisplayNowMs.set(Date.now()),
      TIMER_REFRESH_MS
    );
  }

  private stopRefreshInterval(): void {
    if (this.timerRefreshHandle === null) return;
    clearInterval(this.timerRefreshHandle);
    this.timerRefreshHandle = null;
  }
}

function clampWholeServings(value: number): number {
  return Math.max(1, Math.round(value));
}

/** Rounds only the rendered value and trims insignificant trailing zeros. */
function formatDecimal(value: number, maximumFractionDigits: number): string {
  return Number(value.toFixed(maximumFractionDigits)).toString();
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}
