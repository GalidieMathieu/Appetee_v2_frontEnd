import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { MealPlanContextStore } from '@app/core/shared/data-access/meal-plan/meal-plan-context.store';
import { createCalculationChoiceForm, createNutritionPlanForm, easyRequestFromForm } from '../forms/nutrition-plan-form.factory';
import { createNutritionProfileForm, nutritionProfileRequestFromForm, profileToFormValue } from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.factory';
import { NutritionPlanDto, NutritionCalculationDto, NutritionCalculationRequest, CreateNutritionPlanRequest, UpdateNutritionPlanRequest } from '@app/core/shared/data-access/meal-plan/nutrition-plan.model';
import { NutritionProfileValue } from '@app/core/shared/data-access/user/nutrition-profile.model';
import { NutritionPlanStep, WIZARD_STEPS } from '../models/nutrition-plan-draft.model';
@Injectable()
export class NutritionPlanDraftState {
    private readonly context = inject(MealPlanContextStore);
    private readonly destroyRef = inject(DestroyRef);
    readonly form = createNutritionPlanForm();
    readonly profileForm = createNutritionProfileForm();
    readonly choices = createCalculationChoiceForm();
    readonly mode = signal<'easy' | 'intermediate'>('easy');
    readonly step = signal<NutritionPlanStep>('profile');
    readonly preview = signal<NutritionCalculationDto | null>(null);
    readonly calculationVersion = signal(0);
    readonly forceRecalculation = signal(false);
    private baseline = '';
    private calculationBaseline = '';
    private initializedPlan = false;
    private initializedProfile = false;
    private profileTouched = false;
    private muted = false;
    private readonly dirtySignal = signal(false);
    private readonly versionSignal = signal(0);
    private readonly revisionSignal = signal<string | null>(null);
    readonly dirty = this.dirtySignal.asReadonly();
    readonly version = this.versionSignal.asReadonly();
    readonly reviewedRevision = this.revisionSignal.asReadonly();
    constructor() {
        this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            if (this.muted)
                return;
            this.versionSignal.update(value => value + 1);
            const value = this.form.getRawValue();
            this.dirtySignal.set(this.forceRecalculation() || (this.initializedPlan ? this.snapshot() !== this.baseline : value.name !== '' || value.defaultMealsPerDay !== null || this.calculationVersion() > 0));
        });
        for (const source of [this.profileForm.valueChanges, this.choices.valueChanges] as Observable<unknown>[]) {
            source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
                if (this.muted)
                    return;
                if (source === this.profileForm.valueChanges)
                    this.profileTouched = true;
                this.preview.set(null);
                this.calculationVersion.update(x => x + 1);
                this.versionSignal.update(x => x + 1);
                this.dirtySignal.set(this.forceRecalculation() || (this.initializedPlan ? this.snapshot() !== this.baseline : true));
            });
        }
        this.context.reset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.clear());
        this.destroyRef.onDestroy(() => this.clear());
    }
    initializeRevision(revision: string): void {
        if (this.revisionSignal() === null)
            this.revisionSignal.set(revision);
    }
    reviewRevision(revision: string): void { this.revisionSignal.set(revision); }
    request() { return easyRequestFromForm(this.form); }
    calculation(): NutritionCalculationRequest | null {
        const profile = nutritionProfileRequestFromForm(this.profileForm);
        const { goal, activityLevel } = this.choices.getRawValue();
        return profile && this.profileForm.valid && this.choices.valid && goal && activityLevel ? { profile, goal, activityLevel } : null;
    }
    seedProfile(profile: NutritionProfileValue | null, explicit = false): void {
        if (!explicit && (this.initializedProfile || this.profileTouched || this.initializedPlan))
            return;
        this.initializedProfile = true;
        if (explicit)
            this.profileForm.reset(profileToFormValue(profile));
        else {
            this.muted = true;
            this.profileForm.reset(profileToFormValue(profile), { emitEvent: false });
            this.muted = false;
        }
    }
    seedPlan(plan: NutritionPlanDto, revision: string): void {
        if (this.initializedPlan)
            return;
        const hasEdits = this.version() > 0;
        this.initializedPlan = true;
        this.mode.set(plan.mode);
        this.initializeRevision(revision);
        if (!hasEdits) {
            this.muted = true;
            this.form.reset({ name: plan.name, defaultMealsPerDay: plan.defaultMealsPerDay }, { emitEvent: false });
            this.profileForm.reset(profileToFormValue(plan.calculationInputs), { emitEvent: false });
            this.choices.reset({ goal: plan.goal, activityLevel: plan.activityLevel }, { emitEvent: false });
            this.muted = false;
        }
        this.baseline = JSON.stringify({ metadata: { name: plan.name, defaultMealsPerDay: plan.defaultMealsPerDay },
            profile: profileToFormValue(plan.calculationInputs), choices: { goal: plan.goal, activityLevel: plan.activityLevel } });
        this.calculationBaseline = JSON.stringify({ profile: profileToFormValue(plan.calculationInputs), choices: { goal: plan.goal, activityLevel: plan.activityLevel } });
        this.dirtySignal.set(this.snapshot() !== this.baseline);
    }
    calculationChanged(): boolean {
        return this.forceRecalculation() || (this.mode() === 'intermediate'
            && this.calculationSnapshot() !== this.calculationBaseline);
    }
    requestRecalculation(): void {
        this.forceRecalculation.set(true);
        this.preview.set(null);
        this.calculationVersion.update(x => x + 1);
        this.versionSignal.update(x => x + 1);
        this.dirtySignal.set(true);
    }
    firstIncomplete(): NutritionPlanStep {
        if (!this.profileForm.valid)
            return 'profile';
        if (!this.choices.controls.goal.valid)
            return 'goal';
        if (!this.choices.controls.activityLevel.valid)
            return 'activity';
        if (!this.form.controls.defaultMealsPerDay.valid)
            return 'meal-structure';
        return 'review';
    }
    canVisit(step: NutritionPlanStep): boolean {
        return WIZARD_STEPS.indexOf(step) <= WIZARD_STEPS.indexOf(this.firstIncomplete());
    }
    createRequest(): CreateNutritionPlanRequest | null {
        const metadata = this.request();
        if (!metadata)
            return null;
        if (this.mode() === 'easy')
            return metadata;
        const calculation = this.calculation();
        const preview = this.preview();
        return calculation && preview ? { name: metadata.name, defaultMealsPerDay: metadata.defaultMealsPerDay,
            mode: 'intermediate', calculation, reviewedPolicyVersion: preview.policyVersion, reviewedCalculationYear: preview.calculationYear } : null;
    }
    updateRequest(): UpdateNutritionPlanRequest | null {
        const metadata = this.request();
        if (!metadata)
            return null;
        const base = { name: metadata.name, defaultMealsPerDay: metadata.defaultMealsPerDay };
        if (this.mode() === 'easy' || !this.calculationChanged())
            return base;
        const calculation = this.calculation();
        const preview = this.preview();
        return calculation && preview ? { ...base, calculation, reviewedPolicyVersion: preview.policyVersion, reviewedCalculationYear: preview.calculationYear } : null;
    }
    private calculationSnapshot(): string { return JSON.stringify({ profile: this.profileForm.getRawValue(), choices: this.choices.getRawValue() }); }
    private snapshot(): string { return JSON.stringify({ metadata: this.form.getRawValue(), profile: this.profileForm.getRawValue(), choices: this.choices.getRawValue() }); }
    acknowledge(version: number): boolean {
        if (version !== this.versionSignal())
            return false;
        this.clear();
        return true;
    }
    clear(): void {
        this.muted = true;
        this.profileForm.enable({ emitEvent: false });
        this.choices.enable({ emitEvent: false });
        this.profileForm.reset(profileToFormValue(null), { emitEvent: false });
        this.choices.reset({ goal: null, activityLevel: null }, { emitEvent: false });
        this.preview.set(null);
        this.mode.set('easy');
        this.step.set('profile');
        this.calculationVersion.set(0);
        this.forceRecalculation.set(false);
        this.initializedPlan = false;
        this.initializedProfile = false;
        this.profileTouched = false;
        this.baseline = '';
        this.calculationBaseline = '';
        this.form.enable({ emitEvent: false });
        this.form.reset({ name: '', defaultMealsPerDay: null }, { emitEvent: false });
        this.dirtySignal.set(false);
        this.versionSignal.set(0);
        this.revisionSignal.set(null);
        this.muted = false;
    }
}
