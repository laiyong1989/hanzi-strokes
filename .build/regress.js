/* 既有功能回归（jsdom）
   目的：确认本轮「补全课文 / 加拼音朗读 / 加组词释义」没有改坏原有功能。
   只测不依赖真实布局的部分；布局/像素/动画时长类断言仍在 smoke-test.html（需真实浏览器）。 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { ROOT, makeOpts } = require('./dom-mock');

const spoken = [];
const errs = [];
const base = makeOpts(spoken);
const opts = Object.assign({}, base, {
  beforeParse(win) {
    base.beforeParse(win);
    win.addEventListener('error', e => { errs.push(String((e && e.message) || e)); });
  }
});

const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function T(name, fn) {
  let v;
  try { v = fn(); } catch (e) { v = '抛错 ' + (e && e.message); }
  if (v === true) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' -> ' + v); }
}
async function TA(name, fn) {
  let v;
  try { v = await fn(); } catch (e) { v = '抛错 ' + (e && e.message); }
  if (v === true) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' -> ' + v); }
}

/* localStorage 只在 http(s) 源下可用（file:// 是 opaque origin），
   所以这里自带一个临时静态服务，测完即关，不依赖外部进程。 */
const http = require('http');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'
};
function serve(root) {
  return new Promise(res => {
    const s = http.createServer((req, rp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      fs.readFile(path.join(root, p), (e, d) => {
        if (e) { rp.statusCode = 404; rp.end('404'); }
        else { rp.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream'); rp.end(d); }
      });
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

(async () => {
  const server = await serve(ROOT);
  const port = server.address().port;
  const dom = await JSDOM.fromURL('http://127.0.0.1:' + port + '/index.html', opts);
  const win = dom.window, doc = win.document;
  await new Promise(r => win.addEventListener('load', r));
  await wait(1200);
  win.onerror = m => { errs.push(String(m)); };

  const CUR = win.HZ_CURRICULUM, D = win.HZ_DICT, HZ = win.HZ, App = win.App, Store = win.Store;
  const $ = s => doc.querySelector(s);

  /* ---------- 1. 数据完整性（与 smoke-test 同口径） ---------- */
  console.log('--- 1. 数据完整性 ---');
  T('课程含 12 册', () => Object.keys(CUR).length === 12 ? true : Object.keys(CUR).length);
  let tot = 0, lessonN = 0;
  Object.keys(CUR).forEach(k => CUR[k].units.forEach(u => u.lessons.forEach(L => { tot += L.chars.length; lessonN++; })));
  T('生字总数 2000~3000', () => (tot > 2000 && tot < 3000) ? true : tot);
  T('课数 200 以上', () => lessonN > 200 ? true : lessonN);
  T('一年级上册 26 课', () => {
    const n = CUR['1a'].units.reduce((s, u) => s + u.lessons.length, 0);
    return n === 26 ? true : n;
  });
  T('二年级下册 29 课', () => {
    const n = CUR['2b'].units.reduce((s, u) => s + u.lessons.length, 0);
    return n === 29 ? true : n;
  });
  T('字典 2000 字以上', () => Object.keys(D).length > 2000 ? true : Object.keys(D).length);
  T('字典含拼音与部首', () => {
    const d = D['春'];
    return (d && d.p && d.p.length && d.r) ? true : JSON.stringify(d);
  });

  /* ---------- 2. 目录导航：册 -> 单元 -> 课 ---------- */
  console.log('--- 2. 目录导航 ---');
  $('[data-go="catalog"]').click();
  await wait(200);
  T('进入「按课文学习」并列出 12 册', () => {
    const n = doc.querySelectorAll('#semList .card').length;
    return (n === 12 && !$('#semList').hidden) ? true : n;
  });
  doc.querySelector('#semList [data-sem="2a"]').click();
  await wait(200);
  T('点二年级上册后展开单元列表', () => {
    const g = doc.querySelectorAll('#unitList .unit-group').length;
    return (g === 8 && !$('#unitList').hidden) ? true : ('单元组 ' + g);
  });
  T('第八单元里有《狐假虎威》', () => {
    const g = doc.querySelectorAll('#unitList .unit-group')[7];
    const first = g && g.querySelector('.lsn .lsn-n');
    return first && /狐假虎威/.test(first.textContent) ? true : (first ? first.textContent : '无');
  });

  /* ---------- 3. 生字页 ---------- */
  console.log('--- 3. 生字页 ---');
  const g8 = doc.querySelectorAll('#unitList .unit-group')[7];
  g8.querySelector('.lsn').click();
  await wait(600);
  T('点课后进入生字页', () => $('#scChars').classList.contains('on') ? true : App.screen);
  T('生字卡数量与课文一致', () => {
    const want = CUR['2a'].units[7].lessons[0].chars.length;
    const got = doc.querySelectorAll('#charGrid .cell').length;
    return got === want ? true : ('想要 ' + want + ' 实际 ' + got);
  });
  T('每张生字卡都显示拼音', () => {
    const ps = [...doc.querySelectorAll('#charGrid .cell-py')].map(e => e.textContent.trim());
    return (ps.length && ps.every(t => t && t !== '—')) ? true : JSON.stringify(ps.slice(0, 5));
  });
  T('拼音与字典读音一致', () => {
    const ch = CUR['2a'].units[7].lessons[0].chars[0];
    const el = doc.querySelector('#charGrid .cell-py');
    return el.textContent.trim() === D[ch].p[0] ? true : (el.textContent + ' vs ' + D[ch].p[0]);
  });

  /* ---------- 4. 练字页老功能 ---------- */
  console.log('--- 4. 练字流程 ---');
  await TA('点生字卡进入练字页', async () => {
    doc.querySelector('#charGrid .cell').click();
    await wait(1200);
    return $('#scPractice').classList.contains('on') ? true : App.screen;
  });
  T('进度显示「第 1 / N」', () => /第\s*1\s*\/\s*\d/.test($('#pracProgress').textContent) ? true : $('#pracProgress').textContent);
  T('笔画圆点数量 = 该字笔画数', () => {
    const ch = CUR['2a'].units[7].lessons[0].chars[0];
    const want = HZ.dataOf(ch).m.length;
    const got = doc.querySelectorAll('#strokeDots > *').length;
    return got === want ? true : ('想要 ' + want + ' 实际 ' + got);
  });
  T('练字页四个操作按钮都在', () => {
    const ids = ['btnUndo', 'btnHint', 'btnDemo', 'btnNextChar'];
    const miss = ids.filter(i => !doc.getElementById(i));
    return miss.length === 0 ? true : ('缺 ' + miss.join(','));
  });
  T('点「看笔顺动画」不会把字换掉', () => {
    const before = $('#pracPinyin').textContent.trim();
    $('#btnDemo').click();
    return $('#pracPinyin').textContent.trim() === before ? true : ('变成 ' + $('#pracPinyin').textContent);
  });
  T('擦一笔按钮可点击且不报错', () => {
    $('#btnUndo').click();
    return true;
  });
  T('快捷键区/提示区渲染正常', () => !!$('#pracDict') ? true : '缺 pracDict');

  // 拿练习对象：包一层 createPractice 把它抓出来（app 没有把它挂到 window 上）
  let PRP = null;
  const _cp = HZ.createPractice;
  HZ.createPractice = function (cfg) { PRP = _cp(cfg); return PRP; };
  await TA('写完全部笔画会弹成绩框', async () => {
    const ch = CUR['2a'].units[7].lessons[0].chars[0];
    const d = HZ.dataOf(ch);
    if (!PRP) { App.enterPractice(CUR['2a'].units[7].lessons[0].chars, 0, {}); await wait(1500); }
    if (!PRP) return '拿不到练习对象';
    PRP.clearInk(true);
    for (let k = 0; k < d.m.length; k++) PRP.judge(HZ.resample(HZ.medianScreen(d.m[k]), 12));
    await wait(1200);
    return $('#modalMask').hidden === false ? true : '没弹出';
  });
  await TA('点「下一个字」后弹窗关闭且进度前进', async () => {
    const btn = doc.querySelector('#modalBox [data-act="next"]');
    if (!btn) return '没有下一个字按钮';
    btn.click();
    await wait(900);
    const closed = $('#modalMask').hidden === true;
    const t = $('#pracProgress').textContent;
    return (closed && /第\s*2\s*\//.test(t)) ? true : ('closed=' + closed + ' 进度=' + t);
  });

  /* ---------- 5. 其它页面仍可打开 ---------- */
  console.log('--- 5. 其它页面 ---');
  await TA('查字典页可按拼音搜到字', async () => {
    App.go('dict');
    await wait(400);
    const inp = $('#dictInput');
    inp.value = 'chun';
    inp.dispatchEvent(new win.Event('input', { bubbles: true }));
    await wait(400);
    const n = doc.querySelectorAll('#dictResults .dr-card').length;
    return n > 0 ? true : ('结果数 ' + n);
  });
  T('字典卡片显示拼音', () => {
    const c = doc.querySelector('#dictResults .dr-card');
    return c && /[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(c.textContent) ? true : (c ? c.textContent.slice(0, 40) : '无卡片');
  });
  T('闯关页可渲染', () => { App.go('levels'); return !!$('#lvSemSeg') ? true : '缺闯关页'; });
  T('宠物页可渲染', () => { App.go('pet'); return !!doc.getElementById('scPet') ? true : '缺宠物页'; });
  T('打卡页可渲染', () => { App.go('checkin'); return !!doc.getElementById('scCheckin') ? true : '缺打卡页'; });
  T('首页可返回', () => { App.go('home'); return $('#scHome').classList.contains('on') ? true : App.screen; });

  /* ---------- 6. 存档 ---------- */
  console.log('--- 6. 本机存档 ---');
  T('只有一个速度档处于选中态', () => {
    const on = doc.querySelectorAll('#speedSeg .sp.on');
    return on.length === 1 ? true : on.length;
  });
  T('存档已写入 localStorage', () => !!win.localStorage.getItem('hzpb.v1') ? true : '没有存档');
  T('存档可解析且含设置项', () => {
    const s = JSON.parse(win.localStorage.getItem('hzpb.v1') || '{}');
    return (s && s.settings) ? true : JSON.stringify(s).slice(0, 120);
  });
  await TA('速度档位写入存档', async () => {
    const b = doc.querySelector('#speedSeg .sp[data-sp="1.9"]');
    if (!b) return '没有速度档';
    b.click();
    await wait(300);
    return /"demoSpeed":1\.9/.test(win.localStorage.getItem('hzpb.v1') || '') ? true : '未写入';
  });

  /* ---------- 7. 资源 ---------- */
  console.log('--- 7. 静态资源 ---');
  T('11 张宠物图都在', () => {
    const names = ['egg.png', 'egg-crack.png', 'shu-0.png', 'shu-1.png', 'shu-2.png',
      'huo-0.png', 'huo-1.png', 'huo-2.png', 'shui-0.png', 'shui-1.png', 'shui-2.png'];
    const bad = names.filter(n => !fs.existsSync(path.join(ROOT, 'assets/pets', n)));
    return bad.length === 0 ? true : ('缺 ' + bad.join(','));
  });
  T('运行所需脚本与数据文件齐全', () => {
    const need = ['js/app.js', 'js/hanzi.js', 'js/store.js', 'data/curriculum.js', 'data/dict.js', 'css/app.css'];
    const bad = need.filter(n => !fs.existsSync(path.join(ROOT, n)));
    return bad.length === 0 ? true : ('缺 ' + bad.join(','));
  });

  console.log('--- 8. 控制台 ---');
  T('页面无 JS 报错', () => errs.length === 0 ? true : errs.slice(0, 3).join(' | '));

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('运行异常：', e); process.exit(2); });
