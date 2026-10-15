/* Sugerencias: backend */
import { json, errorResponse, HttpError, readJson, requireMethod, requireOrigin } from './_shared/http.mjs';
import { requireAdmin } from './_shared/security.mjs';
import { getJson, setJson, suggestions, tracksIndex, withLock } from './_shared/store.mjs';

export default async request => {
  try {
    requireAdmin(request);
    const wrongMethod = requireMethod(request, 'POST');
    if (wrongMethod) return wrongMethod;
    requireOrigin(request);
    const body = await readJson(request, 2_048);
    const id = typeof body.id === 'string' ? body.id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new HttpError(400, 'La sugerencia seleccionada no es válida.');
    }
    const record = await getJson(suggestions, id);
    if (!record) throw new HttpError(404, 'No encontramos esa sugerencia.');
    const lock = await withLock(tracksIndex, `__locks__/review:${record.track_id}`, async () => {
      const saved = await withLock(suggestions, '__locks__/submissions', async () => {
        const latest = await getJson(suggestions, id);
        if (!latest) throw new HttpError(404, 'No encontramos esa sugerencia.');
        if (latest.status === 'rejected') {
          const trackKey = `track:${latest.track_id}`;
          const index = await getJson(tracksIndex, trackKey);
          if (index?.suggestion_id === id && index.status !== 'rejected') await setJson(tracksIndex, trackKey, { ...index, status: 'rejected' });
          await tracksIndex.delete(`pending:${id}`);
          return { alreadyRejected: true };
        }
        if (latest.status !== 'pending') throw new HttpError(409, 'Esta sugerencia ya fue revisada.');
        latest.status = 'rejected';
        latest.reviewed_at = new Date().toISOString();
        await setJson(suggestions, id, latest);
        const trackKey = `track:${latest.track_id}`;
        const index = await getJson(tracksIndex, trackKey);
        if (index?.suggestion_id === id) await setJson(tracksIndex, trackKey, { ...index, status: 'rejected' });
        await tracksIndex.delete(`pending:${id}`);
        return { alreadyRejected: false };
      });
      if (!saved.acquired) throw new HttpError(503, 'El sistema está ocupado. Inténtalo de nuevo.');
      return saved.value;
    });
    if (!lock.acquired) throw new HttpError(409, 'Esta sugerencia se está procesando. Espera unos segundos.');
    return json({ ok: true, alreadyRejected: lock.value.alreadyRejected });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: '/api/admin/reject', method: 'POST' };
