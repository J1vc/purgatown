# PURGATOWN

Sitio estático en HTML, CSS y JavaScript. El formulario de canciones sugeridas y el panel de revisión usan Netlify Functions y Netlify Blobs.

## Qué hace el flujo

- El público busca canciones con la API de Spotify y elige un resultado.
- El envío se verifica con Cloudflare Turnstile, se consulta de nuevo en Spotify y se guarda en estado `pending`.
- `/admin/` requiere contraseña. Solo una aprobación añade la canción a Spotify; el rechazo nunca modifica la playlist.
- Antes de añadir, el backend revisa si la canción ya existe en la playlist. Esto permite reintentar si Spotify aceptó una operación pero la función no alcanzó a guardar la aprobación.
- Las sugerencias y los índices usan Netlify Blobs con consistencia fuerte y escrituras condicionales para coordinar cambios simultáneos.

## Requisitos

- Node.js 20.5 o posterior.
- Un sitio Netlify conectado al repositorio Git o desplegado con Netlify CLI. Arrastrar la carpeta al deploy manual publica los archivos estáticos, pero no compila ni publica Netlify Functions ni sus dependencias.
- Una app de Spotify Developer. En Development Mode, Spotify requiere que la cuenta dueña tenga Premium y aplica límites de usuarios autorizados y acceso a la API. Verifica en el Dashboard que tu app puede usar Search, lectura y modificación de playlist antes de anunciar el formulario públicamente. El endpoint de búsqueda admite hasta 10 resultados por solicitud y agregar canciones usa `/v1/playlists/{id}/items`.
- Un widget de Cloudflare Turnstile con el dominio de producción y los hostnames de pruebas configurados.

## Preparación de Spotify

1. Crea una app en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) usando la cuenta que administra la playlist. Para Development Mode, mantén una suscripción Premium activa en la cuenta dueña.
2. En Redirect URIs agrega exactamente `http://127.0.0.1:8888/callback` para el script local. Spotify permite HTTP en direcciones loopback IP como `127.0.0.1`; no permite `localhost`. En producción se exige HTTPS para cualquier callback que no sea loopback. Este proyecto obtiene el refresh token localmente y no necesita un callback OAuth en producción.
3. Copia el Client ID y Client Secret a una copia local de `.env` (crea el archivo copiando `.env.example`). No compartas ese archivo ni lo subas al repositorio.
4. Ejecuta `node scripts/get-refresh-token.mjs`, inicia sesión con la cuenta dueña de la playlist y acepta los permisos. Copia el refresh token de la consola. El script solicita `playlist-modify-public`, `playlist-modify-private` y `playlist-read-private`; los dos primeros permiten agregar a playlists públicas o privadas, y el último permite comprobar si una canción ya está añadida.
5. Copia el ID de la playlist desde su enlace. Por ejemplo, en `https://open.spotify.com/playlist/59OqDrBVYGT8ViZFUUDA9t`, el ID es `59OqDrBVYGT8ViZFUUDA9t`.

## Turnstile

En Cloudflare crea un widget Turnstile y agrega el dominio del sitio (para local, usa las claves de prueba de Cloudflare). El `TURNSTILE_SITE_KEY` es público y la función `/api/config` lo entrega al navegador; `TURNSTILE_SECRET_KEY` permanece en Netlify y valida cada token en el servidor. Un token se acepta una sola vez y vence a los cinco minutos.

## Google Maps

El mapa usa Google Maps JavaScript API con una paleta oscura/neón y mantiene los puntos de interés de Google. Crea una clave de navegador en Google Cloud, habilita **Maps JavaScript API** y la facturación, y restringe la clave a esa API y al dominio `https://purgatown.netlify.app/*` (agrega el origen local si lo necesitas). La clave se expone al navegador y no debe tratarse como secreto; las restricciones de sitio web y API son obligatorias para proteger su uso.

En Netlify define `GOOGLE_MAPS_API_KEY` con alcance **Builds**. El build genera `maps-config.js`; si no hay clave configurada, el sitio conserva el iframe de Google Maps como respaldo. Para local, agrega la clave a `.env` y ejecuta `npm run build` antes de abrir la página.

## Configuración en Netlify

En **Project configuration → Environment variables**, configura estas variables en el contexto **Functions** para producción (y para Deploy Previews si vas a probar allí):

| Variable | Uso |
|---|---|
| `SPOTIFY_CLIENT_ID` | Identifica la app de Spotify |
| `SPOTIFY_CLIENT_SECRET` | Secreto del servidor para tokens |
| `SPOTIFY_REFRESH_TOKEN` | Permiso de la cuenta para gestionar la playlist |
| `SPOTIFY_PLAYLIST_ID` | ID de la playlist del evento |
| `ADMIN_PASSWORD` | Contraseña larga y exclusiva del panel `/admin/` |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres para firmar sesiones |
| `TURNSTILE_SITE_KEY` | Clave pública del widget, servida por `/api/config` |
| `TURNSTILE_SECRET_KEY` | Secreto de validación de Turnstile |
| `GOOGLE_MAPS_API_KEY` | Clave pública restringida para Maps JavaScript API; se usa durante el build |
| `IP_HASH_SALT` | Sal aleatoria larga; solo se guarda el hash SHA-256 de la IP |
| `SITE_ORIGIN` | Origen exacto, por ejemplo `https://tu-sitio.netlify.app` sin ruta |
| `ALLOW_EXPLICIT` | `true` permite explícitas y las marca; `false` las rechaza |
| `MAX_PENDING` | Máximo de sugerencias pendientes; predeterminado `300` |

`SPOTIFY_REDIRECT_URI` solo lo usa el script local de autorización. No se necesita como secreto de Functions. Nunca pongas secretos en `index.html`, `suggestions.js` ni variables públicas.

Puedes generar secretos con un administrador de contraseñas o con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` en una terminal local. No uses el mismo valor para `SESSION_SECRET` e `IP_HASH_SALT`.

Cuando cambies variables de entorno, crea un deploy nuevo para que las funciones y el mapa reciban esos valores.

## Instalación y despliegue

1. Instala la dependencia del proyecto con `npm install`.
2. Instala Netlify CLI fuera del proyecto (`npm install --global netlify-cli`) o usa una instalación que ya tengas.
3. Conecta el directorio al sitio de pruebas con `netlify link`.
4. Ejecuta `netlify dev`. La configuración local debe tener `SITE_ORIGIN` igual al origen que imprime Netlify CLI; si cambia, actualiza `.env`.
5. Prueba con una **playlist de prueba** y un sitio Netlify de prueba, no con la playlist del evento. Confirma búsqueda, Turnstile, envío pending, login, rechazo y aprobación; verifica que aprobar no duplique una canción existente.
6. Conecta el repositorio Git a Netlify (recomendado) o despliega con `netlify deploy --prod`. Ambos métodos detectan `netlify.toml`, instalan `@netlify/blobs` y despliegan funciones. El deploy manual de arrastrar una carpeta no sirve para publicar estas funciones.

En local, copia `.env.example` a `.env`, configura credenciales de pruebas y apunta `SPOTIFY_PLAYLIST_ID` a una playlist de prueba. Netlify CLI usa Blobs con consistencia fuerte. Mantén el sitio de pruebas separado del sitio de producción para que los datos y las aprobaciones no se mezclen.

## Privacidad y seguridad

- Los endpoints de escritura verifican el `Origin`, validan entradas y Turnstile, y usan un honeypot.
- El backend vuelve a consultar la canción a Spotify; nunca acepta título, artistas o portada enviados por el navegador.
- No se guarda la IP en texto plano. Solo el hash con `IP_HASH_SALT` se conserva junto a la sugerencia.
- El admin usa una cookie `HttpOnly`, `Secure`, `SameSite=Strict`, firmada con HMAC-SHA256 y válida por 12 horas. No hay enlace público al panel.
- Las sugerencias no garantizan que la canción suene. El administrador debe aprobarlas una por una.
- Las funciones responden con `Cache-Control: no-store`. La página `/admin/` agrega `noindex, nofollow`.

## Limitación de almacenamiento

Netlify Blobs es almacenamiento clave/valor, no una base de datos transaccional. El flujo usa consistencia fuerte, escrituras condicionales y bloqueos breves para coordinar envíos y revisiones del evento. Si el proyecto crece o necesita alta concurrencia y garantías transaccionales estrictas, migra los contadores y las revisiones a una base de datos con transacciones.
