// Random sample: every speakable text should play from the bundled recordings (no fallback).
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(list.find((p) => p.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const js = (expression) => new Promise((r) => { const id = ++n; pending.set(id, (m) => r(m.result.result?.value)); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })); });
const N = Number(process.argv[2] || 40);
const texts = await js(`(() => { const t = new Set(); words.forEach(w => { t.add(w.w); t.add(w.en); t.add(w.ex); (w.s||[]).forEach(x => t.add(x)); }); const a = [...t].filter(Boolean); a.sort(() => Math.random() - 0.5); return a.slice(0, ${N}); })()`);
const result = {};
for (const accent of ['uk', 'us']) {
  await js(`document.querySelector('#audio-toggle [data-src="${accent}"]').click()`);
  let local = 0, fallback = 0; const bad = [];
  for (const t of texts) {
    const r = await js(`new Promise(res => {
      const P = HTMLMediaElement.prototype, play = P.play, sn = window.speakNative;
      let done = false; const fin = (v) => { if (done) return; done = true; P.play = play; window.speakNative = sn; stopSpeaking(); res(v); };
      P.play = function () { const a = this; a.addEventListener('playing', () => fin(a.src.includes('/assets/audio/${accent}/') ? 'local' : 'other:' + a.src), { once: true }); return play.call(this); };
      window.speakNative = function () { fin('native'); return true; };
      speak(${JSON.stringify(t)}, 1.0, null);
      setTimeout(() => fin('timeout'), 8000);
    })`);
    if (r === 'local') local++; else { fallback++; bad.push([t, r]); }
  }
  result[accent] = { local, fallback, bad: bad.slice(0, 5) };
}
console.log(`抽查 ${texts.length} 条 × 英音/美音：`);
for (const [a, r] of Object.entries(result)) console.log(`  ${a === 'uk' ? '英音' : '美音'}：播放打包录音 ${r.local} 条，用到后备 ${r.fallback} 条`, r.bad.length ? JSON.stringify(r.bad) : '');
ws.close();
