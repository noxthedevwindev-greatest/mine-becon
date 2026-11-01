import { createHash, randomUUID } from 'node:crypto';
import { addressKey, cors, database, normalizeAddress } from '../lib/api-utils.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const db = await database();
    const servers = db.collection('communityServers');
    if (req.method === 'GET') {
      const results = await servers.find({ status: 'approved' }, {
        projection: { _id: 0, name: 1, address: 1, edition: 1, description: 1, createdAt: 1 }
      }).sort({ name: 1 }).limit(500).toArray();
      return res.status(200).json({ servers: results });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (String(body.website || '').length) return res.status(202).json({ ok: true });
    const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 70);
    const address = normalizeAddress(body.address);
    const edition = ['JAVA', 'BEDROCK', 'CROSS_PLAY'].includes(body.edition) ? body.edition : 'JAVA';
    const description = String(body.description || '').trim().replace(/\s+/g, ' ').slice(0, 240);
    if (name.length < 2 || !address) return res.status(400).json({ error: 'Enter a valid name and hostname, optionally followed by a port.' });

    await servers.createIndex({ addressKey: 1 }, { unique: true });
    const key = addressKey(address);
    const existing = await servers.findOne({ addressKey: key, status: { $in: ['pending', 'approved'] } });
    if (existing) return res.status(409).json({ error: 'This server is already listed or awaiting review.' });

    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const ipHash = createHash('sha256').update(ip.slice(0, 100)).digest('hex');
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const limits = db.collection('submissionLimits');
    await limits.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
    await limits.createIndex({ key: 1, day: 1 }, { unique: true });
    let rate;
    try {
      rate = await limits.findOneAndUpdate(
        { key: ipHash, day },
        { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date(Date.now() + 3 * 86400_000) } },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (error) {
      if (error.code === 11000) return res.status(429).json({ error: 'Please wait before submitting again.' });
      throw error;
    }
    if (Number(rate?.count ?? rate?.value?.count) > 3) return res.status(429).json({ error: 'Submission limit reached. Try again tomorrow.' });

    const submission = {
      id: randomUUID(), address, addressKey: key, name, edition, description,
      status: 'pending', createdAt: now, updatedAt: now
    };
    await servers.insertOne(submission);
    return res.status(201).json({ ok: true, status: 'pending', message: 'Thanks! Your server was submitted for review. It will appear in the shared directory after approval.' });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'This server is already listed or awaiting review.' });
    console.error('community server API failed', error?.message || 'unknown error');
    return res.status(500).json({ error: 'The server directory is temporarily unavailable.' });
  }
}
