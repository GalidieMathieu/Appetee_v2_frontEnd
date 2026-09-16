/**
 * Ingredients API tests protect the existing unfiltered catalogue call and bounded search query.
 * The autocomplete response remains the lightweight ID/name Ingredient contract.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_URL } from '../../../api/api.config';
import { IngredientsApi } from './ingredient.api';

describe('IngredientsApi', () => {
  let api: IngredientsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IngredientsApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(IngredientsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('preserves the existing no-search ingredient catalogue request', () => {
    api.getAll().subscribe();

    const request = http.expectOne('/api/ingredients');
    expect(request.request.params.keys()).toEqual([]);
    request.flush([]);
  });

  it('sends bounded search parameters and retains only the ID/name contract', () => {
    let result: unknown;
    api.search('chicken', 10).subscribe(value => { result = value; });

    const request = http.expectOne(
      candidate => candidate.url === '/api/ingredients'
        && candidate.params.get('search') === 'chicken'
        && candidate.params.get('limit') === '10'
    );
    request.flush([{ id: 7, name: 'Chicken breast' }]);

    expect(result).toEqual([{ id: 7, name: 'Chicken breast' }]);
  });
});
