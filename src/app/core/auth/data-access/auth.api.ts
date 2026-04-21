import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@app/core/api/api.config';
import { LoginRequest, SignUpRequest, UserSession } from './auth.model';
import { SKIP_AUTO_LOGOUT } from './auth.request-context';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  private authRequestOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_AUTO_LOGOUT, true),
    };
  }

  // Refresh the session token from the backend without triggering the global 401 logout handler.
  refreshSession(): Observable<UserSession> {
    return this.http.get<UserSession>(`${this.apiUrl}/auth/session`, this.authRequestOptions());
  }

  // Login and return the cookie-backed session plus the current session data.
  login(request: LoginRequest): Observable<UserSession> {
    return this.http.post<UserSession>(`${this.apiUrl}/auth/login`, request, this.authRequestOptions());
  }

  signUp(user: SignUpRequest): Observable<UserSession> {
    return this.http.post<UserSession>(`${this.apiUrl}/auth/sign-up`, user, this.authRequestOptions());
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, this.authRequestOptions());
  }
}
