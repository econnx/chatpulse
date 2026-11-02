// ChatPulse UI: Pulse check-in, Wrapped and the "Who said it?" game.
(function () {
  const DAY = 86400000;
  const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#34d399', '#38bdf8', '#fbbf24', '#f87171', '#a3e635'];
  const $ = s => document.querySelector(s);
  const state = { data: null, prev: null, demo: false, now: Date.now(), chatId: null, gameChat: null };

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const n = x => Math.round(x).toLocaleString('en-US');
  const first = s => Array.from(String(s).trim())[0] || '?';
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) | 0; return Math.abs(h); };
  const color = id => COLORS[hash(id) % COLORS.length];
  const avatar = (name, id) => `<div class="av" style="background:${color(id)}">${esc(first(name).toUpperCase())}</div>`;
  const date = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  function ago(ms) {
    const h = ms / 3600000;
    if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
    if (h < 48) return Math.round(h) + ' h';
    return Math.round(h / 24) + ' days';
  }
  function speed(ms) {
    if (ms == null) return '—';
    if (ms < 60000) return Math.round(ms / 1000) + ' sec';
    if (ms < 3600000) return Math.round(ms / 60000) + ' min';
    return (ms / 3600000).toFixed(1) + ' h';
  }
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
  }
  const chatById = id => state.data.chats.find(c => c.id === id);
  const mine = c => { const p = c.people.find(p => p.id === state.data.meId); return p ? p.msgs : 0; };
  const nameOf = (c, id) => (c.people.find(p => p.id === id) || {}).name || 'Someone';

  // ---------- snapshots (numbers only, no message text) ----------
  function snapshot(data, ts) {
    const chats = {};
    for (const c of data.chats) chats[c.id] = { n: c.name, t: c.total, m: (c.people.find(p => p.id === data.meId) || {}).msgs || 0 };
    return { ts, chats };
  }
  function checkIn(data, now) {
    const snaps = store.get('cp.snaps', []);
    const prev = [...snaps].reverse().find(s => now - s.ts > 3600000) || null;
    const last = snaps[snaps.length - 1];
    if (last && now - last.ts < 12 * 3600000) snaps.pop(); // same session: replace, don't stack
    snaps.push(snapshot(data, now));
    store.set('cp.snaps', snaps.slice(-30));
    return prev;
  }

  // ---------- loading ----------
  function showLoading(msg) { $('#loadMsg').textContent = msg; $('#loading').hidden = false; }
  function fail(msg) { $('#loading').hidden = true; const e = $('#err'); e.textContent = msg; e.hidden = false; }

  function loadFiles(files) {
    files = [...files].filter(f => /\.json$/i.test(f.name) || f.type === 'application/json');
    if (!files.length) return fail('Please choose the result.json file from your Telegram export.');
    $('#err').hidden = true;
    showLoading('Reading your export…');
    const w = new Worker('worker.js');
    w.onmessage = ({ data }) => {
      if (data.progress) return showLoading(data.progress);
      w.terminate();
      if (data.error) return fail(data.error);
      if (!data.result.chats.length) return fail('No messages found in this export.');
      state.demo = false; state.now = Date.now();
      start(data.result, null);
    };
    w.onerror = () => fail('Something went wrong while reading the file.');
    w.postMessage({ files, now: Date.now() });
  }

  function loadDemo() {
    showLoading('Building a demo…');
    setTimeout(() => {
      const now = Date.now();
      const json = Demo.build(now);
      const data = Analyze.analyze(json, { now });
      const past = Analyze.analyze(json, { now, cutoff: now - 3.3 * DAY });
      state.demo = true; state.now = now;
      start(data, snapshot(past, now - 3.3 * DAY));
    }, 30);
  }

  function start(data, demoPrev) {
    if (!data.meId) {
      const saved = store.get('cp.me', null);
      if (saved && data.chats.some(c => c.people.some(p => p.id === saved))) data.meId = saved;
    }
    state.data = data;
    state.prev = demoPrev || (data.meId ? checkIn(data, state.now) : null);
    const ranked = data.chats.filter(c => c.people.length >= 2).sort((a, b) => b.total - a.total);
    state.chatId = (ranked[0] || data.chats[0]).id;
    state.gameChat = state.chatId;
    $('#landing').hidden = true; $('#loading').hidden = true; $('#app').hidden = false;
    document.querySelector('.tabs').hidden = false; $('#newUpload').hidden = false;
    const view = new URLSearchParams(location.search).get('view');
    show(['pulse', 'wrapped', 'game'].includes(view) ? view : 'pulse');
  }

  function show(view) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => (v.hidden = v.id !== 'view-' + view));
    ({ pulse: renderPulse, wrapped: renderWrapped, game: renderGame })[view]();
    window.scrollTo({ top: 0 });
  }

  // ---------- Pulse ----------
  function computePulse() {
    const { chats, meId } = state.data, now = state.now;
    const today = Analyze.todayKey(now);
    const personal = chats.filter(c => c.type === 'personal_chat' && c.people.length >= 2);
    const close = chats.filter(c => c.people.length >= 2 && (c.type === 'personal_chat' || (/group/.test(c.type) && c.people.length <= 8)));

    const debt = meId ? personal.filter(c => c.lastFrom && c.lastFrom !== meId && now - c.last > 3600000 && now - c.last < 21 * DAY).sort((a, b) => a.last - b.last) : [];
    const trend = c => ({ recent: avg(c.weekly.slice(0, 2)), before: avg(c.weekly.slice(2, 10)) });
    const fading = close.filter(c => { const t = trend(c); return t.before >= 8 && t.recent < t.before * 0.4; })
      .sort((a, b) => trend(b).before - trend(a).before);
    const heating = close.filter(c => { const t = trend(c); return t.recent >= 8 && t.recent > Math.max(t.before, 1) * 2; })
      .sort((a, b) => trend(b).recent - trend(a).recent);
    const streaks = close.filter(c => c.streak.cur >= 3).sort((a, b) => b.streak.cur - a.streak.cur);
    const atRisk = streaks.filter(c => c.streak.lastDay !== today);
    const balance = meId ? personal.filter(c => c.total >= 100).sort((a, b) => sum(b.weekly.slice(0, 4)) - sum(a.weekly.slice(0, 4))).slice(0, 6) : [];

    let score = 100 - Math.min(35, debt.length * 7) - Math.min(24, fading.length * 6) - Math.min(15, atRisk.length * 5);
    score = Math.max(5, Math.min(100, score));
    const label = score >= 90 ? 'Socially thriving' : score >= 70 ? 'Doing fine, mostly' : score >= 50 ? 'A few people miss you' : 'Time to text back';
    return { debt, fading, heating, streaks, atRisk, balance, score, label, trend, today };
  }

  function ring(score) {
    const r = 70, c = 2 * Math.PI * r;
    return `<div class="ring"><svg viewBox="0 0 168 168"><defs><linearGradient id="rg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".6" stop-color="#ec4899"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs>
      <circle cx="84" cy="84" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"/>
      <circle cx="84" cy="84" r="${r}" fill="none" stroke="url(#rg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c * score / 100} ${c}"/></svg>
      <div class="val"><b>${score}</b><span>Pulse</span></div></div>`;
  }

  function spark(weekly) {
    const pts = weekly.slice(0, 12).reverse(), max = Math.max(...pts, 1);
    const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 88 + 1},${29 - (v / max) * 26}`).join(' ');
    return `<svg class="spark" viewBox="0 0 90 30"><polyline points="${d}" fill="none" stroke="url(#rg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function mePicker() {
    const people = {};
    for (const c of state.data.chats) for (const p of c.people) people[p.id] = people[p.id] || { ...p, chats: 0, total: 0 };
    for (const c of state.data.chats) for (const p of c.people) { people[p.id].chats++; people[p.id].total += p.msgs; }
    const opts = Object.values(people).sort((a, b) => b.chats - a.chats || b.total - a.total).slice(0, 12);
    return `<div class="card s12"><h3>👋 Which one is you?</h3>
      <p class="muted">Single-chat exports don't say who you are. Pick yourself to unlock reply debt, balance and check-ins.</p>
      <div class="me-pick">${opts.map(p => `<button class="ghost small" data-me="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div></div>`;
  }

  function renderPulse() {
    const P = computePulse(), d = state.data, el = $('#view-pulse');
    const since = state.prev ? sinceBlock(state.prev) : '';
    const sub = P.debt.length
      ? `${P.debt.length} ${P.debt.length === 1 ? 'person is' : 'people are'} waiting for your reply${P.atRisk.length ? ` and ${P.atRisk.length} streak${P.atRisk.length > 1 ? 's' : ''} could break today` : ''}.`
      : P.atRisk.length ? `Nobody's waiting on you, but ${P.atRisk.length} streak${P.atRisk.length > 1 ? 's' : ''} could break today.` : 'Nobody is waiting on you. Inbox zero, socially.';
    const lastMsg = Math.max(...d.chats.map(c => c.last));
    const stale = !state.demo && state.now - lastMsg > 2 * DAY
      ? `<div class="card s12 small">⚠️ The newest message in this export is from ${date(lastMsg)}. Export again for a fresh Pulse.</div>` : '';

    el.innerHTML = `
      <div class="grid">
        ${d.meId ? '' : mePicker()}
        ${stale}
        <div class="card s12 pulse-hero">
          ${ring(P.score)}
          <div>
            <div class="muted small">${state.demo ? 'Demo data · ' : ''}Check-in · ${new Date(state.now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <h2>${P.label}</h2>
            <p>${sub}</p>
            <div class="row">
              <button class="primary small" id="sharePulse">Share my Pulse</button>
              <button class="ghost small" id="remind">🗓 Remind me Mon &amp; Thu</button>
            </div>
          </div>
        </div>
        ${since}
        <div class="card s6"><h3>⏳ Waiting for you <span class="count">${P.debt.length}</span></h3>
          <div class="list">${P.debt.slice(0, 6).map(c => `<div class="item">${avatar(c.name, c.id)}<div class="who"><b>${esc(c.name)}</b><span>“${esc(c.lastText)}”</span></div><span class="tag ${state.now - c.last > 2 * DAY ? 'bad' : 'warn'}">${ago(state.now - c.last)}</span></div>`).join('') || `<div class="empty">${d.meId ? 'All caught up ✨' : 'Pick yourself above to see this.'}</div>`}</div></div>
        <div class="card s6"><h3>🔥 Streaks <span class="count">${P.streaks.length}</span></h3>
          <div class="list">${P.streaks.slice(0, 6).map(c => `<div class="item">${avatar(c.name, c.id)}<div class="who"><b>${esc(c.name)}</b><span>best: ${c.streak.best} days</span></div><span class="tag ${c.streak.lastDay === P.today ? 'good' : 'hot'}">${c.streak.cur} days${c.streak.lastDay === P.today ? ' ✓' : ' · text today!'}</span></div>`).join('') || '<div class="empty">No active streaks (3+ days in a row).</div>'}</div></div>
        <div class="card s6"><h3>🥀 Fading away <span class="count">${P.fading.length}</span></h3>
          <div class="list">${P.fading.slice(0, 5).map(c => { const t = P.trend(c); return `<div class="item">${avatar(c.name, c.id)}<div class="who"><b>${esc(c.name)}</b><span>${n(t.recent)}/week now vs ${n(t.before)}/week before</span></div>${spark(c.weekly)}</div>`; }).join('') || '<div class="empty">No friendships cooling down. Nice.</div>'}</div></div>
        <div class="card s6"><h3>📈 Heating up <span class="count">${P.heating.length}</span></h3>
          <div class="list">${P.heating.slice(0, 5).map(c => { const t = P.trend(c); return `<div class="item">${avatar(c.name, c.id)}<div class="who"><b>${esc(c.name)}</b><span>${n(t.recent)}/week, up from ${n(t.before)}</span></div>${spark(c.weekly)}</div>`; }).join('') || '<div class="empty">Nothing new is heating up.</div>'}</div></div>
        <div class="card s12"><h3>⚖️ Who texts first? <span class="count">last chats you were active in</span></h3>
          <div class="bal">${P.balance.map(c => {
            const me = c.people.find(p => p.id === d.meId), all = sum(c.people.map(p => p.starts)) || 1;
            const share = Math.round(((me ? me.starts : 0) / all) * 100);
            return `<div class="bal-row"><div class="lbl"><span>${esc(c.name)}</span><span class="muted">you start ${share}%</span></div><div class="bar"><i style="width:${share}%;background:var(--grad)"></i></div></div>`;
          }).join('') || `<div class="empty">${d.meId ? 'Not enough personal chats yet.' : 'Pick yourself above to see this.'}</div>`}</div></div>
      </div>`;

    el.querySelectorAll('[data-me]').forEach(b => b.onclick = () => {
      d.meId = b.dataset.me; store.set('cp.me', d.meId);
      if (!state.demo) state.prev = checkIn(d, state.now);
      renderPulse();
    });
    $('#remind').onclick = downloadIcs;
    $('#sharePulse').onclick = () => Cards.share(Cards.pulse({
      score: P.score, label: P.label, waiting: P.debt.length, streak: P.streaks[0] ? P.streaks[0].streak.cur : 0,
      fading: P.fading.length, heating: P.heating.length,
    }), 'my-chatpulse.png').then(toast);
  }

  function sinceBlock(prev) {
    const d = state.data, rows = [];
    let total = 0, my = 0;
    for (const c of d.chats) {
      const p = prev.chats[c.id];
      const dt = c.total - (p ? p.t : 0), dm = mine(c) - (p ? p.m : 0);
      if (dt > 0) { rows.push({ c, dt, isNew: !p }); total += dt; my += Math.max(0, dm); }
    }
    rows.sort((a, b) => b.dt - a.dt);
    const days = Math.max(1, Math.round((state.now - prev.ts) / DAY));
    return `<div class="card s12"><h3>🕑 Since your last check-in <span class="count">${days} day${days > 1 ? 's' : ''} ago · ${date(prev.ts)}</span></h3>
      <div class="since">
        <span class="chip">💬 <b>${n(total)}</b> new messages</span>
        ${d.meId ? `<span class="chip">📤 you sent <b>${n(my)}</b></span><span class="chip">📥 you got <b>${n(total - my)}</b></span>` : ''}
        ${rows.slice(0, 4).map(r => `<span class="chip">${esc(r.c.name)} <b class="up">+${n(r.dt)}</b>${r.isNew ? ' · new' : ''}</span>`).join('')}
      </div></div>`;
  }

  function downloadIcs() {
    const d = new Date(state.now); d.setHours(19, 0, 0, 0);
    while (![1, 4].includes(d.getDay()) || d.getTime() < state.now) d.setDate(d.getDate() + 1), d.setHours(19, 0, 0, 0);
    const p = x => String(x).padStart(2, '0');
    const local = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T190000`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ChatPulse//EN', 'BEGIN:VEVENT', 'UID:checkin@chatpulse', 'DTSTAMP:' + stamp,
      'DTSTART:' + local, 'DURATION:PT10M', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TH', 'SUMMARY:ChatPulse check-in 🫀',
      'DESCRIPTION:Export your Telegram chats and see who is waiting for your reply: https://econnx.github.io/chatpulse/',
      'URL:https://econnx.github.io/chatpulse/', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:ChatPulse check-in', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'chatpulse-checkin.ics'; a.click();
    toast('Open the file to add the reminder to your calendar');
  }

  // ---------- Wrapped ----------
  function chatSelect(id, current, filter) {
    const list = state.data.chats.filter(filter || (c => c.people.length >= 1)).sort((a, b) => b.total - a.total);
    return `<select id="${id}">${list.map(c => `<option value="${esc(c.id)}"${c.id === current ? ' selected' : ''}>${esc(c.name)} · ${n(c.total)}</option>`).join('')}</select>`;
  }

  function renderWrapped() {
    const c = chatById(state.chatId), el = $('#view-wrapped');
    const span = Math.max(1, Math.round((c.last - c.first) / DAY) + 1);
    const ppl = c.people.slice(0, 8), tot = sum(ppl.map(p => p.msgs)) || 1;
    const all = k => sum(c.people.map(p => p[k]));
    const night = all('night');
    const heatMax = Math.max(1, ...c.heat.flat());
    const mKeys = Object.keys(c.months).sort().slice(-18), mMax = Math.max(1, ...mKeys.map(k => c.months[k]));
    const wMax = c.topWords.length ? c.topWords[0][1] : 1;
    const duo = ppl.length >= 2 ? [ppl[0], ppl[1]] : null;
    const startsAll = sum(c.people.map(p => p.starts)) || 1;

    el.innerHTML = `
      <div class="vhead"><div><h2>Wrapped</h2><p>Pick any chat. Stats cover its whole history.</p></div>
        <div class="row">${chatSelect('chatSel', c.id)}<button class="primary small" id="shareW">Share card</button></div></div>
      <div class="grid">
        <div class="card s12 w-hero">
          <div class="muted">${esc(c.name)} · since ${date(c.first)}</div>
          <div class="big grad">${n(c.total)}</div>
          <div class="sub">messages · about <b>${n(c.total / span)}</b> a day · active on <b>${n(c.activeDays)}</b> of ${n(span)} days</div>
        </div>
        <div class="card s12"><div class="tiles">
          <div class="tile"><div class="num">${n(all('words'))}</div><div class="k">words</div></div>
          <div class="tile"><div class="num">${c.streak.best}</div><div class="k">day best streak</div></div>
          <div class="tile"><div class="num">${c.busiest ? n(c.busiest.count) : 0}</div><div class="k">on your busiest day${c.busiest ? `, ${date(c.busiest.day + 'T12:00:00')}` : ''}</div></div>
          <div class="tile"><div class="num">${n(all('voice'))}</div><div class="k">voice messages</div></div>
          <div class="tile"><div class="num">${n(all('stickers'))}</div><div class="k">stickers</div></div>
          <div class="tile"><div class="num">${Math.round((night / c.total) * 100)}%</div><div class="k">sent after midnight</div></div>
        </div></div>
        <div class="card s6 people"><h3>🗣 Who talks the most</h3>
          ${ppl.map((p, i) => `<div class="pr"><div class="lbl" style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px"><span>${esc(p.name)} ${p.emoji.join('')}</span><span class="muted">${n(p.msgs)} · ${Math.round((p.msgs / tot) * 100)}%</span></div><div class="bar"><i style="width:${(p.msgs / ppl[0].msgs) * 100}%;background:${COLORS[i % COLORS.length]}"></i></div></div>`).join('')}
        </div>
        <div class="card s6"><h3>⚡ Who texts first &amp; replies fastest</h3>
          ${duo ? `<div class="vs">
            <div><div class="num">${Math.round((duo[0].starts / startsAll) * 100)}%</div><div class="muted small">${esc(duo[0].name)} · texts first</div></div><div class="muted">vs</div>
            <div><div class="num">${Math.round((duo[1].starts / startsAll) * 100)}%</div><div class="muted small">${esc(duo[1].name)} · texts first</div></div>
            <div><div class="num">${speed(duo[0].reply)}</div><div class="muted small">${esc(duo[0].name)} · reply time</div></div><div class="muted">vs</div>
            <div><div class="num">${speed(duo[1].reply)}</div><div class="muted small">${esc(duo[1].name)} · reply time</div></div>
          </div><p class="muted small" style="margin:16px 0 0">“Texts first” = first message after 6+ hours of silence. Reply time is the median.</p>` : '<div class="empty">Needs at least two people.</div>'}
        </div>
        <div class="card s7"><h3>🕰 When you talk</h3>
          <div class="heat">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => `<span class="hl">${d}</span>${c.heat[i].map((v, h) => `<i title="${d} ${h}:00 · ${v}" style="opacity:${0.06 + (v / heatMax) * 0.94}"></i>`).join('')}`).join('')}
          <span></span>${Array.from({ length: 24 }, (_, h) => `<span style="text-align:center">${h % 6 === 0 ? h : ''}</span>`).join('')}</div>
        </div>
        <div class="card s5"><h3>📅 By month</h3>
          <div class="months">${mKeys.map(k => `<div title="${k}: ${c.months[k]}"><i style="height:${(c.months[k] / mMax) * 100}%"></i>${new Date(k + '-15').toLocaleDateString('en-US', { month: 'narrow' })}</div>`).join('')}</div>
        </div>
        <div class="card s7"><h3>💬 Top words</h3>
          <div class="words">${c.topWords.slice(0, 28).map(([w, v]) => `<span style="font-size:${13 + (v / wMax) * 22}px;opacity:${0.5 + (v / wMax) * 0.5}">${esc(w)}</span>`).join('') || '<div class="empty">No text messages.</div>'}</div>
        </div>
        <div class="card s5"><h3>😂 Top emoji</h3>
          <div class="emojis">${c.topEmoji.slice(0, 8).map(([e, v]) => `<div>${e}<small>${n(v)}</small></div>`).join('') || '<div class="empty">No emoji (seriously?)</div>'}</div>
        </div>
        ${c.firstMsg ? `<div class="card s12"><h3>🌱 Where it all started</h3><p class="quote">${esc(c.firstMsg.text)}</p><p class="muted small">${esc(c.firstMsg.from)}, ${date(c.first)}</p></div>` : ''}
      </div>`;

    $('#chatSel').onchange = e => { state.chatId = e.target.value; renderWrapped(); };
    $('#shareW').onclick = () => Cards.share(Cards.wrapped({
      name: c.name, total: c.total, since: date(c.first), days: c.activeDays, streak: c.streak.best,
      emoji: c.topEmoji.slice(0, 3).map(e => e[0]).join(' '),
      people: ppl.slice(0, 4).map((p, i) => ({ name: p.name, share: p.msgs / tot, color: COLORS[i % COLORS.length] })),
      perDay: Math.round(c.total / span),
    }), 'chat-wrapped.png').then(toast);
  }

  // ---------- Who said it? ----------
  const ROUNDS = 10;
  function gameChats() {
    return state.data.chats.filter(c => c.people.filter(p => c.samples.some(s => s.from === p.id)).length >= 2 && c.samples.length >= 15);
  }

  function renderGame() {
    const el = $('#view-game'), ok = gameChats();
    if (!ok.length) { el.innerHTML = '<div class="card game"><h3>Not enough messages to play</h3><p class="muted">Upload a chat with at least two people and some text messages.</p></div>'; return; }
    if (!ok.some(c => c.id === state.gameChat)) state.gameChat = ok.sort((a, b) => b.total - a.total)[0].id;
    const c = chatById(state.gameChat);
    const players = c.people.filter(p => c.samples.filter(s => s.from === p.id).length >= 3).slice(0, 4);
    const pool = c.samples.filter(s => players.some(p => p.id === s.from)).sort(() => Math.random() - 0.5).slice(0, ROUNDS);
    const best = store.get('cp.best.' + c.id, 0);
    let i = 0, score = 0, streak = 0;

    function round() {
      const s = pool[i];
      el.innerHTML = `<div class="game">
        <div class="vhead" style="justify-content:center"><div class="row">${chatSelect('gameSel', c.id, x => ok.includes(x))}</div></div>
        <div class="score"><span>Round ${i + 1}/${pool.length}</span><span>${streak >= 2 ? `🔥 ${streak} in a row · ` : ''}Score ${score} · Best ${best}</span></div>
        <div class="progress"><i style="width:${(i / pool.length) * 100}%"></i></div>
        <div class="msg">${esc(s.text)}</div>
        <div class="opts">${players.map(p => `<button data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>
      </div>`;
      $('#gameSel').onchange = e => { state.gameChat = e.target.value; renderGame(); };
      el.querySelectorAll('.opts button').forEach(b => b.onclick = () => {
        const right = b.dataset.id === s.from;
        el.querySelectorAll('.opts button').forEach(x => { x.disabled = true; if (x.dataset.id === s.from) x.classList.add('right'); });
        if (right) { score++; streak++; } else { b.classList.add('wrong'); streak = 0; }
        setTimeout(() => (++i < pool.length ? round() : finish()), right ? 650 : 1300);
      });
    }

    function finish() {
      const newBest = score > best;
      if (newBest) store.set('cp.best.' + c.id, score);
      const verdict = score === pool.length ? 'You know this chat by heart 🏆' : score >= pool.length * 0.7 ? 'True insider 😎' : score >= pool.length * 0.4 ? 'Not bad, not great 🤔' : 'Do you even read this chat? 💀';
      el.innerHTML = `<div class="game card final">
        <div class="muted">${esc(c.name)}</div>
        <div class="num grad">${score}/${pool.length}</div>
        <h2>${verdict}</h2>
        <p class="muted">${newBest ? 'New best score!' : `Best: ${Math.max(best, score)}/${pool.length}`}</p>
        <div class="row" style="justify-content:center"><button class="primary" id="again">Play again</button><button class="ghost" id="shareG">Share score</button></div>
      </div>`;
      $('#again').onclick = renderGame;
      $('#shareG').onclick = () => Cards.share(Cards.game({ name: c.name, score, of: pool.length, verdict }), 'who-said-it.png').then(toast);
    }
    round();
  }

  // ---------- wiring ----------
  const drop = $('#drop');
  $('#file').onchange = e => loadFiles(e.target.files);
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => loadFiles(e.dataTransfer.files));
  $('#demoBtn').onclick = loadDemo;
  $('#newUpload').onclick = () => { location.href = location.pathname; };
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => show(b.dataset.view));
  if (new URLSearchParams(location.search).has('demo')) loadDemo();
})();
