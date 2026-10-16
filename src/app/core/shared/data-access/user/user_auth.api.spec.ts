/** Verifies current-user HTTP contracts never accept or transmit a browser-selected account ID. */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../../api/api.config';
import { UserApi } from './user_auth.api';
import { MEAL_PLAN_REVISION_HEADER } from '../meal-plan/meal-plan-mutation.model';

describe('UserApi', () => {
  let api: UserApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(UserApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the authenticated profile without an account id', () => {
    api.getMe().subscribe();

    const request = http.expectOne('/api/users/me');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ username: 'chef', imageUrl: null });
  });

  it('updates only editable current-profile fields without an account id', () => {
    const body = { username: 'chef', imageUrl: 'https://example.com/avatar.png' };
    api.updateMe(body).subscribe();

    const request = http.expectOne('/api/users/me');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    expect(Object.keys(request.request.body)).toEqual(['username', 'imageUrl']);
    request.flush(body);
  });

  it('closes only the cookie-authenticated account without an id or request body', () => {
    api.deleteMe().subscribe();

    const request = http.expectOne('/api/users/me');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.body).toBeNull();
    request.flush(null);
  });

  it('gets the separate nutrition profile without changing the basic profile contract', () => {
    api.getNutritionProfile().subscribe();

    const request = http.expectOne('/api/users/me/nutrition-profile');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ revision: '4', profile: null });
  });

  it('updates only complete nutrition-profile inputs with an opaque revision header', () => {
    const body = {
      calculationSex: 'male' as const,
      birthYear: 1992,
      heightCm: 180.5,
      weightKg: 82.25,
      adultConfirmed: true,
    };
    api.updateNutritionProfile(body, '9007199254740993').subscribe();

    const request = http.expectOne('/api/users/me/nutrition-profile');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    expect(Object.keys(request.request.body)).toEqual([
      'calculationSex',
      'birthYear',
      'heightCm',
      'weightKg',
      'adultConfirmed',
    ]);
    expect(request.request.headers.get(MEAL_PLAN_REVISION_HEADER)).toBe('9007199254740993');
    expect('userId' in request.request.body).toBe(false);
    expect('targets' in request.request.body).toBe(false);
    request.flush({ revision: '9007199254740994', profile: body });
  });
});
