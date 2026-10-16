import { DestroyRef, Injectable, Injector, TemplateRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, Subject, finalize, take, takeUntil } from 'rxjs';

import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { NutritionPlanFacade, NutritionPlanOperationResult } from '@app/core/shared/data-access/meal-plan/nutrition-plan.facade';

/** Route-only dialog/intent state. All cards are derived from readonly Core selectors. */
@Injectable()
export class NutritionPlansPageFacade {
  private readonly core = inject(NutritionPlanFacade);
  private readonly injector = inject(Injector);
  private readonly context = inject(MealPlanContextStore);
  private readonly dialogs = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exit$ = new Subject<void>();
  private dialog: MatDialogRef<unknown> | null = null;
  private deleteRevision: string | null = null;
  private entered = false;
  private routeGeneration = 0;

  readonly plans = this.core.plans;
  readonly loaded = this.core.loaded;
  readonly stale = this.core.stale;
  readonly request = this.core.request;
  readonly currentId = computed(() => this.core.settings()?.currentNutritionPlanId ?? null);
  readonly canWrite = this.core.canWrite;
  readonly loading = signal(false);
  readonly pending = signal<{ id: number; action: 'use' | 'duplicate' | 'delete' } | null>(null);
  readonly deleteId = signal<number | null>(null);
  readonly deletePlan = computed(() => this.plans().find(plan => plan.id === this.deleteId()) ?? null);
  readonly deleteIsCurrent = computed(() => this.deleteId() !== null && this.deleteId() === this.currentId());
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly diagnostic = signal<string | null>(null);
  readonly fieldErrors = signal<readonly string[]>([]);
  readonly requiresReview = signal(false);
  readonly reviewedRefresh = signal<string | null>(null);
  readonly focusHeading = signal(0);
  readonly atCap = computed(() => this.plans().length >= 50);

  constructor() {
    this.context.reset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.leave());
    this.destroyRef.onDestroy(() => this.leave());
  }
  edit(id: number): void {
    if (this.pending() || this.loading() || this.requiresReview() || !this.canWrite()) return;
    void this.injector.get(Router).navigate(['/meal-plan/nutrition-plans', id, 'edit']);
  }

  enter(): void {
    if (this.entered) return;
    this.entered = true;
    this.focusHeading.update(value => value + 1);
    if (this.core.paused()) {
      this.requiresReview.set(true);
      this.error.set('A previous Meal Plan action needs reconciliation. Refresh and review the saved plans.');
    }
    this.refresh();
  }

  leave(): void {
    this.routeGeneration++;
    this.exit$.next();
    this.dialog?.close();
    this.dialog = null;
    this.deleteId.set(null);
    this.deleteRevision = null;
    this.pending.set(null);
    this.entered = false;
    this.error.set(null);
    this.success.set(null);
    this.diagnostic.set(null);
    this.fieldErrors.set([]);
    this.requiresReview.set(false);
    this.reviewedRefresh.set(null);
  }

  onWindowFocus(): void {
    if (this.entered && !this.pending() && !this.dialog && !this.loading()) this.refresh();
  }

  refresh(): void {
    if (this.loading() || this.pending()) return;
    this.loading.set(true);
    this.reviewedRefresh.set(null);
    this.core.loadList().pipe(take(1), finalize(() => this.loading.set(false)),
      takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { if (this.requiresReview()) this.reviewedRefresh.set(response.revision); },
      error: () => undefined, // Query error is independently owned/exposed by the Core list request.
    });
  }

  confirmReview(): void {
    const revision = this.reviewedRefresh();
    if (revision === null || !this.core.resumeAfterReview(revision)) return;
    this.requiresReview.set(false);
    this.reviewedRefresh.set(null);
    this.error.set(null);
    this.diagnostic.set(null);
    this.fieldErrors.set([]);
    // Old delete consent is not permission to delete a refreshed version.
    this.dialog?.close();
  }

  use(planId: number): void {
    const revision = this.authority(planId);
    if (revision === null || planId === this.currentId()) return;
    this.run(planId, 'use', this.core.setCurrent(planId, revision));
  }

  duplicate(planId: number): void {
    const revision = this.authority(planId);
    if (revision === null || this.atCap()) return;
    this.run(planId, 'duplicate', this.core.duplicate(planId, revision));
  }

  requestDelete(planId: number, template: TemplateRef<unknown>): void {
    const revision = this.authority(planId);
    if (revision === null || this.dialog) return;
    this.error.set(null);
    this.success.set(null);
    this.diagnostic.set(null);
    this.fieldErrors.set([]);
    this.deleteId.set(planId);
    this.deleteRevision = revision;
    const dialog = this.dialogs.open(template, {
      ariaLabel: 'Delete nutrition plan', autoFocus: 'first-tabbable', restoreFocus: true,
      width: '30rem', maxWidth: 'calc(100vw - 2rem)',
    });
    this.dialog = dialog;
    dialog.afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.dialog !== dialog) return;
      this.dialog = null;
      this.deleteId.set(null);
      this.deleteRevision = null;
      if (this.success() === 'Nutrition plan deleted. Your saved meals and food are unchanged.') {
        this.focusHeading.update(value => value + 1);
      }
    });
  }

  cancelDelete(): void {
    if (!this.pending()) this.dialog?.close();
  }

  confirmDelete(): void {
    const id = this.deleteId();
    if (id === null || this.deleteRevision === null || this.pending() || this.requiresReview()) return;
    if (this.authority(id) !== this.deleteRevision) {
      this.error.set('This plan changed. Refresh and review the list before confirming deletion again.');
      this.requiresReview.set(true);
      return;
    }
    this.run(id, 'delete', this.core.delete(id, this.deleteRevision));
  }

  private authority(id: number): string | null {
    return this.canWrite() && !this.loading() && !this.pending() && !this.requiresReview()
      && this.plans().some(plan => plan.id === id) ? this.core.revision() : null;
  }

  private run(id: number, action: 'use' | 'duplicate' | 'delete', operation: Observable<NutritionPlanOperationResult>): void {
    const generation = this.routeGeneration;
    this.pending.set({ id, action });
    this.error.set(null);
    this.success.set(null);
    this.diagnostic.set(null);
    this.fieldErrors.set([]);
    if (this.dialog) this.dialog.disableClose = true;
    operation.pipe(take(1), finalize(() => {
      this.pending.set(null);
      if (this.dialog) this.dialog.disableClose = false;
    }), takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result.outcome === 'confirmed') {
        this.success.set(action === 'use' ? 'Current plan updated. Saved meals and food are unchanged.'
          : action === 'duplicate' ? 'Plan duplicated. Your Current plan is unchanged.'
            : 'Nutrition plan deleted. Your saved meals and food are unchanged.');
        if (action === 'delete') this.dialog?.close();
        // Defer until this operation's pending display has settled; Core is already synchronized.
        queueMicrotask(() => { if (this.entered && generation === this.routeGeneration) this.refresh(); });
        return;
      }
      this.requiresReview.set(result.outcome === 'conflict' || result.outcome === 'unknownOutcome');
      this.diagnostic.set([result.code, result.traceId].filter(Boolean).join(' · ') || null);
      this.fieldErrors.set(Object.values(result.errors ?? {}).flat());
      this.error.set(result.outcome === 'conflict'
        ? 'The plan data changed elsewhere. Refresh and review before choosing an action again.'
        : result.outcome === 'unknownOutcome'
          ? 'The outcome is unknown. Refresh and review the saved plans before deciding whether to repeat this action.'
          : result.code === 'csrf_invalid'
            ? 'The security check failed. This action was not applied. Please submit again.'
            : result.httpStatus === 404 ? 'This plan is unavailable. Refresh the list.'
              : 'This action was not confirmed. Previously confirmed plans remain visible; review the error before trying again.');
    });
  }
}
