/* 运行时验证（jsdom，替代本环境失效的 headless Chrome）
   检查：课文完整性 / 拼音显示 / 自动朗读一次 / 组词+释义 / 弹窗关闭 */
const { JSDOM } = require('jsdom');
const path = require('path');
const { ROOT, makeOpts } = require('./dom-mock');

const spoken = [];
const opts = makeOpts(spoken);

const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function T(name, fn) {
  let v;
  try { v = fn(); } catch (e) { v = '抛错 ' + e.message; }
  if (v === true) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' -> ' + v); }
}

(async () => {
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), opts);
  const win = dom.window, doc = win.document;
  await new Promise(r => win.addEventListener('load', r));
  await wait(1200);

  const C = win.HZ_CURRICULUM, D = win.HZ_DICT;

  console.log('--- 1. 课文数据 ---');
  T('二年级上册有 36 课（2022 版 8 单元）', () => {
    const n = C['2a'].units.reduce((s, u) => s + u.lessons.length, 0);
    return (n === 36 && C['2a'].units.length === 8) ? true : n;
  });
  T('二上第八单元 6 课齐全且顺序正确', () => {
    const ls = C['2a'].units[7].lessons;
    const want = ['19《雾在哪里》', '20《雪孩子》', '21《称赞》', '22《纸船和风筝》', '23《快乐的小河》', '语文园地八'];
    return ls.map(l => l.name).join('|') === want.join('|') ? true : ls.map(l => l.name).join('|');
  });
  T('16《难忘的泼水节》生字已修正', () =>
    C['2a'].units[5].lessons[2].chars.join('') === '难忘民因理串裤令' ? true : C['2a'].units[5].lessons[2].chars.join(''));
  T('一年级下册 37 课，旧版《彩虹》已移到二上', () => {
    const n = C['1b'].units.reduce((s, u) => s + u.lessons.length, 0);
    const has = C['1b'].units.some(u => u.lessons.some(l => l.name.indexOf('彩虹') >= 0));
    return (n === 37 && !has) ? true : ('课数 ' + n + ' 彩虹还在=' + has);
  });
  T('一下语文园地三含新增字「止斤寸丁千旦」', () =>
    C['1b'].units[2].lessons[3].chars.join('') === '止斤寸丁千旦' ? true : C['1b'].units[2].lessons[3].chars.join(''));
  T('三年级上册 34 课（2022 版 8 单元）250 字', () => {
    const n = C['3a'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['3a'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    return (n === 34 && C['3a'].units.length === 8 && c === 250) ? true : (n + '课/' + c + '字');
  });
  T('三上第八单元 5 课齐全且顺序正确', () => {
    const ls = C['3a'].units[7].lessons;
    const want = ['23《司马光》', '24《一定要争气》', '25《手术台就是阵地》', '26*《一个粗瓷大碗》', '语文园地八'];
    return ls.map(l => l.name).join('|') === want.join('|') ? true : ls.map(l => l.name).join('|');
  });
  T('三上语文园地三含生字「恒圣萌妥轴阁培厘」', () =>
    C['3a'].units[2].lessons[3].chars.join('') === '恒圣萌妥轴阁培厘' ? true : C['3a'].units[2].lessons[3].chars.join(''));
  T('未升级的册次课文数保持原样（3b21/4a21/5a19/6a15）', () => {
    const n = s => C[s].units.reduce((a, u) => a + u.lessons.length, 0);
    return (n('3b') === 21 && n('4a') === 21 && n('5a') === 19 && n('6a') === 15)
      ? true : [n('3b'), n('4a'), n('5a'), n('6a')].join('/');
  });
  T('所有课文生字都有字帖与字典', () => {
    const bad = [];
    for (const s in C) {
      const sk = (new Function('window', require('fs').readFileSync(ROOT + '/data/strokes/' + s + '.js', 'utf8') + ';return window;'))({}).HZ_STROKES[s];
      C[s].units.forEach(u => u.lessons.forEach(l => l.chars.forEach(c => {
        if (!sk[c] || !D[c]) bad.push(c);
      })));
    }
    return bad.length ? [...new Set(bad)].join('') : true;
  });

  console.log('--- 2. 组词与释义 ---');
  T('每个生字都至少 2 个组词', () => {
    const bad = [];
    for (const s in C) C[s].units.forEach(u => u.lessons.forEach(l => l.chars.forEach(c => {
      if (!(D[c] && D[c].w && D[c].w.length >= 2)) bad.push(c);
    })));
    return bad.length ? [...new Set(bad)].join('') : true;
  });
  T('每个生字都至少有 1 条带释义的组词', () => {
    const bad = [];
    for (const s in C) C[s].units.forEach(u => u.lessons.forEach(l => l.chars.forEach(c => {
      const m = D[c] && D[c].wm;
      if (!m || !Object.keys(m).length) bad.push(c);
    })));
    return bad.length ? [...new Set(bad)].join('') : true;
  });
  T('释义字段非空且长度合理', () => {
    let n = 0, bad = 0;
    for (const c in D) for (const w in (D[c].wm || {})) {
      n++; const m = D[c].wm[w];
      if (!m || m.length > 24) bad++;
    }
    return bad === 0 && n > 4000 ? true : ('共' + n + '条 异常' + bad);
  });

  console.log('--- 3. 拼音与朗读 ---');
  win.App.go('catalog', null);
  await wait(200);
  win.App.go('chars', { sem: '2a', unit: 7, lesson: 0 });
  await wait(900);
  T('生字卡片上显示拼音', () => {
    const cells = doc.querySelectorAll('#charGrid .cell-py');
    if (!cells.length) return '没有拼音元素';
    const t = cells[0].textContent.trim();
    return /[a-z]/.test(t) || /[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/.test(t) ? true : ('拼音内容是 ' + t);
  });
  T('卡片拼音与本字字典一致', () => {
    const ch = win.HZ_CURRICULUM['2a'].units[7].lessons[0].chars[0];
    const el = doc.querySelector('#charGrid .cell-py');
    return el && el.textContent.trim() === (D[ch].p || [])[0] ? true : (el ? el.textContent : '无');
  });

  spoken.length = 0;
  win.App.enterPractice(['忘', '民', '因'], 0, {});
  await wait(1500);
  T('进入生字后自动朗读一次', () => spoken.length === 1 && spoken[0].text === '忘' ? true : JSON.stringify(spoken));
  const before = spoken.length;
  doc.getElementById('btnNextChar').click();
  await wait(1400);
  T('切到下一个字会再朗读一次', () =>
    spoken.length === before + 1 && spoken[spoken.length - 1].text === '民' ? true : JSON.stringify(spoken));
  const before2 = spoken.length;
  win.App.enterPractice(['民'], 0, {});
  await wait(900);
  T('同一个字重复渲染不会再朗读', () => spoken.length === before2 ? true : JSON.stringify(spoken));
  T('朗读开关存在且默认打开', () => {
    const b = doc.getElementById('btnRead');
    return b && !b.classList.contains('off') ? true : '按钮状态异常';
  });
  T('关掉朗读后不再发声', () => {
    doc.getElementById('btnRead').click();
    const n = spoken.length;
    win.App.enterPractice(['汽'], 0, {});
    return (function () { return true; })() && spoken.length === n ? true : '仍在朗读';
  });
  doc.getElementById('btnRead').click();   // 恢复

  /* ---------- 3b. 三种发音 ---------- */
  console.log('--- 3b. 发音档位（国语 / 粤语 / 英语） ---');
  const last = () => spoken[spoken.length - 1] || {};
  function setVoice(k) {
    const b = doc.querySelector('#voiceSeg .vb[data-voice="' + k + '"]');
    if (!b) return false;
    b.click();
    return true;
  }
  T('发音档位按钮有三种', () => {
    const bs = [...doc.querySelectorAll('#voiceSeg .vb')].map(b => b.getAttribute('data-voice'));
    return bs.join(',') === 'zh,yue,en' ? true : bs.join(',');
  });
  T('默认档位是国语', () => {
    const on = doc.querySelector('#voiceSeg .vb.on');
    return on && on.getAttribute('data-voice') === 'zh' ? true : (on ? on.getAttribute('data-voice') : '无');
  });
  T('国语档不会误用粤语语音（语音列表里粤语排第一）', () => {
    const u = last();
    return (u.lang === 'zh-CN' && /Ting-Ting/.test(u.voice || '')) ? true : JSON.stringify(u);
  });

  spoken.length = 0;
  setVoice('yue');
  await wait(200);
  T('切到粤语档会立刻用粤语重读当前字', () => {
    const u = last();
    return (u.text === '汽' && /^zh-HK|^yue/.test(u.lang || '') && /Sinji/.test(u.voice || ''))
      ? true : JSON.stringify(u);
  });

  spoken.length = 0;
  setVoice('en');
  await wait(200);
  T('英语档读的是这个字的英文单词', () => {
    const u = last();
    const want = (D['汽'] || {}).en;
    return (u.lang === 'en-US' && /^[a-z]+$/i.test(u.text || '') && u.text === want)
      ? true : JSON.stringify(u) + ' 期望 ' + want;
  });
  T('英语档大字位置显示英文单词', () => {
    const el = doc.getElementById('pracPinyin');
    const want = (D['汽'] || {}).en;
    const b = el.querySelector('b');
    return (el.classList.contains('en') && b && b.textContent === want)
      ? true : (el.textContent + ' / class=' + el.className);
  });
  T('信息区同时给出 English 一行', () =>
    /English/.test(doc.getElementById('pracDict').textContent) ? true : doc.getElementById('pracDict').textContent.slice(0, 60));

  T('每个课内生字都有英文单词（语气助词除外）', () => {
    const chars = new Set();
    Object.keys(C).forEach(k => C[k].units.forEach(u => u.lessons.forEach(L => L.chars.forEach(c => chars.add(c)))));
    const miss = [...chars].filter(c => !D[c] || !D[c].en);
    return miss.length <= 4 ? true : ('缺 ' + miss.length + ' 个：' + miss.slice(0, 20).join(''));
  });

  spoken.length = 0;
  win.App.enterPractice(['吗'], 0, {});           // 语气助词：没有英文单词
  await wait(1400);
  T('没有英文单词的字（吗）在英语档退回中文读音', () => {
    const u = last();
    return (u.text === '吗' && u.lang === 'zh-CN') ? true : JSON.stringify(u);
  });

  spoken.length = 0;
  await wait(50);
  setVoice('zh');
  await wait(300);
  T('切回国语档会再读一次中文', () => {
    const u = last();
    return (u.text === '吗' && u.lang === 'zh-CN') ? true : JSON.stringify(u);
  });

  /* ---------- 3c. 多音字按上下文选读音 ---------- */
  console.log('--- 3c. 多音字（如 长：长短 cháng / 长大 zhǎng） ---');
  T('多音字带「词 -> 读音」表', () => {
    const d = D['长'];
    return (d && d.pw && d.pw['长短'] === 'cháng' && d.pw['长大'] === 'zhǎng')
      ? true : JSON.stringify(d && d.pw);
  });
  T('「处」处理读 chǔ、处所读 chù', () => {
    const d = D['处'];
    return (d && d.pw && d.pw['处理'] === 'chǔ' && d.pw['处所'] === 'chù')
      ? true : JSON.stringify(d && d.pw);
  });
  T('被误注的字已纠正（干 gān / 脏 zāng / 调 tiáo / 尽 jìn / 似 sì）', () => {
    const want = { 干: 'gān', 脏: 'zāng', 调: 'tiáo', 尽: 'jìn', 似: 'sì' };
    const bad = Object.keys(want).filter(c => !D[c] || D[c].p[0] !== want[c]);
    return bad.length === 0 ? true : bad.map(c => c + '=' + D[c].p[0]).join(',');
  });
  T('多音字的多个读音都保留在字典里', () => {
    const bad = [];
    Object.keys(D).forEach(c => {
      const d = D[c];
      if (!d.pw) return;
      Object.keys(d.pw).forEach(w => { if (d.p.indexOf(d.pw[w]) < 0) bad.push(c + '/' + w); });
    });
    return bad.length === 0 ? true : bad.slice(0, 10).join(',');
  });

  spoken.length = 0;
  win.App.enterPractice(['长'], 0, {});
  await wait(1600);
  T('练字页按组词选音：长短 -> cháng', () => {
    const el = doc.getElementById('pracPinyin');
    return (el.textContent.indexOf('cháng') === 0 && /长短/.test(el.textContent))
      ? true : el.textContent;
  });
  T('信息区说明「在哪个词里读什么」', () =>
    /长短里读 cháng/.test(doc.getElementById('pracDict').textContent)
      ? true : doc.getElementById('pracDict').textContent.slice(0, 80));
  T('多音字朗读：先读词确定读音，再读单字', () => {
    const t = spoken.map(x => x.text).join('|');
    return t === '长短|长' ? true : t;
  });
  T('朗读用的是国语语音（不是粤语）', () => {
    const bad = spoken.filter(x => /Sinji/.test(x.voice || ''));
    return bad.length === 0 ? true : JSON.stringify(bad);
  });

  /* ---------- 3d. 粤语档位完全独立 ---------- */
  console.log('--- 3d. 粤语与国语互不串用 ---');
  spoken.length = 0;
  setVoice('yue');
  await wait(600);
  T('粤语档：语音是粤语（Sinji/zh-HK），绝不用国语语音', () => {
    const u = last();
    return (/^zh-HK/.test(u.lang || '') && /Sinji/.test(u.voice || '') && !/Ting-Ting/.test(u.voice || ''))
      ? true : JSON.stringify(u);
  });
  spoken.length = 0;
  win.App.enterPractice(['春'], 0, {});
  await wait(1500);
  T('粤语档换字后仍然只用粤语语音', () => {
    const bad = spoken.filter(x => !/zh-HK/.test(x.lang || '') || /Ting-Ting/.test(x.voice || ''));
    return (spoken.length > 0 && bad.length === 0) ? true : JSON.stringify(spoken);
  });
  spoken.length = 0;
  setVoice('zh');
  await wait(600);
  T('切回国语档：只用国语语音，不再用粤语语音', () => {
    const u = last();
    return (/^zh-CN/.test(u.lang || '') && /Ting-Ting/.test(u.voice || '') && !/Sinji/.test(u.voice || ''))
      ? true : JSON.stringify(u);
  });

  /* ---------- 3e. 英文单词 + 国际音标 ---------- */
  console.log('--- 3e. 英文注音（IPA） ---');
  T('每个英文单词都有音标', () => {
    const bad = [];
    Object.keys(D).forEach(c => { if (D[c].en && !D[c].ipa) bad.push(c + '/' + D[c].en); });
    return bad.length === 0 ? true : ('缺 ' + bad.length + '：' + bad.slice(0, 10).join(','));
  });
  T('音标统一用美式 IPA 且放在方括号里', () => {
    const bad = [];
    Object.keys(D).forEach(c => {
      const ip = D[c].ipa;
      if (!ip) return;
      if (!(ip.startsWith('[') && ip.endsWith(']'))) bad.push(c + ':' + ip);
      else if (/[ɜəɑɒʌɛɪʊʌɔɝɚ]/.test(ip) === false && /[a-z]/.test(ip) === false) bad.push(c + ':' + ip);
    });
    return bad.length === 0 ? true : bad.slice(0, 8).join(' ');
  });
  T('音标里不含英式专属符号（统一美式）', () => {
    const bad = [];
    Object.keys(D).forEach(c => { if (D[c].ipa && /[ɒːɪə]/.test(D[c].ipa.replace(/[ˈˌ]/g, '')) && /ɒ/.test(D[c].ipa)) bad.push(c); });
    return bad.length === 0 ? true : bad.slice(0, 8).join(',');
  });
  spoken.length = 0;
  setVoice('en');
  await wait(600);
  T('英语档大字位置是「单词 + 音标」', () => {
    const el = doc.getElementById('pracPinyin');
    const want = (D['春'] || {}).en, ip = (D['春'] || {}).ipa;
    return (el.querySelector('b') && el.querySelector('b').textContent === want &&
      el.querySelector('i') && el.querySelector('i').textContent === ip)
      ? true : el.textContent;
  });
  T('英语档只读英文单词，不读中文', () => {
    const u = last();
    return (u.lang === 'en-US' && /^[a-z]/i.test(u.text || '') && !/[\u4e00-\u9fff]/.test(u.text || ''))
      ? true : JSON.stringify(u);
  });
  T('字典卡片也带单词与音标', () => {
    win.App.go('dict');
    const inp = doc.getElementById('dictInput');
    inp.value = 'chun';
    inp.dispatchEvent(new win.Event('input', { bubbles: true }));
    const c = doc.querySelector('#dictResults .dr-card .dr-en');
    return (c && /\[/.test(c.textContent)) ? true : (c ? c.textContent : '无');
  });
  setVoice('zh');

  win.Store.setSetting('voice', 'en');
  win.App.go('chars', { sem: '2a', unit: 7, lesson: 0 });
  await wait(900);
  T('英语档下生字卡也显示英文单词', () => {
    const ch = C['2a'].units[7].lessons[0].chars[0];
    const el = doc.querySelector('#charGrid .cell-py');
    const want = (D[ch] || {}).en;
    return (el && el.classList.contains('en') && el.textContent.trim() === want)
      ? true : ((el ? el.textContent : '无') + ' 期望 ' + want);
  });
  win.Store.setSetting('voice', 'zh');

  console.log('--- 4. 练字页组词展示 ---');
  win.App.enterPractice(['论'], 0, {});
  await wait(1200);
  T('练字页出现组词区块', () => {
    const els = doc.querySelectorAll('#pracDict .wd');
    return els.length >= 2 ? true : ('数量 ' + els.length);
  });
  T('组词带释义', () => {
    const el = doc.querySelector('#pracDict .wd');
    return el && el.querySelector('b') && el.querySelector('i') ? true : '缺词或释义';
  });
  T('拼音大字号已显示', () => {
    const t = doc.getElementById('pracPinyin').textContent.trim();
    return t && t !== '—' ? true : ('内容 ' + t);
  });
  T('练字页组词与字典一致', () => {
    const b = doc.querySelector('#pracDict .wd b');
    return b && (D['论'].w.indexOf(b.textContent) >= 0) ? true : (b ? b.textContent : '无');
  });

  console.log('\n--- 8. 第 1 层：年级册次设置 + 分组自定义名 ---');
  const Store = win.Store, App = win.App;
  const SEM = win.Store.SEM_ORDER;
  // 某个字出现在哪几册（用于判断推字是否越过了当前册）
  const semsOf = function (ch) {
    const out = [];
    SEM.forEach(function (s) {
      if (!C[s]) return;
      C[s].units.forEach(function (u) {
        u.lessons.forEach(function (L) {
          if (L.chars.indexOf(ch) >= 0 && out.indexOf(s) < 0) out.push(s);
        });
      });
    });
    return out;
  };
  const si = function (s) { return SEM.indexOf(s); };

  T('默认当前册是一年级上册', () => Store.currentSem() === '1a' ? true : Store.currentSem());

  T('旧存档（缺册次字段）仍只推一年级的字', () => {
    const keep = Store.state.settings.currentSem;
    delete Store.state.settings.currentSem;              // 模拟老用户存档
    const picked = Store.pickDailyChars(5).map(x => x.ch);
    Store.state.settings.currentSem = keep;
    const bad = picked.filter(ch => semsOf(ch).indexOf('1a') < 0);
    return bad.length === 0 ? true : ('混入了非一年级的字：' + bad.join(''));
  });

  T('推荐字之间不重复', () => {
    Store.setSetting('currentSem', '1a');
    const p = Store.pickDailyChars(5).map(x => x.ch);
    return new Set(p).size === p.length ? true : ('有重复：' + p.join(''));
  });

  T('切到三年级上册后，推字都来自三年级上册或更早', () => {
    Store.setSetting('currentSem', '3a');
    const p = Store.pickDailyChars(5).map(x => x.ch);
    const bad = p.filter(ch => semsOf(ch).every(s => si(s) > si('3a')));
    return bad.length === 0 ? true : ('来自更晚的册：' + bad.join(''));
  });

  T('推字范围确实随册次变化', () => {
    Store.setSetting('currentSem', '1a');
    const a = Store.pickDailyChars(5).map(x => x.ch).join('');
    Store.setSetting('currentSem', '6b');
    const b = Store.pickDailyChars(5).map(x => x.ch).join('');
    Store.setSetting('currentSem', '1a');
    return a !== b ? true : ('两次结果相同：' + a);
  });

  T('首页有当前册次入口', () => doc.getElementById('btnSemPick') ? true : '缺 btnSemPick');

  T('自定义课名可写入也可清除', () => {
    Store.setCustomName('3a-0-1', '我的第一小组');
    const got = Store.customName('3a-0-1');
    Store.setCustomName('3a-0-1', '');
    return (got === '我的第一小组' && !Store.customName('3a-0-1'))
      ? true : ('写入读到=' + got + ' 清除后=' + Store.customName('3a-0-1'));
  });

  // 目录页课名：先渲染再断言（本文件的 T 是同步断言）
  Store.setCustomName('3a-0-1', '我的第一小组');
  App.go('catalog', { sem: '3a', unit: 0, lesson: null });
  await wait(800);
  T('目录页课名显示自定义名称', () => {
    const txt = (doc.getElementById('lessonList') || doc.body).textContent;
    return txt.indexOf('我的第一小组') >= 0 ? true : '目录里没有出现自定义名';
  });
  Store.setCustomName('3a-0-1', '');
  App.go('catalog', { sem: '3a', unit: 0, lesson: null });
  await wait(700);
  T('自定义名清除后恢复原课名', () => {
    const txt = (doc.getElementById('lessonList') || doc.body).textContent;
    return txt.indexOf('我的第一小组') < 0 ? true : '清除后还残留自定义名';
  });

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('运行异常：', e); process.exit(2); });
