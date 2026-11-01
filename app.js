const API = 'https://api.mcsrvstat.us/3/';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function checkServer(address) {
  const response = await fetch(`${API}${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Status service returned ${response.status}`);
  return response.json();
}

function updateCard(card, data, elapsed) {
  const online = Boolean(data.online);
  const badge = $('.status-badge', card);
  badge.className = `status-badge ${online ? 'online' : 'offline'}`;
  badge.innerHTML = `<i></i>${online ? 'Online' : 'Offline'}`;
  $('.players', card).textContent = online ? (data.players?.online ?? 0).toLocaleString() : '—';
  $('.latency', card).textContent = online ? `${elapsed} ms` : 'No response';
  if (data.version) $('.edition', card).textContent = String(data.version).toUpperCase().slice(0, 26);
  const icon = $('.server-icon', card);
  if (data.icon) {
    icon.textContent = '';
    icon.style.backgroundImage = `url(${data.icon})`;
    icon.style.backgroundSize = 'cover';
  }
}

async function refreshCard(card) {
  const address = card.dataset.address;
  const badge = $('.status-badge', card);
  badge.className = 'status-badge loading';
  badge.innerHTML = '<i></i> Checking';
  const started = performance.now();
  try {
    updateCard(card, await checkServer(address), Math.round(performance.now() - started));
  } catch {
    badge.className = 'status-badge offline';
    badge.innerHTML = '<i></i> Unavailable';
    $('.players', card).textContent = '—';
    $('.latency', card).textContent = 'Try again later';
  }
}

$$('.server-card').forEach(refreshCard);
$('#refresh-all').addEventListener('click', () => $$('.server-card').forEach(refreshCard));

$$('.copy').forEach(button => button.addEventListener('click', async () => {
  const address = button.closest('.server-card').dataset.address;
  try {
    await navigator.clipboard.writeText(address);
    button.textContent = '✓';
    setTimeout(() => { button.textContent = '▢'; }, 1200);
  } catch { button.textContent = 'Copy blocked'; }
}));

$('#lookup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const address = $('#server-input').value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const result = $('#lookup-result');
  if (!address || /[\s<>]/.test(address)) {
    result.hidden = false;
    result.textContent = 'Enter a valid hostname or IP address.';
    return;
  }
  result.hidden = false;
  result.textContent = `Checking ${address}…`;
  const started = performance.now();
  try {
    const data = await checkServer(address);
    const elapsed = Math.round(performance.now() - started);
    const online = Boolean(data.online);
    const count = online ? `${(data.players?.online ?? 0).toLocaleString()} / ${(data.players?.max ?? 0).toLocaleString()} players` : 'No response from this server';
    result.innerHTML = `<strong>${online ? '🟢 Online' : '🔴 Offline'}</strong> · ${escapeHtml(address)}<br><span class="server-address">${escapeHtml(count)} · ${elapsed} ms${data.version ? ` · ${escapeHtml(data.version)}` : ''}</span>`;
  } catch {
    result.textContent = `Could not reach the status service for ${address}. Check the address or try again shortly.`;
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
