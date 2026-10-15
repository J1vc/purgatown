#!/usr/bin/env node
/* Sugerencias: backend — se ejecuta localmente y nunca se despliega. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

async function loadLocalEnv() {
  try {
    const content = await readFile(new URL('../.env', import.meta.url), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || match[1] in process.env) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function saveRefreshToken(token) {
  const envPath = new URL('../.env', import.meta.url);
  let content = '';
  try {
    content = await readFile(envPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const line = `SPOTIFY_REFRESH_TOKEN=${token}`;
  const updated = /^SPOTIFY_REFRESH_TOKEN=.*$/m.test(content)
    ? content.replace(/^SPOTIFY_REFRESH_TOKEN=.*$/m, line)
    : `${content.trimEnd()}\n${line}\n`;
  await writeFile(envPath, updated, { encoding: 'utf8', mode: 0o600 });
}

await loadLocalEnv();
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback';
if (!clientId || !clientSecret) {
  console.error('Define SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en .env antes de continuar.');
  process.exit(1);
}
const redirect = new URL(redirectUri);
if (redirect.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(redirect.hostname)) {
  console.error('Para este script registra una URI loopback local, por ejemplo http://127.0.0.1:8888/callback.');
  process.exit(1);
}

const state = randomBytes(24).toString('base64url');
const scopes = ['playlist-modify-public', 'playlist-modify-private', 'playlist-read-private'].join(' ');
const authorization = new URL('https://accounts.spotify.com/authorize');
authorization.search = new URLSearchParams({
  response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: scopes, state, show_dialog: 'true'
}).toString();

const server = createServer(async (request, response) => {
  const url = new URL(request.url, redirect.origin);
  if (url.pathname !== redirect.pathname) {
    response.writeHead(404).end('No encontrado.');
    return;
  }
  if (url.searchParams.get('state') !== state) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('La verificación de seguridad falló. Puedes cerrar esta pestaña.');
    server.close();
    process.exitCode = 1;
    return;
  }
  const code = url.searchParams.get('code');
  if (!code) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Spotify no devolvió un código de autorización. Puedes cerrar esta pestaña.');
    server.close();
    process.exitCode = 1;
    return;
  }
  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(15_000)
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.refresh_token) throw new Error(`Spotify rechazó la autorización (${tokenResponse.status}).`);
    const granted = new Set(String(tokenData.scope || '').split(' '));
    for (const scope of scopes.split(' ')) {
      if (!granted.has(scope)) throw new Error(`Falta el permiso ${scope}. Ejecuta el script de nuevo y acepta los permisos.`);
    }
    await saveRefreshToken(tokenData.refresh_token);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><meta charset="utf-8"><title>Spotify autorizado</title><p>Spotify quedó autorizado. El refresh token se guardó en .env local. Puedes cerrar esta pestaña.</p>');
    console.log('\nAutorización completada. El refresh token se guardó en .env local. Copia el valor de SPOTIFY_REFRESH_TOKEN desde ese archivo a Netlify.');
    console.log('No publiques ni compartas .env.');
    process.exitCode = 0;
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No se pudo obtener el token. Revisa la consola.');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.on('error', error => {
  console.error(`No se pudo abrir ${redirectUri}: ${error.message}`);
  process.exit(1);
});
server.listen(Number(redirect.port || 80), redirect.hostname.replace(/^\[|\]$/g, ''), () => {
  console.log(`Escuchando en ${redirectUri}. Autoriza PURGATOWN en Spotify...`);
  console.log(`Si no se abrió el navegador, visita esta dirección:\n${authorization.toString()}`);
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', authorization.toString()] : [authorization.toString()];
  const opener = spawn(command, args, { detached: true, stdio: 'ignore', shell: false });
  opener.on('error', () => console.log(`Abre esta dirección manualmente:\n${authorization.toString()}`));
  opener.unref();
});
