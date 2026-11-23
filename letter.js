/* Letter of invitation to the Grand Masters of RPG Conglomerate: aged parchment, gold filigree, cursive ink,
   red wax seal and a QR code to the invite link. Drawn on a canvas (1400 × 1980) so it can be saved as a picture.
   Needs qrcode-generator (window.qrcode) and the fonts Pinyon Script, Great Vibes and Cinzel Decorative. */
(function () {
  const W = 1400, H = 1980;
  const INK = '#2b1608', RED = '#6e1712', FADED = 'rgba(43,22,8,.62)';
  const F = { script: '"Pinyon Script", "Great Vibes", cursive', name: '"Great Vibes", "Pinyon Script", cursive', head: '"Cinzel Decorative", "IM Fell English SC", Georgia, serif' };

  const TEXT = {
    en: {
      head: 'The Grand Masters of RPG Conglomerate',
      order: 'By Order of the High Council',
      to: 'To the Most Esteemed and Illustrious',
      body: [
        'Be it known throughout all realms, planes and taverns that the High Council of the Grand Masters of RPG Conglomerate, having observed with great admiration your uncommon gifts in the weaving of tales, the voicing of villains and the rolling of fateful dice, does hereby summon you to take your rightful seat among the Masters of the Game.',
        'Present this missive at the gate below, and the doors of the Toolbox shall open unto you, with all its bestiaries, maps and tokens at your command.'
      ],
      date: d => { const n = d.getDate(), s = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
        return `Given under our hand and seal this ${n}${s} day of ${d.toLocaleString('en-US', { month: 'long' })}, in the year ${d.getFullYear()}.`; },
      sign: 'The High Council of the Grand Masters of RPG Conglomerate',
      scan: 'Scan to accept the summons'
    },
    pt: {
      head: 'Os Grão-Mestres do Conglomerado de RPG',
      order: 'Por Ordem do Alto Conselho',
      to: 'A Vossa Mui Ilustre e Estimada Excelência',
      body: [
        'Saibam todos os reinos, planos e tavernas que o Alto Conselho dos Grão-Mestres do Conglomerado de RPG, tendo observado com grande admiração vossos raros dons na arte de tecer histórias, de dar voz a vilões e de rolar dados fatídicos, vem por meio desta convocar-vos a ocupar vosso legítimo assento entre os Mestres do Jogo.',
        'Apresentai esta missiva no portal abaixo, e as portas da Ferramenta abrir-se-ão para vós, com todos os seus bestiários, mapas e tokens ao vosso comando.'
      ],
      date: d => `Dado sob nossa mão e selo aos ${d.getDate()} dias do mês de ${d.toLocaleString('pt-BR', { month: 'long' })} do ano de ${d.getFullYear()}.`,
      sign: 'O Alto Conselho dos Grão-Mestres do Conglomerado de RPG',
      scan: 'Escaneie para aceitar a convocação'
    }
  };

  // the same code always gives the same stains, so the letter doesn't change between redraws
  const seeded = s => { let h = 1779033703; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), h = h << 13 | h >>> 19;
    return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };

  function gold(g, x0, y0, x1, y1) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#7a5a17'); gr.addColorStop(.25, '#e9cf79'); gr.addColorStop(.5, '#a07b26'); gr.addColorStop(.75, '#f1dc92'); gr.addColorStop(1, '#7f5f1c');
    return gr;
  }

  function parchment(g, rnd) {
    const base = g.createRadialGradient(W / 2, H * .45, 100, W / 2, H / 2, H * .75);
    base.addColorStop(0, '#f7ecd0'); base.addColorStop(.55, '#ecdbb2'); base.addColorStop(1, '#cfae72');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {  // mottled stains
      const x = rnd() * W, y = rnd() * H, r = 30 + rnd() * 220, a = .02 + rnd() * .05;
      const s = g.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, `rgba(${120 + rnd() * 40 | 0},${80 + rnd() * 30 | 0},${30 + rnd() * 20 | 0},${a})`); s.addColorStop(1, 'rgba(120,80,30,0)');
      g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 5000; i++) {  // fibres and specks
      g.fillStyle = `rgba(90,55,20,${rnd() * .09})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 1 + rnd() * 1.5);
    }
    for (let i = 0; i < 3; i++) {  // a couple of old water rings
      const x = 150 + rnd() * (W - 300), y = 200 + rnd() * (H - 400), r = 50 + rnd() * 70;
      g.strokeStyle = 'rgba(130,85,35,.08)'; g.lineWidth = 3 + rnd() * 4; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
    const v = g.createRadialGradient(W / 2, H / 2, H * .38, W / 2, H / 2, H * .78);  // darker, aged edges
    v.addColorStop(0, 'rgba(90,50,15,0)'); v.addColorStop(.8, 'rgba(95,55,18,.28)'); v.addColorStop(1, 'rgba(70,35,8,.6)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  function spiral(g, cx, cy, r0, turns, a0, dir) {
    g.beginPath();
    const steps = 60 * turns;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = a0 + dir * t * turns * Math.PI * 2, r = r0 * (1 - t * .85);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  function corner(g, x, y, dx, dy) {
    g.save(); g.translate(x, y); g.scale(dx, dy);
    g.strokeStyle = gold(g, 0, 0, 220, 220); g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 210); g.bezierCurveTo(0, 90, 30, 30, 90, 20); g.bezierCurveTo(150, 10, 190, 0, 210, 0); g.stroke();
    g.beginPath(); g.moveTo(26, 170); g.bezierCurveTo(30, 80, 80, 30, 170, 26); g.stroke();
    g.lineWidth = 3.5; spiral(g, 62, 62, 30, 1.6, Math.PI * 1.25, 1);
    spiral(g, 214, 14, 16, 1.4, Math.PI, 1); spiral(g, 14, 214, 16, 1.4, Math.PI * 1.5, -1);
    g.fillStyle = gold(g, 0, 0, 30, 30);
    g.beginPath(); g.moveTo(0, -14); g.lineTo(14, 0); g.lineTo(0, 14); g.lineTo(-14, 0); g.closePath(); g.fill();
    g.restore();
  }
  function border(g) {
    const m = 58;
    g.strokeStyle = gold(g, 0, 0, W, H);
    g.lineWidth = 10; g.strokeRect(m, m, W - m * 2, H - m * 2);
    g.lineWidth = 3; g.strokeRect(m + 22, m + 22, W - (m + 22) * 2, H - (m + 22) * 2);
    g.lineWidth = 1.5; g.strokeRect(m - 12, m - 12, W - (m - 12) * 2, H - (m - 12) * 2);
    for (let x = m + 60; x < W - m - 40; x += 44) {  // little beads along the inner frame
      g.fillStyle = gold(g, x - 4, 0, x + 4, 0);
      g.beginPath(); g.arc(x, m + 11, 3, 0, Math.PI * 2); g.arc(x, H - m - 11, 3, 0, Math.PI * 2); g.fill();
    }
    corner(g, m + 22, m + 22, 1, 1); corner(g, W - m - 22, m + 22, -1, 1);
    corner(g, m + 22, H - m - 22, 1, -1); corner(g, W - m - 22, H - m - 22, -1, -1);
  }

  // crest: a gold d20 under a crown, framed by laurels
  function crest(g, cx, cy) {
    for (const side of [-1, 1]) {  // laurels: leaves along an arc from the bottom up each side
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + side * (0.45 + i * 0.2), R = 112;
        g.save(); g.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.rotate(a + side * 0.4);
        g.fillStyle = gold(g, -10, -24, 10, 24);
        g.beginPath(); g.ellipse(0, 0, 9, 24, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
    const r = 70, pts = [...Array(6)].map((_, i) => [cx + r * Math.cos(Math.PI / 6 + i * Math.PI / 3), cy + r * Math.sin(Math.PI / 6 + i * Math.PI / 3)]);
    g.fillStyle = 'rgba(110,23,18,.9)';
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    g.strokeStyle = gold(g, cx - r, cy - r, cx + r, cy + r); g.lineWidth = 5; g.stroke();
    const tri = [[cx, cy - r * .55], [cx + r * .55, cy + r * .38], [cx - r * .55, cy + r * .38]];
    g.lineWidth = 3; g.beginPath(); tri.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
    g.beginPath(); tri.forEach(([x, y], i) => { const p = pts[[4, 0, 2][i]]; g.moveTo(x, y); g.lineTo(p[0], p[1]); });
    g.moveTo(...tri[0]); g.lineTo(...pts[5]); g.moveTo(...tri[1]); g.lineTo(...pts[1]); g.moveTo(...tri[2]); g.lineTo(...pts[3]); g.stroke();
    g.fillStyle = gold(g, cx - 20, 0, cx + 20, 0); g.font = `700 34px ${F.head}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('20', cx, cy + 8);
    const ky = cy - r - 14;  // crown
    g.fillStyle = gold(g, cx - 60, ky - 50, cx + 60, ky);
    g.beginPath(); g.moveTo(cx - 56, ky); g.lineTo(cx - 64, ky - 46); g.lineTo(cx - 30, ky - 22); g.lineTo(cx, ky - 58); g.lineTo(cx + 30, ky - 22); g.lineTo(cx + 64, ky - 46); g.lineTo(cx + 56, ky); g.closePath(); g.fill();
    g.fillStyle = '#8e1a1f'; [[-64, -46], [0, -58], [64, -46]].forEach(([x, y]) => { g.beginPath(); g.arc(cx + x, ky + y, 7, 0, Math.PI * 2); g.fill(); });
  }

  function divider(g, cx, y, w) {
    g.strokeStyle = gold(g, cx - w, y, cx + w, y); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx - w, y); g.lineTo(cx - 22, y); g.moveTo(cx + 22, y); g.lineTo(cx + w, y); g.stroke();
    g.fillStyle = gold(g, cx - 14, y - 14, cx + 14, y + 14);
    g.beginPath(); g.moveTo(cx, y - 13); g.lineTo(cx + 13, y); g.lineTo(cx, y + 13); g.lineTo(cx - 13, y); g.closePath(); g.fill();
    g.lineWidth = 2; spiral(g, cx - w - 12, y, 10, 1.2, 0, 1); spiral(g, cx + w + 12, y, 10, 1.2, Math.PI, -1);
  }

  const wrap = (g, text, maxW) => {
    const words = text.split(/\s+/), lines = []; let cur = [];
    for (const w of words) { const t = [...cur, w].join(' '); if (cur.length && g.measureText(t).width > maxW) { lines.push(cur); cur = [w]; } else cur.push(w); }
    if (cur.length) lines.push(cur);
    return lines;
  };
  function justified(g, lines, x, y, maxW, lh) {
    const sp = g.measureText(' ').width;
    lines.forEach((ws, i) => {
      const widths = ws.map(w => g.measureText(w).width), sum = widths.reduce((a, b) => a + b, 0);
      const gap = i < lines.length - 1 && ws.length > 1 ? (maxW - sum) / (ws.length - 1) : sp;
      const useGap = gap > sp * 3.2 ? sp : gap;
      let cx = x; ws.forEach((w, j) => { g.fillText(w, cx, y + i * lh); cx += widths[j] + useGap; });
    });
    return y + lines.length * lh;
  }
  function centered(g, text, cx, y, maxW, lh) { const ls = wrap(g, text, maxW); ls.forEach((ws, i) => g.fillText(ws.join(' '), cx, y + i * lh)); return y + ls.length * lh; }

  function seal(g, cx, cy, R, rnd) {
    // ribbons under the seal
    for (const [ang, col] of [[-0.42, '#7d1417'], [0.42, '#9a1c20']]) {
      g.save(); g.translate(cx, cy); g.rotate(ang);
      g.fillStyle = col; g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.lineTo(30, R * 1.55); g.lineTo(0, R * 1.32); g.lineTo(-30, R * 1.55); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-26, 0, 9, R * 1.4);
      g.restore();
    }
    g.save();
    g.shadowColor = 'rgba(40,10,5,.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    g.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, r = R * (1 + (rnd() - .5) * .1 + (i % 6 === 0 ? .06 : 0)); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath();
    const wax = g.createRadialGradient(cx - R * .35, cy - R * .35, R * .1, cx, cy, R * 1.1);
    wax.addColorStop(0, '#d63a3d'); wax.addColorStop(.55, '#a3171d'); wax.addColorStop(1, '#5e0b0f');
    g.fillStyle = wax; g.fill(); g.restore();
    g.lineWidth = 7; g.strokeStyle = 'rgba(60,4,6,.5)'; g.beginPath(); g.arc(cx + 2, cy + 2, R * .72, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,160,160,.28)'; g.beginPath(); g.arc(cx - 2, cy - 2, R * .72, 0, Math.PI * 2); g.stroke();
    g.font = `700 ${R * .62}px ${F.head}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(55,3,6,.75)'; g.fillText('GM', cx + 3, cy + 5);
    g.fillStyle = 'rgba(255,175,175,.35)'; g.fillText('GM', cx - 2, cy);
    g.fillStyle = '#9b161c'; g.fillText('GM', cx, cy + 2);
    for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, r = R * (.84 + rnd() * .1); g.fillStyle = `rgba(255,200,200,${.08 + rnd() * .12})`; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2 + rnd() * 4, 0, Math.PI * 2); g.fill(); }
  }

  function qrBlock(g, x, y, S, url, caption) {
    g.fillStyle = 'rgba(250,242,220,.92)'; g.fillRect(x - 30, y - 30, S + 60, S + 60);
    g.strokeStyle = gold(g, x, y, x + S, y + S); g.lineWidth = 5; g.strokeRect(x - 30, y - 30, S + 60, S + 60);
    g.lineWidth = 1.5; g.strokeRect(x - 40, y - 40, S + 80, S + 80);
    if (window.qrcode) {
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      const n = q.getModuleCount(), c = S / n;
      g.fillStyle = INK;
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(x + k * c, y + r * c, Math.ceil(c), Math.ceil(c));
    }
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    let cs = 40; g.font = `${cs}px ${F.script}`; while (g.measureText(caption).width > S + 150 && cs > 26) { cs -= 2; g.font = `${cs}px ${F.script}`; }
    g.fillText(caption, x + S / 2, y + S + 92);
  }

  window.drawLetter = function (canvas, { name, lang, url, code, date }) {
    const T = TEXT[lang] || TEXT.en, g = canvas.getContext('2d'), rnd = seeded(code || name || 'letter');
    canvas.width = W; canvas.height = H;
    parchment(g, rnd); border(g);
    crest(g, W / 2, 240);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = RED; g.font = `700 62px ${F.head}`;
    let y = centered(g, T.head, W / 2, 420, 1060, 76);
    g.fillStyle = INK; g.font = `48px ${F.script}`; g.fillText(T.order, W / 2, y + 14);
    divider(g, W / 2, y + 52, 230);
    g.font = `52px ${F.script}`; g.fillText(T.to, W / 2, y + 140);
    // the recipient, as large as fits
    const nm = String(name || '').trim() || '—';
    let ns = 132; g.font = `${ns}px ${F.name}`; while (g.measureText(nm).width > 1060 && ns > 60) { ns -= 4; g.font = `${ns}px ${F.name}`; }
    g.fillStyle = INK; g.fillText(nm, W / 2, y + 140 + ns * 1.05);
    const nw = Math.min(1060, g.measureText(nm).width + 80), ny = y + 140 + ns * 1.05 + 30;
    g.strokeStyle = gold(g, W / 2 - nw / 2, ny, W / 2 + nw / 2, ny); g.lineWidth = 3;
    g.beginPath(); g.moveTo(W / 2 - nw / 2, ny); g.bezierCurveTo(W / 2 - nw / 4, ny + 14, W / 2 + nw / 4, ny - 14, W / 2 + nw / 2, ny); g.stroke();
    // the summons, justified; smaller type if it would run into the seal
    const top = ny + 88, bottom = H - 560, left = 190, maxW = W - left * 2;
    g.textAlign = 'left';
    let fs = 62, lh, paras;
    for (;;) { g.font = `${fs}px ${F.script}`; lh = fs * 1.34; paras = T.body.map(p => wrap(g, p, maxW));
      const hgt = paras.reduce((s, p) => s + p.length * lh, 0) + (paras.length - 1) * lh * .45 + lh * 1.6;
      if (top + hgt <= bottom || fs <= 36) break; fs -= 2; }
    g.fillStyle = INK; let by = top;
    paras.forEach(p => { by = justified(g, p, left, by, maxW, lh) + lh * .45; });
    g.textAlign = 'center'; g.font = `${fs}px ${F.script}`; g.fillStyle = INK;
    centered(g, T.date(date || new Date()), W / 2, by + lh * .5, maxW, lh);
    // bottom: QR code on the left, seal and signature on the right
    qrBlock(g, 236, H - 500, 260, url, T.scan);
    seal(g, 1000, H - 420, 96, rnd);
    g.fillStyle = INK; g.textAlign = 'center';
    let ss = 46; g.font = `${ss}px ${F.script}`; while (wrap(g, T.sign, 520).length > 2 && ss > 30) { ss -= 2; g.font = `${ss}px ${F.script}`; }
    g.strokeStyle = 'rgba(43,22,8,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(760, H - 240); g.lineTo(1240, H - 240); g.stroke();
    centered(g, T.sign, 1000, H - 194, 520, ss * 1.08);
    g.fillStyle = FADED; g.font = `24px Georgia, serif`;
    g.fillText(String(url).replace(/^https?:\/\//, ''), W / 2, H - 88);
    return canvas;
  };
  window.letterFonts = () => Promise.all([`48px "Pinyon Script"`, `48px "Great Vibes"`, `700 48px "Cinzel Decorative"`].map(f => document.fonts.load(f))).catch(() => {});
})();
