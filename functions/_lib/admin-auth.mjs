const COOKIE_NAME = 'moran_admin_session';
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function safeEqualBytes(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

export function safeEqualText(left, right) {
  return safeEqualBytes(encoder.encode(String(left)), encoder.encode(String(right)));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function verifyPassword(password, encodedHash) {
  const [scheme, iterationsText, saltText, hashText] = String(encodedHash || '').split('$');
  const iterations = Number(iterationsText);
  if (scheme !== 'pbkdf2-sha256' || iterations !== 100_000) return false;
  try {
    const salt = base64UrlDecode(saltText);
    const expected = base64UrlDecode(hashText);
    const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8));
    return safeEqualBytes(actual, expected);
  } catch {
    return false;
  }
}

export async function createSessionToken(username, secret, now = Date.now()) {
  const payload = { username, issuedAt: now, expiresAt: now + 8 * 60 * 60 * 1000, nonce: crypto.randomUUID() };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = base64UrlEncode(await hmac(encodedPayload, secret));
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const [payloadText, signatureText, extra] = String(token).split('.');
  if (!payloadText || !signatureText || extra) return null;
  try {
    const expected = await hmac(payloadText, secret);
    if (!safeEqualBytes(expected, base64UrlDecode(signatureText))) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadText)));
    if (!payload.username || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(request, name = COOKIE_NAME) {
  const header = request.headers.get('Cookie') || '';
  for (const item of header.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export function sessionCookie(token, requestUrl) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`;
}

export function clearSessionCookie(requestUrl) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function requireAdmin(request, env) {
  const session = await verifySessionToken(readCookie(request), env.ADMIN_SESSION_SECRET);
  return session && safeEqualText(session.username, env.ADMIN_USERNAME || '') ? session : null;
}

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}
