import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CKEditorModule, loadCKEditorCloud, CKEditorCloudResult } from '@ckeditor/ckeditor5-angular';
import type { ClassicEditor, EditorConfig } from 'https://cdn.ckeditor.com/typings/ckeditor5.d.ts';
import { CustomerProperty } from '../core/models/property.model';
import { TemplateDto } from '../core/models/template.model';
import { PropertiesService } from '../core/services/properties.service';
import { TemplatesService } from '../core/services/templates.service';
import { ActivatedRoute } from '@angular/router';
import { tokenFromCode } from '../utils/token.util';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-template-editor',
  templateUrl: './template-editor.component.html',
  styleUrl: './template-editor.component.scss',
  imports: [ CommonModule, CKEditorModule, DragDropModule ],
  standalone: true
})
export class TemplateEditorComponent {

  	isBrowser: boolean = false;
  	public Editor: typeof ClassicEditor | null = null;

	public config: EditorConfig | null = null;

	public ngOnInit(): void {
		this.loadProperties();
		const id = this.route.snapshot.paramMap.get('id')!;
		this.loadTemplate(id);
		
		if (this.isBrowser) {
			loadCKEditorCloud( {
				version: '46.0.3',
				premium: true
			} ).then( this._setupEditor.bind( this ) );
		}
	}

	private _setupEditor ( cloud: CKEditorCloudResult<{ version: '46.0.3', premium: true }> ) {
		const {
			ClassicEditor,
			Essentials,
			Paragraph,
			Bold,
			Italic
		} = cloud.CKEditor;

		const { FormatPainter } = cloud.CKEditorPremiumFeatures;

		this.Editor = ClassicEditor;
		this.config = {
			licenseKey: 'eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NTg0OTkxOTksImp0aSI6ImZiZDAwNTE2LWU2ZmQtNGMzNS1hZjZiLWUzZjZlZDI1YzE4YSIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6IjNiODMzODZlIn0.31H_SdIy5U7K2JBi0sJAL0mj_BP-QUlO7zqRpq688Wfi5qke-V7llnimIEvjY2Ek17KoudMzEqoXmHSlu_9Ztw',
			plugins: [ Essentials, Paragraph, Bold, Italic, FormatPainter ],
			toolbar: [ 'undo', 'redo', '|', 'bold', 'italic', '|', 'formatPainter' ]
		};
	}


	properties: CustomerProperty[] = [];
	template?: TemplateDto;

	public content = '';
	private editorInstance: any;

	isLoadingLeft = false;
	isLoadingRight = false;

	constructor(
		private propsSvc: PropertiesService,
		private tplSvc: TemplatesService,
		private route: ActivatedRoute,
		@Inject(PLATFORM_ID) private platformId: Object
	) {
		console.log('TemplateEditorComponent constructor');
		this.isBrowser = isPlatformBrowser(this.platformId);
	}

	loadProperties() {
		this.isLoadingLeft = true;
		this.propsSvc.list().subscribe({
		next: res => { this.properties = res; },
		error: () => {},
		complete: () => { this.isLoadingLeft = false; }
		});
	}

	loadTemplate(id: string) {
		this.isLoadingRight = true;
		this.tplSvc.getById(id).subscribe({
		next: tpl => {
			this.template = tpl;
			this.content = tpl.content || '';
		},
		error: () => {},
		complete: () => { this.isLoadingRight = false; }
		});
	}

	onEditorReady(editor: any) { this.editorInstance = editor; }

	insertTokenFromCode(code: string) {
		const token = tokenFromCode(code);
		if (!this.editorInstance) { this.content += token; return; }
		this.editorInstance.model.change((writer: any) => {
		const pos = this.editorInstance.model.document.selection.getFirstPosition();
		this.editorInstance.model.insertContent(writer.createText(token), pos);
		});
	}

	onDroppedToEditor(ev: CdkDragDrop<any>) {
		const item = ev.item.data as CustomerProperty | undefined;
		if (item?.code) this.insertTokenFromCode(item.code);
	}

	onClickProperty(p: CustomerProperty) { this.insertTokenFromCode(p.code); }

}