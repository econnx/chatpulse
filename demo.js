// Builds a fake Telegram export so people can try the app without their own data.
(function (root) {
  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  const LINES = {
    chat: [
      'are you coming tonight?', 'omg I just saw that 😂😂', 'wait what happened??', 'I\'m literally dying right now',
      'no way that\'s actually true', 'can you send me the notes from today', 'brb grabbing food', 'ok I\'m outside',
      'this song is stuck in my head again', 'I slept like 4 hours lol', 'did you finish the assignment?',
      'honestly same', 'let\'s go to that coffee place tomorrow ☕', 'I can\'t believe it\'s already November',
      'send me a pic!!', 'ahahah stop 😭', 'good morning ☀️', 'what are you doing this weekend?',
      'I\'m so tired of this week', 'this is the best thing I\'ve seen today', 'call me when you\'re free',
      'okay but hear me out', 'the bus is late again 🙄', 'happy to hear that ❤️', 'I miss summer so much',
      'who\'s bringing snacks', 'did you watch the new episode?', 'nooo spoilers please', 'that\'s so cute 🥹',
      'I\'ll be 10 minutes late sorry', 'my code finally works 🎉', 'why is it always raining here',
      'can\'t wait for the holidays', 'let me think about it', 'this teacher is something else 💀',
      'just woke up, what did I miss', 'pizza or sushi tonight? 🍕', 'remind me tomorrow pls', 'deal 🤝',
      'I found the perfect gift for her', 'how was the exam?', 'I think I passed?? 🤞', 'sending you the link now',
      'that meme is so accurate', 'I need coffee immediately', 'goodnight 🌙', 'wanna play later?',
    ],
    mom: [
      'Did you eat today?', 'Call me when you can ❤️', 'Don\'t forget your jacket, it\'s cold', 'How is university going?',
      'Grandma says hi 🌷', 'Are you sleeping enough?', 'I sent you some money for the week', 'Proud of you!',
      'When are you coming home?', 'Take care of yourself 🙏',
    ],
    uni: [
      'does anyone have the slides from lecture 6?', 'deadline is friday right?', 'the quiz opens at 9am',
      'who wants to be in my group for the project', 'is the seminar online today?', 'professor moved the exam 😩',
      'I uploaded the summary to the drive', 'thank you you\'re a lifesaver 🙏', 'what chapter are we on',
      'can someone explain question 3', 'library at 4?', 'we need one more slide about the market',
    ],
    football: [
      'game on saturday at 10 ⚽', 'who\'s in?', 'I\'m in 🙋', 'can\'t this week sorry', 'bring the ball pls',
      'what a goal yesterday', 'we need two more players', 'pitch is booked ✅', 'rain or not we play 💪',
    ],
  };

  function build(now) {
    const r = rng(42);
    const pick = a => a[Math.floor(r() * a.length)];
    const ME = { id: 'user1', name: 'You' };
    const chats = [];
    let msgId = 1;

    function fmt(ts) {
      const d = new Date(ts), p = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    // rate(daysAgo) → expected bursts per day; members[0] is always me
    function chat(id, name, type, members, lines, rate, opts = {}) {
      const msgs = [];
      const start = now - 420 * 86400000;
      const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
      for (let t = start; t < midnight.getTime() + 86400000; t += 86400000) {
        const day = new Date(t); day.setHours(0, 0, 0, 0);
        const ago = Math.round((midnight - day) / 86400000);
        if (ago < (opts.quietDays || 0)) continue;
        let bursts = rate(ago, day.getDay());
        bursts = Math.floor(bursts + r());
        for (let b = 0; b < bursts; b++) {
          const hour = pick([8, 10, 12, 13, 15, 16, 17, 18, 19, 20, 21, 21, 22, 22, 23, 23, 0, 1]);
          let ts = day.getTime() + hour * 3600000 + Math.floor(r() * 3600000);
          let who = Math.floor(r() * members.length);
          const len = 2 + Math.floor(r() * 7);
          for (let i = 0; i < len; i++) {
            if (r() < 0.45) who = (who + 1 + Math.floor(r() * (members.length - 1))) % members.length;
            ts += 20000 + Math.floor(r() * (members[who].slow ? 1800000 : 240000));
            if (ts > now) break;
            const m = { id: msgId++, type: 'message', date: fmt(ts), date_unixtime: String(Math.floor(ts / 1000)), from: members[who].name, from_id: members[who].id, text: '' };
            const roll = r();
            if (roll < 0.07) { m.media_type = 'sticker'; m.sticker_emoji = pick(['😂', '❤️', '🥰', '😭', '👍', '🔥']); }
            else if (roll < 0.1) { m.media_type = 'voice_message'; m.duration_seconds = 5 + Math.floor(r() * 60); }
            else if (roll < 0.12) { m.photo = '(File not included)'; }
            else m.text = pick(lines);
            msgs.push(m);
          }
        }
      }
      if (opts.lastFrom) {
        const ts = now - opts.lastFrom.ago;
        msgs.push({ id: msgId++, type: 'message', date: fmt(ts), date_unixtime: String(Math.floor(ts / 1000)), from: opts.lastFrom.who.name, from_id: opts.lastFrom.who.id, text: opts.lastFrom.text });
      }
      msgs.sort((a, b) => a.date_unixtime - b.date_unixtime);
      chats.push({ name, type, id, messages: msgs });
    }

    const P = (id, name, slow) => ({ id: 'user' + id, name, slow });
    const mia = P(2, 'Mia 🌸'), alex = P(3, 'Alex'), mom = P(4, 'Mom', true), max = P(5, 'Max'),
      sofia = P(6, 'Sofia'), dan = P(7, 'Dan'), kate = P(8, 'Kate'), olek = P(9, 'Olek'), tim = P(10, 'Tim'), nick = P(11, 'Nick');

    chat(102, 'Mia 🌸', 'personal_chat', [ME, mia], LINES.chat, ago => (ago > 236 ? 0 : ago < 60 ? 3.2 : 1.8), { quietDays: 1 });
    chat(103, 'Alex', 'personal_chat', [ME, alex], LINES.chat, ago => (ago > 35 ? 2.4 : ago > 21 ? 0.4 : 0.08));
    chat(104, 'Mom', 'personal_chat', [ME, mom], LINES.mom, () => 0.5, { quietDays: 3, lastFrom: { who: mom, ago: 2.2 * 86400000, text: 'Call me when you can ❤️' } });
    chat(105, 'Max', 'personal_chat', [ME, max], LINES.chat, ago => (ago < 20 ? 2.6 : ago < 90 ? 0.15 : 0));
    chat(106, 'Sofia', 'personal_chat', [ME, sofia], LINES.chat, () => 0.6, { lastFrom: { who: sofia, ago: 9 * 3600000, text: 'so are we going on friday or not? 👀' } });
    chat(107, 'Uni squad 🎓', 'private_group', [ME, dan, kate, olek, alex], LINES.uni, (ago, wd) => (wd === 0 || wd === 6 ? 0.3 : 1.6));
    chat(108, 'Football ⚽', 'private_group', [ME, tim, nick, dan, olek], LINES.football, (ago, wd) => (wd >= 4 ? 0.9 : 0.15));

    return { personal_information: { user_id: 1, first_name: 'You' }, chats: { about: 'demo', list: chats } };
  }

  root.Demo = { build };
})(typeof self !== 'undefined' ? self : this);
