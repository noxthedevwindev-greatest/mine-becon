(() => {
  const feedStatus = document.querySelector('#home-feed-status');
  const playerTotal = document.querySelector('#home-total-players');
  const serverTotal = document.querySelector('#home-server-count');
  const updatedAt = document.querySelector('#home-updated');
  const counts = new Map();
  let retry = 1000;
  let socket;
  const render = () => {
    const values = [...counts.values()].filter(Number.isFinite);
    playerTotal.textContent = values.length ? values.reduce((sum, value) => sum + value, 0).toLocaleString() : '—';
    serverTotal.textContent = String(counts.size || '—');
    updatedAt.textContent = values.length ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '—';
  };
  const connect = () => {
    feedStatus.innerHTML = '<i class="pulse-dot disconnected"></i> CONNECTING';
    try { socket = new WebSocket('wss://minetrack.me'); } catch { setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); return; }
    socket.addEventListener('open', () => { retry = 1000; feedStatus.innerHTML = '<i class="pulse-dot"></i> LIVE'; });
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'init') {
        counts.clear();
        const servers = message.data?.servers || {};
        Object.entries(servers).forEach(([key, server]) => {
          const count = server.playerCount;
          counts.set(key, count !== null && count !== undefined && Number.isFinite(Number(count)) ? Number(count) : null);
        });
        const configured = message.data?.config?.servers;
        if (Array.isArray(configured)) serverTotal.textContent = String(configured.length);
        render();
      } else if (message.type === 'updateServers') {
        Object.entries(message.data || {}).forEach(([key, server]) => {
          if (server.playerCount !== undefined) counts.set(key, server.playerCount === null ? null : Number(server.playerCount));
        });
        render();
      }
    });
    socket.addEventListener('close', () => { feedStatus.innerHTML = '<i class="pulse-dot disconnected"></i> RECONNECTING'; setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); });
    socket.addEventListener('error', () => socket.close());
  };
  connect();
})();
