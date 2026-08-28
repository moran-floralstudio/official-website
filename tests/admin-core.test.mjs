import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import {
  createSessionToken, isSameOrigin, readCookie, sessionCookie, verifyPassword, verifySessionToken
} from '../functions/_lib/admin-auth.mjs';
import {
  extensionForType, isAllowedImageKey, normalizeContent, validateImageBytes
} from '../functions/_lib/content-schema.mjs';

const base64url = value => Buffer.from(value).toString('base64url');

test('PBKDF2 password hash accepts the correct password only', async () => {
  const password = 'local-test-password-2026';
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  const encoded = `pbkdf2-sha256$100000$${base64url(salt)}$${base64url(hash)}`;
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('incorrect-password', encoded), false);
  assert.equal(await verifyPassword(password, 'invalid'), false);
});

test('signed admin session rejects tampering and expiry', async () => {
  const secret = 'test-only-session-secret-that-is-long-enough';
  const now = 1_700_000_000_000;
  const token = await createSessionToken('editor', secret, now);
  assert.equal((await verifySessionToken(token, secret, now + 1000))?.username, 'editor');
  assert.equal(await verifySessionToken(`${token}x`, secret, now + 1000), null);
  assert.equal(await verifySessionToken(token, secret, now + 9 * 60 * 60 * 1000), null);
});

test('cookie and same-origin helpers enforce the expected request boundary', () => {
  const cookie = sessionCookie('abc.123', 'https://example.com/api/admin/login');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  const request = new Request('https://example.com/api/admin/content', { headers: { Origin: 'https://example.com', Cookie: cookie.split(';')[0] } });
  assert.equal(isSameOrigin(request), true);
  assert.equal(readCookie(request), 'abc.123');
  assert.equal(isSameOrigin(new Request(request.url, { headers: { Origin: 'https://wrong.example' } })), false);
});

test('content schema retains only allowed keys and relative upload URLs', () => {
  const content = normalizeContent({
    text: { heroLine1: ' 新標題 ', unknown: 'discard me' },
    images: { heroImage: '/media/uploads/hero-1.webp', serviceSpace: 'https://remote.example/photo.jpg', unknown: '/media/uploads/x.jpg' }
  });
  assert.equal(content.text.heroLine1, '新標題');
  assert.equal('unknown' in content.text, false);
  assert.equal(content.images.heroImage, '/media/uploads/hero-1.webp');
  assert.equal('serviceSpace' in content.images, false);
  assert.equal(isAllowedImageKey('portfolioImage7'), true);
});

test('image validation checks MIME type and magic bytes', () => {
  assert.equal(validateImageBytes('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(validateImageBytes('image/png', Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), true);
  assert.equal(validateImageBytes('image/webp', Uint8Array.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])), true);
  assert.equal(validateImageBytes('image/png', Uint8Array.from([1,2,3,4,5,6,7,8])), false);
  assert.equal(extensionForType('image/webp'), 'webp');
});
