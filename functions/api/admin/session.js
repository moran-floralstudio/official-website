import { json, requireAdmin } from '../../_lib/admin-auth.mjs';

export async function onRequestGet({ request, env }) {
  const session = await requireAdmin(request, env);
  return session ? json(200, { ok: true, authenticated: true, username: session.username }) : json(401, { ok: false, authenticated: false });
}
