/* 通用小工具：用 CDP 打开一个页面，等异步跑完后取一段表达式的值。
   用法： node .build/cdp.js <url> <等待毫秒> "<表达式>"
   为什么不用 --dump-dom：--virtual-time-budget 会干扰 Service Worker / 定时器等异步流程。
   只读操作：仅调用 Runtime.evaluate 取值，不修改任何文件。 */
const url = process.argv[2];
const waitMs = Number(process.argv[3] || 8000);
const expr = process.argv[4] || 'document.body.innerText';
const PORT = Number(process.env.CDP_PORT || 9222);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function findPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch (e) { /* chrome 还没起来 */ }
    await sleep(250);
  }
  throw new Error('找不到可调试的页面，Chrome 没起来？');
}

function evaluate(ws, expression) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e6);
    const onMsg = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (m.result && m.result.exceptionDetails) return reject(new Error(JSON.stringify(m.result.exceptionDetails)));
      resolve(m.result && m.result.result ? m.result.result.value : undefined);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true }
    }));
  });
}

(async () => {
  const page = await findPage();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  await sleep(waitMs);
  try {
    console.log(await evaluate(ws, expr));
  } catch (e) {
    console.log('EVAL_ERROR: ' + e.message);
  }
  ws.close();
  process.exit(0);
})().catch(e => { console.log('ERROR: ' + e.message); process.exit(1); });
