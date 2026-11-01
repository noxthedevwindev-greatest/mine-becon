import { MongoClient } from 'mongodb';
import { createHash } from 'node:crypto';

const globalForMongo = globalThis;
const ORIGIN = process.env.SITE_ORIGIN || 'https://noxthedevwindev-greatest.github.io';

export async function database() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured on the API host');
  if (!globalForMongo.mineBeaconMongo) {
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 });
    globalForMongo.mineBeaconMongo = client.connect().then(() => client);
  }
  const client = await globalForMongo.mineBeaconMongo;
  return client.db(process.env.MONGODB_DB || 'minebeacon');
}

export function cors(req, res) {
  const origin = req.headers.origin;
  if (origin === ORIGIN) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  if (origin && origin !== ORIGIN) { res.status(403).json({ error: 'Origin not allowed' }); return true; }
  return false;
}

export function normalizeAddress(input) {
  const value = String(input || '').trim().toLowerCase();
  if (value.length > 253 || /[\s/<>@?#]/.test(value)) return '';
  const match = value.match(/^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?$/);
  if (!match || match[1].includes('..') || match[1].split('.').some(label => !label || label.startsWith('-') || label.endsWith('-'))) return '';
  const port = match[2] ? Number(match[2]) : null;
  if (port !== null && (port < 1 || port > 65535)) return '';
  return port ? `${match[1]}:${port}` : match[1];
}

export function addressKey(address) {
  return createHash('sha256').update(normalizeAddress(address)).digest('hex');
}
