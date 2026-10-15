/* Sugerencias: backend */
import { env } from './security.mjs';
import { HttpError } from './http.mjs';

let appTokenCache = null;
let userTokenCache = null;

function required(name) {
  const value = env(name).trim();
  if (!value) throw new HttpError(503, 'La conexión con Spotify todavía no está configurada.');
  return value;
}

function basicAuth(clientId, clientSecret) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function fetchToken(body, authorization) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new HttpError(502, 'Spotify no pudo autorizar la solicitud.');
  return { data, expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 3600) - 60) * 1000 };
}

export async function getAppToken() {
  if (appTokenCache?.expiresAt > Date.now()) return appTokenCache.value;
  const clientId = required('SPOTIFY_CLIENT_ID');
  const clientSecret = required('SPOTIFY_CLIENT_SECRET');
  const token = await fetchToken({ grant_type: 'client_credentials' }, basicAuth(clientId, clientSecret));
  appTokenCache = { value: token.data.access_token, expiresAt: token.expiresAt };
  return appTokenCache.value;
}

export async function getUserToken() {
  if (userTokenCache?.expiresAt > Date.now()) return userTokenCache.value;
  const clientId = required('SPOTIFY_CLIENT_ID');
  const clientSecret = required('SPOTIFY_CLIENT_SECRET');
  const refreshToken = required('SPOTIFY_REFRESH_TOKEN');
  const token = await fetchToken({ grant_type: 'refresh_token', refresh_token: refreshToken }, basicAuth(clientId, clientSecret));
  userTokenCache = { value: token.data.access_token, expiresAt: token.expiresAt };
  return userTokenCache.value;
}

export async function spotifyRequest(url, token, options = {}) {
  const { timeoutMs = 12_000, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    headers: { Authorization: `Bearer ${token}`, ...(fetchOptions.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export function spotifyError(status, retryAfter) {
  if (status === 401) throw new HttpError(502, 'Spotify rechazó la autorización. Revisa la conexión de la cuenta.');
  if (status === 403) throw new HttpError(502, 'Spotify no permitió esta acción. Revisa los permisos y el acceso a la playlist.');
  if (status === 429) {
    const wait = Math.max(1, Number(retryAfter) || 30);
    throw new HttpError(429, `Spotify pidió esperar ${wait} segundos antes de volver a intentarlo.`, { retryAfter: wait });
  }
  throw new HttpError(502, `Spotify respondió con un error (${status}). Inténtalo de nuevo.`);
}

export function mapTrack(track) {
  if (!track?.id || !track?.uri) return null;
  return {
    id: track.id,
    uri: track.uri,
    name: String(track.name || 'Canción sin título').slice(0, 200),
    artists: Array.isArray(track.artists) ? track.artists.map(artist => String(artist?.name || '').slice(0, 100)).filter(Boolean) : [],
    album_image: track.album?.images?.[0]?.url || '',
    duration_ms: Math.max(0, Number(track.duration_ms) || 0),
    explicit: Boolean(track.explicit),
    spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${encodeURIComponent(track.id)}`
  };
}

export async function searchTracks(query) {
  const token = await getAppToken();
  const url = new URL('https://api.spotify.com/v1/search');
  url.search = new URLSearchParams({ q: query, type: 'track', limit: '10' });
  const { response, data } = await spotifyRequest(url, token);
  if (!response.ok) spotifyError(response.status, response.headers.get('retry-after'));
  const raw = data.tracks?.items ?? data.items?.items ?? [];
  return raw.map(mapTrack).filter(Boolean).slice(0, 10);
}

export async function getTrackById(id) {
  const token = await getAppToken();
  const { response, data } = await spotifyRequest(`https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}?market=CO`, token);
  if (!response.ok) spotifyError(response.status, response.headers.get('retry-after'));
  const track = mapTrack(data);
  if (!track) throw new HttpError(404, 'No encontramos esa canción en Spotify.');
  return track;
}

export async function playlistContains(trackUri) {
  const playlistId = required('SPOTIFY_PLAYLIST_ID');
  const token = await getUserToken();
  let url = new URL(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`);
  url.search = new URLSearchParams({ limit: '50', fields: 'next,items(item(uri,id))' });
  let pages = 0;
  while (url && pages < 100) {
    const { response, data } = await spotifyRequest(url, token);
    if (!response.ok) spotifyError(response.status, response.headers.get('retry-after'));
    const list = data.items?.items ?? data.items ?? [];
    if (list.some(row => (row.item ?? row.track ?? row)?.uri === trackUri)) return true;
    const next = data.items?.next ?? data.next;
    if (!next) return false;
    const nextUrl = new URL(next);
    if (nextUrl.hostname !== 'api.spotify.com') throw new HttpError(502, 'Spotify devolvió una respuesta no válida.');
    url = nextUrl;
    pages += 1;
  }
  if (url) throw new HttpError(503, 'No se pudo verificar la playlist completa. Inténtalo de nuevo.');
  return false;
}

export async function addTrackToPlaylist(trackUri) {
  const playlistId = required('SPOTIFY_PLAYLIST_ID');
  const token = await getUserToken();
  const { response } = await spotifyRequest(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`,
    token,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uris: [trackUri] }) }
  );
  if (!response.ok) spotifyError(response.status, response.headers.get('retry-after'));
}
