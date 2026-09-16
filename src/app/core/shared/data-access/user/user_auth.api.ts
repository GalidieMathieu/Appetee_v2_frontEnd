import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../api/api.config';
import { ExistsResponse, UpdateCurrentUserRequest, User } from './user.model';

@Injectable({ providedIn: 'root' })
export class UserApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  updateMe(request: UpdateCurrentUserRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/me`, request);
  }

  checkUserExist(email: string): Observable<ExistsResponse> {
    return this.http.get<ExistsResponse>(`${this.apiUrl}/auth/exists-by-email`, { params: { email } });
  }
}
