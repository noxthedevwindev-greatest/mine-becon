import { addressKey, database, normalizeAddress } from '../../lib/api-utils.js';

const CATALOG = 'https://api.minecraftserver.id/api/v1/public';
const fetchJson = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.json();
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const db = await database();
    const snapshots = db.collection('playerSnapshots');
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const first = await fetchJson(`${CATALOG}/servers?limit=50&page=1&sort=players`);
    if (!first.success || !first.data) throw new Error('Directory response was invalid');
    const pages = Math.max(1, Math.min(10, Number(first.data.totalPages) || 1));
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => fetchJson(`${CATALOG}/servers?limit=50&page=${i + 2}&sort=players`)));
    await snapshots.createIndex({ serverKey: 1, day: 1 }, { unique: true });
    const writes = [...(first.data.servers || []), ...rest.flatMap(item => item.data?.servers || [])].flatMap(server => {
      const defaultPort = String(server.edition || '').toUpperCase().includes('BEDROCK') ? 19132 : 25565;
      const hasPort = String(server.address || '').includes(':');
      const rawAddress = server.port && Number(server.port) !== defaultPort && !hasPort ? `${server.address}:${server.port}` : server.address;
      const address = normalizeAddress(rawAddress);
      if (!address) return [];
      const players = server.currentPlayers === null || server.currentPlayers === undefined ? null : Number(server.currentPlayers);
      return [{ updateOne: {
        filter: { serverKey: addressKey(address), day },
        update: { $set: { address, day, capturedAt: now, online: String(server.status).toUpperCase() === 'ONLINE', players: Number.isFinite(players) ? players : null, maxPlayers: Number(server.maxPlayers) || null, source: 'MinecraftServer.ID' } },
        upsert: true
      } }];
    });
    if (writes.length) await snapshots.bulkWrite(writes, { ordered: false });
    let stored = writes.length;
    const custom = await db.collection('communityServers').find({ status: 'approved' }, { projection: { address: 1 } }).limit(12).toArray();
    await Promise.all(custom.map(async item => {
      const address = normalizeAddress(item.address);
      if (!address || writes.some(write => write.updateOne.update.$set.address === address)) return;
      try {
        const status = await fetchJson(`https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`);
        const players = status.online ? Number(status.players?.online) : null;
        await snapshots.updateOne(
          { serverKey: addressKey(address), day },
          { $set: { address, day, capturedAt: now, online: Boolean(status.online), players: Number.isFinite(players) ? players : null, maxPlayers: Number(status.players?.max) || null, source: 'MCSRVStat' } },
          { upsert: true }
        );
        stored += 1;
      } catch { /* A single custom host failure should not discard the catalog snapshots. */ }
    }));
    return res.status(200).json({ ok: true, day, stored });
  } catch (error) {
    console.error('daily snapshot failed', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Snapshot collection failed.' });
  }
}
