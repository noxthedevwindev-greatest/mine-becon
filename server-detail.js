(() => {
  for (const source of ['api-config.js', 'site-cache.js']) {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    document.head.append(script);
  }
  const historyStyles = document.createElement('link');
  historyStyles.rel = 'stylesheet'; historyStyles.href = 'profile-history.css'; document.head.append(historyStyles);
  const q = selector => document.querySelector(selector);
  const address = new URLSearchParams(location.search).get('address')?.trim() || '';
  const els = {
    name: q('#profile-name'), address: q('#profile-address'), mode: q('#profile-mode'), badge: q('#profile-badge'), players: q('#profile-players'), updated: q('#profile-updated'),
    version: q('#profile-version'), software: q('#profile-software'), capacity: q('#profile-capacity'), latency: q('#profile-latency'), host: q('#profile-host'), motd: q('#profile-motd'), diagnostic: q('#profile-diagnostic'), icon: q('#profile-icon'),
    chart: q('#profile-chart'), tooltip: q('#profile-tooltip'), summary: q('#profile-chart-summary'), range: q('#profile-chart-range')
  };
  let feedIndex = -1;
  let samples = [];
  let yearlySamples = [];
  let historyMode = '24h';
  let maxPlayers = 1;
  let apiOnline = null;
  let liveOnline = null;
  let socket;
  let retry = 1000;
  const offlineReasons = new Map();
  const yearSelect = q('#history-year');
  const yearNote = q('#profile-yearly-note');
  const yearNow = new Date().getUTCFullYear();
  for (let year = yearNow; year >= yearNow - 5; year -= 1) yearSelect.add(new Option(String(year), String(year)));
  const updateStatus = (count, error = '', timestamp = Date.now() / 1000) => {
    const online = count !== null && count !== undefined && Number.isFinite(Number(count));
    const players = online ? Number(count) : null;
    liveOnline = online;
    els.badge.className = `status-badge ${online ? 'online' : 'offline'}`;
    els.badge.innerHTML = `<i></i>${online ? 'ONLINE' : 'OFFLINE'}`;
    els.players.textContent = online ? players.toLocaleString() : '—';
    els.updated.textContent = `Updated ${new Date(Number(timestamp) * 1000).toLocaleTimeString()}`;
    if (error) offlineReasons.set('live', error);
    else offlineReasons.delete('live');
    showDiagnostic();
    if (historyMode === '24h' && samples.length) els.summary.textContent = `${samples.length.toLocaleString()} Minetrack samples · peak ${maxPlayers.toLocaleString()} players · latest ${online ? players.toLocaleString() : 'offline'}`;
  };
  const showDiagnostic = () => {
    const messages = [...offlineReasons.values()].filter(Boolean);
    if (apiOnline !== null && liveOnline !== null && apiOnline !== liveOnline) {
      messages.unshift(`Status sources disagree: Minetrack reports ${liveOnline ? 'online' : 'offline'}; MCSRVStat reports ${apiOnline ? 'online' : 'offline'}.`);
    }
    const text = [...new Set(messages)].join(' · ');
    els.diagnostic.hidden = !text;
    els.diagnostic.textContent = text;
  };
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  const draw = () => {
    els.chart.querySelectorAll('.chart-segment').forEach(line => line.remove());
    const points = historyMode === 'year' ? yearlySamples : samples;
    const available = points.filter(point => point.online && Number.isFinite(point.players));
    maxPlayers = Math.max(1, ...available.map(point => point.players));
    let segment = [];
    const flush = () => {
      if (!segment.length) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('class', 'chart-line chart-segment');
      line.setAttribute('points', segment.map(point => `${point.x},${point.y}`).join(' '));
      els.chart.insertBefore(line, els.chart.querySelector('.chart-hover-dot'));
      segment = [];
    };
    points.forEach((point, index) => {
      if (!point.online || !Number.isFinite(point.players)) { flush(); return; }
      segment.push({ x: points.length > 1 ? index * 600 / (points.length - 1) : 300, y: 118 - point.players / maxPlayers * 96 });
    });
    flush();
    els.range.textContent = points.length ? (historyMode === 'year' ? `YEARLY · ${yearSelect.value} · DAILY SAMPLES` : 'MINETRACK · 24 HOURS · 1-MIN SAMPLES') : (historyMode === 'year' ? 'NO YEARLY HISTORY' : 'NO UPSTREAM HISTORY');
    if (historyMode === 'year') {
      els.summary.textContent = points.length ? `${points.length} daily snapshots · peak ${maxPlayers.toLocaleString()} players · latest ${available.at(-1)?.players.toLocaleString() ?? 'offline'}` : 'Yearly snapshots become available after the MineBeacon collector is configured.';
      els.chart.setAttribute('aria-label', `Daily player count during ${yearSelect.value}`);
    } else {
      els.summary.textContent = samples.length ? `${samples.length.toLocaleString()} Minetrack samples · peak ${maxPlayers.toLocaleString()} players · latest ${available.at(-1)?.players.toLocaleString() ?? 'offline'}` : (feedIndex >= 0 ? 'Waiting for Minetrack to send daily history…' : 'This address is not currently in Minetrack’s tracked feed. Its live graph is not available.');
      els.chart.setAttribute('aria-label', 'Player count over the last 24 hours');
    }
    const axis = els.chart.closest('.profile-chart-card').querySelectorAll('.chart-axis span');
    if (axis.length) { axis[0].textContent = historyMode === 'year' ? `JAN ${yearSelect.value}` : '24 hours ago'; axis[1].textContent = historyMode === 'year' ? `DEC ${yearSelect.value}` : 'Now'; }
  };
  let hoverBound = false;
  const bindHover = () => {
    if (hoverBound) return;
    hoverBound = true;
    els.chart.addEventListener('pointermove', event => {
      const points = historyMode === 'year' ? yearlySamples : samples;
      if (!points.length) return;
      const rect = els.chart.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const index = Math.round(fraction * (points.length - 1));
      const point = points[index];
      if (!point) return;
      els.tooltip.textContent = `${new Date(point.at).toLocaleString()} · ${point.online ? `${point.players.toLocaleString()} players` : `Offline${point.error ? ` · ${point.error}` : ''}`}`;
      els.tooltip.hidden = false;
      els.tooltip.style.left = `${Math.max(12, Math.min(88, fraction * 100))}%`;
      const dot = els.chart.querySelector('.chart-hover-dot');
      if (point.online && Number.isFinite(point.players)) {
        dot.setAttribute('cx', fraction * 600);
        dot.setAttribute('cy', 118 - point.players / maxPlayers * 96);
        dot.removeAttribute('hidden');
      } else dot.setAttribute('hidden', '');
    });
    els.chart.addEventListener('pointerleave', () => {
      els.tooltip.hidden = true;
      els.chart.querySelector('.chart-hover-dot').setAttribute('hidden', '');
    });
  };

  const renderApiData = (data, elapsed) => {
    apiOnline = Boolean(data.online);
    els.version.textContent = data.version || 'Not reported';
    els.software.textContent = data.software || data.software_name || 'Not reported';
    els.capacity.textContent = data.online ? `${Number(data.players?.online ?? 0).toLocaleString()} / ${Number(data.players?.max ?? 0).toLocaleString()}` : 'Unavailable';
    els.latency.textContent = data.online ? `${elapsed} ms` : 'No response';
    els.host.textContent = [data.hostname || data.ip || address, data.port || ''].filter(Boolean).join(':');
    const motd = data.motd?.clean || data.motd?.raw || data.motd?.html;
    els.motd.textContent = Array.isArray(motd) ? motd.join(' ').replace(/§[0-9a-fk-or]/gi, '').slice(0, 500) : (typeof motd === 'string' ? motd.replace(/§[0-9a-fk-or]/gi, '').slice(0, 500) : (data.online ? 'The server did not provide a message.' : 'No server message was returned with the offline status.'));
    if (data.icon) { els.icon.src = data.icon; els.icon.hidden = false; }
    const errors = [...(data.errors || []), ...(data.debug?.errors || [])].map(item => typeof item === 'string' ? item : [item.type, item.message].filter(Boolean).join(': ')).filter(Boolean);
    if (errors.length) offlineReasons.set('api', errors.join(' · '));
    else offlineReasons.delete('api');
    showDiagnostic();
    if (feedIndex < 0) updateStatus(data.online ? Number(data.players?.online ?? 0) : null, errors.join(' · '));
  };

  const loadApi = async () => {
    const start = performance.now();
    try {
      const response = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Status API returned HTTP ${response.status}`);
      renderApiData(await response.json(), Math.round(performance.now() - start));
    } catch (error) {
      els.latency.textContent = 'API unavailable';
      els.version.textContent = 'Not reported';
      els.software.textContent = 'Not reported';
      els.motd.textContent = 'No server message could be retrieved.';
      offlineReasons.set('api', `MCSRVStat request failed: ${error.message || 'network error'}`);
      showDiagnostic();
    }
  };

  const connect = () => {
    try { socket = new WebSocket('wss://minetrack.me'); }
    catch { setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); return; }
    socket.onopen = () => { retry = 1000; };
    socket.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.message === 'init') {
        const config = message.config?.servers || [];
        feedIndex = config.findIndex(item => String(item.ip || '').toLowerCase() === address.toLowerCase());
        const server = feedIndex >= 0 ? config[feedIndex] : null;
        els.name.textContent = server?.name || address;
        els.mode.textContent = server ? `${server.type === 'PE' ? 'Bedrock' : 'Java'} server · Tracked by Minetrack` : 'Unlisted public server · status checked via MCSRVStat';
        if (feedIndex >= 0) {
          const status = message.servers?.[feedIndex];
          updateStatus(status?.playerCount, status?.error?.message || '', message.timestampPoints?.at(-1) || Date.now() / 1000);
          socket.send('requestHistoryGraph');
        } else draw();
      } else if (message.message === 'historyGraph' && feedIndex >= 0) {
        const counts = message.graphData?.[feedIndex] || [];
        samples = (message.timestamps || []).map((timestamp, index) => {
          const count = counts[index];
          const online = count !== null && count !== undefined && Number.isFinite(Number(count));
          return { at: Number(timestamp) * 1000, online, players: online ? Number(count) : null, error: online ? '' : 'No response' };
        });
        draw();
      } else if (message.message === 'updateServers' && feedIndex >= 0) {
        const current = message.updates?.[feedIndex];
        if (!current) return;
        updateStatus(current.playerCount, current.error?.message || '', message.timestamp);
        if (message.updateHistoryGraph && samples.length) {
          const online = current.playerCount !== null && current.playerCount !== undefined && Number.isFinite(Number(current.playerCount));
          samples.push({ at: Number(message.timestamp) * 1000, online, players: online ? Number(current.playerCount) : null, error: current.error?.message || 'No response' });
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          samples = samples.filter(point => point.at > cutoff).slice(-1441);
          draw();
        }
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => { els.updated.textContent = 'Live feed disconnected · reconnecting'; setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); };
  };

  if (!address || address.length > 253 || /[\s<>/]/.test(address)) {
    els.name.textContent = 'Server address required';
    els.address.textContent = 'Open this page from a server card, or use the address checker.';
    els.mode.textContent = 'No hostname or IP address was provided.';
    els.summary.textContent = 'No address to look up.';
    els.motd.textContent = 'Return to the server directory and choose a server.';
    q('#copy-address').disabled = true;
    return;
  }
  document.title = `${address} | MineBeacon Server Profile`;
  els.address.textContent = address;
  els.name.textContent = address;
  q('#copy-address').addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(address); event.currentTarget.textContent = 'COPIED'; setTimeout(() => { event.currentTarget.textContent = 'COPY SERVER ADDRESS'; }, 1300); }
    catch { event.currentTarget.textContent = address; }
  });
  bindHover();
  q('#history-24h').addEventListener('click', () => {
    historyMode = '24h';
    yearNote.hidden = true;
    q('#history-24h').setAttribute('aria-pressed', 'true');
    draw();
  });
  q('#history-load').addEventListener('click', async () => {
    historyMode = 'year';
    q('#history-24h').setAttribute('aria-pressed', 'false');
    yearNote.hidden = false;
    const base = String(window.MINEBEACON_API_BASE || '').replace(/\/$/, '');
    if (!base) {
      yearlySamples = [];
      yearNote.textContent = 'Yearly snapshots require the shared MineBeacon API to be deployed and connected. Collection starts after setup, so older data cannot be backfilled.';
      draw();
      return;
    }
    yearNote.textContent = 'Loading daily snapshots…';
    try {
      const response = await fetch(`${base}/api/history?address=${encodeURIComponent(address)}&year=${encodeURIComponent(yearSelect.value)}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`History service returned HTTP ${response.status}`);
      const data = await response.json();
      yearlySamples = (data.samples || []).map(item => ({ at: new Date(`${item.day}T12:00:00Z`).getTime(), online: Boolean(item.online) && item.players !== null && Number.isFinite(Number(item.players)), players: item.players === null ? null : Number(item.players), error: item.online ? '' : 'Offline' }));
      yearNote.textContent = yearlySamples.length ? `${yearlySamples.length} daily snapshots for ${yearSelect.value}. Collection begins after backend setup; no earlier data is available.` : `No saved snapshots for ${yearSelect.value}. Daily collection begins after backend setup.`;
    } catch (error) {
      yearlySamples = [];
      yearNote.textContent = `Yearly history unavailable: ${error.message || 'network error'}`;
    }
    draw();
  });
  loadApi();
  connect();
})();
