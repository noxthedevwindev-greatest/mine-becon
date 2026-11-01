import { addressKey, cors, database, normalizeAddress } from '../lib/api-utils.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });
  const address = normalizeAddress(req.query?.address);
  const year = Number(req.query?.year);
  const currentYear = new Date().getUTCFullYear();
  if (!address || !Number.isInteger(year) || year < currentYear - 5 || year > currentYear) {
    return res.status(400).json({ error: 'Provide a valid server address and year within the past five years.' });
  }
  try {
    const db = await database();
    const samples = await db.collection('playerSnapshots').find(
      { serverKey: addressKey(address), day: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } },
      { projection: { _id: 0, day: 1, capturedAt: 1, players: 1, maxPlayers: 1, online: 1, source: 1 } }
    ).sort({ day: 1 }).limit(370).toArray();
    return res.status(200).json({ address, year, samples });
  } catch (error) {
    console.error('yearly history API failed', error?.message || 'unknown error');
    return res.status(503).json({ error: 'Yearly history is temporarily unavailable.' });
  }
}
