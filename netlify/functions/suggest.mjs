/* Sugerencias: backend */
import { randomUUID } from 'node:crypto';
import { json, errorResponse, HttpError, readJson, requireMethod, requireOrigin } from './_shared/http.mjs';
import { getTrackById } from './_shared/spotify.mjs';
import { clientIp, env, hashIp } from './_shared/security.mjs';
import { checkRateLimit, getJson, setJson, getSuggestionsStore, getTracksIndexStore, withLock } from './_shared/store.mjs';

async function verifyTurnstile(token) {
  const secret = env('TURNSTILE_SECRET_KEY');
  if (!secret) throw new HttpError(503, 'La verificación antispam todavía no está configurada.');
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, idempotency_key: randomUUID() }),
    signal: AbortSignal.timeout(8_000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) throw new HttpError(400, 'Completa la verificación antispam e inténtalo de nuevo.');
}

function pendingLimit() {
  const value = Number.parseInt(env('MAX_PENDING'), 10);
  return Number.isFinite(value) ? Math.min(2_000, Math.max(1, value)) : 300;
}

export default async (request, context) => {
  const wrongMethod = requireMethod(request, 'POST');
  if (wrongMethod) return wrongMethod;
  try {
    const suggestions = getSuggestionsStore();
    const tracksIndex = getTracksIndexStore();
    requireOrigin(request);
    const body = await readJson(request);
    const trackId = typeof body.trackId === 'string' ? body.trackId.trim() : '';
    if (!/^[A-Za-z0-9]{22}$/.test(trackId)) throw new HttpError(400, 'La canción seleccionada no es válida.');
    const requesterName = typeof body.requesterName === 'string' ? body.requesterName.trim() : '';
    if (requesterName.length > 30 || /[<>\u0000-\u001f]/.test(requesterName)) {
      throw new HttpError(400, 'El nombre debe tener hasta 30 caracteres y no incluir etiquetas HTML.');
    }
    if (typeof body.website !== 'string' || body.website.trim()) throw new HttpError(400, 'No se pudo procesar la sugerencia.');
    const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';
    if (!turnstileToken || turnstileToken.length > 2_048) throw new HttpError(400, 'Completa la verificación antispam.');

    const ipHash = hashIp(clientIp(request, context));
    const limit = await checkRateLimit(`rate:suggest:${ipHash}`, { max: 5, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return json({ error: 'Alcanzaste el límite de 5 sugerencias por hora. Inténtalo más tarde.' }, 429, { 'Retry-After': String(limit.retryAfter) });

    await verifyTurnstile(turnstileToken);
    const track = await getTrackById(trackId);
    if (env('ALLOW_EXPLICIT').trim().toLowerCase() === 'false' && track.explicit) {
      throw new HttpError(400, 'Esta canción tiene contenido explícito y no se aceptan canciones explícitas.');
    }

    const locked = await withLock(suggestions, '__locks__/submissions', async () => {
      const trackKey = `track:${track.id}`;
      const existing = await getJson(tracksIndex, trackKey);
      if (existing?.status === 'pending' || existing?.status === 'approved') {
        const original = existing.suggestion_id ? await getJson(suggestions, existing.suggestion_id) : null;
        if (original?.status === existing.status) throw new HttpError(409, 'Esa canción ya fue sugerida.');
        if (original) await setJson(tracksIndex, trackKey, { ...existing, status: original.status });
        else await tracksIndex.delete(trackKey);
      }
      const pending = await tracksIndex.list({ prefix: 'pending:' });
      for (const blob of pending.blobs) {
        const pendingId = blob.key.slice('pending:'.length);
        const pendingRecord = await getJson(suggestions, pendingId);
        if (pendingRecord?.status !== 'pending') await tracksIndex.delete(blob.key);
      }
      const activePending = await tracksIndex.list({ prefix: 'pending:' });
      if (activePending.blobs.length >= pendingLimit()) {
        throw new HttpError(429, 'Por ahora no estamos recibiendo más sugerencias.');
      }
      const id = randomUUID();
      const record = {
        id,
        track_id: track.id,
        track_uri: track.uri,
        title: track.name,
        artists: track.artists.join(', '),
        album_image: track.album_image,
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        spotify_url: track.spotify_url,
        requester_name: requesterName,
        ip_hash: ipHash,
        status: 'pending',
        created_at: new Date().toISOString(),
        reviewed_at: null
      };
      const saved = await suggestions.setJSON(id, record, { onlyIfNew: true });
      if (!saved.modified) throw new HttpError(503, 'No se pudo guardar la sugerencia. Inténtalo de nuevo.');
      try {
        await setJson(tracksIndex, trackKey, { suggestion_id: id, status: 'pending', track_id: track.id });
        await setJson(tracksIndex, `pending:${id}`, { suggestion_id: id });
      } catch (error) {
        const index = await getJson(tracksIndex, trackKey).catch(() => null);
        if (index?.suggestion_id === id) await tracksIndex.delete(trackKey).catch(() => {});
        await tracksIndex.delete(`pending:${id}`).catch(() => {});
        await suggestions.delete(id).catch(() => {});
        throw error;
      }
      return { id };
    });
    if (!locked.acquired) throw new HttpError(503, 'El sistema está ocupado. Inténtalo de nuevo en unos segundos.');
    return json({ id: locked.value.id, message: '¡Listo! Tu sugerencia quedó en revisión.' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: '/api/suggest', method: 'POST' };
