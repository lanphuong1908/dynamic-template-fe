import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PropertiesService } from '../core/services/properties.service';
import { CustomerProperty } from '../core/models/property.model';
import { environment } from '../../environments/environment';

declare const DocsAPI: any; // từ script api.js

@Component({
  selector: 'app-docx-editor',
  standalone: true,
  imports: [DragDropModule, CommonModule, FormsModule],
  templateUrl: './docx-editor.component.html',
  styleUrl: './docx-editor.component.scss'
})
export class DocxEditorComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  @ViewChild('onlyofficeFrame') onlyofficeFrame!: ElementRef;
  private docEditor: any;

  properties: CustomerProperty[] = [];
  filteredProperties: CustomerProperty[] = [];
  isLoadingLeft = false;
  selectedFileName: string | null = null;
  currentDocumentUrl: string | null = null;
  private fileCache: Map<string, string> = new Map(); // Cache file URLs
  private blobUrls: Set<string> = new Set(); // Track blob URLs for cleanup
  
  // Document type selection
  documentType: 'word' | 'cell' = 'word'; // 'word' cho Word, 'cell' cho Excel
  currentFileType: string = 'docx'; // 'docx' hoặc 'xlsx'
  
  // Search and filter
  searchText: string = '';
  selectedProperty: string | null = null;
  
  // Data type selection - mỗi property có kiểu dữ liệu riêng
  propertyDataTypes: Map<string, string> = new Map(); // Map<propertyCode, dataType>
  dataTypes: string[] = ['string', 'number', 'date', 'datetime', 'boolean', 'currency', 'percentage', 'text'];
  
  // Lấy kiểu dữ liệu cho một property (mặc định là 'string')
  getDataTypeForProperty(propertyCode: string): string {
    return this.propertyDataTypes.get(propertyCode) || 'string';
  }
  
  // Set kiểu dữ liệu cho một property
  setDataTypeForProperty(propertyCode: string, dataType: string): void {
    this.propertyDataTypes.set(propertyCode, dataType);
  }

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
            this.filteredProperties = res; // Initialize filtered list
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
    const existingScript = document.querySelector('script[src*="api.js"]') as HTMLScriptElement;
    if (existingScript) {
      console.log('ONLYOFFICE script tag already exists');
      // Check if script is already loaded by checking if DocsAPI is available
      // If not, check if script has onload handler (indicates it might be loading)
      const hasLoadHandler = existingScript.onload !== null;
      
      if (typeof DocsAPI !== 'undefined') {
        // Script already loaded and DocsAPI is available
        this.initOnlyOffice();
      } else if (!hasLoadHandler) {
        // Script might be loading or already loaded but DocsAPI not ready yet
        // Wait a bit and check again
        setTimeout(() => {
          if (typeof DocsAPI !== 'undefined') {
            this.initOnlyOffice();
          } else {
            // If still not available, add listener (script might still be loading)
            existingScript.addEventListener('load', () => {
              this.initOnlyOffice();
            });
          }
        }, 100);
      } else {
        // Script is loading, add listener
        existingScript.addEventListener('load', () => {
          this.initOnlyOffice();
        });
      }
      return;
    }

    const script = document.createElement('script');
    // ONLYOFFICE Document Server URL from environment
    script.src = `${environment.onlyofficeServerUrl}/web-apps/apps/api/documents/api.js`;
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

  selectDocumentType(type: 'word' | 'cell'): void {
    if (this.documentType === type) return; // Đã chọn rồi thì không làm gì
    
    console.log('Changing document type from', this.documentType, 'to', type);
    
    this.documentType = type;
    this.currentFileType = type === 'word' ? 'docx' : 'xlsx';
    this.selectedFileName = null;
    this.currentDocumentUrl = null;
    
    console.log('Document type changed to:', type);
    console.log('Current file type:', this.currentFileType);
    
    // Tạo document mới với loại đã chọn
    this.createNewDocument();
  }

  createNewDocument(): void {
    // Tạo document mới dựa trên loại đã chọn - sử dụng file sample có sẵn
    const fileName = this.documentType === 'word' ? 'sample.docx' : 'sample.xlsx';
    const fileType = this.currentFileType;
    
    // Sử dụng file từ http-server (port 3000) chạy trên máy host
    // Document Server trong Docker cần dùng host.docker.internal để truy cập máy host
    // Yêu cầu: cd s3-demo && npx http-server ./docs -p 3000 --cors
    const sampleDocUrl = `http://host.docker.internal:3000/${fileName}`;
    
    console.log('Creating new document:', fileName, 'Type:', this.documentType);
    console.log('Loading from URL:', sampleDocUrl);
    console.log('Note: Ensure http-server is running: cd s3-demo && npx http-server ./docs -p 3000 --cors');
    
    this.loadDocument(sampleDocUrl, fileName, fileType);
  }

  initOnlyOffice(documentUrl?: string, fileName?: string, fileType?: string): void {
    // Sử dụng documentUrl được truyền vào hoặc URL mặc định
    // Document Server chạy trong Docker nên cần URL có thể truy cập được từ container
    // Thử nhiều cách: IP thực, host.docker.internal, hoặc endpoint proxy
    let defaultUrl = documentUrl || this.currentDocumentUrl;
    
    // Xác định fileType và documentType
    const docFileType = fileType || this.currentFileType;
    const docDocumentType = this.documentType;
    
    if (!defaultUrl) {
      // Sử dụng file từ http-server (port 3000) chạy trên máy host
      // Document Server trong Docker cần dùng host.docker.internal để truy cập máy host
      // Yêu cầu: cd s3-demo && npx http-server ./docs -p 3000 --cors
      const defaultFileName = docFileType === 'docx' || docFileType === 'doc' ? 'sample.docx' : 'sample.xlsx';
      defaultUrl = `http://host.docker.internal:3000/${defaultFileName}`;
      console.log('Using file from local http-server:', defaultUrl);
      console.log('Note: Ensure http-server is running: cd s3-demo && npx http-server ./docs -p 3000 --cors');
    }
    
    // Nếu URL chứa IP private (192.168.x.x, 10.x.x.x, 172.x.x.x), Document Server sẽ chặn
    // Thay thế bằng URL từ Document Server (localhost port 80)
    if (defaultUrl.includes('192.168.') || defaultUrl.includes('10.') || defaultUrl.includes('172.16.')) {
      const filename = defaultUrl.split('/').pop() || (docFileType === 'docx' ? 'sample.docx' : 'sample.xlsx');
      defaultUrl = `http://localhost/web-apps/${filename}`;
      console.log('Replaced private IP URL with Document Server URL:', defaultUrl);
    }
    
    const docTitle = fileName || (docFileType === 'docx' ? 'sample.docx' : 'sample.xlsx');
    
    console.log('Loading document from URL:', defaultUrl);
    console.log('Document type:', docDocumentType, 'File type:', docFileType);
    
    const config = {
      document: {
        fileType: docFileType,
        title: docTitle,
        url: defaultUrl,
        key: 'doc-' + new Date().getTime(), // Key duy nhất để tránh cache
        permissions: {
          edit: true,
          download: true,
          print: true
        },
        // Thêm callback URL để nhận file sau khi save (chỉ khi có server)
        // callbackUrl: window.location.origin + '/api/save-document'
      },
      documentType: docDocumentType, // 'word' hoặc 'cell'
      editorConfig: {
        mode: 'edit',
        user: { id: 'u1', name: 'Guest User' },
        customization: {
          autosave: false,
          hideRightMenu: false,
          toolbarNoTabs: false,
          hideDownload: false, // Đảm bảo nút download hiển thị
          customer: {
            address: 'Hanoi, Vietnam',
            info: 'MSB - Maritime Bank',
            logo: 'http://localhost:3000/logo.png?v=' + new Date().getTime(),
            mail: 'contact@msb.com.vn',
            name: 'MSB Editor',
            www: 'www.msb.com.vn'
          },
          logo: {
            image: "http://localhost:3000/logo.png?v=" + new Date().getTime(),
            imageEmbedded: "http://localhost:3000/logo.png?v=" + new Date().getTime(),
            url: "https://www.msb.com.vn"
          },
          uiTheme: 'theme-classic-light', // Set theme to light
        }
        // Loại bỏ plugins config vì URL không hợp lệ
      },
      width: '100%',
      height: '1024px',
      events: {
        onReady: () => {
          console.log('Editor ready');
          // Lưu reference đến editor để sử dụng sau
          console.log('DocEditor instance:', this.docEditor);
          console.log('DocEditor methods:', Object.keys(this.docEditor || {}));
          
          // Log các methods có sẵn để debug
          if (this.docEditor) {
            console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.docEditor)));
            console.log('Has downloadAs?', typeof this.docEditor.downloadAs);
            console.log('Has createConnector?', typeof this.docEditor.createConnector);
          }
          
          // Kiểm tra iframe sau khi editor ready
          setTimeout(() => {
            const iframe = document.getElementById('onlyofficeFrame');
            console.log('Iframe after ready:', !!iframe, iframe?.id);
          }, 1000);
        },
        onRequestSaveAs: (event: any) => {
          console.log('SaveAs requested', event);
          console.log('Event data:', event.data);
          console.log('Event type:', typeof event.data);
          
          // Lấy dữ liệu file - có thể là URL hoặc base64
          const downloadData = event.data;
          
          if (!downloadData) {
            console.error('No download data in event');
            alert('Không có dữ liệu để download. Vui lòng thử lại.');
            return;
          }

          this.handleDownloadFromEvent({ url: downloadData, fileType: this.documentType === 'word' ? 'docx' : 'xlsx' });
        },
        onDownloadAs: (event: any) => {
          console.log('onDownloadAs event received:', event);
          console.log('Event data:', event.data);
          
          if (event.data && event.data.url) {
            console.log('✅ Handling onDownloadAs event');
            this.handleDownloadFromEvent(event.data);
          } else {
            console.warn('onDownloadAs event missing URL:', event);
          }
        },
        onDocumentStateChange: (event: any) => {
          console.log('Document state changed:', event.data);
        },
        onError: (event: any) => {
          console.error('Editor error:', event.data);
          if (event.data && event.data.errorCode) {
            console.error('Error code:', event.data.errorCode);
            console.error('Error description:', event.data.errorDescription);
            
            // Handle Download failed error (errorCode -4)
            if (event.data.errorCode === -4) {
              console.error('Download failed: Document Server cannot download file from URL');
              console.error('URL:', defaultUrl);
              console.error('Solution: Copy file into Document Server container:');
              console.error('1. docker cp s3-demo/docs/sample.docx <container_name>:/var/www/onlyoffice/documentserver/web-apps/');
              console.error('2. docker cp s3-demo/docs/sample.xlsx <container_name>:/var/www/onlyoffice/documentserver/web-apps/');
              console.error('3. Restart Document Server if needed');
              
              alert('Lỗi: Không thể tải file từ URL.\n\n' +
                    'Giải pháp: Copy file vào Document Server container:\n' +
                    'docker cp s3-demo/docs/sample.docx <container_name>:/var/www/onlyoffice/documentserver/web-apps/\n' +
                    'docker cp s3-demo/docs/sample.xlsx <container_name>:/var/www/onlyoffice/documentserver/web-apps/');
            }
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

    const onlyofficeOrigin = new URL(environment.onlyofficeServerUrl).origin;
    window.addEventListener('message', (event) => {
      if (event.origin !== onlyofficeOrigin) return;
      console.log('From iframe:', event.data);
      
      // Xử lý event onDownloadAs từ ONLYOFFICE
      if (event.data && typeof event.data === 'object') {
        const data = event.data;
        
        // Kiểm tra event onDownloadAs
        if (data.event === 'onDownloadAs' && data.data && data.data.url) {
          console.log('✅ Received onDownloadAs event:', data.data);
          this.handleDownloadFromEvent(data.data);
        }
      }
      
      // Xử lý nếu data là string JSON
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'onDownloadAs' && parsed.data && parsed.data.url) {
            console.log('✅ Received onDownloadAs event (string):', parsed.data);
            this.handleDownloadFromEvent(parsed.data);
          }
        } catch (e) {
          // Không phải JSON, bỏ qua
        }
      }
    });
  }
  
  private handleDownloadFromEvent(data: any): void {
    const downloadUrl = data.url;
    const fileType = data.fileType || (this.documentType === 'word' ? 'docx' : 'xlsx');
    
    if (!downloadUrl) {
      console.error('No download URL in event data');
      return;
    }
    
    console.log('Downloading file from URL:', downloadUrl);
    console.log('File type:', fileType);
    
    try {
      // Tạo link download và trigger click
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = this.selectedFileName 
        ? this.selectedFileName.replace(/\.[^.]+$/, '') + '-edited.' + fileType
        : `edited-document.${fileType}`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Đợi một chút trước khi remove
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);
      
      this.showNotification(`✓ Đã download ${fileType.toUpperCase()} thành công!`, 'success');
    } catch (error) {
      console.error('Error creating download link:', error);
      // Fallback: Mở URL trong tab mới
      window.open(downloadUrl, '_blank');
      this.showNotification(`✓ Đã mở file ${fileType.toUpperCase()} trong tab mới`, 'info');
    }
  }

  onDragStarted(property: any): void {
    console.log('Drag started:', property);
  }

  getFormattedPropertyCode(propertyCode: string, dataType?: string): string {
    // Format: ${dataType.propertyCode}
    const dt = dataType || this.getDataTypeForProperty(propertyCode);
    return '${' + dt + '.' + propertyCode + '}';
  }

  onItemClick(property: any): void {
    // Không làm gì khi click vào item, chỉ highlight
    console.log('Item clicked:', property);
    this.selectedProperty = property.code;
    setTimeout(() => {
      this.selectedProperty = null;
    }, 500);
  }
  
  onCopyClick(event: Event, property: any): void {
    // Ngăn event bubble lên item
    event.stopPropagation();
    
    console.log('Copy icon clicked:', property);
    // Highlight selected property
    this.selectedProperty = property.code;
    setTimeout(() => {
      this.selectedProperty = null;
    }, 500);
    
    // Copy vào clipboard với format: ${dataType.propertyCode}
    const dataType = this.getDataTypeForProperty(property.code);
    const textToCopy = this.getFormattedPropertyCode(property.code, dataType);
    navigator.clipboard.writeText(textToCopy).then(() => {
      console.log('✅ Đã copy vào clipboard:', textToCopy);
      this.showNotification(`✓ Đã copy: ${textToCopy} → Nhấn Ctrl+V để paste`, 'success');
    }).catch((err) => {
      console.error('❌ Lỗi khi copy:', err);
      // Fallback cho trình duyệt không hỗ trợ Clipboard API
      this.fallbackCopyTextToClipboard(textToCopy);
    });
  }
  
  onDataTypeChange(event: Event, property: any): void {
    // Ngăn event bubble lên item
    event.stopPropagation();
    
    const selectElement = event.target as HTMLSelectElement;
    const selectedDataType = selectElement.value;
    this.setDataTypeForProperty(property.code, selectedDataType);
    console.log(`Đã đổi kiểu dữ liệu của ${property.code} thành: ${selectedDataType}`);
  }
  
  // Fallback method cho trình duyệt cũ không hỗ trợ Clipboard API
  private fallbackCopyTextToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('✅ Đã copy (fallback):', text);
        this.showNotification(`✓ Đã copy: ${text} → Nhấn Ctrl+V để paste`, 'success');
      } else {
        console.error('❌ Fallback copy failed');
        alert(`Copy thủ công: ${text}`);
      }
    } catch (err) {
      console.error('❌ Fallback copy error:', err);
      alert(`Copy thủ công: ${text}`);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  filterProperties(): void {
    if (!this.searchText || this.searchText.trim() === '') {
      this.filteredProperties = this.properties;
      return;
    }
    
    const searchLower = this.searchText.toLowerCase().trim();
    this.filteredProperties = this.properties.filter(p => 
      p.code.toLowerCase().includes(searchLower) ||
      (p.name && p.name.toLowerCase().includes(searchLower)) ||
      (p.description && p.description.toLowerCase().includes(searchLower))
    );
  }

  clearSearch(): void {
    this.searchText = '';
    this.filterProperties();
  }

  onItemHover(event: MouseEvent, isEntering: boolean): void {
    const target = event.currentTarget as HTMLElement;
    if (target) {
      target.style.background = isEntering ? '#e0e0e0' : '#f5f5f5';
    }
  }

  onButtonHover(event: MouseEvent, color: string): void {
    const target = event.currentTarget as HTMLElement;
    if (target) {
      target.style.background = color;
    }
  }

  onDropToEditor(event: CdkDragDrop<any>) {
    console.log('Drop event:', event);
    const dragData = event.item.data;
    console.log('Dropped data:', dragData);
    
    // Chèn text vào document bằng ONLYOFFICE API
    // dragData.content đã được format sẵn từ cdkDragData
    if (dragData && dragData.content) {
      this.insertTextToDocument(dragData.content);
    }
  }

  insertTextToDocument(text: string): void {
    if (!this.docEditor) {
      console.error('Editor not initialized');
      alert('Editor chưa sẵn sàng. Vui lòng đợi document load xong.');
      return;
    }

    try {
      // Sử dụng ONLYOFFICE connector API (Developer Edition)
      // Lấy connector từ editor
      const connector = this.docEditor.createConnector();
      
      if (connector && typeof connector.executeMethod === 'function') {
        console.log('✅ Using Developer Edition API - Inserting text:', text);
        
        // Focus vào iframe để đảm bảo cursor được đặt
        const iframe = document.getElementById('onlyofficeFrame') as HTMLIFrameElement;
        if (iframe) {
          iframe.focus();
        }
        
        // Đợi một chút để đảm bảo focus được áp dụng
        setTimeout(() => {
          // Sử dụng executeMethod để chèn text tại vị trí con trỏ
          // Tham số: [text, select] - select = false để không select text sau khi chèn
          connector.executeMethod('InsertText', [text, false], (result: any) => {
            console.log('✅ Text inserted successfully:', text, result);
            // Hiển thị notification
            this.showNotification(`✓ Đã chèn: ${text}`, 'success');
          });
        }, 200);
      } else {
        console.warn('⚠️ createConnector not available - may be Community Edition');
        // Fallback: Copy vào clipboard và yêu cầu user paste
        navigator.clipboard.writeText(text).then(() => {
          this.showNotification(`📋 Đã copy: ${text} → Nhấn Ctrl+V để paste`, 'info');
        }).catch(() => {
          alert(`Copy thủ công: ${text}`);
        });
      }
    } catch (error) {
      console.error('❌ Error inserting text:', error);
      // Fallback: Copy vào clipboard
      navigator.clipboard.writeText(text).then(() => {
        this.showNotification(`📋 Đã copy: ${text} → Nhấn Ctrl+V để paste`, 'info');
      }).catch(() => {
        alert(`Copy thủ công: ${text}`);
      });
    }
  }

  private showNotification(message: string, type: 'success' | 'info' = 'info'): void {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-size: 14px;
      max-width: 400px;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  sendToIframe(data: any): void {
    console.log('Sending to iframe:', data);
    
    const onlyofficeOrigin = new URL(environment.onlyofficeServerUrl).origin;
    
    // Tìm iframe của ONLYOFFICE
    const iframe = document.querySelector('iframe[name="frameEditor"]') as HTMLIFrameElement;
    
    if (iframe?.contentWindow) {
      console.log('Found ONLYOFFICE iframe, sending message');
      iframe.contentWindow.postMessage(
        {
          type: 'insertItem',
          data: data
        },
        onlyofficeOrigin
      );
    } else if (this.onlyofficeFrame?.nativeElement?.contentWindow) {
      console.log('Using ViewChild iframe');
      this.onlyofficeFrame.nativeElement.contentWindow.postMessage(
        {
          type: 'insertItem',
          data: data
        },
        onlyofficeOrigin
      );
    } else {
      console.error('Iframe contentWindow not available');
      alert('Không thể chèn text. Vui lòng thử lại sau khi document load xong.');
    }
  }

  saveDocument(): void {
    console.log('Save document clicked');
    
    if (!this.docEditor) {
      console.warn('Editor not ready');
      alert('Editor chưa sẵn sàng. Vui lòng đợi document load xong.');
      return;
    }

    try {
      // Download với format tương ứng (docx hoặc xlsx)
      const format = this.documentType === 'word' ? 'docx' : 'xlsx';
      console.log('Downloading as', format.toUpperCase(), '...');
      
      // Cách 1: Thử dùng method downloadAs() trực tiếp (nếu có)
      if (typeof this.docEditor.downloadAs === 'function') {
        console.log('✅ Using downloadAs() method');
        try {
          this.docEditor.downloadAs(format);
          this.showNotification(`✓ Đang download ${format.toUpperCase()}...`, 'success');
          return;
        } catch (e) {
          console.log('downloadAs() method failed:', e);
        }
      }
      
      // Cách 2: Thử dùng Developer Edition API với createConnector
      if (typeof this.docEditor.createConnector === 'function') {
        try {
          const connector = this.docEditor.createConnector();
          if (connector && typeof connector.executeMethod === 'function') {
            console.log('✅ Using Developer Edition API - DownloadAs');
            connector.executeMethod('DownloadAs', [format], (result: any) => {
              console.log('Download triggered:', result);
              // Nếu result là undefined, có thể đã trigger download thành công
              this.showNotification(`✓ Đang download ${format.toUpperCase()}...`, 'success');
            });
            return;
          }
        } catch (e) {
          console.log('Developer Edition API failed:', e);
        }
      }
      
      // Cách 3: Trigger download bằng cách gửi message vào iframe
      const iframe = document.getElementById('onlyofficeFrame') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        console.log('✅ Trying to trigger download via postMessage');
        const onlyofficeOrigin = new URL(environment.onlyofficeServerUrl).origin;
        
        // Thử trigger download bằng postMessage
        iframe.contentWindow.postMessage(
          JSON.stringify({
            type: 'download',
            format: format
          }),
          onlyofficeOrigin
        );
        
        // Hoặc thử cách khác
        setTimeout(() => {
          iframe.contentWindow?.postMessage(
            {
              type: 'action',
              actiontype: 'download',
              format: format
            },
            onlyofficeOrigin
          );
        }, 100);
        
        this.showNotification(`✓ Đang download ${format.toUpperCase()}...`, 'success');
        return;
      }
      
      // Fallback: Hướng dẫn user dùng nút Download trong toolbar
      console.warn('⚠️ All download methods failed');
      alert('Vui lòng sử dụng nút "Download" trong toolbar của editor (góc trên bên phải) để tải file về.');
      
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Lỗi khi download. Vui lòng sử dụng nút Download trong toolbar của editor.');
    }
  }

  triggerDownloadFromToolbar(format: string): void {
    console.log('Triggering download, format:', format);
    
    // Đợi một chút để đảm bảo iframe đã load
    this.waitForIframeAndDownload(format, 0);
  }

  waitForIframeAndDownload(format: string, attempt: number): void {
    const maxAttempts = 10;
    
    if (attempt >= maxAttempts) {
      console.error('Iframe not ready after', maxAttempts, 'attempts');
      alert('Editor chưa sẵn sàng. Vui lòng đợi document load xong và thử lại.');
      return;
    }
    
    // Tìm iframe của ONLYOFFICE - thử nhiều cách
    let targetIframe: HTMLIFrameElement | null = null;
    
    // Cách 1: Tìm bằng ID
    targetIframe = document.getElementById('onlyofficeFrame') as HTMLIFrameElement;
    
    // Cách 2: Tìm bằng ViewChild
    if (!targetIframe && this.onlyofficeFrame?.nativeElement) {
      targetIframe = this.onlyofficeFrame.nativeElement;
    }
    
    // Cách 3: Tìm bằng querySelector
    if (!targetIframe) {
      targetIframe = document.querySelector('iframe#onlyofficeFrame') as HTMLIFrameElement;
    }
    
    // Cách 4: Tìm bất kỳ iframe nào chứa ONLYOFFICE
    if (!targetIframe) {
      const onlyofficeOrigin = new URL(environment.onlyofficeServerUrl).origin;
      const allIframes = document.querySelectorAll('iframe');
      for (let i = 0; i < allIframes.length; i++) {
        const iframe = allIframes[i];
        if (iframe.src && (iframe.src.includes(onlyofficeOrigin) || iframe.src.includes('onlyoffice'))) {
          targetIframe = iframe;
          break;
        }
      }
    }
    
    if (!targetIframe) {
      console.log('Iframe not found, retrying... attempt', attempt + 1);
      setTimeout(() => this.waitForIframeAndDownload(format, attempt + 1), 200);
      return;
    }
    
    // Kiểm tra contentWindow
    if (!targetIframe.contentWindow) {
      console.log('Iframe contentWindow is null, retrying... attempt', attempt + 1);
      setTimeout(() => this.waitForIframeAndDownload(format, attempt + 1), 200);
      return;
    }

    const contentWindow = targetIframe.contentWindow;
    console.log('Iframe found and ready, triggering download');
    console.log('Iframe src:', targetIframe.src);
    console.log('Iframe id:', targetIframe.id);
    
    try {
      // Cách 1: Thử trigger click vào nút download trong toolbar (nếu không cross-origin)
      const iframeDoc = targetIframe.contentDocument || contentWindow.document;
      if (iframeDoc) {
        // Tìm nút download trong toolbar của ONLYOFFICE
        const selectors = [
          '[data-id="download"]',
          '.asc-window-download',
          '[title*="Download"]',
          '[aria-label*="Download"]',
          '.asc-window-menu-download',
          'button[data-id="download"]'
        ];
        
        for (const selector of selectors) {
          const downloadBtn = iframeDoc.querySelector(selector) as HTMLElement;
          if (downloadBtn) {
            console.log('Found download button with selector:', selector);
            downloadBtn.click();
            return;
          }
        }
      }
    } catch (e) {
      console.log('Cannot access iframe document (cross-origin), using postMessage');
    }

    // Cách 2: Sử dụng postMessage để trigger download - ONLYOFFICE API
    console.log('Triggering download via postMessage, format:', format);
    
    const onlyofficeOrigin = new URL(environment.onlyofficeServerUrl).origin;
    
    // Gửi message để trigger download
    contentWindow.postMessage(
      JSON.stringify({
        type: 'download',
        format: format
      }),
      onlyofficeOrigin
    );

    // Hoặc thử trigger save event
    contentWindow.postMessage(
      {
        type: 'action',
        actiontype: 'download',
        format: format
      },
      onlyofficeOrigin
    );

    // Hoặc trigger save để trigger onRequestSaveAs
    contentWindow.postMessage(
      {
        type: 'save',
        format: format
      },
      onlyofficeOrigin
    );

    // Fallback: Hướng dẫn user sử dụng nút trong toolbar
    setTimeout(() => {
      console.warn('Download may not have triggered. Please use the Download button in the ONLYOFFICE toolbar.');
    }, 500);
  }

  downloadAsPdf(): void {
    console.log('Download PDF clicked');
    
    if (!this.docEditor) {
      console.warn('Editor not ready');
      alert('Editor chưa sẵn sàng. Vui lòng đợi document load xong.');
      return;
    }

    // Chỉ cho phép download PDF với Word documents
    if (this.documentType !== 'word') {
      alert('PDF chỉ có thể download từ Word documents.');
      return;
    }

    try {
      console.log('Downloading as PDF...');
      
      // Cách 1: Thử dùng method downloadAs() trực tiếp (nếu có)
      if (typeof this.docEditor.downloadAs === 'function') {
        console.log('✅ Using downloadAs() method for PDF');
        this.docEditor.downloadAs('pdf');
        this.showNotification('✓ Đang download PDF...', 'success');
        return;
      }
      
      // Cách 2: Thử dùng Developer Edition API với createConnector
      if (typeof this.docEditor.createConnector === 'function') {
        try {
          const connector = this.docEditor.createConnector();
          if (connector && typeof connector.executeMethod === 'function') {
            console.log('✅ Using Developer Edition API - DownloadAs PDF');
            connector.executeMethod('DownloadAs', ['pdf'], (result: any) => {
              console.log('PDF download triggered:', result);
              // Nếu result là undefined, có thể đã trigger download thành công
              this.showNotification('✓ Đang download PDF...', 'success');
            });
            return;
          }
        } catch (e) {
          console.log('Developer Edition API failed:', e);
        }
      }
      
      // Fallback: Hướng dẫn user
      console.warn('⚠️ Direct PDF download methods not available');
      alert('Vui lòng sử dụng nút "Download" trong toolbar của editor và chọn định dạng PDF để tải file về.');
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Lỗi khi download PDF. Vui lòng sử dụng nút Download trong toolbar của editor.');
    }
  }

  triggerDownloadFromIframe(format: string): void {
    // Tìm iframe của ONLYOFFICE
    const iframe = document.getElementById('onlyofficeFrame') as HTMLIFrameElement;
    const targetIframe = iframe || this.onlyofficeFrame?.nativeElement;
    
    if (!targetIframe) {
      console.error('Iframe not found for download');
      alert('Không thể tìm thấy editor. Vui lòng refresh trang và đợi document load xong.');
      return;
    }
    
    const contentWindow = targetIframe.contentWindow;
    if (!contentWindow) {
      console.error('Iframe contentWindow is null');
      alert('Editor chưa sẵn sàng. Vui lòng đợi document load xong.');
      return;
    }
    
    console.log('Triggering download from iframe, format:', format);
    
    const onlyofficeOrigin = new URL(environment.onlyofficeServerUrl).origin;
    
    // Gửi message để trigger download - ONLYOFFICE API
    contentWindow.postMessage(
      JSON.stringify({
        type: 'download',
        format: format
      }),
      onlyofficeOrigin
    );
    
    // Hoặc thử cách khác
    contentWindow.postMessage(
      {
        type: 'action',
        actiontype: 'download',
        format: format
      },
      onlyofficeOrigin
    );
    
    // Hoặc trigger save event
    setTimeout(() => {
      if (contentWindow) {
        contentWindow.postMessage(
          {
            type: 'save',
            format: format
          },
          onlyofficeOrigin
        );
      }
    }, 100);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFileName = file.name;
      
      // Xác định loại file và cập nhật documentType
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        this.documentType = 'word';
        this.currentFileType = fileName.endsWith('.docx') ? 'docx' : 'doc';
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        this.documentType = 'cell';
        this.currentFileType = fileName.endsWith('.xlsx') ? 'xlsx' : 'xls';
      } else {
        alert('Vui lòng chọn file Word (.docx, .doc) hoặc Excel (.xlsx, .xls)');
        return;
      }
      
      console.log('File type detected:', this.documentType, 'File extension:', this.currentFileType);

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
      
      // Revoke previous blob URLs to prevent memory leaks
      this.revokeBlobUrls();
      
      // Tạo blob URL
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrls.add(blobUrl);
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
    // File cần có sẵn trong thư mục s3-demo/docs/ và được serve qua http-server
    
    const fileName = file.name;
    const targetPath = `s3-demo/docs/${fileName}`;
    
    console.log(`File selected: ${fileName}`);
    console.log(`Checking if file exists at: http://localhost:3000/${fileName}`);
    
    // URL cho Document Server trong Docker (dùng host.docker.internal để truy cập máy host)
    const dockerUrl = `http://host.docker.internal:3000/${fileName}`;
    
    // Kiểm tra xem file có tồn tại trên http-server không (từ browser, dùng localhost)
    const checkUrl = `http://localhost:3000/${fileName}`;
    this.http.head(checkUrl, { observe: 'response' }).subscribe({
      next: () => {
        // File đã có trên http-server, load từ đó
        // Dùng host.docker.internal để Document Server có thể truy cập từ trong Docker
        console.log('File found on http-server, loading from:', dockerUrl);
        this.currentDocumentUrl = dockerUrl;
        this.loadDocument(dockerUrl, fileName, fileType);
      },
      error: () => {
        // File chưa có trên http-server
        console.warn('File not found on http-server.');
        console.log('To fix this:');
        console.log(`1. Copy file to: ${targetPath}`);
        console.log(`2. Ensure http-server is running: cd s3-demo && npx http-server ./docs -p 3000 --cors`);
        console.log(`3. Refresh and select file again`);
        
        // Hiển thị hướng dẫn cho user
        alert(`File "${fileName}" chưa có trong thư mục s3-demo/docs/\n\nĐể mở file:\n1. Copy file "${fileName}" vào thư mục s3-demo/docs/\n2. Đảm bảo http-server đang chạy\n3. Refresh trang và chọn lại file`);
      }
    });
  }

  loadDocument(documentUrl: string, fileName: string, fileType: string = 'docx'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Revoke previous blob URLs before loading new document
    this.revokeBlobUrls();

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
        }
      },
      width: '100%',
      height: '1024px',
      events: {
        onReady: () => {
          console.log('Editor ready with new document');
          console.log('DocEditor instance:', this.docEditor);
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
            
            // Handle Download failed error (errorCode -4)
            if (event.data.errorCode === -4) {
              console.error('Download failed: Document Server cannot download file from URL');
              console.error('Document URL:', documentUrl);
              console.error('Solution: Copy file into Document Server container:');
              console.error('1. docker cp s3-demo/docs/sample.docx <container_name>:/var/www/onlyoffice/documentserver/web-apps/');
              console.error('2. docker cp s3-demo/docs/sample.xlsx <container_name>:/var/www/onlyoffice/documentserver/web-apps/');
              console.error('3. Restart Document Server if needed');
              
              alert('Lỗi: Không thể tải file từ URL.\n\n' +
                    'Giải pháp: Copy file vào Document Server container:\n' +
                    'docker cp s3-demo/docs/sample.docx <container_name>:/var/www/onlyoffice/documentserver/web-apps/\n' +
                    'docker cp s3-demo/docs/sample.xlsx <container_name>:/var/www/onlyoffice/documentserver/web-apps/');
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


  /**
   * Get host IP from environment or window.location
   * Falls back to localhost if not configured
   */
  private getHostIP(): string {
    // Use environment configuration first
    if (environment.hostIP && environment.hostIP !== 'localhost') {
      return environment.hostIP;
    }
    
    // Try to get from window.location.hostname
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // If it's localhost or 127.0.0.1, use localhost
      // In production, this should be configured via environment.hostIP
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'localhost';
      }
      return hostname;
    }
    return 'localhost';
  }

  /**
   * Revoke all blob URLs to prevent memory leaks
   */
  private revokeBlobUrls(): void {
    this.blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking blob URL:', e);
      }
    });
    this.blobUrls.clear();
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
