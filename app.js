const SERVERS = [
  { name: 'Hypixel', address: 'mc.hypixel.net', mode: 'Adventure', color: 'gold' },
  { name: 'CubeCraft', address: 'play.cubecraft.net', mode: 'Minigames', color: 'blue' },
  { name: 'Wynncraft', address: 'play.wynncraft.com', mode: 'RPG', color: 'violet' },
  { name: 'MCC Island', address: 'play.mccisland.net', mode: 'Minigames', color: 'cyan' },
  { name: 'ManaCube', address: 'hub.manacube.net', mode: 'Survival', color: 'green' },
  { name: 'Purple Prison', address: 'purpleprison.net', mode: 'Prison', color: 'violet' },
  { name: 'Complex Gaming', address: 'hub.mc-complex.com', mode: 'Pixelmon', color: 'gold' },
  { name: 'DonutSMP', address: 'donutsmp.net', mode: 'Survival', color: 'orange' },
  { name: 'JartexNetwork', address: 'play.jartexnetwork.com', mode: 'Network', color: 'red' },
  { name: 'PikaNetwork', address: 'play.pika-network.net', mode: 'Network', color: 'blue' }
];
const API = 'https://api.mcsrvstat.us/3/';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const grid = $('#server-grid');
const normalizeAddress = address => String(address || '').trim().toLowerCase().replace(/\.$/, '').replace(/:(25565|19132)$/, '');

function makeCard(server, index) {
  const card = document.createElement('article');
  card.className = `realm ${server.color}`;
  card.dataset.address = server.address;
  card.innerHTML = `<button class="realm-bar" type="button" aria-expanded="false" aria-controls="realm-details-${index}">
    <span class="realm-number">${String(index + 1).padStart(2, '0')}</span><span class="realm-emblem"><img class="server-image" alt="" hidden><b>${escapeHtml(server.name.slice(0, 1))}</b></span>
    <span class="realm-title"><strong>${escapeHtml(server.name)}</strong><small>${escapeHtml(server.address)}</small></span>
    <span class="realm-type">${escapeHtml(server.mode)}</span><span class="bar-players"><strong class="players">—</strong><small>PLAYERS</small></span>
    <span class="status-badge loading"><i></i> Checking</span><span class="expand-icon">＋</span></button>
    <div class="realm-details" id="realm-details-${index}" hidden>
      <div class="player-meter"><div class="meter-label"><span>PLAYER CAPACITY</span><strong class="capacity">Waiting for status</strong></div><div class="meter-track"><i></i></div></div>
      <div class="history-panel"><div class="history-heading"><div><small>PLAYER HISTORY</small><strong class="history-summary">Loading Minetrack's 24-hour graph…</strong></div><span class="history-range">24 HOURS · 1-MIN SAMPLES</span></div><div class="chart-wrap"><svg class="player-chart" viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="Player count over the last 24 hours"><path class="chart-gridline" d="M0 20H600M0 60H600M0 100H600"/><circle class="chart-hover-dot" cx="0" cy="0" r="5" hidden></circle></svg><div class="chart-tooltip" role="status" hidden></div></div><div class="chart-axis"><span>24 hours ago</span><span>Now</span></div><div class="chart-hint">Hover or tap the graph for the exact player count and time.</div><div class="uptime-heading"><small>24-HOUR OBSERVED STATUS</small><span class="uptime-value">Loading</span></div><div class="uptime-strip" aria-label="Recent observed online and offline checks"></div></div>
      <div class="detail-grid"><div><small>GAME VERSION</small><strong class="version">Unknown</strong></div><div><small>SOFTWARE</small><strong class="software">Unknown</strong></div><div><small>RESPONSE</small><strong class="latency">—</strong></div><div><small>PORT / HOST</small><strong class="host-info">—</strong></div></div>
      <div class="motd-box"><small>SERVER MESSAGE / MOTD</small><p class="motd">Waiting for server response…</p></div>
      <a class="server-page-link" href="server.html?address=${encodeURIComponent(server.address)}">OPEN FULL SERVER PAGE <span>↗</span></a>
      <div class="server-error" hidden><small>SERVER / API DIAGNOSTIC</small><p class="error-message"></p></div>
      <div class="favorite-row"><button class="favorite-toggle" type="button" aria-pressed="false">☆ Add to favorites</button><span class="favorite-note">Saved on this device</span></div>
      <div class="sample-row"><div><small>PLAYERS ONLINE</small><div class="sample-players">Player list is not public.</div></div><button class="copy" type="button" title="Copy server address">COPY ADDRESS</button></div>
    </div>`;
  const button = $('.realm-bar', card);
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    $(`#realm-details-${index}`).hidden = open;
    $('.expand-icon', button).textContent = open ? '＋' : '−';
    if (!open) renderHistory(card);
  });
  $('.copy', card).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(server.address); $('.copy', card).textContent = 'COPIED'; setTimeout(() => { $('.copy', card).textContent = 'COPY ADDRESS'; }, 1200); }
    catch { $('.copy', card).textContent = server.address; }
  });
  $('.favorite-toggle', card).addEventListener('click', () => toggleFavorite(card));
  return card;
}

let watchCards = [];
const cardsByAddress = new Map();
function addServerCard(server) {
  const key = normalizeAddress(server.address);
  if (cardsByAddress.has(key)) return cardsByAddress.get(key);
  const card = makeCard(server, watchCards.length);
  if (server.featured) card.dataset.featured = 'true';
  grid.append(card);
  watchCards.push(card);
  cardsByAddress.set(key, card);
  $('#watch-count').textContent = String(watchCards.length).padStart(2, '0');
  $('#directory-count').textContent = String(watchCards.length).padStart(2, '0');
  return card;
}
SERVERS.forEach(server => addServerCard({ ...server, featured: true }));
const FAVORITES_KEY = 'minebeacon:favorites:v1';
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]').map(normalizeAddress)); } catch { /* Favorites remain usable for this session. */ }
let favoritesOnly = false;

function toggleFavorite(card) {
  const address = normalizeAddress(card.dataset.address);
  if (favorites.has(address)) favorites.delete(address);
  else favorites.add(address);
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch { /* Storage may be unavailable. */ }
  const button = $('.favorite-toggle', card);
  const active = favorites.has(address);
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? '★ Saved to favorites' : '☆ Add to favorites';
  arrangeServers();
}

function arrangeServers() {
  const query = $('#server-filter').value.trim().toLocaleLowerCase();
  const sort = $('#server-sort').value;
  const cards = [...watchCards];
  cards.forEach(card => {
    const searchText = `${card.querySelector('.realm-title').textContent} ${card.querySelector('.realm-type').textContent} ${card.dataset.search || ''}`.toLocaleLowerCase();
    card.hidden = Boolean(query && !searchText.includes(query)) || (favoritesOnly && !favorites.has(normalizeAddress(card.dataset.address)));
  });
  if (sort === 'players') cards.sort((a, b) => Number(b.dataset.players ?? -1) - Number(a.dataset.players ?? -1));
  if (sort === 'name') cards.sort((a, b) => a.querySelector('.realm-title strong').textContent.localeCompare(b.querySelector('.realm-title strong').textContent));
  if (sort === 'status') cards.sort((a, b) => Number(b.dataset.online === 'true') - Number(a.dataset.online === 'true'));
  cards.forEach(card => grid.append(card));
}

function applyCatalogListing(card, server) {
  card.dataset.catalogSource = 'msid';
  card.dataset.catalogSlug = server.slug || '';
  card.dataset.catalogOnline = String(server.status === 'ONLINE');
  const count = server.currentPlayers;
  const hasCount = count !== null && count !== undefined && Number.isFinite(Number(count));
  card.dataset.catalogPlayers = hasCount ? String(Number(count)) : '';
  card.dataset.catalogDescription = server.description || '';
  card.dataset.search = [server.description, server.version, ...(server.tags || []), server.edition, server.owner?.username].filter(Boolean).join(' ');
  if (card.dataset.featured !== 'true' && card.dataset.minetrackLive !== 'true') {
    card.querySelector('.realm-title strong').textContent = server.name || server.address;
    card.querySelector('.realm-type').textContent = `${server.edition === 'BEDROCK' ? 'BEDROCK' : server.edition === 'CROSS_PLAY' ? 'JAVA + BEDROCK' : 'JAVA'}${server.tags?.length ? ` · ${server.tags[0]}` : ''}`;
  }
  const live = card.dataset.minetrackLive === 'true';
  const online = live ? card.dataset.minetrackOnline === 'true' : server.status === 'ONLINE';
  const players = live ? (online ? Number(card.dataset.minetrackPlayers) : null) : (online && hasCount ? Number(count) : null);
  const max = Number(server.maxPlayers || card.dataset.maxPlayers || 0);
  if (max > 0) card.dataset.maxPlayers = String(max);
  card.dataset.online = String(online);
  card.dataset.players = online ? String(players ?? 0) : '-1';
  const badge = $('.status-badge', card);
  badge.className = `status-badge ${online ? 'online' : 'offline'}`;
  badge.innerHTML = `<i></i>${online ? 'ONLINE' : 'OFFLINE'}`;
  $('.players', card).textContent = players === null ? '—' : players.toLocaleString();
  $('.bar-players small', card).textContent = live ? 'LIVE COUNT' : 'INDEX SAMPLE';
  $('.capacity', card).textContent = online ? `${players === null ? 'Count unavailable' : `${players.toLocaleString()} online`} / ${max ? `${max.toLocaleString()} max` : 'capacity unknown'}` : 'Directory reports this server offline';
  $('.meter-track i', card).style.width = online && max && players !== null ? `${Math.max(0, Math.min(100, players / max * 100))}%` : '0%';
  $('.version', card).textContent = server.version || 'Not reported';
  $('.software', card).textContent = server.edition?.replace('_', ' ') || 'Community listing';
  $('.latency', card).textContent = live ? 'Minetrack live' : 'Public listing';
  $('.host-info', card).textContent = `${server.address}${server.port && Number(server.port) !== 25565 ? `:${server.port}` : ''}`;
  const description = flatten(server.description || server.tags?.join(' · ') || 'No community description provided.');
  if (description) $('.motd', card).textContent = description.slice(0, 400);
  const icon = $('.server-image', card);
  if (server.iconUrl) { icon.onerror = () => { icon.hidden = true; $('.realm-emblem b', card).hidden = false; }; icon.src = server.iconUrl; icon.hidden = false; $('.realm-emblem b', card).hidden = true; }
  const errorBox = $('.server-error', card);
  if (!online) {
    const message = $('.error-message', card);
    if (!message.textContent.startsWith('Minetrack live probe:')) {
      message.textContent = 'The public directory currently reports this server offline. Open its profile for an independent status check and any available probe diagnostics.';
      errorBox.hidden = false;
    }
  } else if (!$('.error-message', card).textContent.startsWith('Minetrack live probe:')) errorBox.hidden = true;
  $('.realm-bar', card).setAttribute('aria-label', `${card.querySelector('.realm-title strong').textContent}: ${online ? 'online' : 'offline'}, ${players ?? 'unknown'} players`);
}

function applyCatalog(state) {
  if (!state) return;
  for (const server of state.servers || []) {
    if (!server.address) continue;
    const address = server.port && Number(server.port) !== (server.edition === 'BEDROCK' ? 19132 : 25565) ? `${server.address}:${server.port}` : server.address;
    const mode = server.edition === 'BEDROCK' ? 'Bedrock' : (server.edition === 'CROSS_PLAY' ? 'Cross-play' : 'Java');
    const serverCard = addServerCard({ name: server.name || address, address, mode: `${mode}${server.tags?.length ? ` · ${server.tags[0]}` : ''}`, color: 'cyan' });
    applyCatalogListing(serverCard, server);
  }
  $('#catalog-count').textContent = String(state.total || state.servers?.length || 0);
  $('#catalog-status').textContent = state.error ? `Community list temporarily unavailable · ${state.stale ? 'showing saved results' : 'Minetrack feed still works'}` : state.loading ? 'Refreshing community listings…' : `${state.stale ? 'Saved' : 'Updated'} community listings · ${new Date(state.fetchedAt || Date.now()).toLocaleTimeString()} · provider checks about every 5 minutes`;
  arrangeServers();
}
window.addEventListener('minebeacon:catalog', event => applyCatalog(event.detail));
if (window.MineBeaconCatalog) applyCatalog(window.MineBeaconCatalog.state);

function applyCommunityServers(servers = []) {
  for (const server of servers) {
    if (!server.address || !server.name) continue;
    const mode = server.edition === 'BEDROCK' ? 'Bedrock' : server.edition === 'CROSS_PLAY' ? 'Java + Bedrock' : 'Java';
    const card = addServerCard({ name: server.name, address: server.address, mode: `${mode} · Community`, color: 'cyan' });
    card.dataset.custom = 'true';
    card.dataset.search = [server.description, server.edition, 'community custom'].filter(Boolean).join(' ');
    if (server.description) $('.motd', card).textContent = server.description;
    if (!card.dataset.catalogSource && !card.dataset.minetrackLive && !card.dataset.customChecked) {
      card.dataset.customChecked = 'true';
      refreshCard(card);
    }
  }
  arrangeServers();
}
window.addEventListener('minebeacon:custom-servers', event => applyCommunityServers(event.detail));
if (window.MineBeaconCommunity?.servers) applyCommunityServers(window.MineBeaconCommunity.servers);

$('#custom-server-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const server = {
    name: String(data.get('name') || '').trim(),
    address: String(data.get('address') || '').trim().toLowerCase(),
    edition: String(data.get('edition') || 'JAVA'),
    description: String(data.get('description') || '').trim(),
    website: String(data.get('website') || '')
  };
  const message = $('#custom-server-message');
  const button = form.querySelector('button[type="submit"]');
  if (!server.name || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(server.address)) {
    message.textContent = 'Enter a valid name and server hostname, optionally followed by a port.';
    return;
  }
  button.disabled = true;
  window.MineBeaconCommunity?.saveLocal(server);
  message.textContent = 'Added to this browser. Checking whether shared submissions are connected…';
  try {
    if (window.MineBeaconCommunity?.base && !server.website) {
      const result = await window.MineBeaconCommunity.submit(server);
      message.textContent = result.message || 'Submitted for shared-directory review.';
    } else {
      message.textContent = 'Added to this browser. Shared submissions are not connected yet.';
    }
    form.reset();
  } catch (error) {
    message.textContent = `${error.message} Your entry remains saved on this browser.`;
  } finally { button.disabled = false; }
});

$('#server-filter').addEventListener('input', arrangeServers);
$('#server-sort').addEventListener('change', arrangeServers);
$('#favorites-filter').addEventListener('click', event => {
  favoritesOnly = !favoritesOnly;
  event.currentTarget.setAttribute('aria-pressed', String(favoritesOnly));
  event.currentTarget.textContent = favoritesOnly ? '★ Favorites' : '☆ Favorites';
  arrangeServers();
});
watchCards.forEach(card => {
  const button = $('.favorite-toggle', card);
  const active = favorites.has(normalizeAddress(card.dataset.address));
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? '★ Saved to favorites' : '☆ Add to favorites';
});

async function checkServer(address) {
  const response = await fetch(`${API}${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Status service returned ${response.status}`);
  return response.json();
}

function flatten(value) {
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(' ').trim();
  if (value && typeof value === 'object') return '';
  return value == null ? '' : String(value).replace(/§[0-9a-fk-or]/gi, '').trim();
}

const HISTORY_KEY = 'minebeacon:observations:v1';
const HISTORY_LIMIT = 60;
const HISTORY_WINDOW = 24 * 60 * 60 * 1000;

function readHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    const cutoff = Date.now() - HISTORY_WINDOW;
    for (const address of Object.keys(saved)) saved[address] = Array.isArray(saved[address]) ? saved[address].filter(sample => sample.at > cutoff).slice(-HISTORY_LIMIT) : [];
    return saved;
  } catch { return {}; }
}
const observations = readHistory();
const dayHistory = new Map();

function recordObservation(address, data, errorMessage = '', at = Date.now(), source = 'Direct status check') {
  const list = observations[address] || (observations[address] = []);
  list.push({ at, online: Boolean(data?.online), players: data?.online && Number.isFinite(Number(data.players?.online)) ? Number(data.players.online) : null, note: errorMessage || apiErrorMessage(data), source });
  observations[address] = list.slice(-HISTORY_LIMIT);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(observations)); } catch { /* Private browsing or quota: this-session samples still work. */ }
}

function renderHistory(card) {
  if ($('.realm-details', card).hidden) return;
  const hasDayHistory = dayHistory.has(card.dataset.address);
  const list = hasDayHistory ? dayHistory.get(card.dataset.address) : (observations[card.dataset.address] || []);
  const values = list.filter(sample => sample.online && Number.isFinite(sample.players));
  const chart = $('.player-chart', card);
  const hoverDot = $('.chart-hover-dot', chart);
  chart.querySelectorAll('.chart-segment').forEach(segment => segment.remove());
  const max = Math.max(1, ...values.map(sample => sample.players));
  let segment = [];
  const drawSegment = () => {
    if (!segment.length) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('class', 'chart-line chart-segment');
    line.setAttribute('points', segment.map(point => `${point.x},${point.y}`).join(' '));
    chart.insertBefore(line, hoverDot);
    segment = [];
  };
  list.forEach((sample, index) => {
    if (!sample.online || !Number.isFinite(sample.players)) { drawSegment(); return; }
    const x = list.length < 2 ? 300 : index * 600 / (list.length - 1);
    segment.push({ x, y: 100 - sample.players / max * 82 });
  });
  drawSegment();
  const latest = values.at(-1)?.players;
  const trend = values.length ? `${hasDayHistory ? '24h graph' : 'Local samples'} · ${values.length} online points · latest ${latest.toLocaleString()} · peak ${max.toLocaleString()}` : 'Collecting real samples…';
  $('.history-summary', card).textContent = trend;
  $('.history-range', card).textContent = hasDayHistory ? 'MINETRACK · 24 HOURS' : 'LOCAL RECENT HISTORY';
  $('.chart-axis span:first-child', card).textContent = hasDayHistory ? '24 hours ago' : 'Oldest local check';
  $('.uptime-heading small', card).textContent = hasDayHistory ? '24-HOUR OBSERVED STATUS' : 'RECENT OBSERVED STATUS';
  if (!chart.dataset.hoverBound) {
    chart.dataset.hoverBound = 'true';
    const tooltip = $('.chart-tooltip', card);
    chart.addEventListener('pointermove', event => {
      const samples = dayHistory.get(card.dataset.address) || observations[card.dataset.address] || [];
      if (!samples.length) return;
      const rect = chart.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const index = Math.round(fraction * (samples.length - 1));
      const sample = samples[index];
      if (!sample) return;
      const time = new Date(sample.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      tooltip.textContent = `${time} · ${sample.online ? `${sample.players.toLocaleString()} players` : 'No response'}${sample.source ? ` · ${sample.source}` : ''}`;
      tooltip.hidden = false;
      tooltip.style.left = `${Math.max(12, Math.min(88, fraction * 100))}%`;
      const dotX = fraction * 600;
      if (sample.online && Number.isFinite(sample.players)) {
        hoverDot.setAttribute('cx', dotX);
        hoverDot.setAttribute('cy', 100 - sample.players / Math.max(1, ...samples.filter(item => item.online).map(item => item.players)) * 82);
        hoverDot.removeAttribute('hidden');
      } else hoverDot.setAttribute('hidden', '');
    });
    chart.addEventListener('pointerleave', () => { tooltip.hidden = true; hoverDot.setAttribute('hidden', ''); });
  }
  const strip = $('.uptime-strip', card);
  strip.replaceChildren();
  list.slice(-60).forEach(sample => {
    const tick = document.createElement('i');
    tick.className = sample.online ? 'check-online' : 'check-offline';
    tick.title = `${new Date(sample.at).toLocaleString()} · ${sample.source || 'Status check'} · ${sample.online ? `${sample.players ?? 0} players` : (sample.note || 'Offline')}`;
    strip.append(tick);
  });
  const onlineCount = list.filter(sample => sample.online).length;
  $('.uptime-value', card).textContent = list.length ? `${Math.round(onlineCount / list.length * 100)}% observed online · ${list.length} samples` : 'Gathering samples';
}

function apiErrorMessage(data) {
  const errors = [...(Array.isArray(data?.debug?.errors) ? data.debug.errors : []), ...(Array.isArray(data?.errors) ? data.errors : [])];
  return errors.map(error => typeof error === 'string' ? error : [error.type, error.message].filter(Boolean).join(': ')).filter(Boolean).join(' · ');
}

function updateCard(card, data, elapsed, requestError = '') {
  const apiOnline = Boolean(data.online);
  const liveCount = card.dataset.minetrackLive === 'true';
  const indexed = card.dataset.catalogSource === 'msid';
  const indexedOnline = card.dataset.catalogOnline === 'true';
  const online = liveCount ? card.dataset.minetrackOnline === 'true' : (indexed ? indexedOnline : apiOnline);
  card.dataset.online = String(online);
  const indexedCount = card.dataset.catalogPlayers === '' ? null : Number(card.dataset.catalogPlayers);
  const onlineCount = liveCount ? (online ? Number(card.dataset.minetrackPlayers) : null) : (indexed ? (online ? indexedCount : null) : (online ? Number(data.players?.online || 0) : null));
  const maxCount = apiOnline ? Number(data.players?.max || 0) : Number(card.dataset.maxPlayers || 0);
  if (apiOnline && maxCount > 0) card.dataset.maxPlayers = String(maxCount);
  card.dataset.players = online ? String(onlineCount ?? 0) : '-1';
  const badge = $('.status-badge', card);
  badge.className = `status-badge ${online ? 'online' : 'offline'}`;
  badge.innerHTML = `<i></i>${online ? 'ONLINE' : 'OFFLINE'}`;
  $('.players', card).textContent = onlineCount === null ? '—' : onlineCount.toLocaleString();
  $('.capacity', card).textContent = online ? `${onlineCount.toLocaleString()} online / ${maxCount ? maxCount.toLocaleString() : 'unknown'} max` : 'Server is unreachable';
  const percent = maxCount > 0 ? Math.max(0, Math.min(100, onlineCount / maxCount * 100)) : 0;
  $('.meter-track i', card).style.width = `${percent}%`;
  $('.version', card).textContent = data.version || 'Not reported';
  $('.software', card).textContent = data.software || data.software_name || 'Not reported';
  $('.latency', card).textContent = apiOnline ? `${elapsed} ms` : (requestError ? 'API unavailable' : 'No response');
  $('.host-info', card).textContent = [data.hostname || data.ip || '—', data.port || ''].filter(Boolean).join(':');
  const motd = flatten(data.motd?.clean || data.motd?.raw || data.motd?.html) || (indexed && card.dataset.catalogDescription ? card.dataset.catalogDescription : (!apiOnline && liveCount && online ? 'Minetrack sees players online, but the detail API returned no MOTD.' : (apiOnline ? 'This server did not provide a message.' : 'No MOTD was returned with the offline status.')));
  $('.motd', card).textContent = motd.slice(0, 400);
  const sample = Array.isArray(data.players?.list) ? data.players.list.slice(0, 12).map(item => typeof item === 'string' ? item : item.name).filter(Boolean) : [];
  $('.sample-players', card).textContent = sample.length ? sample.join(' · ') : (online ? 'Server did not expose a public player sample.' : 'No player list is available while offline.');
  const mismatch = (liveCount && apiOnline !== online) || (indexed && apiOnline !== indexedOnline);
  const primarySource = liveCount ? 'Minetrack' : 'minecraftserver.id';
  const error = requestError || apiErrorMessage(data) || (mismatch ? `Status sources disagree: ${primarySource} reports ${online ? 'online' : 'offline'}, while MCSRVStat reports ${apiOnline ? 'online' : 'offline'}.` : (!apiOnline ? (online ? `${primarySource} reports this server online, but MCSRVStat returned no online response.` : 'The status API reports this server as offline but supplied no more specific error. The outage could be on the server, network, or status-service side.') : ''));
  const errorBox = $('.server-error', card);
  errorBox.hidden = !error;
  $('.error-message', card).textContent = error;
  const icon = $('.server-image', card);
  if (data.icon) {
    icon.onerror = () => { icon.hidden = true; $('.realm-emblem b', card).hidden = false; };
    icon.src = data.icon; icon.hidden = false; $('.realm-emblem b', card).hidden = true;
  }
  else { icon.hidden = true; $('.realm-emblem b', card).hidden = false; }
  $('.bar-players small', card).textContent = card.dataset.minetrackLive === 'true' ? 'LIVE COUNT' : 'PLAYERS';
  $('.realm-bar', card).setAttribute('aria-label', `${card.querySelector('.realm-title strong').textContent}: ${online ? 'online' : 'offline'}, ${onlineCount ?? 'unknown'} players. Expand for details.`);
  recordObservation(card.dataset.address, data, requestError);
  renderHistory(card);
  arrangeServers();
}

function applyMinetrackCount(card, playerCount, timestamp, error = '') {
  const online = playerCount !== null && playerCount !== undefined && Number.isFinite(Number(playerCount));
  const count = online ? Number(playerCount) : null;
  card.dataset.minetrackLive = 'true';
  card.dataset.minetrackOnline = String(online);
  card.dataset.minetrackPlayers = online ? String(count) : '';
  card.dataset.online = String(online);
  card.dataset.players = online ? String(count) : '-1';
  const badge = $('.status-badge', card);
  badge.className = `status-badge ${online ? 'online' : 'offline'}`;
  badge.innerHTML = `<i></i>${online ? 'ONLINE' : 'OFFLINE'}`;
  $('.players', card).textContent = online ? count.toLocaleString() : '—';
  $('.bar-players small', card).textContent = 'LIVE COUNT';
  $('.capacity', card).textContent = online ? `${count.toLocaleString()} live players / ${Number(card.dataset.maxPlayers || 0) ? `${Number(card.dataset.maxPlayers).toLocaleString()} max` : 'capacity unknown'}` : 'Minetrack probe reports no response';
  const max = Number(card.dataset.maxPlayers || 0);
  $('.meter-track i', card).style.width = online && max ? `${Math.max(0, Math.min(100, count / max * 100))}%` : '0%';
  const errorBox = $('.server-error', card);
  if (!online && error) {
    errorBox.hidden = false;
    $('.error-message', card).textContent = `Minetrack live probe: ${error}`;
  } else if ($('.error-message', card).textContent.startsWith('Minetrack live probe:')) {
    errorBox.hidden = true;
  }
  $('.realm-bar', card).setAttribute('aria-label', `${card.querySelector('.realm-title strong').textContent}: ${online ? 'online' : 'offline'}, ${count ?? 'unknown'} players. Expand for details.`);
  recordObservation(card.dataset.address, { online, players: { online: count } }, error, Number(timestamp) * 1000 || Date.now(), 'Minetrack live');
  renderHistory(card);
  arrangeServers();
}

async function refreshCard(card) {
  if (card.dataset.catalogSource === 'msid') return;
  const badge = $('.status-badge', card);
  if (card.dataset.minetrackLive !== 'true') {
    badge.className = 'status-badge loading';
    badge.innerHTML = '<i></i> CHECKING';
  }
  const started = performance.now();
  try { updateCard(card, await checkServer(card.dataset.address), Math.round(performance.now() - started)); }
  catch (error) {
    const message = error?.name === 'TimeoutError' ? 'Status request timed out after 10 seconds.' : `Status request failed: ${error?.message || 'Unknown network error.'}`;
    updateCard(card, { online: false }, 0, message);
  }
}

let rotationIndex = 0;
let rotationBusy = false;
rotationBusy = true;
refreshCard(watchCards[0]).finally(() => {
  rotationIndex = 1;
  rotationBusy = false;
});
setInterval(async () => {
  if (document.hidden || rotationBusy || watchCards.length === 0) return;
  const refreshable = watchCards.filter(card => card.dataset.catalogSource !== 'msid');
  if (!refreshable.length) return;
  rotationBusy = true;
  await refreshCard(refreshable[rotationIndex % refreshable.length]);
  rotationIndex += 1;
  rotationBusy = false;
}, 1000);
$('#refresh-all').addEventListener('click', async () => {
  if (rotationBusy) return;
  rotationBusy = true;
  const button = $('#refresh-all');
  const cards = watchCards.filter(card => card.dataset.catalogSource !== 'msid');
  try {
    await window.MineBeaconCatalog?.refresh(true);
    for (let index = 0; index < cards.length; index++) {
      button.innerHTML = `<span>↻</span> ${index + 1}/${cards.length}`;
      await refreshCard(cards[index]);
      if (index < cards.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    rotationIndex = (rotationIndex + 1) % Math.max(cards.length, 1);
  } finally {
    button.innerHTML = '<span>↻</span> Refresh list';
    rotationBusy = false;
  }
});

$('#lookup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const address = $('#server-input').value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const result = $('#lookup-result');
  if (!address || /[\s<>]/.test(address)) { result.hidden = false; result.textContent = 'Enter a valid hostname or IP address.'; return; }
  result.hidden = false; result.textContent = `Scanning ${address}…`;
  const started = performance.now();
  try {
    const data = await checkServer(address);
    const count = data.online ? `${(data.players?.online ?? 0).toLocaleString()} / ${(data.players?.max ?? 0).toLocaleString()} players` : 'No response from this server';
    result.textContent = `${data.online ? 'ONLINE' : 'OFFLINE'} · ${address} · ${count} · ${Math.round(performance.now() - started)} ms · ${data.version || 'Version unknown'} · ${flatten(data.motd?.clean)}`;
    const profileLink = document.createElement('a');
    profileLink.className = 'server-page-link';
    profileLink.href = `server.html?address=${encodeURIComponent(address)}`;
    profileLink.textContent = 'OPEN FULL PROFILE ↗';
    result.append(' ', profileLink);
  } catch { result.textContent = `Could not reach the status service for ${address}. Check the address or try again shortly.`; }
});

function startMinetrackFeed() {
  let retryDelay = 1000;
  let socket;
  let feedServers = [];
  const feedState = $('#feed-state');
  const setFeedState = text => {
    feedState.textContent = text;
    $('.mini-live .pulse-dot').classList.toggle('disconnected', text.toLowerCase().includes('disconnected'));
  };
  const connect = () => {
    setFeedState('Connecting to Minetrack live data…');
    try { socket = new WebSocket('wss://minetrack.me'); }
    catch { setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000); return; }
    socket.onopen = () => { retryDelay = 1000; setFeedState('Minetrack live feed connected · syncing'); };
    socket.onmessage = event => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload.message === 'init') {
        feedServers = (payload.config?.servers || []).map((server, index) => {
          const card = addServerCard({
            name: server.name || server.ip,
            address: server.ip,
            mode: server.type === 'PE' ? 'Bedrock' : 'Java',
            color: 'cyan'
          });
          card.dataset.minetrackServerId = String(index);
          const favorite = $('.favorite-toggle', card);
          const isFavorite = favorites.has(card.dataset.address);
          favorite.setAttribute('aria-pressed', String(isFavorite));
          favorite.textContent = isFavorite ? '★ Saved to favorites' : '☆ Add to favorites';
          return card;
        });
        const initTimestamp = payload.timestampPoints?.at(-1) || Date.now() / 1000;
        (payload.servers || []).forEach((status, index) => {
          const card = feedServers[index];
          if (card) applyMinetrackCount(card, status.playerCount, initTimestamp, status.error?.message || '');
        });
        if (payload.config?.isGraphVisible && socket.readyState === WebSocket.OPEN) socket.send('requestHistoryGraph');
        setFeedState(`Minetrack live · ${feedServers.length} tracked servers · updated just now`);
        return;
      }
      if (payload.message === 'historyGraph') {
        feedServers.forEach((card, index) => {
          const counts = payload.graphData?.[index] || [];
          const history = (payload.timestamps || []).map((timestamp, pointIndex) => {
            const count = counts[pointIndex];
            const online = count !== null && count !== undefined && Number.isFinite(Number(count));
            return { at: Number(timestamp) * 1000, online, players: online ? Number(count) : null, note: online ? '' : 'No response', source: 'Minetrack 24-hour history' };
          });
          dayHistory.set(card.dataset.address, history);
          renderHistory(card);
        });
        setFeedState(`Minetrack live · 24-hour graphs loaded · ${feedServers.length} servers`);
        return;
      }
      if (payload.message === 'updateServers') {
        (payload.updates || []).forEach((update, index) => {
          const card = feedServers[index];
          if (card) applyMinetrackCount(card, update.playerCount, payload.timestamp, update.error?.message || '');
        });
        if (payload.updateHistoryGraph) {
          feedServers.forEach((card, index) => {
            const history = dayHistory.get(card.dataset.address);
            const update = payload.updates?.[index];
            if (!history || !update) return;
            const count = update.playerCount;
            const online = count !== null && count !== undefined && Number.isFinite(Number(count));
            history.push({ at: Number(payload.timestamp) * 1000, online, players: online ? Number(count) : null, note: update.error?.message || '', source: 'Minetrack live history' });
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            dayHistory.set(card.dataset.address, history.filter(sample => sample.at > cutoff).slice(-1440));
            renderHistory(card);
          });
        }
        const updatedAt = new Date(Number(payload.timestamp) * 1000);
        setFeedState(`Minetrack live · ${feedServers.length} tracked servers · updated ${updatedAt.toLocaleTimeString()}`);
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      watchCards.forEach(card => {
        if (card.dataset.minetrackLive === 'true') $('.bar-players small', card).textContent = 'STALE';
      });
      setFeedState('Minetrack feed disconnected · retrying');
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
  };
  connect();
}
startMinetrackFeed();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
const communityStyles = document.createElement('link');
communityStyles.rel = 'stylesheet'; communityStyles.href = 'profile-history.css'; document.head.append(communityStyles);
