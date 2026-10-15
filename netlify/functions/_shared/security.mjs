/* Sugerencias: backend */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.mjs';

export function env(name) {
  const fromNetlify = globalThis.Netlify?.env?.get?.(name);
  return fromNetlify ?? process.env[name] ?? '';
}

export function clientIp(request, context) {
  return context?.ip || request.headers.get('x-nf-client-connection-ip') || 'unknown';
}

export function hashIp(ip) {
  const salt = env('IP_HASH_SALT');
  if (!salt) throw new HttpError(503, 'El sitio todavía no está configurado.');
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

const COOKIE_NAME = 'purgatown_admin';
const SESSION_TTL_SECONDS = 12 * 60 * 60;

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function constantTimeStringEqual(left, right) {
  const a = createHash('sha256').update(String(left)).digest();
  const b = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(a, b);
}

export function verifyAdminPassword(input) {
  const expected = env('ADMIN_PASSWORD');
  if (!expected) throw new HttpError(503, 'El panel todavía no está configurado.');
  return constantTimeStringEqual(input, expected);
}

export function createSessionCookie() {
  const secret = env('SESSION_SECRET');
  if (secret.length < 32) throw new HttpError(503, 'El panel todavía no está configurado.');
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, nonce: randomUUID() })).toString('base64url');
  const value = `${payload}.${signature(payload, secret)}`;
  return `${COOKIE_NAME}=${value}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function requireAdmin(request) {
  const secret = env('SESSION_SECRET');
  if (secret.length < 32) throw new HttpError(503, 'El panel todavía no está configurado.');
  const cookies = request.headers.get('cookie') || '';
  const pair = cookies.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`));
  if (!pair) throw new HttpError(401, 'La sesión venció. Inicia sesión de nuevo.');
  const value = pair.slice(COOKIE_NAME.length + 1);
  const dot = value.lastIndexOf('.');
  if (dot <= 0) throw new HttpError(401, 'La sesión venció. Inicia sesión de nuevo.');
  const payload = value.slice(0, dot);
  const supplied = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(signature(payload, secret));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new HttpError(401, 'La sesión venció. Inicia sesión de nuevo.');
  }
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isFinite(session.exp) || session.exp <= Date.now() / 1000) {
      throw new Error('expired');
    }
  } catch {
    throw new HttpError(401, 'La sesión venció. Inicia sesión de nuevo.');
  }
}
