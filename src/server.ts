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
const publicFolder = resolve(serverDistFolder, '../../public');

// Đảm bảo thư mục uploads tồn tại
if (!existsSync(uploadsFolder)) {
  mkdir(uploadsFolder, { recursive: true }).catch(console.error);
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
  const filename = req.params.filename;
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
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = resolve(uploadsFolder, fileName);
    
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
