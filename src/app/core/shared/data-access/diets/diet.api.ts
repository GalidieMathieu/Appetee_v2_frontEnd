import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../../api/api.config';
import { Diet ,CreateDietRequest , UpdateDietRequest } from './diet.model';

@Injectable({ providedIn: 'root' })
export class DietsApi {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_URL) private readonly apiUrl: string
  ) {}

  getAll(): Observable<Diet[]> {
    return this.http.get<Diet[]>(`${this.apiUrl}/diets`);
  }

  create(req: CreateDietRequest): Observable<Diet> {
    return this.http.post<Diet>(`${this.apiUrl}/diets`, req);
  }

  update(id: number, req: UpdateDietRequest): Observable<Diet> {
    return this.http.put<Diet>(`${this.apiUrl}/diets/${id}`, req);
    // use PATCH if your backend is patch-based
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/diets/${id}`);
  }
}
