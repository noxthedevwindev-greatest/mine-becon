(() => {
  const rows = document.querySelector('#leader-rows');
  const search = document.querySelector('#leader-search');
  const statusLine = document.querySelector('#leaderboard-status');
  const serverRows = [];
  let retryDelay = 1000;
  let socket;
  const serverValues = status => {
    if (status.playerCount === null || status.playerCount === undefined || !Number.isFinite(Number(status.playerCount))) return { online: false, count: null };
    return { online: true, count: Number(status.playerCount) };
  };
  const render = () => {
    const filtered = [...serverRows].filter(server => `${server.name} ${server.address}`.toLowerCase().includes(search.value.trim().toLowerCase())).sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
    rows.replaceChildren();
    if (!filtered.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = 6; td.className = 'leader-empty'; td.textContent = 'No servers match that search.'; tr.append(td); rows.append(tr); return;
    }
    filtered.forEach((server, index) => {
      const tr = document.createElement('tr');
      const rank = document.createElement('td'); rank.className = 'leader-rank'; rank.textContent = String(index + 1).padStart(2, '0');
      const nameCell = document.createElement('td'); nameCell.className = 'leader-server';
      const name = document.createElement('strong'); name.textContent = server.name;
      const address = document.createElement('small'); address.textContent = server.address;
      nameCell.append(name, address);
      const status = document.createElement('td'); status.innerHTML = `<span class="leader-status ${server.online ? 'online' : 'offline'}"><i></i>${server.online ? 'ONLINE' : 'OFFLINE'}</span>`;
      const count = document.createElement('td'); count.className = 'leader-current'; count.textContent = server.online ? server.count.toLocaleString() : '—';
      const peak = document.createElement('td'); peak.className = 'leader-peak'; peak.textContent = server.peak === null ? 'Loading…' : server.peak.toLocaleString();
      const action = document.createElement('td');
      const link = document.createElement('a'); link.className = 'leader-profile-link'; link.href = `server.html?address=${encodeURIComponent(server.address)}`; link.textContent = 'VIEW ↗';
      action.append(link); tr.append(rank, nameCell, status, count, peak, action); rows.append(tr);
    });
  };
  search.addEventListener('input', render);
  const updateSummary = () => {
    const online = serverRows.filter(server => server.online);
    const total = online.reduce((sum, server) => sum + server.count, 0);
    document.querySelector('#leader-total-players').textContent = total.toLocaleString();
    document.querySelector('#leader-online-count').textContent = String(online.length);
    document.querySelector('#leader-tracked-count').textContent = String(serverRows.length);
    const busiest = [...online].sort((a, b) => b.count - a.count)[0];
    document.querySelector('#leader-top-name').textContent = busiest?.name || '—';
    render();
  };
  const connect = () => {
    statusLine.textContent = 'Connecting to Minetrack…';
    try { socket = new WebSocket('wss://minetrack.me'); }
    catch { setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000); return; }
    socket.onopen = () => { retryDelay = 1000; };
    socket.onmessage = event => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload.message === 'init') {
        serverRows.length = 0;
        const config = payload.config?.servers || [];
        config.forEach((server, index) => {
          const initial = payload.servers?.[index] || {};
          const values = serverValues(initial);
          serverRows.push({ name: server.name || server.ip || `Server ${index + 1}`, address: server.ip || '', mode: server.type === 'PE' ? 'Bedrock' : 'Java', count: values.count, online: values.online, peak: null });
        });
        statusLine.textContent = `Live · ${serverRows.length} tracked servers · updating in real time`;
        updateSummary();
        if (payload.config?.isGraphVisible && socket.readyState === WebSocket.OPEN) socket.send('requestHistoryGraph');
      } else if (payload.message === 'historyGraph') {
        serverRows.forEach((server, index) => {
          const values = (payload.graphData?.[index] || []).filter(value => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number);
          server.peak = values.length ? Math.max(...values) : 0;
        });
        render();
      } else if (payload.message === 'updateServers') {
        (payload.updates || []).forEach((item, index) => {
          const server = serverRows[index];
          if (!server) return;
          const values = serverValues(item);
          server.count = values.count; server.online = values.online;
          if (values.online) server.peak = Math.max(server.peak ?? 0, values.count);
        });
        const time = new Date(Number(payload.timestamp) * 1000).toLocaleTimeString();
        statusLine.textContent = `Live · ${serverRows.length} tracked servers · updated ${time}`;
        updateSummary();
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => { statusLine.textContent = 'Feed disconnected · reconnecting…'; setTimeout(connect, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000); };
  };
  connect();
})();
