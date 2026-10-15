/* Sugerencias: backend */
import { json, errorResponse, requireMethod } from './_shared/http.mjs';
import { env } from './_shared/security.mjs';

export default async request => {
  const wrongMethod = requireMethod(request, 'GET');
  if (wrongMethod) return wrongMethod;
  try {
    return json({ turnstileSiteKey: env('TURNSTILE_SITE_KEY') || '' });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: '/api/config', method: 'GET' };
