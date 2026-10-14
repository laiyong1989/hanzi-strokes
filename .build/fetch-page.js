#!/usr/bin/env node
/* ================================================================
   fetch-page.js — 用 headless Chrome 打开任意网址并抓取渲染后的内容

   用途：像 jc.pep.com.cn 这类 Vue SPA，用 curl 只能拿到 2KB 的空壳，
        必须真正渲染后才能看到教材列表与内容。复用 run-smoke.js 的 CDP 方案。

   用法：
     node .build/fetch-page.js <url>                 # 打印正文文本
     node .build/fetch-page.js <url> --links         # 打印所有链接（文字 + href）
     node .build/fetch-page.js <url> --wait 8000     # 延长等待（默认 6 秒）
     node .build/fetch-page.js <url> --html          # 打印渲染后的 HTML
     node .build/fetch-page.js <url> --img           # 统计页面里的图片数量
   ================================================================ */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const url = args[0];
if (!url) { console.error('用法: node .build/fetch-page.js <url> [--links] [--wait ms] [--html] [--img]'); process.exit(2); }
const wantLinks = args.includes('--links');
const wantHtml = args.includes('--html');
const wantImg = args.includes('--img');
const wi = args.indexOf('--wait');
const WAIT = wi > 0 ? Number(args[wi + 1]) || 6000 : 6000;

const CDP_PORT = 9355;
const BROWSERS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const bin = BROWSERS.find(b => fs.existsSync(b));
  if (!bin) { console.error('没找到 Chrome/Edge'); process.exit(2); }
  const dir = '/tmp/hzpb-fetch-profile';
  fs.rmSync(dir, { recursive: true, force: true });
  const proc = spawn(bin, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking',
    '--user-data-dir=' + dir, '--remote-debugging-port=' + CDP_PORT,
    '--window-size=1400,1000', 'about:blank'
  ], { stdio: 'ignore' });

  let info = null;
  for (let i = 0; i < 40 && !info; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) info = await r.json(); }
    catch (e) { }
    if (!info) await sleep(500);
  }
  if (!info) { console.error('Chrome 调试端口未就绪'); try { proc.kill(); } catch (e) { } process.exit(2); }

  const t = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP 连接失败')); });
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  const evalJS = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;

  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url });
    await sleep(WAIT);
    console.log('=== 页面标题 ===');
    console.log(await evalJS('document.title'));
    console.log('\n=== 最终 URL ===');
    console.log(await evalJS('location.href'));

    if (wantImg) {
      console.log('\n=== 图片统计 ===');
      console.log(await evalJS('document.querySelectorAll("img").length + " 张 img，' +
        '其中 >200px 的有 " + Array.from(document.querySelectorAll("img")).filter(i=>i.naturalWidth>200).length + " 张"'));
    }
    if (wantLinks) {
      console.log('\n=== 链接（文字 → href）===');
      const links = await evalJS('JSON.stringify(Array.from(document.querySelectorAll("a")).map(a=>[(a.innerText||"").trim().slice(0,40), a.href]).filter(x=>x[0]||/pep/.test(x[1])))');
      JSON.parse(links || '[]').forEach(([txt, href]) => console.log('  ' + (txt || '(无字)') + '  →  ' + href));
    }
    if (wantHtml) {
      console.log('\n=== HTML ===');
      console.log(await evalJS('document.documentElement.outerHTML'));
    } else {
      console.log('\n=== 正文文本 ===');
      console.log(await evalJS('document.body.innerText'));
    }
  } catch (e) {
    console.error('抓取失败：' + e.message);
    process.exitCode = 1;
  } finally {
    try { ws.close(); } catch (e) { }
    try { proc.kill(); } catch (e) { }
  }
})();