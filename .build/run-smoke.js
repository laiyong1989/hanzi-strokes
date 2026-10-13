#!/usr/bin/env node
/* ================================================================
   run-smoke.js — 冒烟测试自动运行器（无需人工点开浏览器）

   为什么不用 `--headless --dump-dom`：
     本机 Chrome 的沙箱初始化会失败（sandbox initialization failed），
     且 --dump-dom 这条输出通道返回 0 字节。
     但加上 --no-sandbox 启动后，DevTools 调试端口是正常的
     → 改用 CDP（Chrome DevTools Protocol）连上去，直接读页面里的 #out 文本。

   流程：起本地静态服务 → 起 headless Chrome → CDP 打开 smoke-test.html
        → 轮询读取结果 → 出现 SMOKE_DONE 或超时 → 解析并输出 → 清理

   用法：
     NODE_PATH=<jsdom 路径> node .build/run-smoke.js
     node .build/run-smoke.js --keep     # 保留浏览器与页面，便于人工排查
   ================================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const KEEP = process.argv.includes('--keep');

const HTTP_PORT = 8765;
const CDP_PORT = 9333;
const BROWSERS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Edge.app/Contents/MacOS/Microsoft Edge'
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
};

/* ---------------- 1. 本地静态服务 ---------------- */
function startServer() {
  return new Promise(res => {
    const srv = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { rep.writeHead(403).end(); return; }
      fs.readFile(f, (err, buf) => {
        if (err) { rep.writeHead(404).end('not found'); return; }
        rep.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        rep.end(buf);
      });
    });
    srv.listen(HTTP_PORT, '127.0.0.1', () => res(srv));
  });
}

/* ---------------- 2. 启动 headless Chrome ---------------- */
function startChrome() {
  const bin = BROWSERS.find(b => fs.existsSync(b));
  if (!bin) return Promise.reject(new Error('没找到 Chrome 或 Edge'));
  const dir = '/tmp/hzpb-smoke-profile';
  fs.rmSync(dir, { recursive: true, force: true });   // 自建临时目录，可安全清理
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking',
    '--user-data-dir=' + dir,
    '--remote-debugging-port=' + CDP_PORT,
    '--window-size=1280,900',
    'about:blank'
  ];
  const proc = spawn(bin, args, { stdio: 'ignore', detached: false });
  proc.on('error', e => console.error('Chrome 启动失败:', e.message));
  return waitForCdp().then(() => ({ bin, proc }));
}

async function waitForCdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version');
      if (r.ok) return await r.json();
    } catch (e) { /* 还没起来 */ }
    await sleep(500);
  }
  throw new Error('Chrome 调试端口 20 秒内未就绪');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- 3. 用 CDP 打开页面并读结果 ---------------- */
async function runTest() {
  const url = 'http://127.0.0.1:' + HTTP_PORT + '/smoke-test.html';

  // Chrome 新版本要求用 PUT 建 target
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const target = await r.json();
  if (!target.webSocketDebuggerUrl) throw new Error('创建标签页失败: ' + JSON.stringify(target).slice(0, 120));

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = e => rej(new Error('CDP 连接失败'));
  });
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });

  // 轮询 #out，直到出现 SMOKE_DONE
  const deadline = Date.now() + 120000;
  let text = '', done = false;
  while (Date.now() < deadline) {
    await sleep(600);
    try {
      const r = await send('Runtime.evaluate', {
        expression: "(document.getElementById('out')||{}).textContent || ''",
        returnByValue: true
      });
      text = (r.result && r.result.value) || '';
      if (text.indexOf('SMOKE_DONE') >= 0) { done = true; break; }
    } catch (e) { /* 页面还在导航 */ }
  }
  if (!KEEP) { try { ws.close(); } catch (e) { } }
  return { text, done };
}

/* ---------------- 主流程 ---------------- */
(async () => {
  let srv = null, chrome = null;
  const t0 = Date.now();
  try {
    srv = await startServer();
    console.log('· 本地服务已起（端口 ' + HTTP_PORT + '）');
    chrome = await startChrome();
    console.log('· headless Chrome 已就绪（CDP ' + CDP_PORT + '）');
    const { text, done } = await runTest();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);

    const lines = text.split('\n');
    const fails = lines.filter(l => /^FAIL/.test(l));
    const summary = (lines.find(l => l.indexOf('=====') >= 0) || '(没有汇总行)').trim();

    console.log('\n' + lines.join('\n'));
    console.log('\n--------------------------------------------------');
    console.log('耗时 ' + secs + ' 秒 · ' + summary);
    if (!done) {
      console.log('⚠ 未出现 SMOKE_DONE（超时或页面卡住），上面的输出可能不完整');
    }
    if (fails.length) {
      console.log('\n失败明细：');
      fails.forEach(l => console.log('  ' + l));
    }
    console.log('--------------------------------------------------');
    process.exitCode = (!done || fails.length) ? 1 : 0;
  } catch (e) {
    console.error('运行失败：' + e.message);
    process.exitCode = 2;
  } finally {
    if (chrome && chrome.proc) {
      if (KEEP) { console.log('（--keep：浏览器仍在运行，端口 ' + CDP_PORT + '）'); }
      else { try { chrome.proc.kill(); } catch (e) { } }
    }
    if (srv) { try { srv.close(); } catch (e) { } }
  }
})();