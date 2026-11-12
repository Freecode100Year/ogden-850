// Offline check on a phone/emulator: clicks speak buttons through the WebView
// DevTools protocol and reports what actually played.
//   adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>
//   node android/test-offline.mjs [ws url]
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(process.argv[2] || list.find((p) => p.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error');
  return r.result.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('页面:', await js('location.href'), '| 单词卡片:', await js('document.querySelectorAll(".card").length'), '| App 模式:', await js('IN_APP'), '| 在线:', await js('navigator.onLine'));

// Watch what plays: wrap Audio.play and the native bridge.
await js(`(() => {
  window.__log = [];
  const P = HTMLMediaElement.prototype, play = P.play;
  P.play = function () { const a = this; const t0 = Date.now();
    a.addEventListener('error', () => __log.push({ kind: 'audio-error', src: a.src.split('/assets/')[1] || a.src }), { once: true });
    a.addEventListener('ended', () => __log.push({ kind: 'audio-ended', src: a.src.split('/assets/')[1] || a.src, ms: Date.now() - t0, dur: a.duration }), { once: true });
    return play.call(this); };
  const sp = AndroidTTS.speak.bind(AndroidTTS);
  window.__nativeCalls = 0;
  const orig = window.speakNative;
  window.speakNative = function (t, r, d) { __nativeCalls++; const ok = orig(t, r, () => { __log.push({ kind: 'native-done', text: t }); d && d(); }); __log.push({ kind: 'native-start', text: t, ok }); return ok; };
  return true; })()`);

async function clickAndWait(selectorExpr, label, waitMs = 6000) {
  await js('__log.length = 0');
  const text = await js(`(() => { const b = ${selectorExpr}; if (!b) return null; b.scrollIntoView(); b.click(); return b.dataset.text; })()`);
  if (text === null) { console.log(`${label}: 找不到按钮`); return; }
  await sleep(waitMs);
  const log = await js('__log');
  const id = await js(`cyrb53(${JSON.stringify(text)}).toString(16)`);
  console.log(`${label}: "${text.slice(0, 50)}" (id ${id})`);
  for (const e of log) console.log('   ', JSON.stringify(e));
}

// 1. Words that are in the bundled recordings (uk and us)
await clickAndWait(`document.querySelector('.card .speak[data-text]')`, '英音 单词');
await js(`document.querySelector('#audio-toggle [data-src="us"]').click()`);
await clickAndWait(`document.querySelector('.card .speak[data-text]')`, '美音 单词');
// 2. An example sentence
await clickAndWait(`[...document.querySelectorAll('.card .speak[data-text]')].find(b => b.dataset.text.split(' ').length > 3)`, '美音 例句', 8000);
// 3. Something that is not recorded at all → the phone's own voice
await js(`(() => { const b = document.createElement('button'); b.className = 'speak'; b.id = '__t'; b.dataset.text = 'This sentence was never recorded.'; document.body.appendChild(b); })()`);
await clickAndWait(`document.getElementById('__t')`, '未录音的句子（应改用手机自带朗读）', 8000);
ws.close();
