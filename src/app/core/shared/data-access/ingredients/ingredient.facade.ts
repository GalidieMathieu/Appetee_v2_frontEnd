import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, of, tap, timeout } from 'rxjs';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { Ingredient, IngredientAdminDetailDto, IngredientAdminDetailRequest } from './ingredient.model';
import { IngredientsApi } from './ingredient.api';
import { IngredientsStore } from './ingredients.store';

@Injectable({ providedIn: 'root' })
export class IngredientsFacade extends AbstractLoadFacade<Ingredient[],IngredientsStore> {
 
    constructor(
        private readonly api: IngredientsApi,
        store: IngredientsStore
      ) 
      {
        super(store);
      }

      readonly ingredients$ = this.data$.pipe(
        map(ingredients => ingredients as readonly Ingredient[])
      );


      //function Common to only the general store one that dont change, like ingredient or diet.
      //TODO, versionnage, to see if there is any update needed. 
      loadIfNeeded(): void {
        if (this.isLoaded()) return;
        this.load();
      }
    
      reload(): void {
        this.reset();
        this.load();
      }

      load(): void {
        if(this.store.isLoading()) {
          return ;
        }
        this.setLoading();
    
        this.api.getAll().pipe(
          timeout(10000),
          catchError((err: unknown) => {
            this.setError(this.toUserMessage(err));
            return EMPTY;
          })
        ).subscribe(data => this.setSuccess(data));
      }


      createIngredientWithDetails(ingredientAdminDetail : IngredientAdminDetailRequest) : Observable<IngredientAdminDetailDto>
      {
        //this can be loading for two resons : 
        // 1: we already trying to create an ingredient and clicked twice on create ingredient
        // 2 : we still fetching some ingredients.
        if(this.store.isLoading()) {
          return EMPTY;
        }

        this.setLoading();
        return this.api.createIngredientWithDetails(this.toIngredientCreateFormData(ingredientAdminDetail)).pipe(
          tap((ingredient : IngredientAdminDetailDto)=>this.store.setIngredientDetails(ingredient)),
          catchError(err => {
            this.setError(this.toUserMessage(err));
            return EMPTY;
          })
        );
      }

      getIngredientWithDetails(id: number): Observable<IngredientAdminDetailDto> {
        const cached = this.store.getIngredientDetailsById(id);
        if (cached) {
          return of(cached);
        }

        if(this.store.isLoading()) {
          return EMPTY;
        }

        this.setLoading();

        return this.api.getIngredientWithDetails(id).pipe(
          tap((ingredient : IngredientAdminDetailDto)=>this.store.setIngredientDetails(ingredient)),
          catchError(err => {
            this.setError(this.toUserMessage(err));
            return EMPTY;
          })
        );
      }

      private toIngredientCreateFormData(ingredient: IngredientAdminDetailRequest): FormData {
        const formData = new FormData();

        formData.append('name', ingredient.name);
        formData.append('basis', ingredient.basis.toString());
        formData.append('basisUnit', ingredient.basisUnit);

        if (ingredient.price !== null) {
          formData.append('price', ingredient.price.toString());
        }

        formData.append('caloriesKcal', ingredient.caloriesKcal.toString());
        formData.append('image', ingredient.image);

        if (ingredient.proteinG !== null) {
          formData.append('proteinG', ingredient.proteinG.toString());
        }

        if (ingredient.fatG !== null) {
          formData.append('fatG', ingredient.fatG.toString());
        }

        if (ingredient.carbsG !== null) {
          formData.append('carbsG', ingredient.carbsG.toString());
        }

        if (ingredient.sugarG !== null) {
          formData.append('sugarG', ingredient.sugarG.toString());
        }

        if (ingredient.fiberG !== null) {
          formData.append('fiberG', ingredient.fiberG.toString());
        }

        if (ingredient.sodiumMg !== null) {
          formData.append('sodiumMg', ingredient.sodiumMg.toString());
        }

        if (ingredient.vitaminCMg !== null) {
          formData.append('vitaminCMg', ingredient.vitaminCMg.toString());
        }

        if (ingredient.ironMg !== null) {
          formData.append('ironMg', ingredient.ironMg.toString());
        }

        return formData;
      }
    }
 
