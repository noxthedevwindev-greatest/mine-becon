(() => {
  const base = String(window.MINEBEACON_API_BASE || '').replace(/\/$/, '');
  const localKey = 'minebeacon:custom-servers:v1';
  const clean = item => ({
    name: String(item.name || '').trim().slice(0, 70),
    address: String(item.address || '').trim().toLowerCase(),
    edition: ['JAVA', 'BEDROCK', 'CROSS_PLAY'].includes(item.edition) ? item.edition : 'JAVA',
    description: String(item.description || '').trim().slice(0, 240),
    custom: true
  });
  const getLocal = () => {
    try {
      const value = JSON.parse(localStorage.getItem(localKey) || '[]');
      return Array.isArray(value) ? value.map(clean).filter(item => item.name && item.address) : [];
    } catch { return []; }
  };
  let current = [];
  const announce = servers => {
    current = servers;
    window.dispatchEvent(new CustomEvent('minebeacon:custom-servers', { detail: servers }));
  };
  const load = async () => {
    announce(getLocal());
    if (!base) return;
    try {
      const response = await fetch(`${base}/api/servers`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Shared directory unavailable');
      const json = await response.json();
      const servers = Array.isArray(json.servers) ? json.servers.map(clean) : [];
      announce([...getLocal(), ...servers]);
    } catch {
      announce(getLocal());
    }
  };
  const saveLocal = server => {
    const next = getLocal();
    if (!next.some(item => item.address === server.address)) next.unshift(clean(server));
    try { localStorage.setItem(localKey, JSON.stringify(next.slice(0, 50))); } catch { /* Keep the current-session listing if storage is full. */ }
    announce(getLocal());
  };
  const submit = async server => {
    if (!base) throw new Error('Your server was saved on this device. Shared submissions are not connected yet.');
    const response = await fetch(`${base}/api/servers`, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ ...server, website: String(server.website || '') }), signal: AbortSignal.timeout(12000)
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || 'Could not submit the server for review.');
    return json;
  };
  window.MineBeaconCommunity = { base, get servers() { return current; }, getLocal, load, saveLocal, submit };
  window.addEventListener('storage', event => { if (event.key === localKey) load(); });
  load();
})();
