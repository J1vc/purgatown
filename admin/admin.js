/* Sugerencias: admin */
const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const dashboardStatus = document.getElementById('dashboardStatus');
const list = document.getElementById('suggestionList');
let activeStatus = 'pending';

const message = (node, text, error = false) => { node.textContent = text; node.dataset.error = String(error); };
const duration = ms => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
const date = value => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};
const spotifyHref = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'open.spotify.com' ? url.href : '#'; }
  catch { return '#'; }
};

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) showLogin('La sesión venció. Inicia sesión de nuevo.');
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

function showLogin(note = '') {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  message(loginStatus, note, Boolean(note));
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  loadCounts();
  loadSuggestions(activeStatus);
}

function buildCard(item) {
  const card = document.createElement('article');
  card.className = 'admin-suggestion';
  const image = document.createElement('img');
  image.className = 'admin-cover';
  image.alt = '';
  image.loading = 'lazy';
  image.src = item.album_image || '';
  const copy = document.createElement('div');
  copy.className = 'admin-copy';
  const title = document.createElement('h2');
  title.textContent = item.title;
  if (item.explicit) {
    const explicit = document.createElement('span');
    explicit.className = 'explicit-tag';
    explicit.textContent = 'E';
    explicit.setAttribute('aria-label', 'Contenido explícito');
    title.append(' ', explicit);
  }
  const artists = document.createElement('p');
  artists.textContent = item.artists;
  const meta = document.createElement('div');
  meta.className = 'admin-meta';
  const trackDuration = document.createElement('span');
  trackDuration.textContent = duration(item.duration_ms);
  const created = document.createElement('span');
  created.textContent = date(item.created_at);
  const requester = document.createElement('span');
  requester.textContent = item.requester_name ? `Sugerida por ${item.requester_name}` : 'Sugerencia anónima';
  meta.append(trackDuration, created, requester);
  const links = document.createElement('div');
  links.className = 'admin-links';
  const spotify = document.createElement('a');
  spotify.href = spotifyHref(item.spotify_url);
  spotify.target = '_blank';
  spotify.rel = 'noopener noreferrer';
  spotify.textContent = 'Abrir en Spotify';
  links.appendChild(spotify);
  copy.append(title, artists, meta, links);
  card.append(image, copy);
  if (activeStatus === 'pending') {
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    const approve = document.createElement('button');
    approve.className = 'button button-green';
    approve.type = 'button';
    approve.textContent = 'Aprobar';
    approve.addEventListener('click', () => review(item.id, 'approve', approve, reject));
    const reject = document.createElement('button');
    reject.className = 'button button-reject';
    reject.type = 'button';
    reject.textContent = 'Rechazar';
    reject.addEventListener('click', () => review(item.id, 'reject', reject, approve));
    actions.append(approve, reject);
    card.appendChild(actions);
  }
  return card;
}

async function loadSuggestions(status) {
  activeStatus = status;
  list.replaceChildren();
  message(dashboardStatus, 'Cargando sugerencias…');
  try {
    const data = await api(`/api/admin/suggestions?status=${encodeURIComponent(status)}`);
    message(dashboardStatus, '');
    if (!data.suggestions?.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = status === 'pending' ? 'No hay sugerencias pendientes.' : 'Todavía no hay canciones en esta pestaña.';
      list.appendChild(empty);
      return;
    }
    data.suggestions.forEach(item => list.appendChild(buildCard(item)));
  } catch (error) {
    message(dashboardStatus, error.message, true);
  }
}

async function loadCounts() {
  for (const status of ['pending', 'approved', 'rejected']) {
    try {
      const data = await api(`/api/admin/suggestions?status=${status}`);
      document.getElementById(`count-${status}`).textContent = String(data.suggestions?.length || 0);
    } catch (error) {
      if (error.message) message(dashboardStatus, error.message, true);
      return;
    }
  }
}

async function review(id, action, button, otherButton) {
  button.disabled = true;
  otherButton.disabled = true;
  message(dashboardStatus, action === 'approve' ? 'Aprobando canción…' : 'Rechazando sugerencia…');
  try {
    const result = await api(`/api/admin/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (action === 'approve') {
      message(dashboardStatus, result.wasOnPlaylist ? 'La canción ya estaba en la playlist y la sugerencia quedó aprobada.' : 'Agregada a la playlist.');
    } else {
      message(dashboardStatus, 'Sugerencia rechazada.');
    }
    await Promise.all([loadCounts(), loadSuggestions(activeStatus)]);
  } catch (error) {
    message(dashboardStatus, error.message, true);
    button.disabled = false;
    otherButton.disabled = false;
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = loginForm.querySelector('button');
  button.disabled = true;
  message(loginStatus, 'Verificando…');
  try {
    await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('adminPassword').value })
    });
    document.getElementById('adminPassword').value = '';
    showDashboard();
  } catch (error) {
    message(loginStatus, error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(other => other.classList.toggle('active', other === tab));
  loadSuggestions(tab.dataset.status);
}));

document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); }
  catch (error) { message(dashboardStatus, error.message, true); }
  showLogin('Sesión cerrada.');
});

api('/api/admin/suggestions?status=pending').then(showDashboard).catch(error => {
  if (!String(error.message).includes('sesión')) message(loginStatus, error.message, true);
});
