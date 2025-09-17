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
    const sqlQuery = `select BIOMETRIC_STATUS, BRANCH_CODE_T24, BUSINESS_TYPE5_T24, CIF_NUMBER, CORP_VI_NAME, COUNTRY_T24, EMAIL, FAX_T24, FEE_ACCOUNT, HQ_ADDR, LEGAL_DOC_EXPIRED_DATE, LEGAL_DOC_ISSUE_AUTH, LEGAL_DOC_ISSUE_DATE, LEGAL_DOC_NUMBER, LEGAL_DOC_TYPE, LEGAL_ENTITY_ID, MOBILE, PRIM_BUS_ADDR, REASON_CLOSED_SERVICE, REGISTRATION_CHANNEL, SERVICE_PACKAGE, SMS_BANKING_REGISTRATION, STATUS, TELEPHONE from corp_customer_manager.customer_info where ID = :id`;
    
    return new Observable<CustomerProperty[]>(subscriber => {
      // Extract field names between SELECT and FROM
      const fieldsString = sqlQuery.toLowerCase()
        .split('select')[1]
        .split('from')[0]
        .trim();
      
      // Split by comma and clean up each field
      const fields = fieldsString
        .split(',')
        .map(field => field.trim());
      
      // Convert to CustomerProperty objects
      const properties = fields.map(field => ({
        id: crypto.randomUUID(),
        code: '${' + field.toUpperCase() + '}',
        name: field.toUpperCase() // You can add proper name mapping here if needed
      }));

      subscriber.next(properties);
      subscriber.complete();
    });
  }

}