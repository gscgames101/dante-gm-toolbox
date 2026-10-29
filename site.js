/* Website adapter: gives the app the same `window.claude` it uses on claude.ai, backed by Firebase.
   - db: Firestore (same collection/doc/onSnapshot calls)
   - user: the DM is whoever the database lets read meta/dm (set in the Firestore rules)
   - assets: pictures stored in Firestore as data URLs; sw.js serves them at _blob/<id>
   - artifact: a marker so the app pushes the players' screen through public/current */
(function () {
  firebase.initializeApp({
    apiKey: 'AIzaSyADoTwcuiWP1ptIYj7omAbanUrwEaBo6Ao',
    authDomain: 'dante-s-gm-tools.firebaseapp.com',
    projectId: 'dante-s-gm-tools',
    storageBucket: 'dante-s-gm-tools.firebasestorage.app',
    messagingSenderId: '1068722879058',
    appId: '1:1068722879058:web:978d30ea27094921c93d8b'
  });
  const auth = firebase.auth();
  const fs = firebase.firestore();
  fs.settings({ ignoreUndefinedProperties: true, merge: true });

  const signedIn = new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); });
  let dmCheck = null;
  async function isDM() {
    await signedIn;
    if (!auth.currentUser) return false;
    if (!dmCheck) dmCheck = fs.doc('meta/dm').get().then(() => true, () => false);
    return dmCheck;
  }

  const MAX = 900000;  // one Firestore document holds up to ~1 MB
  const hex = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  const toDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  /* Make a picture small enough for one database document. */
  async function shrink(dataUrl) {
    if (dataUrl.length <= MAX) return dataUrl;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    let w = img.naturalWidth, h = img.naturalHeight, q = 0.85, out = dataUrl;
    for (let step = 0; step < 8 && out.length > MAX; step++) {
      const scale = Math.min(1, 1600 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      w = c.width * 0.8; h = c.height * 0.8; q = Math.max(0.5, q - 0.08);
    }
    return out;
  }
  const putAsset = async (id, dataUrl) => fs.collection('assets').doc(id).set({ data: await shrink(dataUrl), at: Date.now() });

  const assets = {
    async upload(blob) {
      const id = hex(), data = await shrink(await toDataUrl(blob));
      await fs.collection('assets').doc(id).set({ data, at: Date.now() });
      pics.set(id, data);
      return { id, url: '_blob/' + id };
    },
    async delete(id) { await fs.collection('assets').doc(id).delete(); }
  };
  const user = { isOwner: isDM, canEdit: isDM, can: async () => isDM() };
  const siteMarker = { site: true };

  window.claude = {
    use: async name => {
      if (name === 'db') return fs;
      if (name === 'user') return user;
      if (name === 'assets') return (await isDM()) ? assets : null;
      if (name === 'artifact') return siteMarker;
      return null;
    }
  };

  window.SITE = {
    async signIn() {
      const p = new firebase.auth.GoogleAuthProvider();
      try { await auth.signInWithPopup(p); }
      catch (e) { if (e && /popup/i.test(e.code || '')) return auth.signInWithRedirect(p); throw e; }
      if (!(await (dmCheck = null, isDM()))) { alert('This Google account isn’t the DM of this toolbox.'); await auth.signOut(); return; }
      try { localStorage.setItem('pb-role', JSON.stringify('dm')); } catch {}
      location.reload();
    },
    async signOut() {
      await auth.signOut();
      try { localStorage.removeItem('pb-role'); localStorage.removeItem('pb-cache'); } catch {}
      location.href = location.pathname;
    },
    user: () => auth.currentUser,
    watchPlayers: cb => fs.doc('public/current').onSnapshot(s => cb(s.exists ? s.data() : null), () => {}),
    putAsset,
    imgSrc: id => window.SITE_imgSrc(id)
  };

  /* Pictures. Normally the service worker answers _blob/<id> from the database and keeps a copy on the device.
     Where it isn't running (first visit, private windows, some in-app browsers), images get a blank placeholder
     tagged with their id, and this fills them in from the database. */
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const pics = new Map();  // id -> data URL (or a pending promise)
  const loadPic = id => {
    if (!pics.has(id)) pics.set(id, fs.collection('assets').doc(id).get().then(s => {
      const d = s.exists && s.data().data; if (d) pics.set(id, d); else pics.delete(id); return d || '';
    }, () => { pics.delete(id); return ''; }));
    const v = pics.get(id); return typeof v === 'string' ? Promise.resolve(v) : v;
  };
  const fillImg = img => {
    const m = /^data:image\/gif;base64,[^#]*#a=([0-9a-f]{32})$/i.exec(img.getAttribute('src') || '');
    if (!m) return;
    loadPic(m[1]).then(d => { if (img.getAttribute('src') === BLANK + '#a=' + m[1]) { if (d) img.src = d; else img.dispatchEvent(new Event('error')); } });
  };
  const fillAll = root => { if (root.tagName === 'IMG') fillImg(root); else if (root.querySelectorAll) root.querySelectorAll('img[src^="data:image/gif"]').forEach(fillImg); };
  new MutationObserver(list => list.forEach(r => {
    if (r.type === 'attributes') fillImg(r.target); else r.addedNodes.forEach(n => n.nodeType === 1 && fillAll(n));
  })).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  window.SITE_imgSrc = id => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) return '_blob/' + id;
    const v = pics.get(id);
    return typeof v === 'string' ? v : BLANK + '#a=' + id;
  };

  if ('serviceWorker' in navigator) {
    const first = !navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    if (first) navigator.serviceWorker.addEventListener('controllerchange', () => {
      try { if (sessionStorage.getItem('sw-reloaded')) return; sessionStorage.setItem('sw-reloaded', '1'); } catch {}
      location.reload();  // once, on the very first visit, so pictures load
    });
  }
})();
