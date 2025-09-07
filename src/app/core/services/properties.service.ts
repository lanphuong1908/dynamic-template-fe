import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CustomerProperty } from '../models/property.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PropertiesService {
  
  private base = `${environment.apiBaseUrl}/customers/properties`;

  constructor(
    // private http: HttpClient
  ) {}

  list(): Observable<CustomerProperty[]> {
      // return this.http.get<CustomerProperty[]>(this.base);
      return new Observable<CustomerProperty[]>(subscriber => {
        subscriber.next([
          { "id": "1", "code": "fullName", "name": "Họ tên" },
          { "id": "2", "code": "email", "name": "Email" },
          { "id": "3", "code": "dob", "name": "Ngày sinh" }
        ]);
        subscriber.complete();
      });
  }

}