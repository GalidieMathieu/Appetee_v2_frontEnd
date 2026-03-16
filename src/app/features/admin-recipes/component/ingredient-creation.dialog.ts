import { ChangeDetectorRef, Component, computed, Inject, inject, NgZone, OnInit, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Ingredient, IngredientAdminDetailDto, IngredientDialogResult } from '@app/core/shared/data-access/ingredients/ingredient.model';
import { MatIconModule } from '@angular/material/icon';
import { IngredientsFacade } from '@app/core/shared/data-access/ingredients/ingredient.facade';
import { startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { IngredientCreateFormComponent } from '@app/core/shared/ui/ingredient-creation-component/ingredient-creation.component';

type DialogMode = 'search' | 'create' | 'link';

@Component({
  selector: 'app-ingredient-dialog',
  templateUrl : './ingredient-creation.dialog.html',
  styleUrl: './ingredient-creation.dialog.scss',
  standalone: true,
  imports: [MatDialogModule , ReactiveFormsModule, MatIconModule , IngredientCreateFormComponent]
})
export class IngredientDialogComponent implements OnInit {
    //##################### INIT #################
    constructor(
      @Inject(MAT_DIALOG_DATA) readonly data: any
    ) {}

    ngOnInit(): void {
      this.facade.loadIfNeeded();
    }

    private readonly dialogRef =
      inject<MatDialogRef<IngredientDialogComponent, IngredientDialogResult | undefined>>(MatDialogRef);
    private readonly ngZone = inject(NgZone);

      isNewIngredient = false;
      dialog_Title : string = "Add Ingredient";
      dialog_subTitle : string = "Search for an existing ingredient or create a new one.";

      readonly facade = inject(IngredientsFacade);


      //##################### General State #################
      readonly mode = signal<DialogMode>('search');
      readonly recipeIngredientForm = new FormGroup({
        ingredientId: new FormControl<number | null>(null),
        quantity: new FormControl<number | null>(null),
        unit: new FormControl<string | null>(null),
      });
    


      //#################   searching Ingredient Mode #######################
      /*
        Using signal has we need to use computed and not combineLatest
      */
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

      selectIngredient(ingredient: Ingredient): void {
        this.facade.getIngredientWithDetails(ingredient.id).subscribe({
          next: (details) => {
            this.ngZone.run(() => {
              this.selectedIngredient.set({ ...details });
              this.recipeIngredientForm.patchValue({
                ingredientId: details.id,
                quantity: 1,
                unit: 'g',
              });
              this.mode.set('link');
            });
          },
        });
      }

      //##################### Creation Ingredient Mode #################
      readonly createName = signal('');
      readonly isChildFormValid = signal(false);
      readonly createForm = viewChild(IngredientCreateFormComponent);

      openCreateMode(): void {
        this.createName.set(this.searchTerm());
        this.mode.set('create');
      }

      onCreateIngredientClick(): void {
        this.createForm()?.createIngredient();
      }

      onIngredientCreated(ingredient: IngredientAdminDetailDto): void {
        this.ngZone.run(() => {
          this.selectedIngredient.set({ ...ingredient });
          this.recipeIngredientForm.patchValue({
            ingredientId: ingredient.id,
            quantity: 1,
            unit: 'g',
          });
          this.mode.set('link');
        });
      }

      onChildValidityChanged(isValid: boolean): void {
        this.isChildFormValid.set(isValid);
      }
      
      //for cancel button for creation ingredient, or 
      backToSearch(): void {
        this.mode.set('search');
      }


       //##################### Link to parent #################

        readonly selectedIngredient = signal<IngredientAdminDetailDto | null>(null);


      //#################   UTILS  #######################
      new_IngredBttn : string = "create new ingredient";

      ingredientChoiceSelection() : void {
        this.isNewIngredient = !this.isNewIngredient;
        this.new_IngredBttn = this.isNewIngredient ?"Select existing ingredient" : "create new ingredient";
      }
      
      cancel(): void {
        this.dialogRef.close(undefined);
      }
    
      confirmRecipeIngredient(): void {
        if (this.recipeIngredientForm.invalid || !this.selectedIngredient()) {
          this.recipeIngredientForm.markAllAsTouched();
          return;
        }
    
        /*const result : IngredientDialogResult = {
          ingredientId: this.recipeIngredientForm.controls.ingredientId.value,
          ingredientName: this.selectedIngredient()!.name,
          //quantity: this.recipeIngredientForm.controls.quantity.value,
          //unit: this.recipeIngredientForm.controls.unit.value,
        };
    
        console.log(result);
        this.dialogRef.close(result);*/
      }    
  }