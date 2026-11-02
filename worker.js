// Parses export files off the main thread so big exports don't freeze the page.
importScripts('analyze.js');

self.onmessage = async ({ data }) => {
  try {
    const chats = [];
    let meId = null;
    for (const file of data.files) {
      self.postMessage({ progress: 'Reading ' + file.name + '…' });
      const json = JSON.parse(await file.text());
      self.postMessage({ progress: 'Crunching ' + file.name + '…' });
      const r = Analyze.analyze(json, { now: data.now });
      chats.push(...r.chats);
      meId = meId || r.meId;
    }
    const seen = new Set();
    const unique = chats.filter(c => !seen.has(c.id) && seen.add(c.id));
    self.postMessage({ result: { chats: unique, meId: meId || Analyze.guessMe(unique) } });
  } catch (e) {
    self.postMessage({ error: e instanceof SyntaxError ? 'Could not read this file as JSON. Export the chat with format "Machine-readable JSON".' : e.message });
  }
};
