/* Serves pictures at _blob/<id> from the Firestore "assets" collection, and keeps them on the device. */
const PROJECT = 'dante-s-gm-tools';
const CACHE = 'pics-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  const m = u.pathname.match(/\/_blob\/([0-9a-f]{32})$/i);
  if (m) e.respondWith(picture(m[1], e.request));
});

async function picture(id, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/assets/${id}`);
    if (!r.ok) return new Response('', { status: 404 });
    const doc = await r.json();
    const data = doc.fields && doc.fields.data && doc.fields.data.stringValue;
    if (!data || !data.startsWith('data:image/')) return new Response('', { status: 404 });
    const blob = await (await fetch(data)).blob();
    const res = new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } });
    cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 503 });
  }
}
