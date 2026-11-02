// Turns a Telegram Desktop export (result.json) into compact stats.
// Runs in a Web Worker (worker.js) and on the main thread (demo mode).
(function (root) {
  const DAY = 86400000;

  const STOP = new Set((
    // English
    'the and you that for are with this have not but was just what all your can its it\'s like get out about there they when one how she him his her had has then them too yes yeah lol okay omg why who will would could should did does dont don\'t can\'t can’t i\'m im you\'re i’m don’t thats that\'s really from been more some here also only into well good know now see got going want think time much very sure ok' +
    // Ukrainian
    ' що як але так там тут вже ще мені тобі мене тебе він вона вони воно ми ви цей цього цю ось ну да ага чи коли тому дуже буде було був була якщо або щоб теж тоже хочу може можна треба зараз просто який яка яке які мене його її них нас вас' +
    // Russian
    ' что как это все всё уже еще ещё мне тебе меня тебя он она они оно мы вы его её ее их нас вас был была было будет если или чтобы тоже хочу можно надо сейчас просто какой какая какие кто где когда тогда только очень даже потом нет есть там тут вот ну ага ладно давай типа короче'
  ).split(/\s+/));

  const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;
  const WORD = /[\p{L}][\p{L}'’]{2,}/gu;

  function plain(t) {
    if (typeof t === 'string') return t;
    if (Array.isArray(t)) return t.map(x => (typeof x === 'string' ? x : (x && x.text) || '')).join('');
    return '';
  }

  // Day number from "YYYY-MM-DD" (timezone-free, the export already uses local time).
  const dayNum = key => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / DAY;
  const keyOf = num => new Date(num * DAY).toISOString().slice(0, 10);
  function todayKey(now) {
    const d = new Date(now);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function median(a) {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    return s[s.length >> 1];
  }

  function top(map, n) {
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  function chatsFrom(json) {
    if (json && json.chats && Array.isArray(json.chats.list)) {
      const pi = json.personal_information;
      return { chats: json.chats.list, meId: pi && pi.user_id ? 'user' + pi.user_id : null };
    }
    if (json && Array.isArray(json.messages)) return { chats: [json], meId: null };
    throw new Error('This file is not a Telegram export. Pick the result.json from Telegram Desktop (JSON format).');
  }

  // opts.now   — reference time (ms) for streaks/weeks
  // opts.cutoff — ignore messages after this time (used to fake a past check-in in demo mode)
  function analyzeChat(chat, opts) {
    const now = opts.cutoff || opts.now;
    const nowDay = dayNum(todayKey(now));
    const people = {};
    const hours = new Array(24).fill(0);
    const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const daily = {}, months = {}, words = {}, emoji = {};
    const weekly = new Array(26).fill(0);
    const replyGaps = {};
    const samples = [];
    let total = 0, first = null, last = null, prev = null, seen = 0, firstMsg = null, lastText = '';

    for (const m of chat.messages || []) {
      if (m.type !== 'message') continue;
      const ts = m.date_unixtime ? +m.date_unixtime * 1000 : Date.parse(m.date);
      if (!ts || ts > now) continue;
      const id = m.from_id || m.from || 'unknown';
      const p = people[id] || (people[id] = {
        id, name: m.from || 'Deleted account', msgs: 0, words: 0, chars: 0, stickers: 0, voice: 0,
        circles: 0, media: 0, links: 0, starts: 0, night: 0, longest: '', emoji: {},
      });
      if (m.from && p.name === 'Deleted account') p.name = m.from;
      const text = plain(m.text);
      const date = String(m.date || '');
      const dk = date.slice(0, 10), hr = +date.slice(11, 13) || 0;
      const dn = dayNum(dk);
      const wd = (new Date(dn * DAY).getUTCDay() + 6) % 7; // Monday = 0

      total++; p.msgs++;
      const label = text || (m.media_type === 'sticker' ? (m.sticker_emoji || '') + ' sticker' : m.media_type === 'voice_message' ? '🎤 voice message' : m.media_type === 'video_message' ? '⭕ video message' : m.photo ? '📷 photo' : '📎 attachment');
      if (first === null) { first = ts; firstMsg = { from: p.name, text: label.slice(0, 200) }; }
      last = ts; lastText = label.slice(0, 120);
      hours[hr]++; heat[wd][hr]++;
      daily[dk] = (daily[dk] || 0) + 1;
      months[dk.slice(0, 7)] = (months[dk.slice(0, 7)] || 0) + 1;
      const wi = Math.floor((nowDay - dn) / 7);
      if (wi >= 0 && wi < 26) weekly[wi]++;
      if (hr < 5) p.night++;

      if (m.media_type === 'sticker') p.stickers++;
      else if (m.media_type === 'voice_message') p.voice++;
      else if (m.media_type === 'video_message') p.circles++;
      else if (m.photo || m.media_type || m.file) p.media++;

      if (text) {
        p.chars += text.length;
        if (/https?:\/\//.test(text)) p.links++;
        if (text.length > p.longest.length) p.longest = text.slice(0, 600);
        for (const w of text.toLowerCase().match(WORD) || []) {
          p.words++;
          if (!STOP.has(w) && w.length < 24) words[w] = (words[w] || 0) + 1;
        }
        for (const e of text.match(EMOJI) || []) { emoji[e] = (emoji[e] || 0) + 1; p.emoji[e] = (p.emoji[e] || 0) + 1; }
        // reservoir sample for the "Who said it?" game
        if (text.length >= 12 && text.length <= 160 && !/https?:\/\//.test(text)) {
          seen++;
          if (samples.length < 300) samples.push({ from: id, text });
          else { const j = Math.floor(Math.random() * seen); if (j < 300) samples[j] = { from: id, text }; }
        }
      }
      if (m.sticker_emoji) { emoji[m.sticker_emoji] = (emoji[m.sticker_emoji] || 0) + 1; }

      if (!prev || ts - prev.ts > 6 * 3600000) p.starts++;
      else if (prev.id !== id && ts - prev.ts < 12 * 3600000) (replyGaps[id] || (replyGaps[id] = [])).push(ts - prev.ts);
      prev = { id, ts };
    }

    // streaks over days with at least one message
    const dayNums = Object.keys(daily).map(dayNum).sort((a, b) => a - b);
    let best = 0, run = 0, bestEnd = null;
    for (let i = 0; i < dayNums.length; i++) {
      run = i && dayNums[i] === dayNums[i - 1] + 1 ? run + 1 : 1;
      if (run > best) { best = run; bestEnd = dayNums[i]; }
    }
    let cur = 0;
    const lastDay = dayNums.length ? dayNums[dayNums.length - 1] : null;
    if (lastDay !== null && nowDay - lastDay <= 1) {
      cur = 1;
      for (let i = dayNums.length - 1; i > 0 && dayNums[i - 1] === dayNums[i] - 1; i--) cur++;
    }

    const busiest = top(daily, 1)[0];
    const list = Object.values(people).sort((a, b) => b.msgs - a.msgs).slice(0, 25).map(p => ({
      ...p, emoji: top(p.emoji, 3).map(e => e[0]), reply: median(replyGaps[p.id] || []),
    }));

    return {
      id: String(chat.id), name: chat.name || (chat.type === 'saved_messages' ? 'Saved Messages' : 'Unnamed chat'),
      type: chat.type || 'personal_chat', total, first, last,
      lastFrom: prev ? prev.id : null, lastText, firstMsg,
      activeDays: dayNums.length, people: list, hours, heat, months, weekly, daily,
      topWords: top(words, 40), topEmoji: top(emoji, 12),
      busiest: busiest ? { day: busiest[0], count: busiest[1] } : null,
      streak: { cur, best, bestEnd: bestEnd !== null ? keyOf(bestEnd) : null, lastDay: lastDay !== null ? keyOf(lastDay) : null },
      samples,
    };
  }

  function analyze(json, opts) {
    opts = Object.assign({ now: Date.now() }, opts);
    const { chats, meId } = chatsFrom(json);
    const out = chats.map(c => analyzeChat(c, opts)).filter(c => c.total > 0);
    return { chats: out, meId: meId || guessMe(out) };
  }

  // Without personal_information: "me" is whoever appears in the most chats.
  function guessMe(chats) {
    if (chats.length < 2) return null;
    const count = {};
    for (const c of chats) for (const p of c.people) count[p.id] = (count[p.id] || 0) + 1;
    const best = top(count, 2);
    return best.length && best[0][1] >= 2 && (!best[1] || best[0][1] > best[1][1]) ? best[0][0] : null;
  }

  const api = { analyze, analyzeChat, plain, dayNum, todayKey, guessMe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analyze = api;
})(typeof self !== 'undefined' ? self : this);
