import { isSameOrigin, json, requireAdmin } from '../../_lib/admin-auth.mjs';
import { normalizeContent } from '../../_lib/content-schema.mjs';

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json(403, { ok: false, code: 'ORIGIN_REJECTED', message: '儲存來源不正確。' });
  if (!await requireAdmin(request, env)) return json(401, { ok: false, code: 'AUTH_REQUIRED', message: '管理登入已失效。' });
  if (!env.SITE_CONTENT) return json(503, { ok: false, code: 'CONTENT_STORAGE_NOT_CONFIGURED', message: '網站內容儲存空間尚未設定。' });
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, code: 'INVALID_JSON', message: '網站內容格式不正確。' }); }
  const content = normalizeContent(body);
  await env.SITE_CONTENT.put('content/site-content.json', JSON.stringify(content), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return json(200, { ok: true, content });
}
