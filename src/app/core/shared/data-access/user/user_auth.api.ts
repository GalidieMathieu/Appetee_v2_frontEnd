import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../api/api.config';
import { User , ExistsResponse} from './user.model';

@Injectable({ providedIn: 'root' })
export class UserApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  //This should not need Id as we should be connected and share cookies. is getMe doesnt work,
  // it means that the cookie are not properly been set. 
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  checkUserExist(email : string) : Observable<ExistsResponse>{
    return this.http.get<ExistsResponse>(`${this.apiUrl}/users/exists-by-email`,{ params: { email } })
  }
}
