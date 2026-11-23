/* Website adapter: gives the app the same `window.claude` it uses on claude.ai, backed by Firebase.
   Several GMs can use the site, each with their own bestiary:
   - db: Firestore, scoped to the signed-in GM. The app's collections (monsters, books, maps…) live under gms/<uid>/;
     the players' screen data (public/current, public/map) lives under play/<code>/state/, where <code> is the GM's
     player-link code. Pictures (assets/) and the shared SRD list (srd/) are global.
   - user: a GM is someone the database lets read gms/<their uid> (invited, or the admin; see the Firestore rules)
   - assets: pictures stored in Firestore as data URLs; sw.js serves them at _blob/<id>
   - artifact: a marker so the app pushes the players' screen through public/current
   Players open …#players/<code>: no sign-in, they only read play/<code>/state/. */
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
  const code6 = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; return [...crypto.getRandomValues(new Uint8Array(8))].map(b => a[b % a.length]).join(''); };

  /* Is the signed-in person a GM? The rules only let invited people (and the admin) read gms/<uid>.
     The first time, their GM record is created with a player-link code. */
  let gm = null, gmCheck = null;
  async function isGM() {
    await signedIn;
    const u = auth.currentUser; if (!u) return false;
    if (!gmCheck) gmCheck = (async () => {
      const ref = fs.doc('gms/' + u.uid);
      try {
        const s = await ref.get();
        if (s.exists) { gm = s.data(); if (!gm.playerCode) { gm.playerCode = code6(); await ref.set({ playerCode: gm.playerCode }, { merge: true }); } }
        else { gm = { email: u.email || '', name: u.displayName || '', playerCode: code6(), createdAt: Date.now() }; await ref.set(gm); }
        return true;
      } catch { gm = null; return false; }
    })();
    return gmCheck;
  }
  // The admin (whoever the rules let list the invites) manages invites and the shared SRD list.
  let adminCheck = null;
  const isAdmin = () => adminCheck || (adminCheck = isGM().then(ok => ok ? fs.collection('invites').limit(1).get().then(() => true, () => false) : false));

  /* The app's database, scoped to this GM. */
  const GM_COLS = new Set(['monsters', 'books', 'groups', 'heroes', 'encounters', 'maps', 'mapFolders', 'tokens']);
  const mapPath = p => {
    const segs = String(p).split('/'), uid = auth.currentUser && auth.currentUser.uid;
    if (segs[0] === 'public' && segs.length === 2) return `play/${gm && gm.playerCode}/state/${segs[1]}`;
    if (GM_COLS.has(segs[0]) && uid) return `gms/${uid}/${p}`;
    return p;  // assets, srd, …
  };
  const scopedDb = {
    collection: n => fs.collection(mapPath(n)),
    doc: p => fs.doc(mapPath(p)),
    batch: () => fs.batch(),
    settings: () => {}
  };

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
  const owner = () => (auth.currentUser && auth.currentUser.uid) || '';
  const putAsset = async (id, dataUrl) => fs.collection('assets').doc(id).set({ data: await shrink(dataUrl), at: Date.now(), owner: owner() });
  /* Big pictures (maps) at full quality: split across several documents.
     assets/<id> holds {chunks: n}; assets/<id>_0 … <id>_(n-1) hold the pieces of the data URL. */
  async function putAssetLarge(id, dataUrl) {
    const col = fs.collection('assets');
    if (dataUrl.length <= MAX) return col.doc(id).set({ data: dataUrl, at: Date.now(), owner: owner() });
    const n = Math.ceil(dataUrl.length / MAX);
    for (let i = 0; i < n; i++) await col.doc(`${id}_${i}`).set({ data: dataUrl.slice(i * MAX, (i + 1) * MAX), owner: owner() });
    await col.doc(id).set({ chunks: n, at: Date.now(), owner: owner() });
  }

  const assets = {
    async upload(blob) {
      const id = hex(), data = await shrink(await toDataUrl(blob));
      await fs.collection('assets').doc(id).set({ data, at: Date.now(), owner: owner() });
      pics.set(id, data);
      return { id, url: '_blob/' + id };
    },
    async uploadLarge(blob) {
      const id = hex(), data = await toDataUrl(blob);
      await putAssetLarge(id, data);
      pics.set(id, data);
      return { id, url: '_blob/' + id };
    },
    async delete(id) {
      const col = fs.collection('assets');
      try { const s = await col.doc(id).get(); const n = s.exists && s.data().chunks; for (let i = 0; i < (n || 0); i++) await col.doc(`${id}_${i}`).delete(); } catch {}
      await col.doc(id).delete();
      pics.delete(id);
    }
  };
  const user = { isOwner: isGM, canEdit: isGM, can: async () => isGM() };
  const siteMarker = { site: true };

  window.claude = {
    use: async name => {
      if (name === 'db') return (await isGM()) ? scopedDb : null;
      if (name === 'user') return user;
      if (name === 'assets') return (await isGM()) ? assets : null;
      if (name === 'artifact') return siteMarker;
      return null;
    }
  };

  // The code in a player link: …#players/<code>
  const linkCode = () => { const m = /^#players\/([a-z0-9]{4,32})$/i.exec(location.hash); return m ? m[1].toLowerCase() : null; };
  const playDoc = (code, name) => fs.doc(`play/${code}/state/${name}`);

  window.SITE = {
    async signIn() {
      const p = new firebase.auth.GoogleAuthProvider();
      try { await auth.signInWithPopup(p); }
      catch (e) { if (e && /popup/i.test(e.code || '')) return auth.signInWithRedirect(p); throw e; }
      gmCheck = null; adminCheck = null;
      if (!(await isGM())) { alert(window.SITE_t ? window.SITE_t('notInvited') : 'This Google account isn’t invited to be a GM here. Ask the toolbox owner for an invite.'); await auth.signOut(); return; }
      try { localStorage.setItem('pb-role', JSON.stringify('dm')); } catch {}
      location.hash = ''; location.reload();
    },
    async signOut() {
      await auth.signOut();
      try { localStorage.removeItem('pb-role'); localStorage.removeItem('pb-cache'); } catch {}
      location.href = location.pathname;
    },
    user: () => auth.currentUser,
    isAdmin,
    // players' screen
    linkCode,
    watchPlayers: cb => { const c = linkCode(); if (!c) { cb(null); return () => {}; } return playDoc(c, 'current').onSnapshot(s => cb(s.exists ? s.data() : null), () => cb(null)); },
    watchMap: cb => { const c = linkCode() || (gm && gm.playerCode); if (!c) { cb(null); return () => {}; } return playDoc(c, 'map').onSnapshot(s => cb(s.exists ? s.data() : null), () => {}); },
    playerLink: () => gm && gm.playerCode ? location.origin + location.pathname + '#players/' + gm.playerCode : '',
    // A new code: the old link stops working (its screen data is removed).
    async resetPlayerLink() {
      if (!(await isGM())) throw new Error('not a GM');
      const old = gm.playerCode, code = code6();
      // clear the old screen first: the rules only let a GM write under their current code
      for (const n of ['current', 'map']) { try { await playDoc(old, n).delete(); } catch {} }
      await fs.doc('gms/' + auth.currentUser.uid).set({ playerCode: code }, { merge: true });
      gm.playerCode = code;
      return location.origin + location.pathname + '#players/' + code;
    },
    // the shared SRD list
    watchSrd: cb => fs.collection('srd').onSnapshot(s => cb(s.docs.map(d => ({ ...d.data(), id: d.id }))), () => cb([])),
    srdDoc: id => fs.doc('srd/' + id),
    // invites (admin only)
    invites: {
      list: async () => (await fs.collection('invites').get()).docs.map(d => ({ email: d.id, at: d.data().at || 0 })),
      add: email => fs.doc('invites/' + String(email).trim().toLowerCase()).set({ at: Date.now() }),
      remove: email => fs.doc('invites/' + String(email).trim().toLowerCase()).delete()
    },
    /* One-time move (admin): the single-DM data at the top level goes into this GM's own space, and the monsters
       in the book called "SRD" go to the shared SRD list instead (not copied into the personal bestiary).
       Nothing at the top level is deleted. */
    async migrateLegacy(onStep) {
      const uid = auth.currentUser.uid, base = `gms/${uid}/`;
      const names = ['books', 'monsters', 'groups', 'heroes', 'maps', 'mapFolders', 'tokens'];
      const data = {};
      for (const n of names) { onStep && onStep(`Reading ${n}…`); data[n] = (await fs.collection(n).get()).docs; }
      const srdBook = data.books.find(d => String(d.data().name || '').trim().toLowerCase() === 'srd');
      const srdId = srdBook ? srdBook.id : null;
      const writes = [], counts = { personal: 0, srd: 0, srdAlsoPersonal: 0 };
      for (const n of names) for (const d of data[n]) {
        const v = d.data();
        if (n === 'books' && d.id === srdId) continue;
        if (n === 'monsters' && srdId && (v.bookIds || []).includes(srdId)) {
          writes.push(['srd/' + d.id, { ...v, bookIds: [] }]); counts.srd++;
          const other = (v.bookIds || []).filter(b => b !== srdId);
          if (other.length) { writes.push([base + 'monsters/' + d.id + '_own', { ...v, bookIds: other }]); counts.srdAlsoPersonal++; }
          continue;
        }
        writes.push([base + n + '/' + d.id, v]); counts.personal++;
      }
      const enc = await fs.doc('encounters/current').get();
      if (enc.exists) writes.push([base + 'encounters/current', enc.data()]);
      for (let i = 0; i < writes.length; i += 40) {
        onStep && onStep(`Saving… ${Math.min(i + 40, writes.length)} of ${writes.length}`);
        const b = fs.batch(); writes.slice(i, i + 40).forEach(([p, v]) => b.set(fs.doc(p), v)); await b.commit();
      }
      await fs.doc('gms/' + uid).set({ migratedAt: Date.now() }, { merge: true });
      return counts;
    },
    putAsset,
    putAssetLarge,
    imgSrc: id => window.SITE_imgSrc(id),
    picData: id => loadPic(id).then(d => { if (!d) throw new Error('missing'); return d; })
  };

  /* Pictures. Normally the service worker answers _blob/<id> from the database and keeps a copy on the device.
     Where it isn't running (first visit, private windows, some in-app browsers), images get a blank placeholder
     tagged with their id, and this fills them in from the database. */
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const pics = new Map();  // id -> data URL (or a pending promise)
  const loadPic = id => {
    if (!pics.has(id)) pics.set(id, fs.collection('assets').doc(id).get().then(async s => {
      const meta = s.exists ? s.data() : null;
      let d = meta && meta.data;
      if (meta && meta.chunks) {  // a big map stored in pieces
        const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => fs.collection('assets').doc(`${id}_${i}`).get()));
        d = parts.every(p => p.exists) ? parts.map(p => p.data().data).join('') : '';
      }
      if (d) pics.set(id, d); else pics.delete(id); return d || '';
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
