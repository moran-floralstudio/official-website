import { json } from '../_lib/admin-auth.mjs';
import { normalizeContent } from '../_lib/content-schema.mjs';

export async function onRequestGet({ env }) {
  if (!env.SITE_CONTENT) return json(200, { ok: true, content: null, storage: 'unconfigured' });
  try {
    const object = await env.SITE_CONTENT.get('content/site-content.json');
    if (!object) return json(200, { ok: true, content: null, storage: 'empty' });
    return json(200, { ok: true, content: normalizeContent(JSON.parse(await object.text())), storage: 'r2' });
  } catch {
    return json(500, { ok: false, code: 'CONTENT_READ_FAILED', message: '目前無法讀取網站內容。' });
  }
}
