import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TemplateDto } from '../models/template.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TemplatesService {

  private base = `${environment.apiBaseUrl}/templates`;

  constructor(
    // private http: HttpClient
  ) {}
  
  getById(id: string): Observable<TemplateDto> {
    // return this.http.get<TemplateDto>(`${this.base}/${id}`);
    return new Observable<TemplateDto>(subscriber => {
      subscriber.next(
        { "id": "1", "name": "Welcome Template", "content": "<p>Xin chào {{fullName}}, email: {{email}}</p>" }
      );
      subscriber.complete();
    });
  }

}
