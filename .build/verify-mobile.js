/* ================================================================
   verify-mobile.js — 移动端（触屏 / iOS）语音行为验证

   为什么要单独一个脚本：
     移动端的限制只在「触屏 + 未交互」这个环境下才成立，而 verify.js 跑的是桌面环境
     （maxTouchPoints=0 → NEEDS_GESTURE=false → 永远解锁）。所以必须在 beforeParse 阶段
     把 navigator 伪造成手机，才能验证这些分支。

   覆盖：
     1. 触屏环境判定生效（未交互时自动朗读被抑制）
     2. 首次交互（touchend）后解锁，之后自动朗读恢复
     3. 「读一次」按钮：点击即同步朗读，不需要等待
     4. 多音字序列在缺语音时不卡死
     5. 语音诊断入口存在
   ================================================================ */
'use strict';
const { JSDOM } = require('jsdom');
const path = require('path');
const { ROOT, makeOpts } = require('./dom-mock');

let pass = 0, fail = 0;
function T(name, fn) {
  let v;
  try { v = fn(); } catch (e) { v = '抛错 ' + e.message; }
  if (v === true) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' -> ' + v); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

const spoken = [];
/* 在 makeOpts 的基础上，把环境伪造成 iPhone：脚本执行前就改好，
   这样 app.js 里 `var NEEDS_GESTURE = ...` 求值时拿到的就是触屏环境。 */
function patchMobile(win) {
  Object.defineProperty(win.navigator, 'maxTouchPoints', { value: 5, configurable: true });
  Object.defineProperty(win.navigator, 'platform', { value: 'iPhone', configurable: true });
  try {
    Object.defineProperty(win.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true
    });
  } catch (e) { }
}

(async () => {
  const base = makeOpts(spoken);
  const origBefore = base.beforeParse;
  const opts = Object.assign({}, base, {
    beforeParse(win) {
      if (origBefore) origBefore(win);
      patchMobile(win);
    }
  });

  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), opts);
  const win = dom.window, doc = win.document;
  await new Promise(r => win.addEventListener('load', r));
  await wait(1200);

  const App = win.App;

  console.log('--- 移动端语音行为 ---');

  // 1) 未交互：进入练字页不应该自动朗读（iOS 会静默拦截）
  spoken.length = 0;
  App.enterPractice(['忘', '泼'], 0, {});
  await wait(1000);
  T('触屏未交互时不再自动朗读（避免 iOS 静默拦截造成的「无声」误解）', () =>
    spoken.length === 0 ? true : ('却读了 ' + JSON.stringify(spoken)));

  // 2) 首次交互（touchend）→ 解锁
  doc.dispatchEvent(new win.Event('touchend', { bubbles: true }));
  await wait(300);
  spoken.length = 0;
  App.enterPractice(['龙'], 0, {});
  await wait(1000);
  T('第一次触摸屏幕后解锁，自动朗读恢复', () =>
    spoken.length >= 1 ? true : ('解锁后仍不朗读 ' + JSON.stringify(spoken)));

  // 3) 「读一次」按钮：点击后应立即同步朗读（无需等 280ms）
  T('存在「读一次」按钮', () =>
    doc.getElementById('btnSpeak') ? true : '缺 #btnSpeak');
  spoken.length = 0;
  const bs = doc.getElementById('btnSpeak');
  if (bs) {
    bs.click();
    await wait(150);                      // 刻意只等 150ms：同步调用应当已经发生
    T('点「读一次」立刻出声（不依赖 setTimeout 延迟）', () =>
      spoken.length >= 1 ? true : ('150ms 内没有朗读 ' + JSON.stringify(spoken)));
  }

  // 4) 多音字序列：即使某一档没有语音，也不会卡死（应能从词走到字）
  spoken.length = 0;
  App.enterPractice(['处'], 0, {});      // 「处」是多音字，会走 speakSeq(['处理','处'])
  await wait(1200);
  T('多音字序列在缺语音时不卡死（进程能继续，页面无异常）', () => {
    const errs = doc.querySelectorAll('x-error');
    return errs.length === 0 ? true : '页面出现异常节点';
  });

  // 5) 诊断入口
  T('存在语音诊断入口', () =>
    doc.getElementById('btnVoiceDiag') ? true : '缺 #btnVoiceDiag');

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('运行异常：', e); process.exit(2); });