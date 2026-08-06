import { ChangeDetectorRef, Component, computed, DestroyRef, Inject, inject, NgZone, OnInit, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Ingredient, IngredientAdminDetailDto, IngredientDialogResult } from '@app/core/shared/data-access/ingredients/ingredient.model';
import { MatIconModule } from '@angular/material/icon';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { startWith } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { IngredientCreateFormComponent } from '@app/core/shared/ui/ingredient-creation-component/ingredient-creation.component';
import { LoadingIndicatorComponent } from '@app/core/shared/utils/loading-indicator/loading-indicator.component';

type DialogMode = 'search' | 'create' | 'link';
type LoadingPhase = 'ingredients' | 'details' | 'create';

@Component({
  selector: 'app-ingredient-dialog',
  templateUrl : './ingredient-creation.dialog.html',
  styleUrl: './ingredient-creation.dialog.scss',
  standalone: true,
  imports: [MatDialogModule, ReactiveFormsModule, MatIconModule, IngredientCreateFormComponent, LoadingIndicatorComponent]
})
export class IngredientDialogComponent implements OnInit {
  
  //##################### INIT #################
  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: any
  ) {}

  private readonly dialogRef =
    inject<MatDialogRef<IngredientDialogComponent, IngredientDialogResult | undefined>>(MatDialogRef);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  readonly facade = inject(IngredientsFacade);
  readonly errorMessage = toSignal(this.facade.error$, { initialValue: null });
  readonly isLoading = toSignal(this.facade.isLoading$, { initialValue: false });

  dialog_Title: string = 'Add Ingredient';
  dialog_subTitle: string = 'Search for an existing ingredient or create a new one.';

  // Loads the ingredient list when the dialog opens.
  ngOnInit(): void {
    this.loadingPhase.set('ingredients');
    this.facade.loadIfNeeded();
  }

  //##################### General State #################
  readonly mode = signal<DialogMode>('search');
  readonly loadingPhase = signal<LoadingPhase>('ingredients');
  readonly loadingContent = computed(() => {
    switch (this.loadingPhase()) {
      case 'create':
        return {
          eyebrow: 'Saving ingredient',
          title: 'Creating ingredient entry',
          description: 'We are saving the ingredient details and image before linking it to the recipe.',
          lineCount: 3,
        };
      case 'details':
        return {
          eyebrow: 'Loading ingredient',
          title: 'Preparing ingredient details',
          description: 'We are fetching the full ingredient data so you can confirm the recipe amount.',
          lineCount: 4,
        };
      default:
        return {
          eyebrow: 'Loading ingredients',
          title: 'Preparing ingredient list',
          description: 'We are getting the latest ingredient list ready for search and manual linking.',
          lineCount: 5,
        };
    }
  });
  readonly recipeIngredientForm = new FormGroup({
    ingredientId: new FormControl<number | null>(null),
    quantity: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    unit: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
  });

  //################# Searching Ingredient Mode #######################
  readonly ingredients = toSignal(this.facade.ingredients$, {
    initialValue: [] as Ingredient[],
  });
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly search = toSignal(
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
    { initialValue: this.searchControl.value }
  );
  readonly searchTerm = computed(() => this.search().trim());
  readonly hasSearchTerm = computed(() => this.searchTerm().length > 0);
  readonly filteredIngredients = computed(() => {
    const ingredients = this.ingredients();
    const term = this.search().trim().toLowerCase();

    if (!term) {
      return [];
    }

    return ingredients
      .filter(ingredient =>
        ingredient.name.toLowerCase().startsWith(term)
      )
      .slice(0, 4);
  });

  // Starts loading the selected ingredient details before linking it.
  selectIngredient(ingredient: Ingredient): void {
    this.loadingPhase.set('details');
    this.loadIngredientDetails(ingredient.id);
  }

  // Fetches the full ingredient DTO used by the link step.
  private loadIngredientDetails(id: number): void {
    this.facade.getIngredientWithDetails(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: details => {
        this.ngZone.run(() => {
          this.showSelectedIngredient(details);
        });
      },
    });
  }

  //##################### Creation Ingredient Mode #################
  readonly createName = signal('');
  readonly isChildFormValid = signal(false);
  readonly createForm = viewChild(IngredientCreateFormComponent);

  // Switches the dialog to manual ingredient creation mode.
  openCreateMode(): void {
    this.isChildFormValid.set(false);
    this.createName.set(this.searchTerm());
    this.mode.set('create');
  }

  // Creates a new ingredient and immediately prepares it for linking.
  onCreateIngredientClick(): void {
    if (!this.canCreateIngredient()) {
      return;
    }

    const ingredientRequest = this.createForm()?.buildCreateRequest();
    if (!ingredientRequest) {
      return;
    }

    this.loadingPhase.set('create');
    this.facade.createIngredientWithDetails(ingredientRequest).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (ingredient: IngredientAdminDetailDto) => {
        this.ngZone.run(() => {
          this.showSelectedIngredient(ingredient);
        });
      },
    });
  }

  // Mirrors the child form validity to control the create action state.
  onChildValidityChanged(isValid: boolean): void {
    this.isChildFormValid.set(isValid);
  }

  // Returns from create/link mode to the ingredient search view.
  backToSearch(): void {
    this.isChildFormValid.set(false);
    this.mode.set('search');
  }

  // Tells the template when the child create form is ready to submit.
  canCreateIngredient(): boolean {
    return this.isChildFormValid() && this.createForm()?.form.valid === true;
  }

  //##################### Link To Parent #################
  readonly selectedIngredient = signal<IngredientAdminDetailDto | null>(null);

  // Stores the selected ingredient and pre-fills the recipe quantity fields.
  private showSelectedIngredient(ingredient: IngredientAdminDetailDto): void {
    this.selectedIngredient.set({ ...ingredient });
    this.recipeIngredientForm.patchValue({
      ingredientId: ingredient.id,
      quantity: ingredient.basis,
      unit: ingredient.basisUnit,
    });
    this.mode.set('link');
    queueMicrotask(() => this.changeDetectorRef.detectChanges());
  }

  //################# Utility Actions #######################
  // Closes the dialog without returning an ingredient selection.
  cancel(): void {
    this.dialogRef.close(undefined);
  }

  // Returns the chosen ingredient id and quantity data to the parent page.
  confirmRecipeIngredient(): void {
    if (this.recipeIngredientForm.invalid || !this.selectedIngredient()) {
      this.recipeIngredientForm.markAllAsTouched();
      return;
    }

    const result: IngredientDialogResult = {
      ingredientId: this.selectedIngredient()!.id,
      quantity: this.recipeIngredientForm.controls.quantity.value,
      unit: this.recipeIngredientForm.controls.unit.value,
    };

    this.dialogRef.close(result);
  }
}
