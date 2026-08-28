import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');

test('inline application script has valid JavaScript syntax', () => {
  const scripts = [...html.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1);
  scripts.forEach((match, index) => new vm.Script(match[1], { filename: `index-inline-${index + 1}.js` }));
});

test('navigation targets and required content sections exist', () => {
  for (const id of ['main', 'philosophy', 'services', 'portfolio', 'process', 'faq', 'contact']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('referenced local assets exist', async () => {
  const references = [...html.matchAll(/['"](\/(?:assets|robots|sitemap)[^'"#?]*)['"]/g)].map(match => match[1]);
  assert.ok(references.length > 10);
  for (const reference of new Set(references)) {
    await access(resolve(root, reference.slice(1)));
  }
});

test('images have alt text and no removed production hazards remain', () => {
  for (const image of html.matchAll(/<img\b[^>]*>/gi)) assert.match(image[0], /\balt="[^"]*"/i);
  for (const forbidden of ['Ava0623', 'moranadmin', 'script.google.com', 'cdn.tailwindcss.com', 'static.line-scdn.net', 'placehold.co']) {
    assert.equal(html.includes(forbidden), false);
  }
});

test('booking dialog exposes accessible name and privacy consent', () => {
  assert.match(html, /id="bookingModal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="bookingTitle"/);
  assert.match(html, /name="privacyConsent"[^>]*required/);
  assert.match(html, /id="formStatus"[^>]*aria-live="polite"/);
});

test('booking form has one action button and a separate success dialog', () => {
  const form = html.match(/<form id="bookingForm"[\s\S]*?<\/form>/)?.[0] || '';
  assert.equal((form.match(/<button\b/g) || []).length, 1);
  assert.equal((form.match(/<a\b/g) || []).length, 0);
  assert.match(html, /id="successModal"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /hideModal\(bookingModal, false\);[\s\S]*showModal\(successModal\)/);
});

test('admin editor entry, editable content, upload picker, and relative image URLs are wired', () => {
  assert.match(html, /id="adminEntry"[^>]*aria-label="進入網站編輯模式"/);
  assert.ok((html.match(/data-edit-key=/g) || []).length >= 40);
  assert.ok((html.match(/data-image-key=/g) || []).length >= 5);
  assert.match(html, /id="adminImageInput"[^>]*type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /requestJson\('\/api\/admin\/upload'/);
  assert.match(html, /requestJson\('\/api\/admin\/content'/);
  assert.match(html, /applyContent\(payload\.content \?\? payload\)/);
});

test('original footer credit is preserved and Moran name opens the shared admin flow', () => {
  assert.match(html, /class="container footer-original-row"/);
  assert.match(html, /設計與規劃由<\/span><a id="footerAdminLink"[^>]*>莫珩<\/a><span[^>]*>管理團隊 極致打造<\/span>/);
  assert.match(html, /footerAdminLink'\)\.addEventListener\('click',[\s\S]*openAdmin\(\)/);
});
