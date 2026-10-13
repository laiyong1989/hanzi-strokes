/* ================================================================
   app.js — 界面、模式与交互
   ================================================================ */
(function (w) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CUR = w.HZ_CURRICULUM;
  var SEM_LABEL = {};
  w.Store.SEM_ORDER.forEach(function (k) { SEM_LABEL[k] = (CUR[k] && CUR[k].name) || k; });

  /* ================= 音效（WebAudio，无外部资源） ================= */
  var AC = null;
  function ac() {
    if (!AC) { try { AC = new (w.AudioContext || w.webkitAudioContext)(); } catch (e) { AC = null; } }
    return AC;
  }
  function beep(freq, dur, type, vol, delay) {
    if (!w.Store.state.settings.sound) return;
    var c = ac(); if (!c) return;
    try {
      var t0 = c.currentTime + (delay || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol === undefined ? .16 : vol, t0 + .015);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + .03);
    } catch (e) { }
  }
  var SFX = {
    ok: function () { beep(660, .12, 'sine', .15); beep(880, .16, 'sine', .13, .09); },
    good: function () { beep(660, .1); beep(880, .1, 'sine', .15, .08); beep(1180, .22, 'sine', .13, .16); },
    wrong: function () { beep(300, .18, 'sine', .10); beep(220, .22, 'sine', .09, .12); },
    coin: function () { beep(1180, .07, 'triangle', .12); beep(1560, .12, 'triangle', .10, .06); },
    tap: function () { beep(520, .05, 'sine', .07); }
  };

  /* ================= 朗读（系统语音合成，无外部资源） =================
     三种发音：zh 国语（普通话）/ yue 粤语 / en 英语（读这个字的英文单词）。
     关键坑：不能「取第一个中文语音」——macOS 的语音列表里 zh-HK（粤语 Sinji）
     常常排在 zh-CN 前面，那样读出来就是粤语。所以必须按 lang 精确挑。 */
  var TTS = { ok: false, voices: [], by: { zh: null, yue: null, en: null }, spoken: {}, warned: {} };
  var VOICE_DEF = {
    zh: { lang: 'zh-CN', name: /(普通话|国语|中文|Chinese \(Mainland|Tingting|Ting-Ting|婷婷|Huihui|Yaoyao|Kangkang)/i,
      langOK: /^(zh[-_]?CN|cmn[-_]?Hans|zh[-_]?Hans|zh[-_]?SG)$/i, langBad: /^(zh[-_]?HK|yue|zh[-_]?yue|zh[-_]?TW|zh[-_]?Hant)$/i },
    yue: { lang: 'zh-HK', name: /(粤语|Cantonese|Sinji|Mei-Jia|Meijia)/i,
      langOK: /^(zh[-_]?HK|yue|zh[-_]?yue)$/i, langBad: /^(zh[-_]?CN|zh[-_]?TW|cmn)/i },
    en: { lang: 'en-US', name: /(Samantha|Alex|Daniel|Karen|Moira|Google US|Microsoft (Zira|David|Aria))/i,
      langOK: /^en([-_](US|GB|AU|CA|IN))?$/i, langBad: /^(zh|yue|cmn)/i }
  };
  function langOf(v) { return (v && (v.lang || '')).replace(/_/g, '-').trim(); }
  /* 挑某个发音的语音：先按 lang 精确匹配，再看名字，最后按 lang 前缀兜底 */
  function pickVoice(kind) {
    var def = VOICE_DEF[kind] || VOICE_DEF.zh, vs = TTS.voices;
    function hit(v) {
      var L = langOf(v);
      if (def.langBad && def.langBad.test(L)) return 0;      // 明确排除：粤语绝不当国语用
      if (def.langOK && def.langOK.test(L)) return 3;
      if (def.name && def.name.test(v.name || '')) return 2;
      if (kind === 'zh' && /^zh/i.test(L)) return 1;
      if (kind === 'yue' && /^(zh|yue)/i.test(L)) return 1;
      if (kind === 'en' && /^en/i.test(L)) return 1;
      return 0;
    }
    var best = null, bs = 0;
    for (var i = 0; i < vs.length; i++) {
      var s = hit(vs[i]);
      if (s > bs) { bs = s; best = vs[i]; }
    }
    return best;
  }
  function initTTS() {
    if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) return;
    TTS.ok = true;
    function pick() {
      var vs = [];
      try { vs = w.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
      if (!vs.length) return;
      TTS.voices = vs;
      TTS.by.zh = pickVoice('zh');
      TTS.by.yue = pickVoice('yue');
      TTS.by.en = pickVoice('en');
    }
    pick();
    try { w.speechSynthesis.onvoiceschanged = pick; } catch (e) { }
    setTimeout(pick, 900);                 // 部分浏览器异步填充语音列表
  }
  /* 当前发音档位 */
  function voiceKind() {
    var k = w.Store.getSetting('voice');
    return (k === 'yue' || k === 'en') ? k : 'zh';
  }
  /* 英语档位下这个字读什么：优先英文单词，没有就退回读汉字 */
  function enWordOf(ch) {
    var d = w.HZ_DICT && w.HZ_DICT[ch];
    return (d && d.en) ? d.en : '';
  }
  /* 英文单词后面的国际音标（美式，方括号），没有就不显示 */
  function ipaOf(ch) {
    var d = w.HZ_DICT && w.HZ_DICT[ch];
    return (d && d.ipa) ? d.ipa : '';
  }

  /* ---------- 多音字：按上下文（组词）选读音 ----------
     字典里 p 是「这个字会用到的读音」，pw 是「哪个词里读哪个音」。
     练字页有组词，就能像老师那样判断：处理 chǔ、处所 chù。 */
  function pickPinyin(ch, words) {
    var d = w.HZ_DICT && w.HZ_DICT[ch];
    if (!d) return { py: '', from: '' };
    var pw = d.pw || {};
    var ws = words || (d.w || []);
    for (var i = 0; i < ws.length; i++) {
      if (pw[ws[i]]) return { py: pw[ws[i]], from: ws[i] };
    }
    return { py: (d.p && d.p.length) ? d.p[0] : '', from: '' };
  }
  /* 这个字是不是多音字（p 里有不止一个读音，而且确实在不同词里读不同的音） */
  function isPolyphone(ch) {
    var d = w.HZ_DICT && w.HZ_DICT[ch];
    if (!d || !d.p || d.p.length < 2) return false;
    var pw = d.pw || {}, s = {};
    for (var k in pw) s[pw[k]] = 1;
    return Object.keys(s).length > 1 || false;
  }
  var speakToken = 0;                        // 保证「后一次朗读打断前一次」
  function speakOne(text, kind, then) {
    if (!TTS.ok || !text) return false;
    var def = VOICE_DEF[kind] || VOICE_DEF.zh;
    try {
      var u = new w.SpeechSynthesisUtterance(text);
      u.lang = def.lang;                   // 只靠 lang 不够，语音必须一起指定
      if (TTS.by[kind]) u.voice = TTS.by[kind];   // 各档位只用自己的语音，互不串用
      u.rate = (kind === 'en' ? .75 : .8); u.pitch = 1.05; u.volume = 1;
      if (then) u.onend = then;
      w.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function speakText(text, kind) {
    try { w.speechSynthesis.cancel(); } catch (e) { }   // 不排队、不叠加、不循环
    return speakOne(text, kind);
  }
  /* 依次读几段（多音字：先读词确定读音，再读单字）。任何新的朗读都会打断它 */
  function speakSeq(texts, kind) {
    var my = ++speakToken, i = 0;
    try { w.speechSynthesis.cancel(); } catch (e) { }
    (function next() {
      if (my !== speakToken || i >= texts.length) return;
      speakOne(texts[i++], kind, next);
    })();
  }
  /* 读一个字：按当前档位选文本与语音；英语没有对应单词时退回国语读汉字 */
  function speakChar(ch) {
    if (!TTS.ok) return;
    var st = w.Store.state.settings;
    if (!st.autoRead || !st.sound) return;   // 关掉朗读或整体静音时不发声
    var kind = voiceKind(), used = kind;
    if (kind === 'en') {
      var en = enWordOf(ch);
      if (en) speakText(en, 'en');
      else speakText(ch, 'zh');              // 语气助词等没有英文：退回国语读汉字
      return;
    }
    // 国语 / 粤语：多音字先读词（读音在这里是确定的），再读单字，避免读错音
    var pick = isPolyphone(ch) ? pickPinyin(ch) : { from: '' };
    if (pick.from) speakSeq([pick.from, ch], used);
    else speakText(ch, used);
  }
  /* 一个字一种发音只自动读一次：重复渲染、重写同一个字都不会再读；换档位允许重读 */
  function autoSpeak(ch) {
    if (!ch) return;
    var key = voiceKind() + '|' + ch;
    if (TTS.spoken[key]) return;
    TTS.spoken[key] = 1;
    setTimeout(function () { speakChar(ch); }, 280);
  }

  /* ================= 小工具 ================= */
  function toast(msg, type, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast on' + (type ? ' ' + type : '');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.className = 'toast'; }, ms || 1900);
  }
  function loading(on, txt) {
    $('loading').hidden = !on;
    if (txt) $('loadingTxt').textContent = txt;
  }
  function say(kind) {
    var sets = {
      ok: ['写得真好！', '这一笔很稳！', '笔顺对啦！', '漂亮！', '继续加油！'],
      order: ['笔顺再想想哦～', '这一笔要先写别的笔画', '顺序有点不对，看看提示'],
      miss: ['没关系，再来一次', '慢一点，看清格子里', '这一笔再写一遍试试']
    };
    var arr = sets[kind] || sets.ok;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function starRow(n, cls) {
    var s = '';
    for (var i = 0; i < 3; i++) s += '<svg class="ic' + (i < n ? ' on' : '') + '"><use href="#i-star"/></svg>';
    return '<div class="' + (cls || 'lv-stars') + '">' + s + '</div>';
  }

  /* ================= 顶栏 / 路由 ================= */
  var App = {
    stack: [],
    screen: 'home',
    params: null
  };
  function refreshTop() {
    var s = w.Store.state;
    $('statStars').textContent = s.stars;
    $('statCoins').textContent = s.coins;
    $('btnSound').className = 'tb-btn' + (s.settings.sound ? '' : ' off');
    var done = Object.keys(s.chars).length;
    $('tileCheckin').textContent = w.Store.checkinDoneToday()
      ? '已打卡 · 连续 ' + s.checkin.streak + ' 天'
      : '5 分钟 · 还没打卡';
    $('tileLevels').textContent = '已写 ' + done + ' 个字';
    $('tilePet').textContent = w.Store.pet().hatched
      ? w.Store.petKind().name + ' · ' + w.Store.petStageName()
      : '孵化进度 ' + w.Store.pet().hatchDays + '/' + w.Store.MAX_CHECKIN_DAYS + ' 天';
    var kind = w.Store.petKind(), st = w.Store.pet();
    var src = petImg(st.hatched ? kind.id : 'egg', st.hatched ? st.stage : (st.hatchDays > 3 ? 1 : 0));
    $('heroPetImg').src = src;
    $('heroPetName').textContent = st.hatched ? (kind.name + ' · ' + w.Store.petStageName()) : '宠物蛋';
    $('heroTip').textContent = st.hatched
      ? '把它养大吧：每天打卡 + 认真写字赚金币'
      : '连续打卡把蛋孵化出来，就有小伙伴陪你写字啦';
    refreshSemPick();
  }
  function petImg(id, stage) {
    if (id === 'egg') return 'assets/pets/egg' + (stage >= 1 ? '-crack' : '') + '.png';
    return 'assets/pets/' + id + '-' + (stage || 0) + '.png';
  }

  var TITLES = {
    home: '生字笔顺乐园', catalog: '按课文学习', chars: '本课生字', practice: '写字练习',
    dict: '查字典', levels: '闯关模式', pet: '宠物养成', checkin: '每日打卡', about: '家长须知'
  };
  function show(name, params) {
    App.screen = name; App.params = params || null;
    var list = document.querySelectorAll('.screen');
    for (var i = 0; i < list.length; i++) list[i].classList.remove('on');
    var el = $('sc' + name.charAt(0).toUpperCase() + name.slice(1));
    if (el) el.classList.add('on');
    $('tbTitle').textContent = TITLES[name] || '生字笔顺乐园';
    $('btnBack').hidden = (name === 'home');
    var sc = el && el.querySelector ? el : null;
    refreshTop();
    if (name === 'practice' && PR.p) setTimeout(function () { PR.p.resize(); }, 60);
  }
  function go(name, params, push) {
    if (push !== false && App.screen !== name) App.stack.push({ s: App.screen, p: App.params });
    SFX.tap();
    if (name === 'home') App.stack = [];
    if (name === 'catalog') renderCatalog(params || App.catState || {});
    if (name === 'chars') renderChars(params);
    if (name === 'dict') renderDict();
    if (name === 'levels') renderLevels(params);
    if (name === 'pet') renderPet();
    if (name === 'checkin') renderCheckin();
    if (name === 'about') renderAbout();
    show(name, params);
  }
  function back() {
    var prev = App.stack.pop();
    if (!prev) return go('home');
    if (prev.s === 'practice' && PR.ctx && PR.ctx.from === 'checkin') prev = { s: 'checkin' };
    go(prev.s, prev.p, false);
  }

  /* ================= 首页 ================= */
  function renderHome() { refreshTop(); }

  /* ---- 当前册次：首页显示 + 弹窗选择 ---- */
  function refreshSemPick() {
    var id = w.Store.currentSem();
    $('semPickName').textContent = '当前：' + (SEM_LABEL[id] || id);
  }
  function openSemPick() {
    var cur = w.Store.currentSem();
    var html = '<h3>选择册次</h3><p>决定每天推荐哪些生字</p>' +
      '<div class="sem-grid">' + w.Store.SEM_ORDER.map(function (k) {
        return '<button class="sem-cell' + (k === cur ? ' on' : '') + '" data-act="' + k + '">' +
          SEM_LABEL[k] + '</button>';
      }).join('') + '</div>' +
      '<div class="row-actions"><button class="btn btn-ghost" data-act="">关闭</button></div>';
    modal(html, function (act) {
      closeModal();
      if (!act || act === cur) return;
      w.Store.setSetting('currentSem', act);
      refreshSemPick();
      lvSem = act; lvUserPicked = false;   // 闯关页跟随新册次
      // 当前册的字帖预载跟着换
      preloadSems();
      // 切册后重渲染当前页；打卡页要按新册次重挑生字
      CK.chars = [];
      if (App.screen === 'checkin') renderCheckin();
      else go(App.screen, App.params, false);
      toast('已切到' + (SEM_LABEL[act] || act), 'good', 1500);
    });
  }
  /* 字帖预载：当前册 + 上一册 */
  function preloadSems() {
    var order = w.Store.SEM_ORDER;
    var cur = w.Store.currentSem();
    var i = order.indexOf(cur);
    var list = i > 0 ? [order[i], order[i - 1]] : [order[0]];
    list.forEach(function (sid) { w.HZ.loadSem(sid); });
  }

  /* ================= 按课文学习 ================= */
  /* 课名显示：家长自定义名优先，没有则用原课名 */
  function lessonName(L) { return w.Store.customName(L.id) || L.name; }
  /* 把文本转义后再插进 innerHTML，避免自定义名里的尖括号破坏结构 */
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* 字 -> 课 id。whereIs() 只给出课名，拿不到自定义名要用的 key，这里自己建一份索引 */
  var CHAR_LESSON_ID = null;
  function lessonIdOfChar(ch) {
    if (!CHAR_LESSON_ID) {
      CHAR_LESSON_ID = {};
      for (var i = 0; i < w.Store.SEM_ORDER.length; i++) {
        var sem = CUR[w.Store.SEM_ORDER[i]];
        if (!sem) continue;
        sem.units.forEach(function (u) {
          u.lessons.forEach(function (L) {
            L.chars.forEach(function (c) { if (!CHAR_LESSON_ID[c]) CHAR_LESSON_ID[c] = L.id; });
          });
        });
      }
    }
    return CHAR_LESSON_ID[ch] || '';
  }
  /* 行内改名：把课名那一格换成输入框 + 确定/取消（不用 window.prompt） */
  function startRename(btn) {
    var id = btn.getAttribute('data-rename');
    // 铅笔按钮与 .lsn-main 是兄弟节点，先找到所在的那一课，再取课名格
    var row = btn.closest ? btn.closest('.lsn') : null;
    var cell = row ? row.querySelector('.lsn-main') : null;
    if (!cell) return;
    var cur = cell.getAttribute('data-lname') || '';
    cell.innerHTML = '<span class="lsn-edit">' +
      '<input class="lsn-input" type="text" maxlength="24" value="' + escHtml(cur) + '" placeholder="给这节课起个名字">' +
      '<button class="lsn-ok" data-rename-ok="' + id + '">确定</button>' +
      '<button class="lsn-cancel" data-rename-cancel="1">取消</button></span>';
    var inp = cell.querySelector('.lsn-input');
    if (inp) {
      inp.focus();
      if (inp.select) inp.select();
      inp.onkeydown = function (e) {
        if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); finishRename(id, inp.value); }
      };
    }
  }
  function finishRename(id, val) {
    w.Store.setCustomName(id, val);
    renderCatalog(App.catState);
    toast(w.Store.customName(id) ? '已改名为「' + w.Store.customName(id) + '」' : '已恢复原课名', 'good', 1500);
  }

  App.catState = { sem: null, unit: null };
  function renderCatalog(st) {
    App.catState = st = st || { sem: null, unit: null };
    var semList = $('semList'), unitList = $('unitList'), lessonList = $('lessonList'), crumb = $('catCrumb');
    if (!st.sem) {
      crumb.innerHTML = '<button class="on">全部 12 册</button>';
      semList.hidden = false; unitList.hidden = true; lessonList.hidden = true;
      semList.innerHTML = w.Store.SEM_ORDER.map(function (k) {
        var sem = CUR[k];
        var total = 0, done = 0;
        sem.units.forEach(function (u) { u.lessons.forEach(function (L) {
          total += L.chars.length; done += w.Store.lessonDoneChars(L); }); });
        return '<button class="card" data-sem="' + k + '">' +
          '<span class="card-t">' + sem.name + '<span class="pill">' + total + ' 字</span></span>' +
          '<span class="bar"><i style="width:' + pct(done, total) + '%"></i></span>' +
          '<span class="card-s">已写 ' + done + ' / ' + total + ' 字</span></button>';
      }).join('');
      return;
    }
    var sem = CUR[st.sem];
    var u = st.unit === null ? null : sem.units[st.unit];
    crumb.innerHTML = '<button data-sem="">全部 12 册</button><span class="sep">›</span>' +
      '<button class="' + (u ? '' : 'on') + '" data-sem="' + st.sem + '">' + sem.name + '</button>' +
      (u ? '<span class="sep">›</span><button class="on">第' + '一二三四五六七八'[st.unit] + '单元</button>' : '');
    if (!u) {
      semList.hidden = true; lessonList.hidden = true; unitList.hidden = false;
      unitList.innerHTML = sem.units.map(function (uu, i) {
        var total = 0, done = 0;
        uu.lessons.forEach(function (L) { total += L.chars.length; done += w.Store.lessonDoneChars(L); });
        return '<div class="unit-group"><div class="unit-hd"><span>' + uu.name + '</span>' +
          '<span class="card-s">' + done + '/' + total + ' 字</span></div>' +
          '<div class="unit-body">' + uu.lessons.map(function (L, j) {
            var d = w.Store.lessonDoneChars(L), all = L.chars.length;
            var ls = w.Store.lessonState(L.id);
            return '<button class="lsn" data-unit="' + i + '" data-lesson="' + j + '">' +
              '<span class="lsn-main" data-lname="' + escHtml(lessonName(L)) + '">' +
              '<span class="lsn-n">' + escHtml(lessonName(L)) + '</span>' +
              '<span class="lsn-c">' + L.chars.join(' ') + '</span></span>' +
              (ls && ls.stars ? starRow(ls.stars) : '') +
              '<span class="lsn-done">' + (d >= all ? '已完成' : d + '/' + all) + '</span>' +
              '<span class="lsn-editbtn" data-rename="' + L.id + '" title="给这节课起个名字">✎</span></button>';
          }).join('') + '</div></div>';
      }).join('');
      return;
    }
    semList.hidden = true; unitList.hidden = true; lessonList.hidden = false;
    lessonList.innerHTML = u.lessons.map(function (L, j) {
      var d = w.Store.lessonDoneChars(L), all = L.chars.length;
      return '<button class="lsn" data-lesson="' + j + '">' +
        '<span class="lsn-main" data-lname="' + escHtml(lessonName(L)) + '">' +
        '<span class="lsn-n">' + escHtml(lessonName(L)) + '</span>' +
        '<span class="lsn-c">' + L.chars.join(' ') + '</span></span>' +
        '<span class="lsn-done">' + d + '/' + all + '</span>' +
        '<span class="lsn-editbtn" data-rename="' + L.id + '" title="给这节课起个名字">✎</span></button>';
    }).join('');
  }

  /* ================= 一课的字 ================= */
  var Viewing = { lesson: null, sem: null };
  function renderChars(p) {
    if (!p) return;
    var sem = CUR[p.sem], L = sem.units[p.unit].lessons[p.lesson];
    Viewing = { lesson: L, sem: p.sem };
    var d = w.Store.lessonDoneChars(L), all = L.chars.length;
    var ls = w.Store.lessonState(L.id);
    $('charHead').innerHTML = '<h2>' + escHtml(lessonName(L)) + '</h2>' +
      '<p>' + sem.name + ' · ' + L.chars.length + ' 个生字 · 已写 ' + d + '/' + all +
      '　' + (ls && ls.stars ? '历史最好成绩：' + '★'.repeat(ls.stars) : '') + '</p>';
    $('charGrid').innerHTML = L.chars.map(function (c, i) {
      var st = w.Store.charState(c);
      var d = w.HZ.dataOf(c);
      var inner = d ? '' : '<span style="font-family:Kaiti SC,KaiTi,serif;font-size:34px">' + c + '</span>';
      return '<button class="cell' + (st ? ' done' : '') + '" data-i="' + i + '">' +
        '<span class="cell-badge">' + (st ? '★' + st.s : (i + 1)) + '</span>' + inner +
        '<span class="cell-py' + (voiceKind() === 'en' ? ' en' : '') + '">' + labelOf(c) + '</span></button>';
    }).join('');
    // 异步补字帖
    w.HZ.loadSem(p.sem).then(function () {
      var cells = $('charGrid').children;
      for (var i = 0; i < L.chars.length; i++) {
        var cell = cells[i];
        while (cell.firstChild) cell.removeChild(cell.firstChild);
        var s = w.HZ.staticSvg(L.chars[i]);
        cell.appendChild(s);
        var st = w.Store.charState(L.chars[i]);
        cell.insertAdjacentHTML('afterbegin', '<span class="cell-badge">' + (st ? '★' + st.s : (i + 1)) + '</span>');
        cell.insertAdjacentHTML('beforeend', '<span class="cell-py' + (voiceKind() === 'en' ? ' en' : '') + '">' +
          labelOf(L.chars[i]) + '</span>');
      }
    });
  }

  /* ================= 练字页 ================= */
  var PR = { list: [], i: 0, ctx: null, p: null, timer: null };
  var CHAR_TIPS = {};

  /* 拼音（取字典里的第一个读音，多音字只显示一个，避免吓到孩子） */
  function pinyinOf(ch) {
    var d = w.HZ_DICT && w.HZ_DICT[ch];
    return (d && d.p && d.p.length) ? d.p[0] : '';
  }
  /* 生字下面那行小字：国语/粤语档显示拼音，英语档显示英文单词（没有单词就退回拼音） */
  function labelOf(ch) {
    if (voiceKind() === 'en') {
      var en = enWordOf(ch);
      if (en) return en;
    }
    return pinyinOf(ch);
  }
  /* 组词 + 释义（释义来自 data/dict.js 的 wm 字段，没有释义时只显示词语） */
  function wordBlock(d, max) {
    if (!d || !d.w || !d.w.length) return '';
    var wm = d.wm || {}, n = max || 3;
    var ws = [], i;
    for (i = 0; i < d.w.length && ws.length < n; i++) if (wm[d.w[i]]) ws.push(d.w[i]);
    for (i = 0; i < d.w.length && ws.length < n; i++) if (ws.indexOf(d.w[i]) < 0) ws.push(d.w[i]);
    var h = '';
    for (i = 0; i < ws.length; i++)
      h += '<span class="wd"><b>' + ws[i] + '</b>' +
        (wm[ws[i]] ? '<i>' + wm[ws[i]] + '</i>' : '') + '</span>';
    return '<div class="wd-list">' + h + '</div>';
  }

  function enterPractice(list, i, ctx) {
    PR.list = list; PR.i = i || 0; PR.ctx = ctx || {};
    var ch = PR.list[PR.i];
    loading(true, '正在准备「' + ch + '」的字帖…');
    w.HZ.loadChar(ch).then(function () {
      loading(false);
      show('practice', null);        // 先显示页面：格子隐藏时量不到尺寸，墨迹会缩到左上角
      startChar();
      App.stack.push({ s: (ctx && ctx.back) || 'chars', p: (ctx && ctx.params) || null });
    }).catch(function (e) {
      loading(false);
      toast('这个字暂时没有字帖：' + ch, 'bad', 2600);
    });
  }
  function startChar() {
    var ch = PR.list[PR.i];
    var mode = (PR.mode || 'trace');
    if (PR.p && PR.p.destroy) PR.p.destroy();   // 注销上一个字的监听，否则一笔会被两组监听各判一次
    PR.p = null;
    var p = w.HZ.createPractice({
      svg: $('stageSvg'), canvas: $('ink'), stage: $('stage'), char: ch, mode: mode,
      onStroke: onStroke, onDone: onCharDone
    });
    if (!p) { toast('缺少这个字的字帖', 'bad'); return; }
    PR.p = p;
    p.resize();
    requestAnimationFrame(function () { if (PR.p === p) p.resize(); });   // 布局稳定后再量一次
    document.querySelectorAll('.prac-tabs .tab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === mode);
    });
    renderPracMeta(ch, p.totalStrokes);
  }
  /* 大字那一行：英语档显示「英文单词 + 音标」，其它档显示拼音（切换档位时也要跟着变） */
  function setPinyinLine(ch, pyAll) {
    var pe = $('pracPinyin');
    var en = enWordOf(ch);
    if (voiceKind() === 'en' && en) {
      var ip = ipaOf(ch);
      pe.innerHTML = '<b>' + en + '</b>' + (ip ? '<i>' + ip + '</i>' : '');
      pe.className = 'pinyin en';
      pe.title = pyAll;
      return;
    }
    var pick = pickPinyin(ch);               // 按组词判断多音字读哪个音
    pe.innerHTML = (pick.py || pyAll) +
      (pick.from ? '<i>　' + pick.from + '</i>' : '');
    pe.className = 'pinyin';
    pe.title = pyAll;
  }
  function renderPracMeta(ch, total) {
    var d = w.HZ_DICT && w.HZ_DICT[ch] ? w.HZ_DICT[ch] : {};
    $('pracProgress').textContent = '第 ' + (PR.i + 1) + ' / ' + PR.list.length + ' 个字　「' + ch + '」';
    var en = enWordOf(ch);
    var py = (d.p && d.p.length ? d.p.join(' / ') : '—');
    var pick = pickPinyin(ch);
    // 英语档：大字位置直接给英文单词，拼音收进信息区，这样「听到什么就看到什么」
    setPinyinLine(ch, py);
    var dots = '';
    for (var i = 0; i < total; i++) dots += '<span class="sdot" data-i="' + i + '">' + (i + 1) + '</span>';
    $('strokeDots').innerHTML = dots;
    var w2 = w.HZ.whereIs(ch);
    $('pracDict').innerHTML = '<b>拼音</b> ' + py +
      (pick.from ? '　<span class="py-note">' + pick.from + '里读 ' + pick.py + '</span>' : '') +
      (en ? '<br><b>English</b> ' + en + (ipaOf(ch) ? ' ' + ipaOf(ch) : '') : '') +
      '<br><b>部首</b> ' + (d.r || '—') + '　<b>总笔画</b> ' + (d.s || total) +
      (wordBlock(d, 3) ? '<div class="wd-title">组词</div>' + wordBlock(d, 3) : '') +
      (w2 ? '<div class="wd-from">出自 ' + (SEM_LABEL[w2.sem] || '') + ' ' +
        escHtml(w.Store.customName(lessonIdOfChar(ch)) || w2.lesson) + '</div>' : '');
    autoSpeak(ch);                       // 切到这个字，自动读一次（同一个字不会重复读）
    if (PR.p && PR.p.index() === 0) {
      // 首次进入自动演示，帮助孩子看清笔顺
      setTimeout(function () { if (PR.p && PR.p.index() === 0) demoAnim(); }, 420);
    }
  }
  function markDot(i, cls) {
    var el = $('strokeDots').querySelector('.sdot[data-i="' + i + '"]');
    if (el) el.className = 'sdot ' + (cls || '');
  }
  function onStroke(ev) {
    if (ev.type === 'ok') {
      markDot(ev.idx, 'ok');
      markDot(ev.idx + 1, 'on');
      SFX.ok();
      if (PR.p && PR.p.index() > 0 && PR.p.index() % 2 === 0) toast(say('ok'), 'good', 1100);
    } else if (ev.type === 'order') {
      SFX.wrong();
      markDot(PR.p.index(), 'err');
      var name = '第' + (PR.p.index() + 1) + '笔';
      toast('笔顺要调整哦：这一笔像是「' + name + '」之外的笔画。' + name + '还没写，看老师写一遍～', 'bad', 2600);
      PR.p.flashWrong(function () { PR.p.hint(); });
    } else {
      SFX.wrong();
      markDot(PR.p.index(), 'err');
      toast(say('miss') + '（第' + (PR.p.index() + 1) + '笔）', 'bad', 1800);
      PR.p.flashWrong(function () { });
    }
  }
  function onCharDone(res) {
    var stars = 3;
    if (res.mistakes >= 3) stars = 1; else if (res.mistakes >= 1) stars = 2;
    if (res.hints > 0) stars = Math.min(stars, 2);
    var r = w.Store.markChar(PR.list[PR.i], stars);
    SFX.good();
    // 展示整字
    var g = w.HZ.svgEl('g', { transform: 'translate(0,' + w.HZ.BASE + ') scale(1,-1)' });
    var data = w.HZ.dataOf(PR.list[PR.i]);
    if (data) for (var i = 0; i < data.s.length; i++)
      g.appendChild(w.HZ.svgEl('path', { d: data.s[i], fill: '#2F2F3D', opacity: 0 }));
    $('stageSvg').appendChild(g);
    w.HZ.playChar(g, PR.list[PR.i], { color: '#2F2F3D', dur: 120, gap: 40 });

    if (PR.ctx && PR.ctx.checkin) {
      w.Store.checkinAddChar(PR.list[PR.i]);
      renderCheckin();
    }
    refreshTop();
    var last = PR.i >= PR.list.length - 1;
    modal(
      '<h3>写对啦！</h3>' + starRow(stars, 'm-stars') +
      '<p>「' + PR.list[PR.i] + '」获得 ' + r.coins + ' 金币<br>' +
      (res.mistakes === 0 ? '一次都没写错，真棒！' : '写错了 ' + res.mistakes + ' 次，多练几遍更熟练～') + '</p>' +
      '<div class="row-actions">' +
      (last ? '' : '<button class="btn btn-main" data-act="next">下一个字</button>') +
      '<button class="btn btn-ghost" data-act="again">再写一遍</button>' +
      '<button class="btn btn-ghost" data-act="close">' + (last ? '完成本课' : '先休息一下') + '</button>' +
      '</div>',
      function (act) {
        closeModal();                       // 点了按钮就立刻收起弹窗，不用再点一次
        if (act === 'next') { PR.i++; startChar(); }
        else if (act === 'again') { startChar(); }
        else { finishLesson(last); }
      }
    );
  }
  function finishLesson(last) {
    closeModal();
    if (PR.ctx && PR.ctx.lesson) {
      var L = PR.ctx.lesson;
      var d = w.Store.lessonDoneChars(L);
      if (d >= L.chars.length) {
        var sum = 0, n = 0;
        L.chars.forEach(function (c) { var s = w.Store.charState(c); if (s) { sum += s.s; n++; } });
        var avg = n ? Math.max(1, Math.round(sum / n)) : 1;
        var prev = w.Store.lessonState(L.id);
        var bonus = w.Store.markLesson(L.id, avg, L.chars.length, L.name);
        refreshTop();
        if (!prev || prev.n === 1) {
          modal('<h3>' + L.name + ' 通关！</h3>' + starRow(avg, 'm-stars') +
            '<p>奖励 ' + bonus + ' 金币、' + avg + ' 颗星！<br>继续下一课吧～</p>' +
            '<div class="row-actions"><button class="btn btn-main" data-act="close">太棒了</button></div>',
            function () { closeModal(); });
          SFX.good();
          return;
        }
      }
      if (PR.ctx && PR.ctx.checkin) { go('checkin'); return; }
      go('chars', PR.ctx && PR.ctx.params ? PR.ctx.params : null, false);
      return;
    }
    if (PR.ctx && PR.ctx.checkin) { go('checkin'); return; }
    go('home', null, false);
  }
  function demoAnim() {
    if (!PR.p) return;
    var ch = PR.p.ch;
    PR.p.clearInk(true);
    $('stageSvg').innerHTML = '';
    $('stageSvg').appendChild(w.HZ.gridGroup());
    var wrap = w.HZ.svgEl('g', { transform: 'translate(0,' + w.HZ.BASE + ') scale(1,-1)' });
    $('stageSvg').appendChild(wrap);
    var data = w.HZ.dataOf(ch);
    if (data) for (var i = 0; i < data.s.length; i++)
      wrap.appendChild(w.HZ.svgEl('path', { d: data.s[i], fill: '#EDE9E1' }));

    var done = false;
    function restore() {                       // 无论动画是否被打断，都恢复可写状态
      if (done) return;
      done = true;
      PR._demoDone = true;
      if (PR.p) { PR.p.clearInk(true); PR.p.paint(); }
      var dots = $('strokeDots').querySelectorAll('.sdot');
      for (var k = 0; k < dots.length; k++) dots[k].className = 'sdot';
      markDot(0, 'on');
      toast('看清楚了吗？照着慢慢写～', 'good', 1500);
    }
    PR._demoDone = false;
    var DUR = 380, GAP = 160;                     // 正常档每笔的时长与笔间停顿（会再乘速度倍率）
    var k = w.HZ.getSpeed();
    w.HZ.playChar(wrap, ch, {
      color: '#2F2F3D', dur: DUR, gap: GAP,
      onStroke: function (i) { markDot(i, 'ok'); markDot(i + 1, 'on'); }
    }).then(restore);
    // 兜底时间也要跟着速度走，否则慢速档会被提前打断
    setTimeout(restore, 1400 + (data ? data.s.length : 4) * ((DUR + GAP) * k + 300));
  }
  function wirePractice() {
    $('btnUndo').onclick = function () { if (PR.p) { PR.p.removeLast(); refreshDots(); } };
    $('btnHint').onclick = function () { if (PR.p) PR.p.hint().then(function () { toast('跟着黄色的笔画写～', 'good', 1500); }); };
    $('btnDemo').onclick = function () { demoAnim(); };
    $('btnNextChar').onclick = function () {
      closeModal();
      if (PR.i >= PR.list.length - 1) { finishLesson(true); return; }
      PR.i++; startChar();
    };
    /* 演示速度：三档，选择记在本机存档里，下次打开仍然是这一档 */
    var spBtns = document.querySelectorAll('#speedSeg .sp');
    function applySpeed(m, silent) {
      m = Number(m) || 1;
      w.HZ.setSpeed(m);
      w.Store.setSetting('demoSpeed', m);
      for (var i = 0; i < spBtns.length; i++)
        spBtns[i].classList.toggle('on', Number(spBtns[i].getAttribute('data-sp')) === m);
      if (!silent) toast('演示速度已设为「' + (m > 1.2 ? '慢' : (m < 0.8 ? '快' : '正常')) + '」，已帮你记住', 'good', 1500);
    }
    for (var i = 0; i < spBtns.length; i++) {
      spBtns[i].onclick = function () { applySpeed(this.getAttribute('data-sp')); };
    }
    applySpeed(w.Store.getSetting('demoSpeed') || 1, true);
    /* 自动朗读开关：切到一个生字时读一次，关掉就完全静音 */
    var btnRead = $('btnRead');
    function applyRead(on, silent) {
      w.Store.setSetting('autoRead', !!on);
      if (btnRead) {
        btnRead.classList.toggle('off', !on);
        btnRead.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      if (!silent) {
        toast(on ? '已打开：换到新字会读一次它的读音' : '已关闭自动朗读', on ? 'good' : '', 1600);
        if (on) setTimeout(function () { speakChar(PR.list[PR.i]); }, 120);
      }
    }
    if (btnRead) btnRead.onclick = function () {
      applyRead(!w.Store.getSetting('autoRead'));
    };
    applyRead(w.Store.getSetting('autoRead') !== false, true);

    /* 发音档位：国语 / 粤语 / 英语 */
    var voiceSeg = $('voiceSeg');
    var VOICE_NAME = { zh: '国语（普通话）', yue: '粤语', en: '英语' };
    function applyVoice(k, silent) {
      if (k !== 'yue' && k !== 'en') k = 'zh';
      w.Store.setSetting('voice', k);
      if (voiceSeg) voiceSeg.querySelectorAll('.vb').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-voice') === k);
      });
      if (silent) return;
      // 系统里没装这个语音时提醒一次（装了才能真的读出粤语/英语）
      if (TTS.ok && !TTS.by[k] && !TTS.warned[k]) {
        TTS.warned[k] = 1;
        toast('系统里好像还没装' + VOICE_NAME[k] + '语音，现在先用默认语音读。' +
          '可以在「设置 → 辅助功能 → 朗读内容」里下载后再试。', 'bad', 3600);
      }
      if (k === 'en') toast('英语档：读这个字的英文单词', 'good', 1600);
      var ch = PR.list[PR.i];
      if (ch) {
        // 大字位置要跟着档位立刻变（不然会出现「听着是英语、看着还是拼音」）
        var dd = (w.HZ_DICT && w.HZ_DICT[ch]) ? w.HZ_DICT[ch] : {};
        setPinyinLine(ch, (dd.p && dd.p.length) ? dd.p.join(' / ') : '—');
        // 生字页也要跟着换（英语档显示单词、国语/粤语档显示拼音）
        if (App.screen === 'chars' && App.params) renderChars(App.params);
        // 换档位要能重读：autoSpeak 的记键带档位，这里直接读当前字
        setTimeout(function () { speakChar(ch); }, 140);
      }
    }
    if (voiceSeg) voiceSeg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-voice]');
      if (b) applyVoice(b.getAttribute('data-voice'));
    });
    applyVoice(w.Store.getSetting('voice') || 'zh', true);

    document.querySelectorAll('.prac-tabs .tab').forEach(function (b) {
      b.onclick = function () {
        PR.mode = b.getAttribute('data-mode');
        document.querySelectorAll('.prac-tabs .tab').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        if (PR.p) { PR.p.setMode(PR.mode); PR.p.clearInk(true); markDot(0, 'on'); }
      };
    });
  }
  function refreshDots() {
    if (!PR.p) return;
    var dots = $('strokeDots').querySelectorAll('.sdot');
    for (var i = 0; i < dots.length; i++)
      dots[i].className = 'sdot' + (i < PR.p.index() ? ' ok' : (i === PR.p.index() ? ' on' : ''));
  }

  /* ================= 弹层 ================= */
  function modal(html, cb) {
    $('modalBox').innerHTML = html;
    $('modalMask').hidden = false;
    $('modalBox').querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () { cb && cb(b.getAttribute('data-act')); };
    });
  }
  function closeModal() { $('modalMask').hidden = true; }
  $('modalMask').addEventListener('click', function (e) { if (e.target === $('modalMask')) closeModal(); });

  /* ================= 查字典 ================= */
  var IDX = null, dictTab = 'pinyin', curRadical = null;
  function stripTone(s) {
    return s.toLowerCase()
      .replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i')
      .replace(/[ōóǒò]/g, 'o').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜü]/g, 'v')
      .replace(/[^a-z]/g, '');
  }
  function buildIndex() {
    IDX = { py: {}, rad: {} };
    for (var ch in w.HZ_DICT) {
      var d = w.HZ_DICT[ch];
      (d.p || []).forEach(function (p) {
        var k = stripTone(p);
        if (!k) return;
        (IDX.py[k] = IDX.py[k] || []).push(ch);
        var ini = k.slice(0, 2);
        while (ini.length >= 1) { (IDX.py[ini] = IDX.py[ini] || []).push(ch); ini = ini.slice(0, -1); }
      });
      if (d.r) (IDX.rad[d.r] = IDX.rad[d.r] || []).push(ch);
    }
    Object.keys(IDX.py).forEach(function (k) {
      IDX.py[k] = IDX.py[k].filter(function (c, i, a) { return a.indexOf(c) === i; });
    });
  }
  function renderDict() {
    if (!IDX) buildIndex();
    $('dictHint').innerHTML = dictTab === 'pinyin'
      ? '提示：可以不带声调，例如 <b>chun</b>、<b>ch</b>、<b>shu</b>。也可以用拼音首字母查，例如 <b>hj</b> 找「花」类字不确定。'
      : '提示：点击下面的部首，看看这个部首的字有哪些。';
    $('dictInput').placeholder = dictTab === 'pinyin' ? '输入拼音，如 chun 或 chūn' : '输入拼音继续检索（部首请点上方）';
    if (dictTab === 'radical') {
      $('radicalPanel').hidden = false;
      var rads = Object.keys(IDX.rad).sort(function (a, b) { return IDX.rad[b].length - IDX.rad[a].length; });
      $('radicalPanel').innerHTML = '<div class="rad-hd">常用部首（按字数多少排列）</div><div class="rad-list">' +
        rads.slice(0, 96).map(function (r) {
          return '<button class="rad-btn' + (curRadical === r ? ' on' : '') + '" data-r="' + r + '">' + r + '</button>';
        }).join('') + '</div>';
    } else {
      $('radicalPanel').hidden = true;
    }
    doSearch($('dictInput').value);
  }
  function doSearch(q) {
    var box = $('dictResults');
    var html = '';
    if (dictTab === 'radical' && curRadical) {
      var list = IDX.rad[curRadical] || [];
      html = list.map(dictCard).join('') || '<div class="empty">这个部首暂时没有收录的字</div>';
      box.innerHTML = html; return;
    }
    var key = stripTone(q || '');
    if (!key) {
      box.innerHTML = '<div class="empty">输入拼音或点选部首，就能找到要学的字</div>';
      return;
    }
    var hits = IDX.py[key];
    if (!hits) {
      var cands = Object.keys(IDX.py).filter(function (k) { return k.indexOf(key) === 0; })
        .sort(function (a, b) { return IDX.py[b].length - IDX.py[a].length; }).slice(0, 4);
      if (cands.length) hits = IDX.py[cands[0]];
    }
    if (!hits || !hits.length) {
      box.innerHTML = '<div class="empty">没有找到「' + q + '」对应的生字<br>换个拼音试试，或用部首查字</div>';
      return;
    }
    box.innerHTML = hits.slice(0, 60).map(dictCard).join('');
  }
  function dictCard(ch) {
    var d = w.HZ_DICT[ch] || {}, wp = w.HZ.whereIs(ch), st = w.Store.charState(ch);
    return '<button class="dr-card" data-ch="' + ch + '">' +
      '<span class="dr-hz">' + ch + '</span>' +
      '<span class="dr-py">' + ((d.p && d.p[0]) || '') + '</span>' +
      (d.en ? '<span class="dr-en">' + d.en + (d.ipa ? ' ' + d.ipa : '') + '</span>' : '') +
      '<span class="dr-sub">' + (d.r ? '部首 ' + d.r : '') + (d.s ? ' · ' + d.s + '画' : '') + '</span>' +
      ((d.w && d.w.length)
        ? '<span class="dr-word">' + d.w[0] +
          ((d.wm && d.wm[d.w[0]]) ? '<i>' + d.wm[d.w[0]] + '</i>' : '') + '</span>'
        : '') +
      (wp ? '<span class="dr-tag">' + (SEM_LABEL[wp.sem] || '').replace('年级', '') +
        (w.Store.customName(lessonIdOfChar(ch)) ? ' · ' + escHtml(w.Store.customName(lessonIdOfChar(ch))) : '') +
        '</span>' : '') +
      (st ? '<span class="dr-sub">★' + st.s + '</span>' : '') + '</button>';
  }
  function wireDict() {
    $('dictInput').addEventListener('input', function () { doSearch(this.value); });
    $('dictClear').onclick = function () { $('dictInput').value = ''; doSearch(''); };
    document.querySelectorAll('.seg [data-dtab]').forEach(function (b) {
      b.onclick = function () {
        dictTab = b.getAttribute('data-dtab'); curRadical = null;
        document.querySelectorAll('.seg [data-dtab]').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); renderDict();
      };
    });
    $('radicalPanel').addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return;
      curRadical = b.getAttribute('data-r');
      renderDict(); SFX.tap();
    });
    $('dictResults').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ch]'); if (!b) return;
      var ch = b.getAttribute('data-ch');
      toast('开始练习「' + ch + '」', 'good', 1200);
      enterPractice([ch], 0, { back: 'dict' });
    });
  }

  /* ================= 闯关 ================= */
  var lvSem = '1a', lvUserPicked = false;   // 用户是否手动切过闯关册
  function renderLevels(p) {
    // 打开闯关页时默认定位到当前册（若已是当前册则保持不动）
    if (p && p.sem) lvSem = p.sem;
    else if (lvSem !== w.Store.currentSem() && !lvUserPicked) lvSem = w.Store.currentSem();
    if (!CUR[lvSem]) lvSem = w.Store.currentSem();
    $('lvSemSeg').innerHTML = w.Store.SEM_ORDER.map(function (k) {
      return '<button class="seg-btn' + (k === lvSem ? ' on' : '') + '" data-lvsem="' + k + '">' + SEM_LABEL[k] + '</button>';
    }).join('');
    var sem = CUR[lvSem], html = '', idx = 0;
    sem.units.forEach(function (u) {
      u.lessons.forEach(function (L) {
        var ls = w.Store.lessonState(L.id);
        var d = w.Store.lessonDoneChars(L);
        var done = d >= L.chars.length;
        html += '<button class="lv-card" data-lv="' + L.id + '">' +
          (ls && ls.stars ? '' : '<span class="lv-lock">' + (done ? '' : '<svg class="ic"><use href="#i-lock"/></svg>') + '</span>') +
          '<span class="lv-n">第 ' + (++idx) + ' 关 · ' + u.name + '</span>' +
          '<span class="lv-t">' + L.name + '</span>' +
          '<span class="card-s">' + L.chars.length + ' 个字 · ' + d + '/' + L.chars.length + '</span>' +
          starRow((ls && ls.stars) || 0) + '</button>';
      });
    });
    $('lvList').innerHTML = html;
  }

  /* ================= 宠物 ================= */
  function renderPet() {
    var st = w.Store.pet(), kind = w.Store.petKind();
    $('petImg').src = petImg(st.hatched ? kind.id : 'egg', st.hatched ? st.stage : (st.hatchDays > 3 ? 1 : 0));
    $('petName').textContent = st.hatched ? (kind.name + ' · ' + w.Store.petStageName()) : '神秘的宠物蛋';
    $('petStage').textContent = st.hatched
      ? '成长值 ' + st.exp + ' · 已喂食 ' + (st.fedTotal || 0) + ' 次'
      : '孵化进度 ' + st.hatchDays + ' / ' + w.Store.MAX_CHECKIN_DAYS + ' 天（每天打卡 +1）';
    $('petBar').style.width = st.hatched
      ? Math.min(100, ((st.fedTotal || 0) % w.Store.FEED_PER_STAGE) / w.Store.FEED_PER_STAGE * 100) + '%'
      : pct(st.hatchDays, w.Store.MAX_CHECKIN_DAYS) + '%';
    $('petDesc').textContent = st.hatched ? kind.desc : '每天完成一次打卡，蛋就会更热一点点，7 天就能孵化。';
    $('petAlbum').innerHTML = w.Store.PETS.map(function (k) {
      var cur = (st.id === k.id);
      var maxStage = cur && st.hatched ? st.stage : -1;
      var items = '';
      for (var s = 0; s < 3; s++) {
        var on = maxStage >= s;
        items += '<div class="pa' + (on ? '' : ' locked') + '">' +
          '<img src="' + petImg(k.id, s) + '" alt="">' +
          '<div class="pa-t">' + k.name + '</div>' +
          '<div class="pa-s">' + (['幼生期', '成长期', '进化期'][s]) + (on ? ' 已解锁' : ' 未解锁') + '</div></div>';
      }
      return items;
    }).join('') +
      '<div class="pa' + (w.Store.pet().hatched ? '' : ' locked') + '"><img src="assets/pets/egg.png" alt="">' +
      '<div class="pa-t">宠物蛋</div><div class="pa-s">打卡孵化</div></div>';
    $('petLog').innerHTML = (w.Store.state.log || []).slice(0, 20).map(function (l) {
      var d = new Date(l.t);
      return '<div>' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + l.s + '</div>';
    }).join('') || '<div>还没有记录，快去写几个字吧～</div>';
  }
  function wirePet() {
    $('btnFeed').onclick = function () {
      var r = w.Store.feed();
      if (!r.ok) { toast(r.msg, 'bad', 2200); SFX.wrong(); return; }
      SFX.coin();
      renderPet(); refreshTop();
      toast(r.up ? '宠物进化啦！' : '喂食成功，它开心地跳了跳', 'good', 1800);
      if (r.up) SFX.good();
    };
    $('btnSwitchPet').onclick = function () {
      var cur = w.Store.pet().id;
      var i = 0;
      w.Store.PETS.forEach(function (k, j) { if (k.id === cur) i = j; });
      var nxt = w.Store.PETS[(i + 1) % w.Store.PETS.length];
      w.Store.switchPet(nxt.id);
      renderPet(); refreshTop(); SFX.tap();
      toast('现在养的是「' + nxt.name + '」', 'good', 1500);
    };
    $('btnPetCheckin').onclick = function () { go('checkin'); };
  }

  /* ================= 每日打卡 ================= */
  var CK = { timer: null, left: 300, running: false, chars: [] };
  function renderCheckin() {
    var c = w.Store.checkin();
    var need = 5;
    var todayCount = Math.min(c.todayChars.length, need);
    $('ckDays').textContent = c.days.length;
    $('ckStreak').textContent = c.streak || 0;
    $('ckToday').textContent = todayCount + '/' + need;
    $('ckTime').textContent = fmt(CK.left);
    $('ckRing').style.setProperty('--p', ((300 - CK.left) / 300 * 100) + '%');
    var pick = CK.chars.length ? CK.chars.map(function (o) { return o.ch; }) : w.Store.pickDailyChars(need).map(function (o) { return o.ch; });
    if (!CK.chars.length) CK.chars = w.Store.pickDailyChars(need);
    $('ckGrid').innerHTML = pick.map(function (ch, i) {
      var st = w.Store.charState(ch);
      var done = c.todayChars.indexOf(ch) >= 0;
      return '<button class="cell' + (done ? ' done' : '') + (i === c.todayChars.length % pick.length ? ' ck-on' : '') +
        '" data-ck="' + ch + '"><span class="cell-badge">' + (done ? '✓' : (i + 1)) + '</span>' +
        '<span style="font-family:Kaiti SC,KaiTi,serif;font-size:30px">' + ch + '</span></button>';
    }).join('');
    // 预载「当前册 + 上一册」的字帖（推字只来自当前册及之前的册）。
    // 若当前册的字已全部写满，推到的字可能来自更早的册，那些册也要补上，
    // 否则 staticSvg 只能画文字兜底、看不到笔顺。
    var needSems = w.Store.semBackOrder().slice(0, 2);
    pick.forEach(function (ch) {
      var where = w.HZ.whereIs(ch);          // semOf 未对外暴露，用 whereIs 拿同一份索引
      var sid = where && where.sem;
      if (sid && needSems.indexOf(sid) < 0) needSems.push(sid);
    });
    needSems.forEach(function (sid) { w.HZ.loadSem(sid).then(function () {
      var cells = $('ckGrid').children;
      for (var i = 0; i < pick.length && i < cells.length; i++) {
        var cell = cells[i];
        while (cell.firstChild) cell.removeChild(cell.firstChild);
        cell.appendChild(w.HZ.staticSvg(pick[i]));
        var done = c.todayChars.indexOf(pick[i]) >= 0;
        cell.insertAdjacentHTML('afterbegin', '<span class="cell-badge">' + (done ? '✓' : (i + 1)) + '</span>');
      }
    }); });
    $('btnCkClaim').disabled = !(todayCount >= need && !c.claimed);
    $('btnCkStart').textContent = CK.running ? '继续打卡（剩 ' + fmt(CK.left) + '）' : (todayCount >= need && c.claimed ? '今天已完成' : '开始打卡');
    // 日历（最近 14 天）
    var html = '', today = new Date();
    for (var i = 13; i >= 0; i--) {
      var d = new Date(today); d.setDate(d.getDate() - i);
      var key = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      var on = c.days.indexOf(key) >= 0;
      html += '<div class="day-dot' + (on ? ' ok' : '') + (i === 0 ? ' today' : '') + '">' +
        (on ? '✓' : (d.getDate())) + '</div>';
    }
    $('ckCalendar').innerHTML = html;
  }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(s) { var m = Math.floor(s / 60); var x = s % 60; return m + ':' + (x < 10 ? '0' + x : x); }
  function startCheckinTimer() {
    if (CK.running) return;
    CK.running = true;
    CK.timer = setInterval(function () {
      CK.left--;
      $('ckTime').textContent = fmt(Math.max(0, CK.left));
      $('ckRing').style.setProperty('--p', ((300 - CK.left) / 300 * 100) + '%');
      if (CK.left <= 0) {
        clearInterval(CK.timer); CK.running = false; CK.left = 0;
        toast('5 分钟到啦，今天写得很棒！', 'good', 2600);
        renderCheckin();
      }
    }, 1000);
  }
  function wireCheckin() {
    $('btnCkStart').onclick = function () {
      var c = w.Store.checkin();
      CK.chars = w.Store.pickDailyChars(5);
      startCheckinTimer();
      var first = CK.chars[0] ? CK.chars[0].ch : null;
      if (!first) { toast('还没有可以练习的字', 'bad'); return; }
      enterPractice(CK.chars.map(function (o) { return o.ch; }), 0,
        { checkin: true, back: 'checkin' });
    };
    $('btnCkClaim').onclick = function () {
      var ok = w.Store.checkinClaim(30);
      if (!ok) { toast('今天已经领过啦', 'bad'); return; }
      SFX.coin();
      renderCheckin(); refreshTop();
      var st = w.Store.pet();
      var tip = st.hatched && st.hatchDays === w.Store.MAX_CHECKIN_DAYS
        ? '蛋里的小家伙出来了！去宠物页看看它吧'
        : '连续打卡 ' + w.Store.checkin().streak + ' 天，蛋的孵化进度 ' + st.hatchDays + '/' + w.Store.MAX_CHECKIN_DAYS;
      var hatch = (st.hatched && !w.Store.state._hatchSeen);
      modal('<h3>打卡成功！</h3><p>获得 30 金币<br>' + tip + '</p>' +
        '<div class="row-actions"><button class="btn btn-main" data-act="pet">去看宠物</button>' +
        '<button class="btn btn-ghost" data-act="close">继续写字</button></div>',
        function (act) {
          closeModal();
          if (act === 'pet') { w.Store.state._hatchSeen = true; w.Store.save(); go('pet'); }
        });
    };
    $('ckGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ck]'); if (!b) return;
      var ch = b.getAttribute('data-ck');
      var list = CK.chars.map(function (o) { return o.ch; });
      var i = list.indexOf(ch); if (i < 0) i = 0;
      startCheckinTimer();
      enterPractice(list, i, { checkin: true, back: 'checkin' });
    });
  }

  /* ================= 家长须知 ================= */
  function renderAbout() {
    $('aboutVer').textContent = '生字笔顺乐园 v1.0 · 本地版 · 收录 ' +
      w.Store.SEM_ORDER.reduce(function (a, k) {
        return a + CUR[k].units.reduce(function (b, u) {
          return b + u.lessons.reduce(function (c, L) { return c + L.chars.length; }, 0); }, 0);
      }, 0) + ' 个生字';
  }
  function wireAbout() {
    $('btnReset').onclick = function () {
      modal('<h3>清除学习记录？</h3><p>会清空星星、金币、宠物和打卡记录，且无法恢复。</p>' +
        '<div class="row-actions"><button class="btn btn-danger" data-act="yes">确认清除</button>' +
        '<button class="btn btn-ghost" data-act="no">再想想</button></div>', function (act) {
          if (act === 'yes') {
            w.Store.reset(); closeModal(); refreshTop(); go('home');
            toast('已清除，可以重新开始啦', 'good');
          } else closeModal();
        });
    };
    $('btnExport').onclick = function () {
      var blob = new Blob([JSON.stringify(w.Store.state, null, 1)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '生字笔顺-学习记录.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('学习记录已导出', 'good');
    };
  }

  /* ================= 事件绑定 ================= */
  function wire() {
    document.body.addEventListener('click', function (e) {
      var goEl = e.target.closest('[data-go]');
      if (goEl) { go(goEl.getAttribute('data-go')); return; }
      var sem = e.target.closest('[data-sem]');
      if (sem && $('scCatalog').classList.contains('on')) {
        var v = sem.getAttribute('data-sem');
        renderCatalog(v ? { sem: v, unit: null } : { sem: null, unit: null });
        return;
      }
      // 改名相关按钮要先判断，否则会落到下面的 data-lesson 跳课
      var rnOk = e.target.closest('[data-rename-ok]');
      if (rnOk) {
        var box = rnOk.parentNode.querySelector('.lsn-input');
        finishRename(rnOk.getAttribute('data-rename-ok'), box ? box.value : '');
        return;
      }
      var rnCancel = e.target.closest('[data-rename-cancel]');
      if (rnCancel) { renderCatalog(App.catState); return; }
      var rn = e.target.closest('[data-rename]');
      if (rn && $('scCatalog').classList.contains('on')) { startRename(rn); return; }
      var lsn = e.target.closest('[data-lesson]');
      if (lsn && $('scCatalog').classList.contains('on')) {
        var st2 = App.catState;
        // 「册 → 单元总览」里的课按钮自带 data-unit（第几单元的第几课）；
        // 进入某个单元后的列表里，按钮只有 data-lesson，此时沿用当前单元。
        if (lsn.hasAttribute('data-unit')) st2.unit = +lsn.getAttribute('data-unit');
        else if (st2.unit === null || st2.unit === undefined) st2.unit = 0;
        st2.lesson = +lsn.getAttribute('data-lesson');
        go('chars', { sem: st2.sem, unit: st2.unit, lesson: st2.lesson });
        return;
      }
      var unitBtn = e.target.closest('[data-unit]');
      if (unitBtn && $('scCatalog').classList.contains('on')) {
        renderCatalog({ sem: App.catState.sem, unit: +unitBtn.getAttribute('data-unit') });
        return;
      }
      var cell = e.target.closest('[data-i]');
      if (cell && $('scChars').classList.contains('on')) {
        var stc = App.catState;
        enterPractice(Viewing.lesson.chars, +cell.getAttribute('data-i'), {
          lesson: Viewing.lesson, back: 'chars',
          params: { sem: stc.sem, unit: stc.unit === null ? 0 : stc.unit, lesson: stc.lesson }
        });
        return;
      }
      var lv = e.target.closest('[data-lv]');
      if (lv && $('scLevels').classList.contains('on')) {
        var id = lv.getAttribute('data-lv'), L = null;
        for (var i = 0; i < CUR[lvSem].units.length; i++) {
          for (var j = 0; j < CUR[lvSem].units[i].lessons.length; j++) {
            if (CUR[lvSem].units[i].lessons[j].id === id) L = CUR[lvSem].units[i].lessons[j];
          }
        }
        if (L) enterPractice(L.chars, 0, { lesson: L, back: 'levels' });
        return;
      }
      var lvs = e.target.closest('[data-lvsem]');
      if (lvs && $('scLevels').classList.contains('on')) { lvSem = lvs.getAttribute('data-lvsem'); lvUserPicked = true; renderLevels(); return; }
    });
    $('btnBack').onclick = back;
    $('btnSemPick').onclick = function () { SFX.tap(); openSemPick(); };
    $('btnSound').onclick = function () {
      var s = w.Store.state.settings;
      s.sound = !s.sound; w.Store.save(); refreshTop();
      if (s.sound) SFX.ok();
    };
    $('btnWholeLesson').onclick = function () {
      if (!Viewing.lesson) return;
      var st = App.catState;
      enterPractice(Viewing.lesson.chars, 0, {
        lesson: Viewing.lesson, back: 'chars',
        params: { sem: st.sem, unit: st.unit === null ? 0 : st.unit, lesson: st.lesson }
      });
    };
    wirePractice(); wireDict(); wirePet(); wireCheckin(); wireAbout();
    w.addEventListener('hz:store', function () { refreshTop(); });
    w.addEventListener('resize', function () {
      if (App.screen === 'practice' && PR.p) PR.p.resize();
      if (App.screen === 'checkin') renderCheckin();
    });
    w.addEventListener('orientationchange', function () {
      setTimeout(function () { if (App.screen === 'practice' && PR.p) PR.p.resize(); }, 300);
    });
  }

  /* ================= 启动 ================= */
  function boot() {
    w.Store.load();
    initTTS();                 // 语音列表在部分浏览器里是异步给的，先挂钩子
    wire();
    renderHome();
    show('home');
    // 预载当前册的字帖，加快首次进入
    preloadSems();
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  w.App = { go: go, back: back, enterPractice: enterPractice, petImg: petImg };
})(window);
