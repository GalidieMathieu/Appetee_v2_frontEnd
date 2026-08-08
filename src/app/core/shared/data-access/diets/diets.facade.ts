import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, tap, timeout } from 'rxjs';

import { DietsApi } from './diet.api';
import { DietsStore } from './diets.store';
import { Diet } from './diet.model';
import { AbstractLoadFacade } from '../generic-template/abstractLoadFacade';

@Injectable({ providedIn: 'root' })
export class DietsFacade extends AbstractLoadFacade<Diet[] , DietsStore> {

  constructor(
    private readonly api: DietsApi,
     store: DietsStore
  ) {
    super(store);
  }

  readonly diets$ = this.data$.pipe(
    map(diets => diets as readonly Diet[])
  );

  loadIfNeeded(): void {
    if (this.isLoaded()) return;
    this.load();
  }

  reload(): void {
    this.reset();
    this.load();
  }

  load(): void {
    if (this.store.isLoading()) return;
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
