(() => {
  const q = selector => document.querySelector(selector);
  const address = new URLSearchParams(location.search).get('address')?.trim() || '';
  const els = {
    name: q('#profile-name'), address: q('#profile-address'), mode: q('#profile-mode'), badge: q('#profile-badge'), players: q('#profile-players'), updated: q('#profile-updated'),
    version: q('#profile-version'), software: q('#profile-software'), capacity: q('#profile-capacity'), latency: q('#profile-latency'), host: q('#profile-host'), motd: q('#profile-motd'), diagnostic: q('#profile-diagnostic'), icon: q('#profile-icon'),
    chart: q('#profile-chart'), tooltip: q('#profile-tooltip'), summary: q('#profile-chart-summary'), range: q('#profile-chart-range')
  };
  let feedIndex = -1;
  let samples = [];
  let maxPlayers = 1;
  let apiOnline = null;
  let liveOnline = null;
  let socket;
  let retry = 1000;
  const offlineReasons = new Map();
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
    if (samples.length) els.summary.textContent = `${samples.length.toLocaleString()} Minetrack samples · peak ${maxPlayers.toLocaleString()} players · latest ${online ? players.toLocaleString() : 'offline'}`;
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
    const available = samples.filter(point => point.online && Number.isFinite(point.players));
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
    samples.forEach((point, index) => {
      if (!point.online || !Number.isFinite(point.players)) { flush(); return; }
      segment.push({ x: samples.length > 1 ? index * 600 / (samples.length - 1) : 300, y: 118 - point.players / maxPlayers * 96 });
    });
    flush();
    els.range.textContent = samples.length ? 'MINETRACK · 24 HOURS · 1-MIN SAMPLES' : 'NO UPSTREAM HISTORY';
    els.summary.textContent = samples.length ? `${samples.length.toLocaleString()} Minetrack samples · peak ${maxPlayers.toLocaleString()} players · latest ${available.at(-1)?.players.toLocaleString() ?? 'offline'}` : (feedIndex >= 0 ? 'Waiting for Minetrack to send daily history…' : 'This address is not currently in Minetrack’s tracked feed. Its live graph is not available.');
  };
  let hoverBound = false;
  const bindHover = () => {
    if (hoverBound) return;
    hoverBound = true;
    els.chart.addEventListener('pointermove', event => {
      if (!samples.length) return;
      const rect = els.chart.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const index = Math.round(fraction * (samples.length - 1));
      const point = samples[index];
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
  loadApi();
  connect();
})();
