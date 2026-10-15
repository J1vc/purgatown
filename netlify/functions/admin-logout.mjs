/* Sugerencias: backend */
import { json, errorResponse, requireMethod, requireOrigin } from './_shared/http.mjs';
import { clearSessionCookie, requireAdmin } from './_shared/security.mjs';

export default async request => {
  try {
    requireAdmin(request);
    const wrongMethod = requireMethod(request, 'POST');
    if (wrongMethod) return wrongMethod;
    requireOrigin(request);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: '/api/admin/logout', method: 'POST' };
