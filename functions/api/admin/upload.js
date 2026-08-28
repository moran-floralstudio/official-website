import { isSameOrigin, json, requireAdmin } from '../../_lib/admin-auth.mjs';
import { extensionForType, isAllowedImageKey, validateImageBytes } from '../../_lib/content-schema.mjs';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json(403, { ok: false, code: 'ORIGIN_REJECTED', message: '上傳來源不正確。' });
  if (!await requireAdmin(request, env)) return json(401, { ok: false, code: 'AUTH_REQUIRED', message: '管理登入已失效。' });
  if (!env.SITE_CONTENT) return json(503, { ok: false, code: 'CONTENT_STORAGE_NOT_CONFIGURED', message: '圖片儲存空間尚未設定。' });
  let form;
  try { form = await request.formData(); } catch { return json(400, { ok: false, code: 'INVALID_FORM', message: '無法讀取圖片上傳內容。' }); }
  const slot = String(form.get('slot') || '');
  const file = form.get('file');
  if (!isAllowedImageKey(slot)) return json(400, { ok: false, code: 'INVALID_IMAGE_SLOT', message: '圖片位置不正確。' });
  if (!file || typeof file.arrayBuffer !== 'function') return json(400, { ok: false, code: 'IMAGE_REQUIRED', message: '請選擇圖片檔案。' });
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return json(413, { ok: false, code: 'IMAGE_SIZE_INVALID', message: '圖片須小於 8 MB。' });
  const extension = extensionForType(file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!extension || !validateImageBytes(file.type, bytes)) return json(415, { ok: false, code: 'IMAGE_TYPE_INVALID', message: '僅支援有效的 JPG、PNG 或 WebP 圖片。' });
  const key = `uploads/${slot}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  await env.SITE_CONTENT.put(key, bytes, { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { slot } });
  return json(201, { ok: true, slot, url: `/media/${key}` });
}
