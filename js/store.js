/* ================================================================
   store.js — 本地进度存储（全部只保存在本机，不上传任何数据）
   ================================================================ */
(function (w) {
  'use strict';
  var KEY = 'hzpb.v1';
  var PETS = [
    { id: 'shu', name: '电光鼠',   el: '电', color: '#FFD166', desc: '一只闪着电光的圆耳小兽，最喜欢看小朋友写好字。' },
    { id: 'huo', name: '火尾兽',   el: '火', color: '#FFA94D', desc: '尾巴像小火苗，写字认真的时候尾巴会亮起来。' },
    { id: 'shui', name: '水灵兽',  el: '水', color: '#6FC7F5', desc: '住在水滴里的小精灵，写得越稳它越开心。' }
  ];
  var MAX_CHECKIN_DAYS = 7;      // 累计打卡 7 天孵化
  var FEED_COST = 20;            // 一次喂食花费
  var FEED_PER_STAGE = 5;        // 每个阶段需要喂食次数

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }

  function fresh() {
    return {
      v: 1, coins: 0, stars: 0,
      chars: {}, lessons: {}, levels: {},
      pet: { id: 'shu', stage: 0, exp: 0, hatchDays: 0, hatched: false, lastFed: 0, fedTotal: 0 },
      checkin: { days: [], today: '', todayChars: [], streak: 0, lastDay: '' },
      // demoSpeed：笔顺演示速度倍率（>1 更慢）；autoRead：切到生字自动朗读一次
      // voice：朗读发音 zh=国语（普通话） yue=粤语 en=英语（读这个字的英文单词）
      // currentSem：当前册次（默认一年级上册）；customNames：家长自定义的课名
      settings: {
        sound: true, demoSpeed: 1, autoRead: true, voice: 'zh',
        currentSem: '1a', customNames: {}
      },
      log: []
    };
  }

  var S = null;
  function load() {
    try {
      var raw = w.localStorage.getItem(KEY);
      S = raw ? JSON.parse(raw) : fresh();
    } catch (e) { S = fresh(); }
    var f = fresh();
    for (var k in f) { if (!(k in S)) S[k] = f[k]; }
    for (var k2 in f.pet) { if (!(k2 in S.pet)) S.pet[k2] = f.pet[k2]; }
    for (var k3 in f.checkin) { if (!(k3 in S.checkin)) S.checkin[k3] = f.checkin[k3]; }
    for (var k4 in f.settings) { if (!(k4 in S.settings)) S.settings[k4] = f.settings[k4]; }
    return S;
  }
  var saveTimer = null;
  function save() {
    try { w.dispatchEvent(new Event('hz:store')); } catch (e) { }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { w.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
    }, 120);
  }
  function reset() {
    S = fresh(); save();
  }

  function pet() { return S.pet; }
  function petKind() {
    for (var i = 0; i < PETS.length; i++) if (PETS[i].id === S.pet.id) return PETS[i];
    return PETS[0];
  }
  function petStageName() {
    if (!S.pet.hatched) return '宠物蛋';
    return ['幼生期', '成长期', '进化期'][Math.min(2, S.pet.stage)];
  }
  function petNeed() { return FEED_PER_STAGE; }

  /* ---------------- 奖励 ---------------- */
  function log(text) {
    S.log.unshift({ t: Date.now(), s: text });
    if (S.log.length > 60) S.log.length = 60;
  }
  function addCoins(n) { S.coins = Math.max(0, S.coins + n); save(); }
  function addStars(n) { S.stars = Math.max(0, S.stars + n); save(); }

  /* 记录一个字写完的结果：stars 0~3 */
  function markChar(ch, stars, opts) {
    opts = opts || {};
    var c = S.chars[ch] || { n: 0, s: 0, t: 0 };
    c.n++; c.t = Date.now();
    if (stars > c.s) c.s = stars;
    S.chars[ch] = { n: c.n, s: c.s, t: c.t };
    var coins = 3 + stars * 2;
    var st = stars >= 3 ? 3 : (stars >= 2 ? 2 : 1);
    addCoins(coins); addStars(st);
    if (S.pet.hatched) { S.pet.exp += (stars >= 3 ? 2 : 1); }
    save();
    return { coins: coins, stars: st };
  }
  function charState(ch) { return (S && S.chars[ch]) || null; }
  function isCharDone(ch) { return !!(S && S.chars[ch]); }

  /* 一课完成：stars 为本课平均星级 */
  function markLesson(lessonId, stars, total, name) {
    var old = S.lessons[lessonId] || { stars: 0, total: total, n: 0, name: name || '' };
    old.n++;
    if (stars > old.stars) old.stars = stars;
    old.total = total; old.name = name || old.name; old.t = Date.now();
    S.lessons[lessonId] = old;
    var bonus = 20 + stars * 10;
    addCoins(bonus); addStars(stars);
    log('完成《' + (name || lessonId) + '》，获得 ' + bonus + ' 金币、' + stars + ' 颗星');
    save();
    return bonus;
  }
  function lessonState(id) { return (S && S.lessons[id]) || null; }

  /* 一课已写好的字数 */
  function lessonDoneChars(lesson) {
    var n = 0;
    for (var i = 0; i < lesson.chars.length; i++) if (S.chars[lesson.chars[i]]) n++;
    return n;
  }

  /* 闯关解锁：按册顺序，第 1 关默认解锁，前一关拿到星才解锁下一关 */
  function levelUnlocked(semId, idx) {
    if (idx <= 0) return true;
    return true; // 儿童模式：不锁死，只做进度提示（避免挫败感）
  }

  /* ---------------- 打卡 ---------------- */
  function checkin() {
    if (S.checkin.today !== today()) {
      S.checkin.today = today();
      S.checkin.todayChars = [];
      S.checkin.claimed = false;
      save();
    }
    return S.checkin;
  }
  function checkinAddChar(ch) {
    var c = checkin();
    if (c.todayChars.indexOf(ch) < 0) { c.todayChars.push(ch); save(); }
    return c.todayChars.length;
  }
  function checkinClaim(reward) {
    var c = checkin();
    if (c.claimed) return false;
    c.claimed = true;
    if (c.days.indexOf(c.today) < 0) c.days.push(c.today);
    var y = new Date(); y.setDate(y.getDate() - 1);
    var ymd = y.getFullYear() + '-' + p2(y.getMonth() + 1) + '-' + p2(y.getDate());
    c.streak = (c.lastDay === ymd) ? (c.streak || 0) + 1 : 1;
    c.lastDay = c.today;
    if (!S.pet.hatched) {
      S.pet.hatchDays = Math.min(MAX_CHECKIN_DAYS, (S.pet.hatchDays || 0) + 1);
      if (S.pet.hatchDays >= MAX_CHECKIN_DAYS) { S.pet.hatched = true; }
    }
    addCoins(reward || 30); addStars(1);
    log('今日打卡成功，连续 ' + c.streak + ' 天');
    save();
    return true;
  }
  function checkinDoneToday() {
    return S.checkin.days.indexOf(today()) >= 0;
  }

  /* ---------------- 宠物 ---------------- */
  function feed() {
    if (!S.pet.hatched) return { ok: false, msg: '先连续打卡把蛋孵化出来吧' };
    if (S.pet.exp <= 0) return { ok: false, msg: '它还不饿，先去写字吧' };
    if (S.coins < FEED_COST) return { ok: false, msg: '金币不够啦，再写几个字攒一攒' };
    if (S.pet.stage >= 2 && S.pet.exp < FEED_PER_STAGE) return { ok: false, msg: '已经长大啦，继续写字它会更强壮' };
    S.coins -= FEED_COST;
    S.pet.exp -= 1; S.pet.fedTotal = (S.pet.fedTotal || 0) + 1;
    S.pet.lastFed = Date.now();
    var up = false;
    if (S.pet.fedTotal % FEED_PER_STAGE === 0 && S.pet.stage < 2) { S.pet.stage++; up = true; }
    log(up ? ('宠物进化到「' + petStageName() + '」！') : '喂食成功，它变开心了');
    save();
    return { ok: true, up: up };
  }
  function switchPet(id) {
    for (var i = 0; i < PETS.length; i++) {
      if (PETS[i].id === id) {
        var same = (S.pet.id === id);
        S.pet.id = id;
        log(same ? ('继续养「' + PETS[i].name + '」') : ('切换宠物：' + PETS[i].name));
        save(); return true;
      }
    }
    return false;
  }

  /* ---------------- 设置 ---------------- */
  /* 当前册次：旧存档没有这个字段时由 load() 补成 '1a'；非法值退回第一册 */
  function currentSem() {
    var id = S && S.settings ? S.settings.currentSem : '';
    var cur = w.HZ_CURRICULUM;
    if (id && cur && cur[id]) return id;
    for (var i = 0; i < SEM_ORDER.length; i++) if (SEM_ORDER[i] === id) return id;
    return SEM_ORDER[0];
  }
  /* 当前册 → 之前的册（越靠前越优先），用于「补足」时取字 */
  function semBackOrder() {
    var curSem = currentSem();
    var idx = -1;
    for (var i = 0; i < SEM_ORDER.length; i++) if (SEM_ORDER[i] === curSem) { idx = i; break; }
    if (idx < 0) idx = 0;
    var out = [];
    for (var j = idx; j >= 0; j--) out.push(SEM_ORDER[j]);
    return out;
  }
  /* 收集候选字时的册顺序。
     当前册是第一册时「之前的册」为空，按 A4 退回原有行为（整册从头扫到 260 个候选）；
     当前册靠后时只扫「当前册 + 之前的册」，不会推到高年级去。 */
  function semScanOrder() {
    var back = semBackOrder();
    return (back.length === 1) ? SEM_ORDER : back;
  }

  /* 家长自定义课名：key 为 sem-unit-lesson（如 3a-0-1）；没设置/清空则返回空串 */
  function customName(key) {
    var m = S && S.settings ? S.settings.customNames : null;
    if (!m || typeof m !== 'object') return '';
    var v = m[key];
    return (typeof v === 'string') ? v : '';
  }
  /* 设置自定义课名；传空串即删除该课的自定义名（恢复原课名） */
  function setCustomName(key, val) {
    if (!S || !S.settings || !key) return '';
    if (!S.settings.customNames || typeof S.settings.customNames !== 'object') S.settings.customNames = {};
    var v = (val === null || val === undefined) ? '' : String(val);
    v = v.replace(/^\s+|\s+$/g, '').slice(0, 24);
    if (v) S.settings.customNames[key] = v;
    else delete S.settings.customNames[key];
    save();
    return v;
  }

  /* 今日应练的字：优先「练得少/星级低」的字，按册顺序取
     册顺序由 semScanOrder() 决定：当前册优先，再往前面的册补；同一个字只取一次 */
  function pickDailyChars(n) {
    var cand = [];
    var cur = w.HZ_CURRICULUM;
    if (!cur) return [];
    var order = semScanOrder();
    var seen = {};
    outer:
    for (var si = 0; si < order.length; si++) {
      var sem = cur[order[si]];
      if (!sem) continue;
      for (var ui = 0; ui < sem.units.length; ui++) {
        var u = sem.units[ui];
        for (var li = 0; li < u.lessons.length; li++) {
          var L = u.lessons[li];
          for (var ci = 0; ci < L.chars.length; ci++) {
            var ch = L.chars[ci];
            // 同一个字在多册出现时只保留第一次（当前册优先）
            if (seen[ch]) continue;
            seen[ch] = 1;
            var st = S.chars[ch];
            if (!st || st.s < 3) cand.push({ ch: ch, w: st ? (3 - st.s) * 10 + Math.min(9, st.n) : 60, lesson: L });
            if (cand.length > 260) break outer;
          }
        }
      }
    }
    cand.sort(function (a, b) { return b.w - a.w; });
    var out = [];
    for (var k = 0; k < cand.length && out.length < n; k++) out.push(cand[k]);
    // 不足时用「当前册 + 之前的册」的全部生字补足（不再写死 1a/1b）
    if (out.length < n) {
      var got = {};
      for (var g = 0; g < out.length; g++) got[out[g].ch] = 1;
      var back = semBackOrder();
      for (var bi = 0; bi < back.length && out.length < n; bi++) {
        var fb = cur[back[bi]];
        if (!fb) continue;
        for (var bu = 0; bu < fb.units.length && out.length < n; bu++) {
          for (var bl = 0; bl < fb.units[bu].lessons.length && out.length < n; bl++) {
            for (var bc = 0; bc < fb.units[bu].lessons[bl].chars.length && out.length < n; bc++) {
              var ech = fb.units[bu].lessons[bl].chars[bc];
              if (got[ech]) continue;
              got[ech] = 1;
              out.push({ ch: ech, w: 1, lesson: null });
            }
          }
        }
      }
    }
    return out.slice(0, n);
  }

  var SEM_ORDER = ['1a', '1b', '2a', '2b', '3a', '3b', '4a', '4b', '5a', '5b', '6a', '6b'];

  w.Store = {
    load: load, save: save, reset: reset,
    get state() { return S; },
    PETS: PETS, SEM_ORDER: SEM_ORDER,
    MAX_CHECKIN_DAYS: MAX_CHECKIN_DAYS, FEED_COST: FEED_COST, FEED_PER_STAGE: FEED_PER_STAGE,
    today: today,
    addCoins: addCoins, addStars: addStars, log: log,
    markChar: markChar, charState: charState, isCharDone: isCharDone,
    markLesson: markLesson, lessonState: lessonState, lessonDoneChars: lessonDoneChars,
    getSetting: function (k) { return S && S.settings ? S.settings[k] : undefined; },
    setSetting: function (k, v) { if (S && S.settings) { S.settings[k] = v; save(); } return v; },
    currentSem: currentSem, semBackOrder: semBackOrder,
    customName: customName, setCustomName: setCustomName,
    pet: pet, petKind: petKind, petStageName: petStageName, petNeed: petNeed,
    feed: feed, switchPet: switchPet,
    checkin: checkin, checkinAddChar: checkinAddChar, checkinClaim: checkinClaim, checkinDoneToday: checkinDoneToday,
    pickDailyChars: pickDailyChars
  };
})(window);
