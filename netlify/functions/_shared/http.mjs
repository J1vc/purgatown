/* Sugerencias: backend */
export class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      ...headers
    }
  });
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    const headers = error.details.retryAfter ? { 'Retry-After': String(error.details.retryAfter) } : {};
    return json({ error: error.message, ...error.details }, error.status, headers);
  }
  console.error('Error interno en una función de sugerencias:', error?.message || 'unknown');
  return json({ error: 'Ocurrió un error interno. Inténtalo de nuevo.' }, 500);
}

export async function readJson(request, maxBytes = 8_192) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new HttpError(413, 'La solicitud es demasiado grande.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, 'La solicitud es demasiado grande.');
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid body');
    return value;
  } catch {
    throw new HttpError(400, 'El formato de la solicitud no es válido.');
  }
}

export function requireOrigin(request) {
  const configured = globalThis.Netlify?.env?.get?.('SITE_ORIGIN') ?? process.env.SITE_ORIGIN ?? '';
  if (!configured) throw new HttpError(503, 'El sitio todavía no está configurado.');
  let expected;
  let received;
  try {
    expected = new URL(configured).origin;
    received = new URL(request.headers.get('origin') || '').origin;
  } catch {
    throw new HttpError(403, 'Origen no permitido.');
  }
  if (received !== expected) throw new HttpError(403, 'Origen no permitido.');
}

export function requireMethod(request, method) {
  if (request.method !== method) {
    return json({ error: 'Método no permitido.' }, 405, { Allow: method });
  }
  return null;
}
