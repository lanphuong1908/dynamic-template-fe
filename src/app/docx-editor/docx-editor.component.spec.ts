import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocxEditorComponent } from './docx-editor.component';

describe('DocxEditorComponent', () => {
  let component: DocxEditorComponent;
  let fixture: ComponentFixture<DocxEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocxEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocxEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
