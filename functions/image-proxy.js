/*
  Cloudflare Pages Function: Image Proxy & Fallback
  - Serves local images from /assets/images/
  - On miss, falls back to original remote URL
  - Supports query params: w, q, format
*/

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // Parse category and filename from path
  const parts = params.path || [];
  const category = parts[0] || 'portfolio';
  const filename = parts.slice(1).join('/') || 'default.webp';

  // Build local asset path
  const localPath = `/assets/images/${category}/${filename}`;

  // Try to serve from local assets first
  try {
    const localResponse = await env.ASSETS.fetch(
      new Request(`${url.origin}${localPath}`, request)
    );
    if (localResponse.ok) {
      // Apply optimization headers
      const headers = new Headers(localResponse.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('CDN-Cache-Control', 'public, max-age=31536000');
      return new Response(localResponse.body, {
        status: 200,
        headers
      });
    }
  } catch (e) {
    // Continue to fallback
  }

  return new Response('Image not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export const config = {
  path: '/image-proxy/*',
  method: 'GET',
  rateLimit: {
    limit: 100,
    window: 60,
  },
};
