import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, Injector, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, finalize, map, merge, switchMap, take, takeUntil, timer } from 'rxjs';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { NutritionPlanFacade } from '@app/core/shared/data-access/meal-plan/nutrition-plan.facade';
import { NutritionPlanFieldErrors } from '../models/nutrition-plan-draft.model';
import { NutritionPlanDraftState } from './nutrition-plan-draft.state';
import { NutritionProfileFacade } from '@app/core/shared/data-access/user/nutrition-profile.facade';
import { NutritionProfileFieldErrors } from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.model';
import { NutritionPlanStep, WIZARD_STEPS } from '../models/nutrition-plan-draft.model';
import { toApiErrorMessage } from '@app/core/shared/data-access/generic-template/api-error-message';
@Injectable()
export class NutritionPlanFlowFacade {
    private readonly core = inject(NutritionPlanFacade);
    private readonly draft = inject(NutritionPlanDraftState);
    private readonly router = inject(Router);
    private readonly document = inject(DOCUMENT);
    private readonly context = inject(MealPlanContextStore);
    private readonly destroyRef = inject(DestroyRef);
    private readonly exit$ = new Subject<void>();
    private entered = false;
    private previewAfterSave = false;
    private readonly injector = inject(Injector);
    private readonly previewIntent$ = new Subject<void>();
    private readonly editChange$ = new Subject<void>();
    readonly draftState = this.draft;
    readonly steps = WIZARD_STEPS;
    readonly editingId = signal<number | null>(null);
    readonly detailQuery = computed(() => this.editingId() === null ? null : this.core.detailRequest(this.editingId()!));
    readonly savedDetail = computed(() => this.editingId() === null ? null : this.core.detail(this.editingId()!));
    readonly previewLoading = signal(false);
    readonly previewError = signal<string | null>(null);
    readonly profileError = signal<string | null>(null);
    readonly profileErrors = signal<NutritionProfileFieldErrors>({});
    readonly choiceErrors = signal<Readonly<Record<string, readonly string[]>>>({});
    readonly savedProfileAvailable = signal(false);
    readonly previewChangedPolicy = computed(() => this.draft.preview() !== null && this.savedDetail() !== null
        && this.draft.preview()!.policyVersion !== this.savedDetail()!.plan.calculationPolicyVersion);
    readonly form = this.draft.form;
    readonly dirty = this.draft.dirty;
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly completed = signal(false);
    readonly error = signal<string | null>(null);
    readonly diagnostic = signal<string | null>(null);
    readonly fieldErrors = signal<NutritionPlanFieldErrors>({});
    readonly requiresReview = signal(false);
    readonly refreshedRevision = signal<string | null>(null);
    readonly query = this.core.request;
    readonly savedPlans = this.core.plans;
    readonly currentId = computed(() => this.core.settings()?.currentNutritionPlanId ?? null);
    readonly atCap = computed(() => this.savedPlans().length >= 50);
    readonly canCreate = computed(() => (this.editingId() === null ? this.core.canWrite() : this.core.detailFresh(this.editingId()!) && !this.core.pending() && !this.core.paused()) && !this.loading() && !this.saving()
        && !this.requiresReview() && !this.completed() && (this.editingId() !== null || !this.atCap())
        && this.draft.reviewedRevision() === (this.editingId() === null ? this.core.revision() : this.savedDetail()?.revision));
    constructor() {
        this.context.reset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.leave());
        merge(this.draft.profileForm.valueChanges, this.draft.choices.valueChanges, this.previewIntent$).pipe(switchMap(() => {
            this.previewError.set(null);
            this.previewLoading.set(false);
            if (!this.entered || this.draft.mode() !== 'intermediate')
                return EMPTY;
                this.draft.preview.set(null);
                if (this.editingId() !== null && !this.draft.calculationChanged()) return EMPTY;
                const calculation = this.draft.calculation();
            if (!calculation)
                return EMPTY;
            const version = this.draft.calculationVersion();
            return timer(300).pipe(switchMap(() => {
                this.previewLoading.set(true);
                return this.core.preview(calculation).pipe(take(1), takeUntil(this.exit$), map(preview => ({ preview, version })), finalize(() => this.previewLoading.set(false)), catchError((error: unknown) => {
                    if (version === this.draft.calculationVersion()) {
                        this.previewError.set(toApiErrorMessage(error));
                        this.mapCalculationErrors(error);
                    }
                    return EMPTY;
                }));
            }), takeUntil(this.exit$));
        }), takeUntilDestroyed(this.destroyRef)).subscribe(({ preview, version }) => {
            if (this.entered && version === this.draft.calculationVersion()) {
                this.draft.preview.set(preview);
                this.profileErrors.set({});
                this.choiceErrors.set({});
            }
        });
    }
    startWizard(): void {
        if (this.entered && this.draft.mode() === 'intermediate' && this.editingId() === null)
            return;
        this.draft.mode.set('intermediate');
        this.enter();
        this.loadProfile();
    }
    bindWizardRoute(route: ActivatedRoute): void {
        (route.firstChild ?? route).paramMap.pipe(takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe(params => {
            const step = params.get('step');
            if (WIZARD_STEPS.includes(step as NutritionPlanStep))
                this.draft.step.set(step as NutritionPlanStep);
        });
    }
    bindEditRoute(route: ActivatedRoute): void {
        route.paramMap.pipe(takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe(params => {
            const raw = params.get('planId');
            if (!raw || !/^[1-9]\d*$/.test(raw) || Number(raw) > 2147483647) {
                this.error.set('This plan is unavailable.');
                return;
            }
            if (this.entered && this.editingId() !== Number(raw)) {
                if (!this.canLeave()) {
                    void this.router.navigate(['/meal-plan/nutrition-plans', this.editingId(), 'edit'], { replaceUrl: true });
                    return;
                }
                this.editChange$.next();
                this.draft.clear();
                this.entered = false;
                this.loading.set(false);
            }
            this.startEdit(Number(raw));
        });
    }
    startEdit(id: number): void {
        if (this.entered && this.editingId() === id)
            return;
        this.entered = true;
        this.editingId.set(id);
        if (this.core.paused())
            this.requiresReview.set(true);
        this.refresh();
    }
    private loadProfile(): void {
        const profile = this.injector.get(NutritionProfileFacade);
        profile.load().pipe(take(1), takeUntil(this.editChange$), takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe({
            next: response => {
                this.profileError.set(null);
                this.savedProfileAvailable.set(response.profile !== null);
                this.draft.seedProfile(response.profile);
                if (this.editingId() === null)
                    this.previewIntent$.next();
                else if (!this.core.detailFresh(this.editingId()!)) {
                    this.requiresReview.set(true);
                    this.error.set('The saved plan context changed. Refresh and review it; your draft is preserved.');
                }
            },
            error: (error: unknown) => this.profileError.set(toApiErrorMessage(error)),
        });
    }
    useCurrentProfile(): void {
        const value = this.injector.get(NutritionProfileFacade).store.profile();
        if (value)
            this.draft.seedProfile(value, true);
    }
    reloadProfile(): void { if (!this.saving()) this.loadProfile(); }
    chooseEasy(): void { if (!this.saving()) void this.router.navigateByUrl('/meal-plan/nutrition-plans/create/easy'); }
    recalculate(): void {
        this.draft.requestRecalculation();
        this.previewIntent$.next();
    }
    canVisit(step: NutritionPlanStep): boolean { return this.draft.canVisit(step); }
    fieldIssues(): readonly {
        step: NutritionPlanStep;
        id: string;
        message: string;
    }[] {
        const issues: {
            step: NutritionPlanStep;
            id: string;
            message: string;
        }[] = [];
        if (this.fieldErrors().name?.length || this.form.controls.name.touched && this.form.controls.name.invalid) {
            issues.push({ step: 'review', id: this.editingId() === null ? 'review-name' : 'edit-name', message: this.fieldErrors().name?.[0] ?? 'Enter a name of 1–80 characters.' });
        }
        if (this.fieldErrors().defaultMealsPerDay?.length || this.form.controls.defaultMealsPerDay.touched && this.form.controls.defaultMealsPerDay.invalid) {
            issues.push({ step: 'meal-structure', id: 'meal-count-1', message: this.fieldErrors().defaultMealsPerDay?.[0] ?? 'Choose a meal count from 1 to 8.' });
        }
        if (this.draft.mode() !== 'intermediate')
            return issues;
        for (const field of [
            { key: 'calculationSex' as const, id: 'nutrition-sex-female', message: 'Choose a calculation sex.' },
            { key: 'ageYears' as const, id: 'nutrition-age', message: 'Enter a whole-number age from 18 to 65.' },
            { key: 'heightCm' as const, id: 'nutrition-height', message: 'Enter a height from 120 to 230 cm.' },
            { key: 'weightKg' as const, id: 'nutrition-weight', message: 'Enter a weight from 35 to 250 kg.' },
            { key: 'adultConfirmed' as const, id: 'nutrition-adult', message: 'Confirm you are at least 18.' },
        ]) {
            const control = this.draft.profileForm.controls[field.key];
            if (this.profileErrors()[field.key]?.length || control.touched && control.invalid
                || field.key === 'adultConfirmed' && this.draft.profileForm.touched && this.draft.profileForm.hasError('adultConfirmationRequired')) {
                issues.push({ step: 'profile', id: field.id, message: this.profileErrors()[field.key]?.[0] ?? field.message });
            }
        }
        for (const field of [{ key: 'goal' as const, step: 'goal' as const, id: 'goal-performance', message: 'Choose a goal.' },
            { key: 'activityLevel' as const, step: 'activity' as const, id: 'activity-inactive', message: 'Choose an activity level.' }]) {
            const control = this.draft.choices.controls[field.key];
            if (this.choiceErrors()[field.key]?.length || control.touched && control.invalid)
                issues.push({ step: field.step, id: field.id, message: this.choiceErrors()[field.key]?.[0] ?? field.message });
        }
        return issues;
    }
    goTo(step: NutritionPlanStep): void {
        if (this.saving())
            return;
        if (!this.canVisit(step)) {
            switch (this.draft.firstIncomplete()) {
                case 'profile': this.draft.profileForm.markAllAsTouched(); break;
                case 'goal': this.draft.choices.controls.goal.markAsTouched(); break;
                case 'activity': this.draft.choices.controls.activityLevel.markAsTouched(); break;
                case 'meal-structure': this.form.controls.defaultMealsPerDay.markAsTouched(); break;
                case 'review': this.form.controls.name.markAsTouched(); break;
            }
            this.error.set('Complete the required fields before continuing.');
            return;
        }
        this.error.set(null);
        void this.router.navigate(['/meal-plan/nutrition-plans/create/intermediate', step]);
    }
    next(): void { const index = WIZARD_STEPS.indexOf(this.draft.step()); if (index < 4)
        this.goTo(WIZARD_STEPS[index + 1]!); }
    back(): void { const index = WIZARD_STEPS.indexOf(this.draft.step()); if (index > 0)
        this.goTo(WIZARD_STEPS[index - 1]!);
    else
        this.cancel(); }
    private mapCalculationErrors(error: unknown): void {
        if (typeof error !== 'object' || error === null || !('error' in error) || typeof error.error !== 'object' || error.error === null)
            return;
        const body = error.error as {
            code?: string;
            traceId?: string;
            errors?: Record<string, string[]>;
        };
        const fields = body.errors ?? {};
        this.diagnostic.set([body.code, body.traceId].filter(Boolean).join(' · ') || null);
        this.profileErrors.set({ calculationSex: fields['profile.calculationSex'] ?? fields['calculation.profile.calculationSex'],
            ageYears: fields['profile.birthYear'] ?? fields['calculation.profile.birthYear'], heightCm: fields['profile.heightCm'] ?? fields['calculation.profile.heightCm'],
            weightKg: fields['profile.weightKg'] ?? fields['calculation.profile.weightKg'], adultConfirmed: fields['profile.adultConfirmed'] ?? fields['calculation.profile.adultConfirmed'] });
        this.choiceErrors.set({ goal: fields['goal'] ?? fields['calculation.goal'] ?? [], activityLevel: fields['activityLevel'] ?? fields['calculation.activityLevel'] ?? [] });
    }
    enter(): void {
        if (this.entered)
            return;
        this.entered = true;
        if (this.core.paused())
            this.requiresReview.set(true);
        this.refresh();
    }
    refresh(): void {
        if (this.loading() || this.saving())
            return;
        this.loading.set(true);
        this.refreshedRevision.set(null);
        if (this.editingId() !== null) {
            const id = this.editingId()!;
            this.core.loadDetail(id).pipe(take(1), finalize(() => this.loading.set(false)), takeUntil(this.editChange$), takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe({
                next: response => {
                    if (this.editingId() !== id)
                        return;
                    this.draft.seedPlan(response.plan, response.revision);
                    if (response.plan.mode === 'intermediate') this.loadProfile();
                    if (this.requiresReview() || this.draft.reviewedRevision() !== response.revision) {
                        this.requiresReview.set(true);
                        this.refreshedRevision.set(response.revision);
                    }
                }, error: () => undefined,
            });
            return;
        }
        this.core.loadList().pipe(take(1), finalize(() => this.loading.set(false)), takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe({
            next: response => {
                this.draft.initializeRevision(response.revision);
                if (this.requiresReview() || this.draft.reviewedRevision() !== response.revision) {
                    this.requiresReview.set(true);
                    this.refreshedRevision.set(response.revision);
                }
            }, error: () => undefined,
        });
    }
    confirmReview(): void {
        const revision = this.refreshedRevision();
        if (revision === null || !(this.editingId() === null ? this.core.resumeAfterReview(revision) : this.core.resumeDetailAfterReview(this.editingId()!, revision)))
            return;
        this.draft.reviewRevision(revision);
        this.requiresReview.set(false);
        this.refreshedRevision.set(null);
        this.error.set(null);
        this.diagnostic.set(null);
        this.fieldErrors.set({});
    }
    create(): void {
        if (this.saving() || this.completed())
            return;
        this.form.markAllAsTouched();
        if (this.draft.mode() === 'intermediate' && (this.editingId() === null || this.draft.calculationChanged())) {
            this.draft.profileForm.markAllAsTouched();
            this.draft.choices.markAllAsTouched();
        }
        const request = this.editingId() === null ? this.draft.createRequest() : this.draft.updateRequest();
        if (request === null) {
            this.error.set('Review the highlighted fields and calculation preview before submitting your plan.');
            return;
        }
        if (!this.canCreate()) {
            this.error.set(this.editingId() === null && this.atCap() ? 'You have reached the limit of 50 plans.' : 'Refresh and review the saved plan context before submitting.');
            if (!this.loading() && !(this.editingId() === null && this.atCap()))
                this.requiresReview.set(true);
            return;
        }
        const revision = this.draft.reviewedRevision()!;
        const version = this.draft.version();
        this.error.set(null);
        this.diagnostic.set(null);
        this.fieldErrors.set({});
        this.saving.set(true);
        this.form.disable({ emitEvent: false });
        this.draft.profileForm.disable({ emitEvent: false });
        this.draft.choices.disable({ emitEvent: false });
        const operation = this.editingId() === null
            ? this.core.create(request as import('@app/core/shared/data-access/meal-plan/nutrition-plan.model').CreateNutritionPlanRequest, revision)
            : this.core.update(this.editingId()!, request, revision);
        operation.pipe(take(1), finalize(() => {
            this.saving.set(false);
            this.form.enable({ emitEvent: false });
            this.draft.profileForm.enable({ emitEvent: false });
            this.draft.choices.enable({ emitEvent: false });
            if (this.previewAfterSave) {
                this.previewAfterSave = false;
                this.previewIntent$.next();
            }
        }), takeUntil(this.exit$), takeUntilDestroyed(this.destroyRef)).subscribe(result => {
            if (result.outcome === 'confirmed') {
                this.completed.set(true);
                if (this.draft.acknowledge(version)) {
                    void this.router.navigateByUrl('/meal-plan/nutrition-plans', { replaceUrl: true, state: this.returnFocusState() });
                }
                else {
                    this.error.set('Your submitted plan was saved. Later edits are not saved; return to the plans list to review.');
                }
                return;
            }
            const fields: NutritionPlanFieldErrors = {};
            if (result.errors?.['name'])
                fields.name = result.errors['name'];
            if (result.errors?.['defaultMealsPerDay'])
                fields.defaultMealsPerDay = result.errors['defaultMealsPerDay'];
            if (result.code === 'plan_name_conflict')
                fields.name = ['This name is already in use. Choose another name; matching ignores case and accents.'];
            this.fieldErrors.set(fields);
            if (result.errors)
                this.mapCalculationErrors({ error: { errors: result.errors, code: result.code, traceId: result.traceId } });
            if (result.code === 'calculation_preview_stale') {
                this.draft.requestRecalculation();
                this.previewAfterSave = true;
                if (this.editingId() === null)
                    void this.router.navigate(['/meal-plan/nutrition-plans/create/intermediate', 'review']);
            }
            this.diagnostic.set([result.code, result.traceId].filter(Boolean).join(' · ') || null);
            this.requiresReview.set(result.outcome === 'conflict' || result.outcome === 'unknownOutcome');
            this.error.set(result.outcome === 'unknownOutcome'
                ? 'The save outcome is unknown. Refresh and inspect the saved plans before deciding whether to submit again.'
                : result.outcome === 'conflict'
                    ? 'The plan could not be saved. Refresh and review the saved plans and your draft before submitting again.'
                    : result.code === 'csrf_invalid' ? 'The security check failed. This save was rejected. Please submit again.'
                        : 'The plan was not confirmed. Your draft is preserved.');
        });
    }
    private returnFocusState(): {
        focusCreatePlan: true;
    } | {
        focusPlanId: number;
    } {
        return this.editingId() === null ? { focusCreatePlan: true } : { focusPlanId: this.editingId()! };
    }
    cancel(): void { void this.router.navigateByUrl('/meal-plan/nutrition-plans', { replaceUrl: true, state: this.returnFocusState() }); }
    canLeave(): boolean {
        if (!this.entered || (this.completed() && !this.dirty()))
            return true;
        if (this.saving() || this.requiresReview()) {
            this.error.set('Wait for the result, or refresh and review an uncertain result, before leaving.');
            return false;
        }
        if (!this.dirty())
            return true;
        if (!(this.document.defaultView?.confirm('Discard this unsaved nutrition plan and leave this page?') ?? false))
            return false;
        this.draft.clear();
        return true;
    }
    leave(): void {
        this.exit$.next();
        this.entered = false;
        this.draft.clear();
        this.previewAfterSave = false;
        this.completed.set(false);
        this.requiresReview.set(false);
        this.refreshedRevision.set(null);
        this.error.set(null);
        this.diagnostic.set(null);
        this.fieldErrors.set({});
        this.editingId.set(null);
        this.previewLoading.set(false);
        this.previewError.set(null);
        this.profileError.set(null);
        this.profileErrors.set({});
        this.choiceErrors.set({});
        this.savedProfileAvailable.set(false);
    }
}
