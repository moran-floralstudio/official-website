export const TEXT_KEYS = Object.freeze([
  'announcement', 'heroLine1', 'heroLine2', 'heroCopy', 'heroCaption',
  'philosophyTitle', 'philosophyQuote',
  'valueTitle1', 'valueBody1', 'valueTitle2', 'valueBody2', 'valueTitle3', 'valueBody3',
  'servicesTitle', 'servicesLead',
  'serviceTitle1', 'serviceBody1', 'serviceTitle2', 'serviceBody2',
  'serviceTitle3', 'serviceBody3', 'serviceTitle4', 'serviceBody4',
  'portfolioTitle', 'portfolioLead', 'portfolioNote',
  'portfolioItemTitle1', 'portfolioItemTitle2', 'portfolioItemTitle3', 'portfolioItemTitle4',
  'portfolioItemTitle5', 'portfolioItemTitle6', 'portfolioItemTitle7',
  'processTitle', 'processLead',
  'stepTitle1', 'stepBody1', 'stepTitle2', 'stepBody2', 'stepTitle3', 'stepBody3', 'stepTitle4', 'stepBody4',
  'serviceNotesTitle', 'faqTitle',
  'faqQuestion1', 'faqAnswer1', 'faqQuestion2', 'faqAnswer2', 'faqQuestion3', 'faqAnswer3',
  'faqQuestion4', 'faqAnswer4', 'faqQuestion5', 'faqAnswer5',
  'contactTitle', 'contactCopy', 'footerCopy', 'footerCopyright', 'footerCreditPrefix', 'footerCreditSuffix'
]);

export const IMAGE_KEYS = Object.freeze([
  'heroImage', 'serviceSpace', 'serviceWedding', 'serviceGift', 'serviceWorkshop',
  'portfolioImage1', 'portfolioImage2', 'portfolioImage3', 'portfolioImage4',
  'portfolioImage5', 'portfolioImage6', 'portfolioImage7'
]);

const textKeySet = new Set(TEXT_KEYS);
const imageKeySet = new Set(IMAGE_KEYS);

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, 2000) : '';
}

function cleanTimestamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function cleanImage(value) {
  if (typeof value !== 'string') return '';
  const path = value.trim();
  return /^\/(?:media\/uploads|assets\/images\/uploads)\/[A-Za-z0-9._/-]+$/.test(path) ? path : '';
}

export function normalizeContent(input, savedAt = '') {
  const text = {};
  const images = {};
  for (const [key, value] of Object.entries(input?.text || {})) {
    if (textKeySet.has(key)) text[key] = cleanText(value);
  }
  for (const [key, value] of Object.entries(input?.images || {})) {
    if (imageKeySet.has(key)) {
      const image = cleanImage(value);
      if (image) images[key] = image;
    }
  }
  return { version: 1, updatedAt: cleanTimestamp(savedAt) || new Date().toISOString(), text, images };
}

export function isAllowedImageKey(value) {
  return imageKeySet.has(value);
}

export function validateImageBytes(type, bytes) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.slice(0, 8).every((byte, index) => byte === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index]);
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export function extensionForType(type) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[type] || '';
}
