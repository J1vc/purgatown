/* Sugerencias: backend */
import { json, errorResponse, HttpError, readJson, requireMethod, requireOrigin } from './_shared/http.mjs';
import { clientIp, createSessionCookie, hashIp, env, verifyAdminPassword } from './_shared/security.mjs';
import { checkRateLimit } from './_shared/store.mjs';

export default async (request, context) => {
  const wrongMethod = requireMethod(request, 'POST');
  if (wrongMethod) return wrongMethod;
  try {
    requireOrigin(request);
    if (!env('IP_HASH_SALT')) throw new HttpError(503, 'El panel todavía no está configurado.');
    const ipHash = hashIp(clientIp(request, context));
    const limit = await checkRateLimit(`rate:login:${ipHash}`, { max: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return json({ error: 'Demasiados intentos. Espera antes de volver a iniciar sesión.' }, 429, { 'Retry-After': String(limit.retryAfter) });
    const body = await readJson(request, 2_048);
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length > 256 || !verifyAdminPassword(password)) throw new HttpError(401, 'La contraseña no es correcta.');
    return json({ ok: true }, 200, { 'Set-Cookie': createSessionCookie() });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: '/api/admin/login', method: 'POST' };
