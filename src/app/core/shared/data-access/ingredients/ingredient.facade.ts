import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, timeout } from 'rxjs';

import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';
import { Ingredient } from './ingredient.model';
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
    
      //Common Fucntion to all Facade
      protected isLoaded(): boolean { return this.store.isLoaded(); }
      protected setLoading(): void { this.store.setLoading(); }
      protected setError(message: string): void { this.store.setError(message); }
      protected setSuccess(data: Ingredient[]): void { this.store.setSuccess(data); }
      protected override reset(): void { this.store.reset(); }


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
        this.setLoading();
    
        this.api.getAll().pipe(
          timeout(10000),
          catchError((err: unknown) => {
            this.setError(this.toUserMessage(err));
            return EMPTY;
          })
        ).subscribe(data => this.setSuccess(data));
      }

    }
