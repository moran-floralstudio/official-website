export async function onRequestGet({ env, params }) {
  if (!env.SITE_CONTENT) return new Response('Media storage is not configured', { status: 503 });
  const rawPath = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!/^uploads\/[A-Za-z0-9._/-]+$/.test(rawPath)) return new Response('Not found', { status: 404 });
  const object = await env.SITE_CONTENT.get(rawPath);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
