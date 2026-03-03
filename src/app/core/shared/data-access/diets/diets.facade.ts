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

  protected isLoaded(): boolean { return this.store.isLoaded(); }
  protected setLoading(): void { this.store.setLoading(); }
  protected setError(message: string): void { this.store.setError(message); }
  protected setSuccess(data: Diet[]): void { this.store.setSuccess(data); }
  protected override reset(): void { this.store.reset(); }

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
