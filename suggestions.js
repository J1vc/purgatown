/* Sugerencias: frontend */
(() => {
  const search = document.getElementById('songSearch');
  const resultsBox = document.getElementById('songResults');
  const searchStatus = document.getElementById('searchStatus');
  const form = document.getElementById('suggestionForm');
  const status = document.getElementById('suggestionStatus');
  const submit = document.getElementById('submitSuggestion');
  const nameInput = document.getElementById('requesterName');
  const honeypot = document.getElementById('website');
  const widgetBox = document.getElementById('turnstileWidget');
  if (!search || !resultsBox || !form) return;

  let timer = null;
  let searchController = null;
  let currentResults = [];
  let activeIndex = -1;
  let selectedTrack = null;
  let widgetId = null;
  let turnstileToken = '';
  let siteKey = '';
  let apiReady = null;

  const setMessage = (node, message, isError = false) => {
    node.textContent = message;
    node.dataset.error = String(isError);
  };
  const formatDuration = ms => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
  const spotifyUrl = track => {
    try {
      const url = new URL(track.spotify_url);
      return url.hostname === 'open.spotify.com' && url.protocol === 'https:' ? url.href : '#';
    } catch { return '#'; }
  };

  const configPromise = fetch('/api/config', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('config')))
    .then(config => { siteKey = typeof config.turnstileSiteKey === 'string' ? config.turnstileSiteKey : ''; return siteKey; })
    .catch(() => '');

  function ensureTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (apiReady) return apiReady;
    apiReady = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('No se pudo cargar la verificación antispam.')), 12_000);
      window.purgatownTurnstileReady = () => { window.clearTimeout(timeout); resolve(window.turnstile); };
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=purgatownTurnstileReady&render=explicit';
      script.async = true;
      script.defer = true;
      script.onerror = () => { window.clearTimeout(timeout); reject(new Error('No se pudo cargar la verificación antispam.')); };
      document.head.appendChild(script);
    });
    return apiReady;
  }

  async function renderTurnstile() {
    submit.disabled = true;
    siteKey = await configPromise;
    if (!siteKey) {
      setMessage(status, 'La recepción de sugerencias aún no está habilitada.', true);
      return;
    }
    try {
      const turnstile = await ensureTurnstile();
      if (widgetId !== null) turnstile.remove(widgetId);
      turnstileToken = '';
      widgetId = turnstile.render(widgetBox, {
        sitekey: siteKey,
        theme: 'dark',
        callback: token => { turnstileToken = token; submit.disabled = false; },
        'expired-callback': () => { turnstileToken = ''; submit.disabled = true; },
        'error-callback': () => { turnstileToken = ''; submit.disabled = true; setMessage(status, 'No se pudo completar la verificación. Recarga el reto.', true); }
      });
    } catch (error) {
      setMessage(status, error.message, true);
    }
  }

  function closeResults() {
    resultsBox.hidden = true;
    search.setAttribute('aria-expanded', 'false');
    search.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function renderResults(items) {
    currentResults = items;
    activeIndex = -1;
    resultsBox.replaceChildren();
    if (!items.length) {
      closeResults();
      setMessage(searchStatus, 'No encontramos esa canción. Prueba con otro nombre.');
      return;
    }
    items.forEach((track, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `song-option-${index}`;
      option.className = 'suggestion-result';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const row = document.createElement('div');
      row.className = 'suggestion-result-row';
      row.setAttribute('role', 'group');
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      if (track.album_image) image.src = track.album_image;
      const copy = document.createElement('span');
      copy.className = 'suggestion-result-copy';
      const title = document.createElement('strong');
      title.textContent = track.name;
      const artists = document.createElement('span');
      artists.textContent = track.artists.join(', ');
      copy.append(title, artists);
      const duration = document.createElement('span');
      duration.className = 'suggestion-result-duration';
      duration.textContent = formatDuration(track.duration_ms);
      option.append(image, copy, duration);
      if (track.explicit) {
        const explicit = document.createElement('span');
        explicit.className = 'explicit-mark';
        explicit.textContent = 'E';
        explicit.setAttribute('aria-label', 'Contenido explícito');
        option.append(explicit);
      }
      option.addEventListener('click', () => chooseTrack(track));
      const spotifyLink = document.createElement('a');
      spotifyLink.className = 'suggestion-row-spotify';
      spotifyLink.href = spotifyUrl(track);
      spotifyLink.target = '_blank';
      spotifyLink.rel = 'noopener noreferrer';
      spotifyLink.textContent = 'Spotify';
      spotifyLink.setAttribute('aria-label', `Abrir ${track.name} en Spotify`);
      row.append(option, spotifyLink);
      resultsBox.appendChild(row);
    });
    resultsBox.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    setMessage(searchStatus, `${items.length} resultados. Usa las flechas y Enter para elegir.`);
  }

  function chooseTrack(track) {
    selectedTrack = track;
    closeResults();
    form.hidden = false;
    document.getElementById('selectedImage').src = track.album_image || '';
    document.getElementById('selectedImage').alt = `Portada de ${track.name}`;
    document.getElementById('selectedTitle').textContent = track.name;
    document.getElementById('selectedArtists').textContent = track.artists.join(', ');
    document.getElementById('selectedDuration').textContent = formatDuration(track.duration_ms);
    const link = document.getElementById('selectedSpotifyLink');
    link.href = spotifyUrl(track);
    setMessage(searchStatus, '');
    setMessage(status, '');
    renderTurnstile();
    form.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  async function runSearch(query) {
    searchController?.abort();
    searchController = new AbortController();
    setMessage(searchStatus, 'Buscando en Spotify…');
    resultsBox.replaceChildren();
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: searchController.signal, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 429 ? 'Alcanzaste el límite de búsquedas. Espera un momento.' : (data.error || 'No se pudo buscar en Spotify.'));
      renderResults(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      if (error.name === 'AbortError') return;
      closeResults();
      setMessage(searchStatus, error.message || 'Error de red. Revisa tu conexión e inténtalo de nuevo.', true);
    }
  }

  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    searchController?.abort();
    selectedTrack = null;
    form.hidden = true;
    submit.disabled = true;
    setMessage(status, '');
    const query = search.value.trim();
    if (query.length < 2) {
      closeResults();
      resultsBox.replaceChildren();
      setMessage(searchStatus, query ? 'Escribe al menos 2 caracteres.' : '');
      return;
    }
    timer = window.setTimeout(() => runSearch(query), 350);
  });

  search.addEventListener('keydown', event => {
    if (resultsBox.hidden || !currentResults.length) {
      if (event.key === 'Escape') closeResults();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + direction + currentResults.length) % currentResults.length;
      [...resultsBox.children].forEach((row, index) => row.querySelector('[role="option"]')?.setAttribute('aria-selected', String(index === activeIndex)));
      search.setAttribute('aria-activedescendant', `song-option-${activeIndex}`);
      resultsBox.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      chooseTrack(currentResults[activeIndex]);
    } else if (event.key === 'Escape') {
      closeResults();
    }
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.suggestion-search-wrap')) closeResults();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedTrack || !turnstileToken || submit.disabled) return;
    submit.disabled = true;
    setMessage(status, 'Enviando sugerencia…');
    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: selectedTrack.id, requesterName: nameInput.value.trim(), turnstileToken, website: honeypot.value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (response.status === 429 ? 'Alcanzaste el límite de envíos. Inténtalo más tarde.' : 'No se pudo enviar la sugerencia.'));
      setMessage(status, '¡Listo! Tu sugerencia quedó en revisión.');
      search.value = '';
      nameInput.value = '';
      honeypot.value = '';
      selectedTrack = null;
      form.hidden = true;
      setMessage(searchStatus, '');
      if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId);
      widgetId = null;
      turnstileToken = '';
    } catch (error) {
      setMessage(status, error.message || 'Error de red. Revisa tu conexión e inténtalo de nuevo.', true);
      if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
      turnstileToken = '';
      submit.disabled = true;
    }
  });
})();
