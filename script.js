/* ---------- Playlist ---------- */
  // Opción A: define el ID público de Spotify. Opción B: canciones locales de respaldo.
  const SPOTIFY_PLAYLIST_ID = '59OqDrBVYGT8ViZFUUDA9t';
  // Para tracks reales vía Spotify Web API, usa un backend/serverless; nunca expongas client_secret en frontend.
  // Edita aquí las canciones que van a sonar en el evento.
  const playlist = [
    { t: '[Canción]', a: '[Artista]' },
    { t: '[Canción]', a: '[Artista]' },
    { t: '[Canción]', a: '[Artista]' },
    { t: '[Canción]', a: '[Artista]' },
    { t: '[Canción]', a: '[Artista]' },
    { t: '[Canción]', a: '[Artista]' },
    { t: '[Canción]', a: '[Artista]' },
    { t: '[Canción]', a: '[Artista]' }
  ];
  const player = document.getElementById('spotifyPlayer');
  const spotifyEmbed = document.getElementById('spotifyEmbed');
  const spotifyLink = document.getElementById('spotifyLink');
  const equalizer = document.getElementById('playlistEqualizer');
  const trackList = document.getElementById('trackList');
  const setEqualizerPlaying = playing => equalizer.classList.toggle('is-playing', playing);
  if (SPOTIFY_PLAYLIST_ID.trim()) {
    const id = SPOTIFY_PLAYLIST_ID.trim();
    player.classList.remove('hidden');
    spotifyLink.href = `https://open.spotify.com/playlist/${encodeURIComponent(id)}`;
    spotifyLink.classList.remove('hidden');

    // Spotify's iFrame API reports play/pause state for the embedded playlist.
    window.onSpotifyIframeApiReady = IFrameAPI => {
      IFrameAPI.createController(spotifyEmbed, {
        uri: `spotify:playlist:${id}`,
        width: '100%',
        height: 352
      }, controller => {
        controller.addListener('playback_update', event => {
          const state = event.data;
          setEqualizerPlaying(Boolean(state && !state.isPaused && !state.isBuffering));
        });
        controller.addListener('playback_started', () => setEqualizerPlaying(true));
      });
    };
    const spotifyApi = document.createElement('script');
    spotifyApi.src = 'https://open.spotify.com/embed/iframe-api/v1';
    spotifyApi.async = true;
    document.body.appendChild(spotifyApi);
  } else {
    trackList.innerHTML = playlist.map((x, i) => `
      <div class="track">
        <span class="font-display text-2xl w-8 text-center ${i % 2 ? 'text-lime glow-lime' : 'text-neon glow-pink'}">${String(i + 1).padStart(2, '0')}</span>
        <div class="flex-1 min-w-0">
          <p class="font-display uppercase text-xl truncate">${x.t}</p>
          <p class="text-white/60 uppercase tracking-widest text-xs">${x.a}</p>
        </div>
        <span class="text-lime text-lg" aria-hidden="true">♪</span>
      </div>`).join('');
    trackList.classList.remove('hidden');
  }

  /* ---------- Menú hamburguesa ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const iconOpen = document.getElementById('iconOpen');
  const iconClose = document.getElementById('iconClose');
  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden', !open);
    mobileMenu.classList.toggle('flex', open);
    iconOpen.classList.toggle('hidden', open);
    iconClose.classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  menuBtn.addEventListener('click', () => toggleMenu());
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

  /* ---------- Ruleta ---------- */
  // Cuando se definan los premios, reemplaza estos signos de pregunta por la lista real.
  // Para reactivarla: quita .ruleta-bloqueada y el panel de cuenta regresiva, y habilita la mecánica del botón.
  const prizes = Array(8).fill('?');
  const wheel = document.getElementById('wheel');
  const cx = 150, cy = 150, r = 140, n = prizes.length, seg = 360 / n;
  const fills = ['#FF00FF', '#0a0a0a', '#39FF14', '#0a0a0a'];
  const textFill = ['#000', '#FF00FF', '#000', '#39FF14'];
  const NS = 'http://www.w3.org/2000/svg';

  function polar(angleDeg, radius) {
    const a = (angleDeg - 90) * Math.PI / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  }
  prizes.forEach((label, i) => {
    const a0 = i * seg, a1 = (i + 1) * seg;
    const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`);
    path.setAttribute('fill', fills[i % fills.length]);
    path.setAttribute('stroke', '#39FF14');
    path.setAttribute('stroke-width', '2');
    wheel.appendChild(path);

    const mid = a0 + seg / 2;
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy - 92);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-family', 'Anton, Impact, sans-serif');
    text.setAttribute('font-size', '40');
    text.setAttribute('fill', textFill[i % textFill.length]);
    text.setAttribute('transform', `rotate(${mid} ${cx} ${cy})`);
    text.textContent = label;
    wheel.appendChild(text);
  });

  /* ---------- Cuenta regresiva ---------- */
  // Edita aquí la fecha del evento. El offset -05:00 fija la hora de Colombia.
  const EVENTO = new Date('2026-10-31T20:00:00-05:00');
  const cdLabel = document.getElementById('cdLabel');
  const countdownInterval = { id: null };
  const formatCountdown = value => String(value).padStart(2, '0');

  function tickCountdown() {
    const remaining = Math.max(0, EVENTO.getTime() - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    document.getElementById('cdD').textContent = formatCountdown(days);
    document.getElementById('cdH').textContent = formatCountdown(hours);
    document.getElementById('cdM').textContent = formatCountdown(minutes);
    document.getElementById('cdS').textContent = formatCountdown(seconds);

    if (remaining === 0) {
      cdLabel.textContent = '¡Ya empezó la fiesta!';
      if (countdownInterval.id !== null) clearInterval(countdownInterval.id);
    }
  }

  tickCountdown();
  if (Date.now() < EVENTO.getTime()) countdownInterval.id = setInterval(tickCountdown, 1000);

  // Dónde es
  const ADDRESS_TO_COPY = 'La Esquina de Abajo, Cl. 41 #46-257, Nte. Centro Histórico, Barranquilla, Atlántico';
  const copyAddressButton = document.getElementById('copyEventAddress');
  const copyAddressStatus = document.getElementById('copyAddressStatus');
  let copyStatusTimeout;

  async function copyEventAddress() {
    let copied = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API no disponible');
      await navigator.clipboard.writeText(ADDRESS_TO_COPY);
      copied = true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = ADDRESS_TO_COPY;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        textarea.remove();
      } catch {
        copied = false;
      }
    }
    copyAddressStatus.textContent = copied ? 'Dirección copiada' : 'No se pudo copiar';
    copyAddressStatus.dataset.error = String(!copied);
    window.clearTimeout(copyStatusTimeout);
    copyStatusTimeout = window.setTimeout(() => {
      copyAddressStatus.textContent = '';
      delete copyAddressStatus.dataset.error;
    }, 2500);
  }

  copyAddressButton?.addEventListener('click', copyEventAddress);

  // Use Google Maps JavaScript API when a restricted browser key is configured.
  // Keep the shared Google Maps iframe visible if the API key is missing or fails.
  const mapElement = document.getElementById('eventMap');
  const mapFallback = document.getElementById('eventMapFallback');
  const googleMapsKey = window.PURGATOWN_GOOGLE_MAPS_API_KEY;

  if (mapElement && googleMapsKey) {
    window.initPurgatownMap = () => {
      const location = { lat: 10.9887017, lng: -74.7816287 };
      const map = new google.maps.Map(mapElement, {
        center: location,
        zoom: 17,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: true,
        styles: [
          // Keep Google's dark map and nearby-place labels, but make the roads
          // quiet enough that the Purgatown frame and venue pin stay in focus.
          { elementType: 'geometry', stylers: [{ color: '#11131a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#ded9e5' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#11131a' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#34323e' }] },
          { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#aaa5b3' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#11131a' }] },
          { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#191a23' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e2029' }] },
          { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#c8c1d0' }] },
          { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'on' }] },
          { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14251f' }] },
          { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#91c9a5' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#282a34' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#b9b5c1' }] },
          { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#302f39' }] },
          { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#373641' }] },
          { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#35323c' }] },
          { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#403b46' }] },
          { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#302d39' }] },
          { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#c0b7c9' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1a28' }] }
        ]
      });

      new google.maps.Marker({
        map,
        position: location,
        title: 'La Esquina de Abajo',
        icon: {
          url: 'assets/img/purgatown-map-pin.svg',
          scaledSize: new google.maps.Size(38, 46),
          anchor: new google.maps.Point(19, 44)
        },
        zIndex: 1000
      });

      google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
        if (mapFallback) mapFallback.hidden = true;
      });
    };

    const mapsApi = document.createElement('script');
    mapsApi.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey)}&callback=initPurgatownMap&loading=async&v=weekly`;
    mapsApi.async = true;
    mapsApi.onerror = () => console.error('No se pudo cargar Google Maps; se mantiene el mapa de respaldo.');
    document.head.appendChild(mapsApi);
  }

