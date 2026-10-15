/* Sugerencias: backend */
import { json, errorResponse, HttpError, requireMethod } from './_shared/http.mjs';
import { requireAdmin } from './_shared/security.mjs';
import { suggestions } from './_shared/store.mjs';

export default async request => {
  try {
    requireAdmin(request);
    const wrongMethod = requireMethod(request, 'GET');
    if (wrongMethod) return wrongMethod;
    const status = new URL(request.url).searchParams.get('status') || 'pending';
    if (!['pending', 'approved', 'rejected'].includes(status)) throw new HttpError(400, 'El filtro solicitado no es válido.');
    const records = [];
    for await (const page of suggestions.list({ paginate: true })) {
      for (const blob of page.blobs) {
        if (blob.key.startsWith('__')) continue;
        const record = await suggestions.get(blob.key, { type: 'json', consistency: 'strong' });
        if (record?.status === status) {
          const { ip_hash, ...safeRecord } = record;
          records.push(safeRecord);
        }
      }
    }
    records.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return json({ suggestions: records });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: '/api/admin/suggestions', method: 'GET' };
