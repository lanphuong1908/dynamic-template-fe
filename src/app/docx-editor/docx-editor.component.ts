import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PropertiesService } from '../core/services/properties.service';
import { CustomerProperty } from '../core/models/property.model';

declare const DocsAPI: any; // từ script api.js

@Component({
  selector: 'app-docx-editor',
  standalone: true,
  imports: [DragDropModule, CommonModule],
  templateUrl: './docx-editor.component.html',
  styleUrl: './docx-editor.component.scss'
})
export class DocxEditorComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  @ViewChild('onlyofficeFrame') onlyofficeFrame!: ElementRef;
  private docEditor: any;
  
  properties: CustomerProperty[] = [];
  isLoadingLeft = false;

  constructor(
		private propsSvc: PropertiesService
	) {
	}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadProperties();
      this.loadOnlyOfficeScript();
      this.setupPostMessageListener();
    }
  }

  loadProperties() {
    console.log("Load properties");
    this.isLoadingLeft = true;
    this.propsSvc.list().subscribe({
        next: res => { 
            console.log('API Response:', res); // Thêm log này
            this.properties = res;
        },
        error: (err) => {
            console.error('API Error:', err);  // Thêm log lỗi
        },
        complete: () => { 
            this.isLoadingLeft = false;
        }
    });
  }

  loadOnlyOfficeScript(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const script = document.createElement('script');
    script.src = 'http://10.86.35.191:8080/web-apps/apps/api/documents/api.js'; // Thay bằng URL Document Server thực
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      this.initOnlyOffice();
    };

    script.onerror = () => {
      console.error('Failed to load ONLYOFFICE script');
    };
  }

  initOnlyOffice(): void {
    const config = {
      document: {
        fileType: 'docx',
        title: 'sample.docx',
        url: 'http://10.86.35.191:3000/template.docx', // Đảm bảo URL này trả về file DOCX
        key: 'doc-' + new Date().getTime(), // Key duy nhất để tránh cache
        permissions: {
          edit: true,
          download: true
        }
      },
      documentType: 'word', // Sửa từ 'text' thành 'word'
      editorConfig: {
        mode: 'edit',
        user: { id: 'u1', name: 'Guest User' },
        customization: {
          autosave: false,
          hideRightMenu: false,
          toolbarNoTabs: false
        },
        plugins: {
          autostart: ['asc.{123e4567-e89b-12d3-a456-426614174000}'], // Thay bằng GUID hợp lệ
          pluginsData: ['http://10.86.35.191:3000/drag-insert-plugin.js'] // Đảm bảo file tồn tại
        }
      },
      width: '100%',
      height: '1024px',
      events: {
        onReady: function () {
          console.log('Editor ready');
        },
        onRequestSaveAs: (event: any) => {
          console.log('SaveAs requested', event);
          // Lấy dữ liệu file
          const downloadUrl = event.data;
          
          // Tạo link download
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = 'edited-document.docx';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        },
        onError: function (event: any) {
          console.error('Editor error:', event.data);
        }
      }
    };

    try {
      console.log("Iframe start init");
      this.docEditor = new DocsAPI.DocEditor('onlyofficeFrame', config);
    } catch (error) {
      console.error('Failed to initialize editor:', error);
    }
  }

  setupPostMessageListener(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    window.addEventListener('message', (event) => {
      if (event.origin !== 'http://10.86.35.191:8080') return; // Sửa thành URL Document Server thực
      console.log('From iframe:', event.data);
    });
  }

  onDropToEditor(event: CdkDragDrop<any>) {
    console.log('Drop event:', event);
    const dragData = event.item.data;
    this.sendToIframe(dragData);
    console.log('Dropped data:', dragData);
  }

  sendToIframe(data: any): void {
    console.log(this.onlyofficeFrame?.nativeElement);
    console.log(this.onlyofficeFrame?.nativeElement?.contentWindow);

    if (this.onlyofficeFrame?.nativeElement?.contentWindow) {
      console.log('Sending to iframe:', data);
      this.onlyofficeFrame.nativeElement.contentWindow.postMessage(
        {
          type: 'insertItem',
          data: data
        },
        'http://10.86.35.191:8080'
      );
    } else {
      console.error('Iframe contentWindow not available');
    }
  }

  saveDocument(): void {
    if (this.docEditor) {
      // Trigger save dialog
      this.docEditor.downloadAs();
    }
  }


  // ngAfterViewInit(): void {
  //   // URL file DOCX tĩnh (VD: file nằm trên S3 / CDN của bạn)
  //   const fileUrl = 'http://192.168.5.109:3000/template.docx';

  //   const config = {
  //     document: {
  //       fileType: 'docx',
  //       title: 'sample.docx',
  //       url: fileUrl,     // Document Server sẽ tải file từ đây
  //       permissions: {
  //         edit: true,
  //         download: true
  //       }
  //     },
  //     documentType: 'text',
  //     editorConfig: {
  //       mode: 'edit',
  //       // KHÔNG cấu hình callbackUrl => không autosave
  //       user: { id: 'u1', name: 'Guest User' },
  //       customization: {
  //         autosave: false,           // tắt autosave vì không có callback
  //         hideRightMenu: false,
  //         // Đảm bảo có mục "Download as" để user tải DOCX về
  //         toolbarNoTabs: false
  //       }
  //     },
  //     width: '80%',
  //     height: '1024px'
  //   };

  //   // new DocsAPI.DocEditor('onlyoffice-container', config);
  //   this.onlyofficeFrame = new DocsAPI.DocEditor('onlyoffice-container', config);
  // }
  
}
