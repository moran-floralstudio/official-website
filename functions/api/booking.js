const SERVICES = new Set(['空間花藝陳列', '婚禮花藝設計', '客製花禮訂製', '實體花藝課程']);
const BUDGETS = new Set(['NT$ 3,000 以下', 'NT$ 3,000 - 15,000', 'NT$ 15,000 - 35,000', 'NT$ 35,000 以上']);
const MAX_BODY_BYTES = 12_000;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function taipeiDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validate(raw) {
  if (raw.website) return { error: 'BOT_CHECK_FAILED', message: '表單驗證失敗。' };
  const startedAt = Number(raw.startedAt);
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < 1200 || elapsed > 86_400_000) {
    return { error: 'FORM_SESSION_INVALID', message: '表單已逾時或送出過快，請重新開啟後再試。' };
  }

  const data = {
    serviceType: text(raw.serviceType, 30), date: text(raw.date, 10), location: text(raw.location, 80),
    budget: text(raw.budget, 30), name: text(raw.name, 50), phone: text(raw.phone, 30),
    lineId: text(raw.lineId, 50), remarks: text(raw.remarks, 1000)
  };
  if (!SERVICES.has(data.serviceType)) return { error: 'INVALID_SERVICE', message: '請重新選擇服務項目。' };
  if (!BUDGETS.has(data.budget)) return { error: 'INVALID_BUDGET', message: '請重新選擇預算區間。' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date < taipeiDate()) return { error: 'INVALID_DATE', message: '需求日期不可早於今天。' };
  if (data.name.length < 1) return { error: 'INVALID_NAME', message: '請填寫姓名或稱呼。' };
  if (!/^[0-9+()\-\s]{7,30}$/.test(data.phone)) return { error: 'INVALID_PHONE', message: '請填寫可聯絡的電話號碼。' };
  return { data };
}

function createReference() {
  const stamp = taipeiDate().replaceAll('-', '');
  return `MR-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function buildMessage(data, refCode) {
  return `【默藍花藝｜預約諮詢單】\n諮詢單號：${refCode}\n服務項目：${data.serviceType}\n需求日期：${data.date}\n地點區域：${data.location || '未提供'}\n預算區間：${data.budget}\n聯絡姓名：${data.name}\n聯絡電話：${data.phone}\nLINE ID：${data.lineId || '未提供'}\n需求備註：${data.remarks || '無'}`;
}

export async function onRequestPost({ request, env }) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.toLowerCase().includes('application/json')) return json(415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE', message: '表單格式不正確。' });
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json(413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: '表單內容過長。' });

  let rawText;
  let raw;
  try {
    rawText = await request.text();
    if (new TextEncoder().encode(rawText).length > MAX_BODY_BYTES) return json(413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: '表單內容過長。' });
    raw = JSON.parse(rawText);
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON', message: '表單內容無法解析。' });
  }

  const checked = validate(raw || {});
  if (checked.error) return json(400, { ok: false, code: checked.error, message: checked.message });
  if (!env.BOOKING_WEBHOOK_URL) return json(503, { ok: false, code: 'BOOKING_SERVICE_NOT_CONFIGURED', message: '預約服務尚未完成設定。' });

  let webhook;
  try {
    webhook = new URL(env.BOOKING_WEBHOOK_URL);
    if (webhook.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    return json(503, { ok: false, code: 'BOOKING_SERVICE_MISCONFIGURED', message: '預約服務設定無效。' });
  }

  const refCode = createReference();
  const payload = { ...checked.data, refCode, fullMessage: buildMessage(checked.data, refCode), source: 'moran-floral-website' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(webhook.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ postData: JSON.stringify(payload) }),
      redirect: 'follow',
      signal: controller.signal
    });
    if (!upstream.ok) {
      return json(502, { ok: false, code: 'UPSTREAM_REJECTED', upstreamStatus: upstream.status, message: '預約服務暫時未接受資料。' });
    }
    return json(201, { ok: true, refCode });
  } catch {
    return json(502, { ok: false, code: 'UPSTREAM_UNAVAILABLE', message: '目前無法連線預約服務。' });
  } finally {
    clearTimeout(timeout);
  }
}
