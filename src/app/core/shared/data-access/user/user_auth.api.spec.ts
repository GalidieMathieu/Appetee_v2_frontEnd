import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../../api/api.config';
import { UserApi } from './user_auth.api';

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
});
