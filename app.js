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
      <div class="history-panel"><div class="history-heading"><div><small>OBSERVED PLAYER HISTORY</small><strong class="history-summary">Collecting real samples…</strong></div><span class="history-range">LAST 60 CHECKS</span></div><svg class="player-chart" viewBox="0 0 600 120" role="img" aria-label="Observed player-count history graph"><path class="chart-gridline" d="M0 20H600M0 60H600M0 100H600"/><polyline class="chart-line" points=""/></svg><div class="uptime-heading"><small>RECENT STATUS CHECKS</small><span class="uptime-value">Gathering samples</span></div><div class="uptime-strip" aria-label="Recent observed online and offline checks"></div></div>
      <div class="detail-grid"><div><small>GAME VERSION</small><strong class="version">Unknown</strong></div><div><small>SOFTWARE</small><strong class="software">Unknown</strong></div><div><small>RESPONSE</small><strong class="latency">—</strong></div><div><small>PORT / HOST</small><strong class="host-info">—</strong></div></div>
      <div class="motd-box"><small>SERVER MESSAGE / MOTD</small><p class="motd">Waiting for server response…</p></div>
      <div class="server-error" hidden><small>SERVER / API DIAGNOSTIC</small><p class="error-message"></p></div>
      <div class="sample-row"><div><small>PLAYERS ONLINE</small><div class="sample-players">Player list is not public.</div></div><button class="copy" type="button" title="Copy server address">COPY ADDRESS</button></div>
    </div>`;
  const button = $('.realm-bar', card);
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    $(`#realm-details-${index}`).hidden = open;
    $('.expand-icon', button).textContent = open ? '＋' : '−';
  });
  $('.copy', card).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(server.address); $('.copy', card).textContent = 'COPIED'; setTimeout(() => { $('.copy', card).textContent = 'COPY ADDRESS'; }, 1200); }
    catch { $('.copy', card).textContent = server.address; }
  });
  return card;
}

SERVERS.forEach((server, index) => grid.append(makeCard(server, index)));
$('#watch-count').textContent = String(SERVERS.length).padStart(2, '0');
const watchCards = $$('.realm', grid);

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

function recordObservation(address, data, errorMessage = '') {
  const list = observations[address] || (observations[address] = []);
  list.push({ at: Date.now(), online: Boolean(data?.online), players: data?.online && Number.isFinite(Number(data.players?.online)) ? Number(data.players.online) : null, note: errorMessage || apiErrorMessage(data) });
  observations[address] = list.slice(-HISTORY_LIMIT);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(observations)); } catch { /* Private browsing or quota: this-session samples still work. */ }
}

function renderHistory(card) {
  const list = observations[card.dataset.address] || [];
  const values = list.filter(sample => sample.online && Number.isFinite(sample.players));
  const line = $('.chart-line', card);
  const chart = $('.player-chart', card);
  const circlesHost = chart;
  chart.querySelectorAll('.sample-dot').forEach(dot => dot.remove());
  const max = Math.max(1, ...values.map(sample => sample.players));
  const coords = values.map(sample => ({ x: list.length < 2 ? 300 : list.indexOf(sample) * 600 / (list.length - 1), y: 100 - sample.players / max * 82, sample }));
  line.setAttribute('points', coords.map(point => `${point.x},${point.y}`).join(' '));
  coords.forEach(point => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('class', 'sample-dot'); dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y); dot.setAttribute('r', '3.5');
    dot.setAttribute('aria-label', `${point.sample.players} players at ${new Date(point.sample.at).toLocaleTimeString()}`);
    circlesHost.append(dot);
  });
  const latest = values.at(-1)?.players;
  const trend = values.length ? `${values.length} real samples · now ${latest.toLocaleString()} · peak ${max.toLocaleString()}` : 'Collecting real samples…';
  $('.history-summary', card).textContent = trend;
  const strip = $('.uptime-strip', card);
  strip.replaceChildren();
  list.forEach(sample => {
    const tick = document.createElement('i');
    tick.className = sample.online ? 'check-online' : 'check-offline';
    tick.title = `${new Date(sample.at).toLocaleString()} · ${sample.online ? `${sample.players ?? 0} players` : (sample.note || 'Offline')}`;
    strip.append(tick);
  });
  const onlineCount = list.filter(sample => sample.online).length;
  $('.uptime-value', card).textContent = list.length ? `${Math.round(onlineCount / list.length * 100)}% observed online · ${list.length} checks` : 'Gathering samples';
}

function apiErrorMessage(data) {
  const errors = [...(Array.isArray(data?.debug?.errors) ? data.debug.errors : []), ...(Array.isArray(data?.errors) ? data.errors : [])];
  return errors.map(error => typeof error === 'string' ? error : [error.type, error.message].filter(Boolean).join(': ')).filter(Boolean).join(' · ');
}

function updateCard(card, data, elapsed, requestError = '') {
  const online = Boolean(data.online);
  const badge = $('.status-badge', card);
  badge.className = `status-badge ${online ? 'online' : 'offline'}`;
  badge.innerHTML = `<i></i>${online ? 'ONLINE' : 'OFFLINE'}`;
  const onlineCount = online ? Number(data.players?.online || 0) : null;
  const maxCount = online ? Number(data.players?.max || 0) : null;
  $('.players', card).textContent = onlineCount === null ? '—' : onlineCount.toLocaleString();
  $('.capacity', card).textContent = online ? `${onlineCount.toLocaleString()} online / ${maxCount.toLocaleString()} max` : 'Server is unreachable';
  const percent = maxCount > 0 ? Math.max(0, Math.min(100, onlineCount / maxCount * 100)) : 0;
  $('.meter-track i', card).style.width = `${percent}%`;
  $('.version', card).textContent = data.version || 'Not reported';
  $('.software', card).textContent = data.software || data.software_name || 'Not reported';
  $('.latency', card).textContent = online ? `${elapsed} ms` : 'No response';
  $('.host-info', card).textContent = [data.hostname || data.ip || '—', data.port || ''].filter(Boolean).join(':');
  const motd = flatten(data.motd?.clean || data.motd?.raw || data.motd?.html) || (online ? 'This server did not provide a message.' : 'No MOTD was returned with the offline status.');
  $('.motd', card).textContent = motd.slice(0, 400);
  const sample = Array.isArray(data.players?.list) ? data.players.list.slice(0, 12).map(item => typeof item === 'string' ? item : item.name).filter(Boolean) : [];
  $('.sample-players', card).textContent = sample.length ? sample.join(' · ') : (online ? 'Server did not expose a public player sample.' : 'No player list is available while offline.');
  const error = requestError || apiErrorMessage(data) || (!online ? 'The status API reports this server as offline but supplied no more specific error. The outage could be on the server, network, or status-service side.' : '');
  const errorBox = $('.server-error', card);
  errorBox.hidden = !error;
  $('.error-message', card).textContent = error;
  const icon = $('.server-image', card);
  if (data.icon) {
    icon.onerror = () => { icon.hidden = true; $('.realm-emblem b', card).hidden = false; };
    icon.src = data.icon; icon.hidden = false; $('.realm-emblem b', card).hidden = true;
  }
  else { icon.hidden = true; $('.realm-emblem b', card).hidden = false; }
  $('.realm-bar', card).setAttribute('aria-label', `${card.querySelector('.realm-title strong').textContent}: ${online ? 'online' : 'offline'}, ${onlineCount ?? 'unknown'} players. Expand for details.`);
  recordObservation(card.dataset.address, data, requestError);
  renderHistory(card);
}

async function refreshCard(card) {
  const badge = $('.status-badge', card);
  badge.className = 'status-badge loading';
  badge.innerHTML = '<i></i> CHECKING';
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
  rotationBusy = true;
  await refreshCard(watchCards[rotationIndex % watchCards.length]);
  rotationIndex += 1;
  rotationBusy = false;
}, 1000);
$('#refresh-all').addEventListener('click', async () => {
  if (rotationBusy) return;
  rotationBusy = true;
  for (const card of watchCards) await refreshCard(card);
  rotationIndex = (rotationIndex + 1) % Math.max(watchCards.length, 1);
  rotationBusy = false;
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
  } catch { result.textContent = `Could not reach the status service for ${address}. Check the address or try again shortly.`; }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
