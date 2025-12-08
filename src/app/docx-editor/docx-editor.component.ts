import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  selectedFileName: string | null = null;
  currentDocumentUrl: string | null = null;
  private fileCache: Map<string, string> = new Map(); // Cache file URLs

  constructor(
		private propsSvc: PropertiesService,
		private http: HttpClient
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

    // Kiểm tra xem script đã được tải chưa
    if (typeof DocsAPI !== 'undefined') {
      console.log('ONLYOFFICE script already loaded');
      this.initOnlyOffice();
      return;
    }

    // Kiểm tra xem script tag đã tồn tại chưa
    const existingScript = document.querySelector('script[src*="api.js"]');
    if (existingScript) {
      console.log('ONLYOFFICE script tag already exists, waiting for load...');
      existingScript.addEventListener('load', () => {
        this.initOnlyOffice();
      });
      return;
    }

    const script = document.createElement('script');
    // ONLYOFFICE Document Server đang chạy trên port 8080
    script.src = 'http://localhost:8080/web-apps/apps/api/documents/api.js';
    script.async = true;
    script.id = 'onlyoffice-api-script';
    
    script.onload = () => {
      console.log('ONLYOFFICE script loaded successfully');
      this.initOnlyOffice();
    };

    script.onerror = () => {
      console.error('Failed to load ONLYOFFICE script. Please ensure ONLYOFFICE Document Server is running and accessible at:', script.src);
      console.error('You may need to:');
      console.error('1. Start ONLYOFFICE Document Server');
      console.error('2. Update the script URL in docx-editor.component.ts to match your Document Server URL');
    };
    
    document.body.appendChild(script);
  }

  initOnlyOffice(documentUrl?: string, fileName?: string): void {
    // Sử dụng documentUrl được truyền vào hoặc URL mặc định
    // Document Server chạy trong Docker nên cần URL có thể truy cập được từ container
    // Thử nhiều cách: IP thực, host.docker.internal, hoặc endpoint proxy
    let defaultUrl = documentUrl || this.currentDocumentUrl;
    
    if (!defaultUrl) {
      // Sử dụng file từ Document Server container (đã copy vào /var/www/onlyoffice/documentserver/web-apps/)
      // File được serve qua nginx của Document Server (port 80 bên trong container)
      // Document Server sẽ tải file từ chính nó, tránh vấn đề private IP
      defaultUrl = 'http://localhost/web-apps/sample.docx';
      console.log('Using file from Document Server:', defaultUrl);
    }
    
    // Nếu URL chứa IP private (192.168.x.x, 10.x.x.x, 172.x.x.x), Document Server sẽ chặn
    // Thay thế bằng URL từ Document Server (localhost port 80)
    if (defaultUrl.includes('192.168.') || defaultUrl.includes('10.') || defaultUrl.includes('172.16.')) {
      const filename = defaultUrl.split('/').pop() || 'sample.docx';
      defaultUrl = `http://localhost/web-apps/${filename}`;
      console.log('Replaced private IP URL with Document Server URL:', defaultUrl);
    }
    
    const docTitle = fileName || 'sample.docx';
    
    console.log('Loading document from URL:', defaultUrl);
    console.log('Make sure http-server is running on port 3000 and accessible from Docker container');
    
    const config = {
      document: {
        fileType: 'docx',
        title: docTitle,
        url: defaultUrl,
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
        onError: (event: any) => {
          console.error('Editor error:', event.data);
          if (event.data && event.data.errorCode) {
            console.error('Error code:', event.data.errorCode);
            console.error('Error description:', event.data.errorDescription);
          }
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
      if (event.origin !== 'http://localhost:8080') return; // ONLYOFFICE Document Server trên port 8080
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
        'http://localhost:8080'
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFileName = file.name;
      
      // Kiểm tra loại file
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.ms-powerpoint' // .ppt
      ];
      
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(docx?|xlsx?|pptx?)$/i)) {
        alert('Vui lòng chọn file Word, Excel hoặc PowerPoint (.docx, .doc, .xlsx, .xls, .pptx, .ppt)');
        return;
      }

      // Upload file lên server
      this.uploadFile(file);
    }
  }

  uploadFile(file: File): void {
    console.log('Uploading file:', file.name, file.size, 'bytes');
    
    // Trong dev mode, endpoint /api/upload-document không hoạt động
    // Sử dụng cách đơn giản hơn: đọc file và upload lên http-server hoặc sử dụng blob URL
    // Tốt nhất là copy file vào s3-demo/docs/ và load từ đó
    
    // Giải pháp tạm thời: sử dụng FileReader để đọc file và tạo URL
    // Sau đó upload lên http-server ở port 3000 nếu có thể
    this.uploadToHttpServer(file);
  }

  uploadToHttpServer(file: File): void {
    console.log('Preparing to load file:', file.name);
    
    // Đọc file và tạo một URL tạm thời
    // ONLYOFFICE cần một URL thực sự, không thể dùng blob URL
    // Giải pháp: đọc file, convert thành base64, và tạo một endpoint tạm thời
    // Hoặc đơn giản hơn: copy file vào thư mục s3-demo/docs/ và load từ đó
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        console.error('Failed to read file');
        alert('Không thể đọc file. Vui lòng thử lại.');
        return;
      }

      // Tạo blob từ arrayBuffer
      const blob = new Blob([arrayBuffer], { 
        type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      // Tạo blob URL
      const blobUrl = URL.createObjectURL(blob);
      console.log('Created blob URL:', blobUrl);
      
      // Xác định file type từ extension
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let fileType = 'docx';
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        fileType = 'xlsx';
      } else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
        fileType = 'pptx';
      } else if (fileExtension === 'doc') {
        fileType = 'doc';
      }

      // Lưu URL để sử dụng sau
      this.currentDocumentUrl = blobUrl;
      
      // Thử upload file lên http-server ở port 3000
      // Nếu không được, sử dụng blob URL (có thể không hoạt động)
      this.uploadToPort3000(file, blobUrl, fileType);
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      alert('Lỗi khi đọc file. Vui lòng thử lại.');
    };
    
    reader.readAsArrayBuffer(file);
  }

  uploadToPort3000(file: File, blobUrl: string, fileType: string): void {
    console.log('Preparing file for ONLYOFFICE:', file.name);
    
    // ONLYOFFICE cần một URL thực sự, không thể dùng blob URL
    // Giải pháp: Copy file vào thư mục s3-demo/docs/ và load từ http-server
    // Hoặc tạo một endpoint để serve file tạm thời
    
    // Tạm thời: Hướng dẫn user copy file vào s3-demo/docs/
    const fileName = file.name;
    const targetPath = `s3-demo/docs/${fileName}`;
    
    console.log(`File selected: ${fileName}`);
    console.log(`Please copy this file to: ${targetPath}`);
    console.log(`Then load from: http://localhost:3000/${fileName}`);
    
    // Thử load từ http-server ở port 3000
    // Sử dụng IP thực của máy để Document Server có thể truy cập được
    const hostIP = '192.168.1.35'; // IP của máy host
    const httpServerUrl = `http://${hostIP}:3000/${fileName}`;
    
    // Kiểm tra xem file có tồn tại trên http-server không (từ browser, dùng localhost)
    const checkUrl = `http://localhost:3000/${fileName}`;
    this.http.head(checkUrl, { observe: 'response' }).subscribe({
      next: () => {
        // File đã có trên http-server, load từ đó (dùng IP thực cho Document Server)
        console.log('File found on http-server, loading from:', httpServerUrl);
        this.currentDocumentUrl = httpServerUrl;
        this.loadDocument(httpServerUrl, fileName, fileType);
      },
      error: () => {
        // File chưa có trên http-server
        console.warn('File not found on http-server. Using blob URL (may not work).');
        console.log('To fix this:');
        console.log(`1. Copy file to: ${targetPath}`);
        console.log(`2. Ensure http-server is running: cd s3-demo && npx http-server ./docs -p 3000 --cors`);
        console.log(`3. Refresh and select file again`);
        
        // Thử với blob URL (có thể không hoạt động)
        this.currentDocumentUrl = blobUrl;
        this.loadDocument(blobUrl, fileName, fileType);
        
        // Hiển thị hướng dẫn cho user
        alert(`Đã chọn file: ${fileName}\n\n⚠️ Lưu ý: File cần được copy vào thư mục s3-demo/docs/\n\nĐể load file:\n1. Copy file "${fileName}" vào thư mục s3-demo/docs/\n2. Đảm bảo http-server đang chạy: cd s3-demo && npx http-server ./docs -p 3000 --cors\n3. Refresh trang và chọn lại file\n\nHoặc file sẽ được thử load từ blob URL (có thể không hoạt động).`);
      }
    });
  }

  loadDocument(documentUrl: string, fileName: string, fileType: string = 'docx'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Nếu editor chưa được khởi tạo, đợi script load xong
    if (typeof DocsAPI === 'undefined') {
      console.log('Waiting for ONLYOFFICE script to load...');
      setTimeout(() => this.loadDocument(documentUrl, fileName, fileType), 500);
      return;
    }

    // Xác định documentType từ fileType
    let documentType = 'word';
    if (fileType === 'xlsx' || fileType === 'xls') {
      documentType = 'cell';
    } else if (fileType === 'pptx' || fileType === 'ppt') {
      documentType = 'slide';
    }

    // Nếu đã có editor, destroy nó trước
    if (this.docEditor) {
      try {
        this.docEditor.destroyEditor();
      } catch (e) {
        console.log('Destroying old editor...');
      }
    }

    const config = {
      document: {
        fileType: fileType,
        title: fileName,
        url: documentUrl,
        key: 'doc-' + new Date().getTime(),
        permissions: {
          edit: true,
          download: true
        }
      },
      documentType: documentType,
      editorConfig: {
        mode: 'edit',
        user: { id: 'u1', name: 'Guest User' },
        customization: {
          autosave: false,
          hideRightMenu: false,
          toolbarNoTabs: false
        },
        plugins: {
          autostart: ['asc.{123e4567-e89b-12d3-a456-426614174000}'],
          pluginsData: ['http://10.86.35.191:3000/drag-insert-plugin.js']
        }
      },
      width: '100%',
      height: '1024px',
      events: {
        onReady: () => {
          console.log('Editor ready with new document');
        },
        onRequestSaveAs: (event: any) => {
          console.log('SaveAs requested', event);
          const downloadUrl = event.data;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = fileName || 'edited-document.docx';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        },
        onError: (event: any) => {
          console.error('Editor error:', event.data);
          if (event.data && event.data.errorCode) {
            console.error('Error code:', event.data.errorCode);
            console.error('Error description:', event.data.errorDescription);
            
            // Nếu lỗi download failed, thử các URL khác
            if (event.data.errorCode === -4) {
              console.error('Download failed. Trying alternative URLs...');
              // Có thể thử lại với URL khác hoặc hiển thị hướng dẫn
            }
          }
        }
      }
    };

    try {
      console.log('Loading document:', fileName);
      console.log('Document URL:', documentUrl);
      console.log('File type:', fileType);
      console.log('Document type:', documentType);
      console.log('Full config:', JSON.stringify(config, null, 2));
      
      // Clear iframe trước khi khởi tạo editor mới
      const iframe = document.getElementById('onlyofficeFrame');
      if (iframe) {
        iframe.innerHTML = '';
      }
      
      this.docEditor = new DocsAPI.DocEditor('onlyofficeFrame', config);
      console.log('Editor initialized successfully');
    } catch (error) {
      console.error('Failed to load document:', error);
      console.error('Error details:', error);
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
