import { createSessionToken, isSameOrigin, json, safeEqualText, sessionCookie, verifyPassword } from '../../_lib/admin-auth.mjs';

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json(403, { ok: false, code: 'ORIGIN_REJECTED', message: '登入來源不正確。' });
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_SESSION_SECRET) {
    return json(503, { ok: false, code: 'ADMIN_NOT_CONFIGURED', message: '管理功能尚未完成伺服器設定。' });
  }
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, code: 'INVALID_JSON', message: '登入資料格式不正確。' }); }
  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 80) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  const validUser = safeEqualText(username, env.ADMIN_USERNAME);
  const validPassword = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!validUser || !validPassword) {
    return json(401, { ok: false, code: 'INVALID_CREDENTIALS', message: '帳號或密碼不正確。' });
  }
  const token = await createSessionToken(env.ADMIN_USERNAME, env.ADMIN_SESSION_SECRET);
  return json(200, { ok: true, username: env.ADMIN_USERNAME }, { 'Set-Cookie': sessionCookie(token, request.url) });
}
