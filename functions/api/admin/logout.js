import { clearSessionCookie, isSameOrigin, json } from '../../_lib/admin-auth.mjs';

export async function onRequestPost({ request }) {
  if (!isSameOrigin(request)) return json(403, { ok: false, code: 'ORIGIN_REJECTED', message: '登出來源不正確。' });
  return json(200, { ok: true }, { 'Set-Cookie': clearSessionCookie(request.url) });
}
