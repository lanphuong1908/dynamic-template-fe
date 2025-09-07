import { Routes } from '@angular/router';
import { TemplateEditorComponent } from './template-editor/template-editor.component';
import { AppComponent } from './app.component';

export const routes: Routes = [
  {
    path: '',
    component: AppComponent,
    title: 'Home',
  },
  {
    path: 'template-editor',
    component: TemplateEditorComponent,
    title: 'Template Editor',
  }
];
