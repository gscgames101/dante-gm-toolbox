/* Serves pictures at _blob/<id> from the Firestore "assets" collection, and keeps them on the device.
   Big pictures (maps) are stored in pieces: assets/<id> says {chunks: n}, and <id>_0 … <id>_(n-1) hold the data. */
const PROJECT = 'dante-s-gm-tools';
const CACHE = 'pics-v1';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/assets/`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  const m = u.pathname.match(/\/_blob\/([0-9a-f]{32})$/i);
  if (m) e.respondWith(picture(m[1], e.request));
});

async function getDoc(name) {
  const r = await fetch(DOCS + name);
  return r.ok ? r.json() : null;
}

async function picture(id, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const doc = await getDoc(id);
    if (!doc || !doc.fields) return new Response('', { status: 404 });
    let data = doc.fields.data && doc.fields.data.stringValue;
    const chunks = doc.fields.chunks && +doc.fields.chunks.integerValue;
    if (chunks) {
      const parts = await Promise.all(Array.from({ length: chunks }, (_, i) => getDoc(`${id}_${i}`)));
      if (parts.some(p => !p || !p.fields || !p.fields.data)) return new Response('', { status: 404 });
      data = parts.map(p => p.fields.data.stringValue).join('');
    }
    if (!data || !data.startsWith('data:image/')) return new Response('', { status: 404 });
    const blob = await (await fetch(data)).blob();
    const res = new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } });
    cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 503 });
  }
}
