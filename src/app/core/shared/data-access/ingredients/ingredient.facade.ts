import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, of, switchMap, tap, timeout } from 'rxjs';

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
        return this.api.createIngredientWithDetails(ingredientAdminDetail).pipe(
          tap((ingredient : IngredientAdminDetailDto)=>this.store.setIngredientDetails(ingredient)),
          catchError(err => {
            this.setError(this.toUserMessage(err));
            return EMPTY;
          })
        );
      }

      getIngredientWithDetails(id: number): Observable<IngredientAdminDetailDto> {

        if(this.store.isLoading()) {
          return EMPTY;
        }

        const cached = this.store.getIngredientDetailsById(id);
        if (cached) {
          return of(cached);
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
    }