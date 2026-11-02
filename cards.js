// Story-ready share cards drawn on a canvas (1080×1350).
(function (root) {
  const W = 1080, H = 1350;
  const DISPLAY = '"Space Grotesk", Inter, sans-serif', BODY = 'Inter, system-ui, sans-serif';

  function base() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#09090f'; x.fillRect(0, 0, W, H);
    for (const [cx, cy, r, col] of [[120, 80, 700, 'rgba(139,92,246,.55)'], [1000, 1250, 650, 'rgba(249,115,22,.35)'], [900, 300, 420, 'rgba(236,72,153,.28)']]) {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(9,9,15,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    // header
    logo(x, 80, 80, 56);
    x.fillStyle = '#fff'; x.font = `700 40px ${DISPLAY}`; x.textBaseline = 'middle';
    x.fillText('ChatPulse', 152, 108);
    // footer
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = `500 30px ${BODY}`; x.textBaseline = 'alphabetic';
    x.fillText('econnx.github.io/chatpulse', 80, H - 80);
    return { c, x };
  }

  function grad(x, x0, y0, x1, y1) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#8b5cf6'); g.addColorStop(0.55, '#ec4899'); g.addColorStop(1, '#f97316');
    return g;
  }

  function logo(x, px, py, s) {
    x.save(); x.fillStyle = grad(x, px, py, px + s, py + s);
    round(x, px, py, s, s, s * 0.28); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = s * 0.08; x.lineCap = x.lineJoin = 'round';
    const k = s / 32; x.beginPath();
    [[5, 17], [11, 17], [14, 10], [18, 23], [21, 17], [27, 17]].forEach(([a, b], i) => (i ? x.lineTo : x.moveTo).call(x, px + a * k, py + b * k));
    x.stroke(); x.restore();
  }

  function round(x, px, py, w, h, r) {
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }

  function fit(x, text, max, size, weight, font) {
    let s = size;
    do { x.font = `${weight} ${s}px ${font}`; s -= 4; } while (x.measureText(text).width > max && s > 20);
  }

  function stat(x, px, py, w, value, label) {
    x.fillStyle = 'rgba(255,255,255,.06)'; round(x, px, py, w, 190, 32); x.fill();
    x.fillStyle = '#fff'; fit(x, String(value), w - 60, 72, 700, DISPLAY); x.fillText(String(value), px + 32, py + 100);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = `500 28px ${BODY}`; x.fillText(label, px + 32, py + 150);
  }

  function wrapped(d) {
    const { c, x } = base();
    x.textBaseline = 'alphabetic';
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = `600 34px ${BODY}`; x.fillText('WRAPPED · since ' + d.since, 80, 270);
    x.fillStyle = '#fff'; fit(x, d.name, W - 160, 76, 700, DISPLAY); x.fillText(d.name, 80, 360);
    x.fillStyle = grad(x, 80, 400, 900, 600); fit(x, d.total.toLocaleString('en-US'), W - 160, 230, 700, DISPLAY);
    x.fillText(d.total.toLocaleString('en-US'), 72, 600);
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = `500 38px ${BODY}`; x.fillText(`messages · ~${d.perDay} a day`, 80, 670);
    const w = (W - 160 - 40) / 3;
    stat(x, 80, 730, w, d.days, 'active days');
    stat(x, 80 + w + 20, 730, w, d.streak, 'best streak');
    stat(x, 80 + (w + 20) * 2, 730, w, d.emoji || '—', 'top emoji');
    // who talks most
    let px = 80; const bw = W - 160;
    x.save(); round(x, 80, 990, bw, 34, 17); x.clip();
    for (const p of d.people) { x.fillStyle = p.color; x.fillRect(px, 990, bw * p.share + 1, 34); px += bw * p.share; }
    x.restore();
    let ly = 1080;
    d.people.slice(0, 4).forEach((p, i) => {
      const lx = 80 + (i % 2) * 470, yy = ly + Math.floor(i / 2) * 56;
      x.fillStyle = p.color; x.beginPath(); x.arc(lx + 12, yy - 10, 12, 0, 7); x.fill();
      x.fillStyle = '#fff'; fit(x, `${p.name} ${Math.round(p.share * 100)}%`, 410, 32, 600, BODY);
      x.fillText(`${p.name} ${Math.round(p.share * 100)}%`, lx + 36, yy);
    });
    return c;
  }

  function pulse(d) {
    const { c, x } = base();
    const cx = W / 2, cy = 520, r = 230;
    x.lineWidth = 46; x.lineCap = 'round';
    x.strokeStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = grad(x, cx - r, cy - r, cx + r, cy + r); x.beginPath();
    x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * d.score / 100); x.stroke();
    x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = `700 190px ${DISPLAY}`; x.textBaseline = 'middle';
    x.fillText(d.score, cx, cy - 6);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = `600 30px ${BODY}`; x.fillText('MY PULSE', cx, cy + 110);
    x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; fit(x, d.label, W - 160, 72, 700, DISPLAY); x.fillText(d.label, cx, 870);
    x.textAlign = 'left';
    const w = (W - 160 - 40) / 3;
    stat(x, 80, 940, w, d.waiting, 'waiting on me');
    stat(x, 80 + w + 20, 940, w, d.streak ? d.streak + 'd' : '—', 'top streak');
    stat(x, 80 + (w + 20) * 2, 940, w, d.fading, 'fading chats');
    return c;
  }

  function game(d) {
    const { c, x } = base();
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = `600 38px ${BODY}`; x.fillText('WHO SAID IT?', W / 2, 360);
    x.fillStyle = '#fff'; fit(x, d.name, W - 160, 64, 700, DISPLAY); x.fillText(d.name, W / 2, 450);
    x.fillStyle = grad(x, 200, 500, 900, 800); x.font = `700 300px ${DISPLAY}`; x.fillText(`${d.score}/${d.of}`, W / 2, 820);
    x.fillStyle = '#fff'; fit(x, d.verdict, W - 160, 60, 700, DISPLAY); x.fillText(d.verdict, W / 2, 950);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = `500 34px ${BODY}`; x.fillText('Think you know the chat better? Beat me.', W / 2, 1040);
    return c;
  }

  async function share(canvas, filename) {
    await document.fonts.ready;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file] }); return 'Shared!'; } catch { /* cancelled */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    return 'Card saved — post it anywhere';
  }

  root.Cards = { wrapped, pulse, game, share };
})(window);
