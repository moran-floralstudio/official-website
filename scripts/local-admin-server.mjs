import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { extensionForType, isAllowedImageKey, normalizeContent, validateImageBytes } from '../functions/_lib/content-schema.mjs';

const siteRoot = resolve(process.env.MORAN_SITE_ROOT || resolve(import.meta.dirname, '..'));
const host = '127.0.0.1';
const port = Number(process.env.MORAN_PORT || 4173);
const adminUser = process.env.MORAN_ADMIN_USER || '';
const adminPassword = process.env.MORAN_ADMIN_PASSWORD || '';
const bookingMode = process.env.MORAN_DEV_BOOKING_MODE || 'disabled';
const contentPath = resolve(siteRoot, 'assets', 'site-content.json');
const uploadDir = resolve(siteRoot, 'assets', 'images', 'uploads');
const sessions = new Map();
const MAX_BODY = 9 * 1024 * 1024;

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
};

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}

function safeTextEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map(item => item.trim().split('=')).filter(parts => parts[0]).map(([key, value = '']) => [key, decodeURIComponent(value)]));
}

function authenticated(request) {
  const token = cookies(request).moran_admin_local;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return false;
  }
  return true;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  const expected = `http://${request.headers.host}`;
  return origin === expected;
}

async function bodyBuffer(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function webRequest(request, buffer) {
  return new Request(`http://${request.headers.host}${request.url}`, {
    method: request.method, headers: request.headers, body: buffer.length ? buffer : undefined
  });
}

async function readContent() {
  try { return normalizeContent(JSON.parse(await readFile(contentPath, 'utf8'))); }
  catch { return normalizeContent({}); }
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/content') {
    return json(response, 200, { ok: true, content: await readContent(), storage: 'filesystem' });
  }
  if (request.method === 'GET' && url.pathname === '/api/admin/session') {
    return authenticated(request) ? json(response, 200, { ok: true, authenticated: true, username: adminUser }) : json(response, 401, { ok: false, authenticated: false });
  }
  if (request.method === 'POST' && !sameOrigin(request)) return json(response, 403, { ok: false, code: 'ORIGIN_REJECTED', message: '請求來源不正確。' });

  if (request.method === 'POST' && url.pathname === '/api/admin/login') {
    if (!adminUser || adminPassword.length < 12) return json(response, 503, { ok: false, code: 'ADMIN_NOT_CONFIGURED', message: '本機管理帳密尚未設定。' });
    let input;
    try { input = JSON.parse((await bodyBuffer(request)).toString('utf8')); } catch { return json(response, 400, { ok: false, code: 'INVALID_JSON', message: '登入資料格式不正確。' }); }
    if (!safeTextEqual(input.username || '', adminUser) || !safeTextEqual(input.password || '', adminPassword)) return json(response, 401, { ok: false, code: 'INVALID_CREDENTIALS', message: '帳號或密碼不正確。' });
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, { expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    return json(response, 200, { ok: true, username: adminUser }, { 'Set-Cookie': `moran_admin_local=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800` });
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
    const token = cookies(request).moran_admin_local;
    if (token) sessions.delete(token);
    return json(response, 200, { ok: true }, { 'Set-Cookie': 'moran_admin_local=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/content') {
    if (!authenticated(request)) return json(response, 401, { ok: false, code: 'AUTH_REQUIRED', message: '管理登入已失效。' });
    let input;
    try { input = JSON.parse((await bodyBuffer(request)).toString('utf8')); } catch { return json(response, 400, { ok: false, code: 'INVALID_JSON', message: '網站內容格式不正確。' }); }
    const content = normalizeContent(input);
    await mkdir(resolve(siteRoot, 'assets'), { recursive: true });
    await writeFile(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
    return json(response, 200, { ok: true, content });
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/upload') {
    if (!authenticated(request)) return json(response, 401, { ok: false, code: 'AUTH_REQUIRED', message: '管理登入已失效。' });
    let form;
    try {
      const buffer = await bodyBuffer(request);
      form = await (await webRequest(request, buffer)).formData();
    } catch {
      return json(response, 400, { ok: false, code: 'INVALID_FORM', message: '無法讀取圖片上傳內容。' });
    }
    const slot = String(form.get('slot') || '');
    const file = form.get('file');
    if (!isAllowedImageKey(slot)) return json(response, 400, { ok: false, code: 'INVALID_IMAGE_SLOT', message: '圖片位置不正確。' });
    if (!file || typeof file.arrayBuffer !== 'function') return json(response, 400, { ok: false, code: 'IMAGE_REQUIRED', message: '請選擇圖片。' });
    if (file.size < 1 || file.size > 8 * 1024 * 1024) return json(response, 413, { ok: false, code: 'IMAGE_SIZE_INVALID', message: '圖片須小於 8 MB。' });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = extensionForType(file.type);
    if (!extension || !validateImageBytes(file.type, bytes)) return json(response, 415, { ok: false, code: 'IMAGE_TYPE_INVALID', message: '僅支援有效的 JPG、PNG 或 WebP 圖片。' });
    await mkdir(uploadDir, { recursive: true });
    const filename = `${slot}-${Date.now()}-${randomBytes(4).toString('hex')}.${extension}`;
    await writeFile(resolve(uploadDir, filename), bytes);
    return json(response, 201, { ok: true, slot, url: `/assets/images/uploads/${filename}` });
  }
  if (request.method === 'POST' && url.pathname === '/api/booking') {
    await bodyBuffer(request);
    if (bookingMode !== 'success') return json(response, 503, { ok: false, code: 'LOCAL_BOOKING_DISABLED', message: '本機預約服務未啟用。' });
    return json(response, 201, { ok: true, refCode: `MR-QA-${Date.now().toString().slice(-6)}` });
  }
  return json(response, 404, { ok: false, code: 'NOT_FOUND', message: '找不到 API。' });
}

async function serveStatic(request, response, url) {
  const routes = new Set(['/', '/index.html', '/robots.txt', '/sitemap.xml']);
  if (!routes.has(url.pathname) && !url.pathname.startsWith('/assets/')) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = resolve(siteRoot, relative);
  if (filePath !== siteRoot && !filePath.startsWith(siteRoot + sep)) {
    response.writeHead(403);
    return response.end();
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not file');
    response.writeHead(200, {
      'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': url.pathname === '/index.html' || url.pathname === '/' ? 'no-store' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
    else await serveStatic(request, response, url);
  } catch (error) {
    console.error('Request failed:', error.message);
    if (!response.headersSent) json(response, 500, { ok: false, code: 'LOCAL_SERVER_ERROR', message: '本機伺服器發生錯誤。' });
    else response.end();
  }
});

server.listen(port, host, () => {
  console.log(`Moran Floral local editor: http://${host}:${port}/`);
  console.log(adminUser && adminPassword.length >= 12 ? 'Admin editor: configured from environment' : 'Admin editor: disabled until MORAN_ADMIN_USER and MORAN_ADMIN_PASSWORD are set');
});
