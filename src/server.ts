import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const uploadsFolder = resolve(serverDistFolder, '../uploads');
// Fix: Resolve public folder from project root, not from dist folder
// serverDistFolder is at dist/dynamic-template-fe/server
// We need to go up to project root: ../../../
const projectRoot = resolve(serverDistFolder, '../../../');
const publicFolder = resolve(projectRoot, 'public');

// Đảm bảo thư mục uploads tồn tại - await during initialization
let uploadsFolderReady: Promise<string | undefined>;
if (!existsSync(uploadsFolder)) {
  uploadsFolderReady = mkdir(uploadsFolder, { recursive: true }).catch((error) => {
    console.error('Failed to create uploads folder:', error);
    throw error;
  });
} else {
  uploadsFolderReady = Promise.resolve(undefined);
}

const app = express();
const angularApp = new AngularNodeAppEngine();

// Cấu hình multer để lưu file vào memory
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Serve uploaded files from /uploads
 */
app.use('/uploads', express.static(uploadsFolder, {
  maxAge: '1h',
  index: false,
  redirect: false,
}));

/**
 * Serve sample documents from /public
 */
app.use('/sample-docs', express.static(publicFolder, {
  maxAge: '1h',
  index: false,
  redirect: false,
  setHeaders: (res, path) => {
    // Set CORS headers để Document Server có thể truy cập
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }
}));

/**
 * Proxy endpoint để serve file từ http-server (port 3000)
 * Document Server không cho phép truy cập private IP, nên cần proxy qua public URL
 */
app.get('/api/proxy-document/:filename', async (req, res) => {
  let filename = req.params.filename;
  
  // Security: Prevent path traversal attacks
  // Remove any path traversal sequences and normalize the path
  filename = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // Additional validation: ensure filename is safe
  if (!filename || filename.length === 0 || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  // Only allow alphanumeric, dots, hyphens, and underscores
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename characters' });
  }
  
  const httpServerUrl = `http://localhost:3000/${filename}`;
  
  try {
    // Sử dụng fetch built-in của Node.js 18+
    const response = await fetch(httpServerUrl);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'File not found' });
    }
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Failed to proxy file' });
  }
});

/**
 * Upload endpoint for documents
 */
app.post('/api/upload-document', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Ensure uploads folder exists before writing
    await uploadsFolderReady;
    
    // Sanitize filename to prevent path traversal
    const sanitizedOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${sanitizedOriginalName}`;
    const filePath = resolve(uploadsFolder, fileName);
    
    // Additional security: ensure the resolved path is within uploadsFolder
    if (!filePath.startsWith(uploadsFolder)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    await writeFile(filePath, req.file.buffer);
    
    // Trả về URL để truy cập file
    const fileUrl = `/uploads/${fileName}`;
    return res.json({ url: fileUrl, fileName: req.file.originalname });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * Callback endpoint for ONLYOFFICE to save document
 */
app.post('/api/save-document', async (req, res) => {
  try {
    console.log('Save document callback received');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    // ONLYOFFICE sẽ gửi file data qua body
    const fileData = req.body;
    
    if (!fileData || !fileData.url) {
      console.error('No file data in callback');
      return res.status(400).json({ error: 'No file data' });
    }

    // Download file từ ONLYOFFICE
    const response = await fetch(fileData.url);
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to download file from ONLYOFFICE' });
    }

    const buffer = await response.arrayBuffer();
    const fileName = `downloaded-${Date.now()}.${fileData.filetype || 'docx'}`;
    const filePath = resolve(uploadsFolder, fileName);
    
    await writeFile(filePath, Buffer.from(buffer));
    
    console.log('File saved:', fileName);
    
    // Trả về URL để download
    return res.json({ 
      success: true, 
      url: `/uploads/${fileName}`,
      fileName: fileName
    });
  } catch (error) {
    console.error('Save document callback error:', error);
    return res.status(500).json({ error: 'Failed to save document' });
  }
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
