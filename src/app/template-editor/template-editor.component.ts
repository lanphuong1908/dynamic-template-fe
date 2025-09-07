import { Component, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { ClassicEditor, Bold, Essentials, Italic, Paragraph } from 'ckeditor5';


@Component({
  selector: 'app-template-editor',
  imports: [BrowserModule, CKEditorModule, FormsModule, ReactiveFormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './template-editor.component.html',
  styleUrl: './template-editor.component.scss',
  standalone: true
})
export class TemplateEditorComponent {

  public Editor = ClassicEditor;
  public config = {
		licenseKey: 'GPL',
		plugins: [ Essentials, Paragraph, Bold, Italic ],
		toolbar: [ 'undo', 'redo', '|', 'bold', 'italic', '|' ]
	}

}
