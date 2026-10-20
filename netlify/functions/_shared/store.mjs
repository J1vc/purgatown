/* Sugerencias: backend */
import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';

// Resolve stores at request time so each function invocation uses Netlify's current credentials.
export const getSuggestionsStore = () => getStore({ name: 'suggestions', consistency: 'strong' });
export const getTracksIndexStore = () => getStore({ name: 'tracks-index', consistency: 'strong' });
const getRateLimitsStore = () => getStore({ name: 'rate-limits', consistency: 'strong' });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Conditional writes give this small event workflow an atomic lock over mutations.
export async function withLock(store, key, task, leaseMs = 25_000) {
  const owner = randomUUID();
  let lockEtag = null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const lock = { owner, expires_at: Date.now() + leaseMs };
    if (!current) {
      const result = await store.setJSON(key, lock, { onlyIfNew: true });
      if (result.modified) { lockEtag = result.etag; break; }
    } else if (Number(current.data?.expires_at || 0) <= Date.now()) {
      const result = await store.setJSON(key, lock, { onlyIfMatch: current.etag });
      if (result.modified) { lockEtag = result.etag; break; }
    }
    await wait(50 + Math.floor(Math.random() * 70));
  }

  if (!lockEtag) return { acquired: false };
  try {
    return { acquired: true, value: await task() };
  } finally {
    const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' }).catch(() => null);
    if (current?.data?.owner === owner && current.etag === lockEtag) {
      await store.setJSON(key, { owner: '', expires_at: 0 }, { onlyIfMatch: lockEtag }).catch(() => {});
    }
  }
}

export async function getJson(store, key) {
  return store.get(key, { type: 'json', consistency: 'strong' });
}

export async function setJson(store, key, value) {
  return store.setJSON(key, value);
}

export async function checkRateLimit(key, { max, windowMs, now = Date.now() }) {
  const rateLimits = getRateLimitsStore();
  const locked = await withLock(rateLimits, 'rate:mutation-lock', async () => {
    const record = await getJson(rateLimits, key);
    const active = record && Number(record.expires_at) > now;
    const attempts = active && Array.isArray(record.attempts)
      ? record.attempts.filter(timestamp => Number(timestamp) > now - windowMs)
      : [];
    if (attempts.length >= max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((attempts[0] + windowMs - now) / 1000)) };
    }
    attempts.push(now);
    await setJson(rateLimits, key, { attempts, expires_at: now + windowMs });
    // Opportunistically remove a small batch of expired counters so the store stays bounded.
    if (Math.random() < 0.03) {
      let inspected = 0;
      for await (const page of rateLimits.list({ paginate: true })) {
        for (const blob of page.blobs) {
          if (blob.key === 'rate:mutation-lock' || blob.key === key) continue;
          const old = await getJson(rateLimits, blob.key).catch(() => null);
          if (old && Number(old.expires_at) <= now) await rateLimits.delete(blob.key).catch(() => {});
          inspected += 1;
          if (inspected >= 30) break;
        }
        if (inspected >= 30) break;
      }
    }
    return { allowed: true, retryAfter: 0 };
  });
  return locked.acquired ? locked.value : { allowed: false, retryAfter: 2 };
}

