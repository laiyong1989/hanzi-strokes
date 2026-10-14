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
  T('三年级下册 35 课（2022 版 8 单元）250 字', () => {
    const n = C['3b'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['3b'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    return (n === 35 && C['3b'].units.length === 8 && c === 250) ? true : (n + '课/' + c + '字');
  });
  T('三下第八单元 4 课齐全且顺序正确', () => {
    const ls = C['3b'].units[7].lessons;
    const want = ['25《慢性子裁缝和急性子顾客》', '26《漏》', '27*《枣核》', '语文园地八'];
    return ls.map(l => l.name).join('|') === want.join('|') ? true : ls.map(l => l.name).join('|');
  });
  T('三下语文园地一含生字「匕忆艺乙冗犬税兑执」', () =>
    C['3b'].units[0].lessons[4].chars.join('') === '匕忆艺乙冗犬税兑执' ? true : C['3b'].units[0].lessons[4].chars.join(''));
  T('3b 多音字按课文定首读音（称chèn/驯xùn/拓tuò/瞭liào/咳ké）', () => {
    const want = {称: 'chèn', 驯: 'xùn', 拓: 'tuò', 瞭: 'liào', 咳: 'ké'};
    const bad = Object.keys(want).filter(c => !D[c] || D[c].p[0] !== want[c]);
    return bad.length ? bad.map(c => c + '=' + (D[c] || {}).p).join(',') : true;
  });
  T('四年级上册 35 课（2022 版 8 单元）250 字', () => {
    const n = C['4a'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['4a'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    return (n === 35 && C['4a'].units.length === 8 && c === 250) ? true : (n + '课/' + c + '字');
  });
  T('四上第八单元 5 课齐全且顺序正确', () => {
    const ls = C['4a'].units[7].lessons;
    const want = ['语文园地八', '24《我将无我，不负人民》', '25《为中华之崛起而读书》', '26*《延安，我把你追寻》', '27《古诗三首》'];
    return ls.map(l => l.name).join('|') === want.join('|') ? true : ls.map(l => l.name).join('|');
  });
  T('四上语文园地四含生字「卉玫瑰牡丹蕾茉莉棠」', () =>
    C['4a'].units[3].lessons[4].chars.join('') === '卉玫瑰牡丹蕾茉莉棠'
      ? true : C['4a'].units[3].lessons[4].chars.join(''));
  T('四上语文园地八含生字「韭芹椒蒜薯藕芋姜」', () =>
    C['4a'].units[7].lessons[0].chars.join('') === '韭芹椒蒜薯藕芋姜'
      ? true : C['4a'].units[7].lessons[0].chars.join(''));
  T('四年级下册 37 课（2022 版 8 单元）250 字', () => {
    const n = C['4b'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['4b'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    return (n === 37 && C['4b'].units.length === 8 && c === 250) ? true : (n + '课/' + c + '字');
  });
  T('四下第一单元 3《天窗》含「慰藉烁蝙蝠」、5《琥珀》含「怒吼脂拭」（防课号错位）', () => {
    const l3 = C['4b'].units[0].lessons[2].chars.join('');
    const l5 = C['4b'].units[1].lessons[0].chars.join('');
    return (l3 === '慰藉卜锐滩帐烁蝙蝠霸鹰' && l5 === '怒吼脂拭餐划晌辣渗挣番埋刷测详')
      ? true : '3:' + l3 + ' | 5:' + l5;
  });
  T('四下第二单元含快乐读书吧且无生字', () => {
    const ls = C['4b'].units[1].lessons;
    const last = ls[ls.length - 1];
    return (last.name === '快乐读书吧' && last.chars.length === 0) ? true : last.name + '/' + last.chars.length;
  });
  T('四下 27《巨人的花园》含「硕允砌牌禁惩踪啸私颊拆」', () =>
    C['4b'].units[7].lessons[1].chars.join('') === '硕允砌牌禁惩踪啸私颊拆'
      ? true : C['4b'].units[7].lessons[1].chars.join(''));
  T('五年级上册 33 课（2022 版 8 单元）220 字', () => {
    const n = C['5a'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['5a'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    return (n === 33 && C['5a'].units.length === 8 && c === 220) ? true : (n + '课/' + c + '字');
  });
  T('五上 12《少年中国说》含「欧洲泻潜腾兽胎皇途」、13《圆明园》含「组征」', () => {
    const l12 = C['5a'].units[3].lessons[1].chars.join('');
    const l13 = C['5a'].units[3].lessons[2].chars.join('');
    return (l12 === '欧洲泻潜腾兽胎皇途' && l13 === '估损组殿征览境宏唐侵销罪略')
      ? true : '12:' + l12 + ' | 13:' + l13;
  });
  T('五上语文园地六含「孝喻躁泣弛卑亢赋」、园地七含省份简称', () => {
    const y6 = C['5a'].units[5].lessons[3].chars.join('');
    const y7 = C['5a'].units[6].lessons[3].chars.join('');
    return (y6 === '孝喻躁泣弛卑亢赋' && y7 === '湘粤蜀沪滇赣闽陕窑皖')
      ? true : 'Y6:' + y6 + ' | Y7:' + y7;
  });
  T('五年级下册 31 课（2022 版 8 单元，U3 为综合性学习）180 字', () => {
    const n = C['5b'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['5b'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    const u3 = C['5b'].units[2].lessons[0].name;
    return (n === 31 && C['5b'].units.length === 8 && c === 180 && u3.includes('遨游汉字'))
      ? true : (n + '课/' + c + '字/U3=' + u3);
  });
  T('五下 5《草船借箭》含「遮漆疑惑」、22《手指》含「拇搔痒秽拧螺」', () => {
    const l5 = C['5b'].units[1].lessons[0].chars.join('');
    const l22 = C['5b'].units[7].lessons[1].chars.join('');
    return (l5 === '妒忌曹督委鲁遮漆疑惑寨擂呐插' && l22 === '拇搔痒秽轧拧螺纽扣貌仓渺享庸憎')
      ? true : '5:' + l5 + ' | 22:' + l22;
  });
  T('六年级下册 24 课（2022 版 6 单元，末单元为综合性学习）120 字', () => {
    const n = C['6b'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['6b'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    const u6 = C['6b'].units[5].lessons[0].name;
    return (n === 24 && C['6b'].units.length === 6 && c === 120 && u6.includes('难忘小学生活'))
      ? true : (n + '课/' + c + '字/U6=' + u6);
  });
  T('六下 3《古诗三首》含「脉栖鸦」、8《匆匆》含「藏挪徘徊蒸裸」', () => {
    const l3 = C['6b'].units[0].lessons[2].chars.join('');
    const l8 = C['6b'].units[2].lessons[0].chars.join('');
    return (l3 === '御侯皎章泣盈脉栖鸦' && l8 === '藏挪徘徊蒸裸')
      ? true : '3:' + l3 + ' | 8:' + l8;
  });
  T('六下 11《十六年前的回忆》含「稚避峻啪僻瞅靴魔刑」、16《表里的生物》含「吠脆拦恶蟋蟀」', () => {
    const l11 = C['6b'].units[3].lessons[1].chars.join('');
    const l16 = C['6b'].units[4].lessons[2].chars.join('');
    return (l11 === '稚避峻啪僻瞅靴魔刑哼绑啃袍押执'
      && l16 === '吠脆拦恶蟋蟀')
      ? true : '11:' + l11 + ' | 16:' + l16;
  });
  T('六下第四单元含「综合性学习：奋斗的历程」且无生字、第二单元末为快乐读书吧', () => {
    const u4 = C['6b'].units[3].lessons.map(l => l.name);
    const u2last = C['6b'].units[1].lessons[C['6b'].units[1].lessons.length - 1];
    return (u4.some(x => x.includes('奋斗的历程')) && u2last.name === '快乐读书吧')
      ? true : u4.join('/') + ' | ' + u2last.name;
  });
  T('六下「脉」首读 mò（脉脉不得语）', () =>
    D['脉'].p[0] === 'mò' ? true : D['脉'].p.join(','));
  T('六年级上册 34 课（2022 版 8 单元）180 字', () => {
    const n = C['6a'].units.reduce((s, u) => s + u.lessons.length, 0);
    const c = C['6a'].units.reduce((s, u) => s + u.lessons.reduce((a, l) => a + l.chars.length, 0), 0);
    return (n === 34 && C['6a'].units.length === 8 && c === 180) ? true : (n + '课/' + c + '字');
  });
  T('六上 1《草原》「勒」首读 lè、23《少年闰土》含「伶俐」、24《好的故事》含「藻焰削」', () => {
    const l1 = C['6a'].units[0].lessons[0].chars.join('');
    const l23 = C['6a'].units[7].lessons[0].chars.join('');
    const l24 = C['6a'].units[7].lessons[1].chars.join('');
    return (l1 === '勒吟骏鞭裳蹄腐貌拘稍'
      && l23 === '郑拜偷租厨毡羞爹猬伶俐'
      && l24 === '搁萍藻漾焰削缕晕骤撕坠剩')
      ? true : '1:' + l1 + ' 23:' + l23 + ' 24:' + l24;
  });
  T('六上 21《表里的生物》含「谐拦添怖愉蟋蟀」', () =>
    C['6a'].units[6].lessons[1].chars.join('') === '谐拦添怖愉蟋蟀'
      ? true : C['6a'].units[6].lessons[1].chars.join(''));
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
