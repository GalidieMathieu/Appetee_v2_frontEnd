import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@app/core/api/api.config';
import { LoginRequest, SignUpRequest, UserSession } from './auth.model';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  //Refresh the session Token from the back end to the front
  refreshSession(): Observable<UserSession> {
    return this.http.get<UserSession>(`${this.apiUrl}/auth/session`);
  }

  //logIn and return witha  session token (handle by .net) and the UserSession Data
  login(request: LoginRequest) : Observable<UserSession>{
    return this.http.post<UserSession>(`${this.apiUrl}/auth/login`, request);
  }

  signUp(user : SignUpRequest) : Observable<UserSession>{
    return this.http.post<UserSession>(`${this.apiUrl}/auth/sign-up`, user);
  }

  logout() {
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {});
  }
}
