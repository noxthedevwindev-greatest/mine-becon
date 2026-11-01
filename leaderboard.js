(() => {
  const $ = selector => document.querySelector(selector);
  const rowsElement = $('#leader-rows');
  const search = $('#leader-search');
  const statusLine = $('#leaderboard-status');
  const allServers = new Map();
  const liveAddresses = new Set();
  const selectors = {
    edition: $('#edition-filter'), status: $('#status-filter'), tag: $('#tag-filter'),
    sort: $('#leader-sort'), size: $('#page-size')
  };
  let page = 1;
  let pageSize = Number(selectors.size.value) || 24;
  let retryDelay = 1000;
  let socket;
  let catalogState = { servers: [], total: 0, fetchedAt: 0, stale: false };
  const normalize = address => String(address || '').trim().toLowerCase().replace(/\.$/, '').replace(/:25565$/, '').replace(/:19132$/, '');
  const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const format = value => Number(value || 0).toLocaleString();
  const serverValues = status => {
    const count = numeric(status?.playerCount ?? status?.players?.online);
    return { online: count !== null, count };
  };
  const editionName = edition => {
    const value = String(edition || '').toLowerCase();
    if (value.includes('bedrock') || value === 'pe') return 'Bedrock';
    if (value.includes('cross')) return 'Java + Bedrock';
    return 'Java';
  };
  const upsert = (address, patch) => {
    const key = normalize(address);
    if (!key) return null;
    const existing = allServers.get(key) || { address: String(address).trim(), name: String(address).trim(), online: false, count: null, live: false };
    Object.assign(existing, patch);
    allServers.set(key, existing);
    return existing;
  };
  const applyCatalog = state => {
    if (!state) return;
    catalogState = state;
    for (const item of state.servers || []) {
      const address = item.port && Number(item.port) !== (String(item.edition).toLowerCase().includes('bedrock') ? 19132 : 25565) ? `${item.address}:${item.port}` : item.address;
      if (!address) continue;
      const existing = allServers.get(normalize(address));
      const patch = {
        name: item.name || address,
        address,
        edition: editionName(item.edition),
        online: String(item.status || '').toLowerCase() === 'online',
        count: numeric(item.currentPlayers),
        maxPlayers: numeric(item.maxPlayers),
        version: item.version || '',
        versionFamily: item.versionFamily || '',
        description: item.description || '',
        iconUrl: item.iconUrl || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        uptime: numeric(item.uptimePercent30d),
        votes: numeric(item.monthlyVotes),
        slug: item.slug || '',
        catalog: true,
        sourceUrl: item.slug ? `https://minecraftserver.id/en/server/${encodeURIComponent(item.slug)}` : ''
      };
      if (existing?.live) {
        patch.online = existing.online;
        patch.count = existing.count;
        patch.live = true;
        patch.edition = existing.edition || patch.edition;
      }
      upsert(address, patch);
    }
    refreshTags();
    updateSummary();
    rowsElement.setAttribute('aria-busy', state.loading ? 'true' : 'false');
  };
  const refreshTags = () => {
    const select = selectors.tag;
    const selected = select.value || 'all';
    const tags = new Set();
    allServers.forEach(server => (server.tags || []).forEach(tag => tags.add(String(tag))));
    select.replaceChildren(new Option('All game modes', 'all'));
    [...tags].sort((a, b) => a.localeCompare(b)).forEach(tag => select.add(new Option(tag, tag)));
    select.value = [...select.options].some(option => option.value === selected) ? selected : 'all';
  };
  const createIcon = server => {
    const box = document.createElement('span');
    box.className = 'multiplayer-icon';
    const fallback = document.createElement('span');
    fallback.textContent = (server.name || '?').trim().charAt(0).toUpperCase() || '?';
    box.append(fallback);
    if (server.iconUrl) {
      const image = document.createElement('img');
      image.src = server.iconUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => image.remove(), { once: true });
      box.append(image);
    }
    return box;
  };
  const createCard = (server, rank) => {
    const article = document.createElement('article');
    article.className = 'multiplayer-row';
    const rankElement = document.createElement('span');
    rankElement.className = 'multiplayer-rank';
    rankElement.textContent = String(rank).padStart(2, '0');
    const title = document.createElement('div');
    title.className = 'multiplayer-server';
    const name = document.createElement('strong');
    name.textContent = server.name || server.address;
    const address = document.createElement('small');
    address.textContent = server.address;
    title.append(name, address);
    const info = document.createElement('div');
    info.className = 'multiplayer-info';
    const edition = document.createElement('span');
    edition.className = 'edition-chip';
    edition.textContent = server.edition || 'Java';
    info.append(edition);
    if (server.version) {
      const version = document.createElement('span');
      version.className = 'version-chip';
      version.textContent = server.version;
      info.append(version);
    }
    (server.tags || []).slice(0, 2).forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'mode-chip';
      chip.textContent = tag;
      info.append(chip);
    });
    const playerBox = document.createElement('div');
    playerBox.className = 'multiplayer-player-count';
    const count = document.createElement('strong');
    count.textContent = server.online && server.count !== null ? `${format(server.count)}${server.maxPlayers ? ` / ${format(server.maxPlayers)}` : ''}` : 'Offline';
    const countLabel = document.createElement('small');
    countLabel.textContent = server.online ? (server.live ? 'LIVE PLAYERS' : 'LISTED PLAYERS') : 'NO RESPONSE';
    playerBox.append(count, countLabel);
    if (server.online && server.maxPlayers > 0 && server.count !== null) {
      const meter = document.createElement('span');
      meter.className = 'player-meter-track';
      const fill = document.createElement('i');
      fill.style.width = `${Math.min(100, (server.count / server.maxPlayers) * 100)}%`;
      meter.append(fill);
      playerBox.append(meter);
    }
    const state = document.createElement('span');
    state.className = `multiplayer-status ${server.online ? 'online' : 'offline'}`;
    const dot = document.createElement('i');
    const stateText = document.createElement('span');
    stateText.textContent = server.online ? 'ONLINE' : 'OFFLINE';
    state.append(dot, stateText);
    const metrics = document.createElement('span');
    metrics.className = 'multiplayer-metrics';
    if (server.uptime !== null && server.uptime !== undefined) metrics.textContent = `${server.uptime.toFixed(1)}% 30D`;
    else if (server.peak !== null && server.peak !== undefined) metrics.textContent = `24H PEAK ${format(server.peak)}`;
    else metrics.textContent = server.live ? 'LIVE FEED' : 'COMMUNITY LISTING';
    const action = document.createElement('a');
    action.className = 'multiplayer-open';
    action.href = `server.html?address=${encodeURIComponent(server.address)}`;
    action.textContent = 'DETAILS ↗';
    action.setAttribute('aria-label', `View ${server.name} details`);
    article.append(rankElement, createIcon(server), title, info, playerBox, state, metrics, action);
    return article;
  };
  const getFiltered = () => {
    const term = search.value.trim().toLowerCase();
    const edition = selectors.edition.value;
    const status = selectors.status.value;
    const tag = selectors.tag.value;
    const list = [...allServers.values()].filter(server => {
      const haystack = `${server.name} ${server.address} ${server.description} ${server.version} ${(server.tags || []).join(' ')}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (edition === 'java' && server.edition !== 'Java') return false;
      if (edition === 'bedrock' && server.edition !== 'Bedrock') return false;
      if (edition === 'cross' && !server.edition.toLowerCase().includes('bedrock')) return false;
      if (status === 'online' && !server.online) return false;
      if (status === 'offline' && server.online) return false;
      if (tag !== 'all' && !(server.tags || []).includes(tag)) return false;
      return true;
    });
    const sort = selectors.sort.value;
    list.sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'uptime') return (b.uptime ?? -1) - (a.uptime ?? -1) || (b.count ?? -1) - (a.count ?? -1);
      if (sort === 'votes') return (b.votes ?? -1) - (a.votes ?? -1) || (b.count ?? -1) - (a.count ?? -1);
      return (b.count ?? -1) - (a.count ?? -1) || Number(b.online) - Number(a.online) || (a.name || '').localeCompare(b.name || '');
    });
    return list;
  };
  const render = () => {
    const filtered = getFiltered();
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages);
    const start = (page - 1) * pageSize;
    rowsElement.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'leader-empty';
      empty.textContent = 'No servers match these filters. Try another search or clear a filter.';
      rowsElement.append(empty);
    } else filtered.slice(start, start + pageSize).forEach((server, index) => rowsElement.append(createCard(server, start + index + 1)));
    $('#leader-results').textContent = `${format(filtered.length)} server${filtered.length === 1 ? '' : 's'} · showing ${filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)}` : '0'}`;
    $('#leader-page').textContent = `Page ${page} of ${pages}`;
    $('#leader-prev').disabled = page <= 1;
    $('#leader-next').disabled = page >= pages;
  };
  const updateSummary = () => {
    const list = [...allServers.values()];
    const online = list.filter(server => server.online && server.count !== null);
    $('#leader-total-players').textContent = format(online.reduce((sum, server) => sum + server.count, 0));
    $('#leader-online-count').textContent = format(list.filter(server => server.online).length);
    $('#leader-tracked-count').textContent = format(list.length);
    $('#leader-live-count').textContent = format(list.filter(server => server.live).length);
    render();
  };
  const liveOrder = [];
  const updateLiveStatus = time => {
    const pieces = [];
    if (liveAddresses.size) pieces.push(`Minetrack live · ${liveAddresses.size} tracked`);
    if (catalogState.total) pieces.push(`${format(catalogState.total)} directory listings`);
    if (time) pieces.push(`updated ${time}`);
    if (!pieces.length) pieces.push(catalogState.error ? 'Directory unavailable · connecting to Minetrack…' : 'Connecting to live sources…');
    if (catalogState.stale) pieces.push('showing cached directory');
    statusLine.textContent = pieces.join(' · ');
  };
  search.addEventListener('input', () => { page = 1; render(); });
  Object.values(selectors).forEach(control => control.addEventListener('change', () => {
    if (control === selectors.size) pageSize = Number(control.value) || 24;
    page = 1;
    render();
  }));
  $('#leader-prev').addEventListener('click', () => { page = Math.max(1, page - 1); render(); });
  $('#leader-next').addEventListener('click', () => { page += 1; render(); });
  $('#leader-refresh').addEventListener('click', () => {
    if (window.MineBeaconCatalog) window.MineBeaconCatalog.refresh(true);
    if (socket?.readyState === WebSocket.OPEN) socket.send('requestHistoryGraph');
    updateLiveStatus('refresh requested');
  });
  window.addEventListener('minebeacon:catalog', event => applyCatalog(event.detail));
  if (window.MineBeaconCatalog?.state) applyCatalog(window.MineBeaconCatalog.state);
  const connect = () => {
    updateLiveStatus();
    try { socket = new WebSocket('wss://minetrack.me'); }
    catch { setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000); return; }
    socket.onopen = () => { retryDelay = 1000; };
    socket.onmessage = event => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload.message === 'init') {
        const config = payload.config?.servers || [];
        const updates = payload.servers || [];
        config.forEach((server, index) => {
          const address = server.ip || server.address || '';
          const values = serverValues(updates[index]);
          const item = upsert(address, {
            name: server.name || address,
            address,
            edition: editionName(server.type),
            online: values.online,
            count: values.count,
            live: true,
            tags: allServers.get(normalize(address))?.tags || [],
            peak: null
          });
          if (item) { liveAddresses.add(normalize(address)); liveOrder[index] = normalize(address); }
        });
        refreshTags();
        updateLiveStatus();
        updateSummary();
        if (payload.config?.isGraphVisible && socket.readyState === WebSocket.OPEN) socket.send('requestHistoryGraph');
      } else if (payload.message === 'historyGraph') {
        allServers.forEach(server => {
          if (!server.live) return;
          const index = liveOrder.indexOf(normalize(server.address));
          const values = (payload.graphData?.[index] || []).filter(value => numeric(value) !== null).map(Number);
          server.peak = values.length ? Math.max(...values) : 0;
        });
        render();
      } else if (payload.message === 'updateServers') {
        (payload.updates || []).forEach((item, index) => {
          const address = liveOrder[index];
          const server = allServers.get(address);
          if (!server) return;
          const values = serverValues(item);
          server.count = values.count;
          server.online = values.online;
          if (values.online) server.peak = Math.max(server.peak ?? 0, values.count);
        });
        const timestamp = numeric(payload.timestamp);
        updateLiveStatus(timestamp ? new Date(timestamp * 1000).toLocaleTimeString() : 'just now');
        updateSummary();
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      statusLine.textContent = 'Live feed disconnected · reconnecting…';
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
  };
  connect();
})();
