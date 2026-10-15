/* Sugerencias: backend */
import { json, errorResponse, HttpError, requireMethod } from './_shared/http.mjs';
import { searchTracks } from './_shared/spotify.mjs';
import { clientIp, env, hashIp } from './_shared/security.mjs';
import { checkRateLimit } from './_shared/store.mjs';

export default async (request, context) => {
  const wrongMethod = requireMethod(request, 'GET');
  if (wrongMethod) return wrongMethod;
  try {
    const query = new URL(request.url).searchParams.get('q')?.trim() || '';
    if (query.length < 2 || query.length > 100) throw new HttpError(400, 'Escribe entre 2 y 100 caracteres para buscar.');
    if (!env('IP_HASH_SALT')) throw new HttpError(503, 'El buscador todavía no está configurado.');
    const limit = await checkRateLimit(`rate:search:${hashIp(clientIp(request, context))}`, { max: 30, windowMs: 60_000 });
    if (!limit.allowed) return json({ error: 'Alcanzaste el límite de búsquedas. Espera un momento.' }, 429, { 'Retry-After': String(limit.retryAfter) });
    return json({ results: await searchTracks(query) });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: '/api/search', method: 'GET' };
