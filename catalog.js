(() => {
  const BASE = 'https://api.minecraftserver.id/api/v1/public';
  const CACHE_KEY = 'minebeacon:community-catalog:v1';
  const PAGE_SIZE = 50;
  const REFRESH_MS = 60_000;
  let timer;
  let busy = false;
  let lastFetched = 0;
  let current = { servers: [], overview: null, fetchedAt: 0, stale: false };
  const publish = (patch = {}) => {
    current = { ...current, ...patch };
    window.dispatchEvent(new CustomEvent('minebeacon:catalog', { detail: current }));
  };
  const readCache = () => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cache && Array.isArray(cache.servers) && cache.fetchedAt) {
        current = { ...current, ...cache, stale: Date.now() - cache.fetchedAt > 5 * 60_000 };
        publish();
      }
    } catch { /* A corrupt or blocked cache only removes the offline fallback. */ }
  };
  const request = async url => {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Directory returned HTTP ${response.status}`);
    const json = await response.json();
    if (!json.success || !json.data) throw new Error(json.error?.message || 'Directory returned an invalid response');
    return json.data;
  };
  const refresh = async (force = false) => {
    if (busy) return current;
    if (!force && current.servers.length && Date.now() - lastFetched < REFRESH_MS) return current;
    busy = true;
    publish({ loading: true, error: '' });
    try {
      const first = await request(`${BASE}/servers?limit=${PAGE_SIZE}&page=1&sort=players`);
      const totalPages = Math.max(1, Math.min(10, Number(first.totalPages) || 1));
      const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => request(`${BASE}/servers?limit=${PAGE_SIZE}&page=${index + 2}&sort=players`)));
      const overviewPromise = request(`${BASE}/stats/overview`).catch(() => null);
      const servers = [...(first.servers || []), ...rest.flatMap(page => page.servers || [])];
      const overview = await overviewPromise;
      const fetchedAt = Date.now();
      lastFetched = fetchedAt;
      const data = { servers, overview, total: Number(first.total) || servers.length, fetchedAt, stale: false, loading: false, error: '' };
      current = data;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* Catalog remains available for this visit. */ }
      publish(data);
    } catch (error) {
      publish({ loading: false, stale: current.servers.length > 0, error: error?.message || 'Directory unavailable' });
    } finally { busy = false; }
    return current;
  };
  readCache();
  window.MineBeaconCatalog = { refresh, get state() { return current; } };
  refresh();
  timer = setInterval(() => refresh(true), REFRESH_MS);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
