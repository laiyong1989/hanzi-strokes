/* ================================================================
   hanzi.js — 楷体笔锋渲染 / 笔顺动画 / 手写轨迹判定
   字形轮廓数据：Make Me a Hanzi（Arphic Public License）
   坐标：1024×1024 字身框，y 轴向上（渲染时翻转）
   ================================================================ */
(function (w) {
  'use strict';

  var BOX = 1024, BASE = 900;           // 基线：数据 y=0 落在 viewBox y=900
  var SPEED = 1;                        // 笔顺演示速度倍率：>1 更慢，<1 更快（1 = 正常）
  function spd(ms) { return Math.max(30, Math.round((ms || 0) * SPEED)); }
  var LOADED = {};                      // 已加载的册
  var semOf = {};                       // 字 -> 册
  var CHAR_BOX = {};

  function buildIndex() {
    var cur = w.HZ_CURRICULUM; if (!cur) return;
    Object.keys(cur).forEach(function (sid) {
      cur[sid].units.forEach(function (u) {
        u.lessons.forEach(function (L) {
          L.chars.forEach(function (c) {
            if (!semOf[c]) semOf[c] = sid;
            if (!CHAR_BOX[c]) CHAR_BOX[c] = { lesson: L.name, sem: sid, unit: u.name };
          });
        });
      });
    });
  }
  function whereIs(ch) { return CHAR_BOX[ch] || null; }

  function loadSem(sid) {
    if (LOADED[sid]) return Promise.resolve();
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = 'data/strokes/' + sid + '.js';
      sc.onload = function () { LOADED[sid] = true; res(); };
      sc.onerror = function () { rej(new Error('字帖加载失败：' + sid)); };
      document.head.appendChild(sc);
    });
  }
  function loadChar(ch) {
    var sid = semOf[ch];
    if (!sid) return Promise.reject(new Error('没有这个字：' + ch));
    return loadSem(sid);
  }
  function dataOf(ch) {
    var sid = semOf[ch];
    if (!sid || !w.HZ_STROKES || !w.HZ_STROKES[sid]) return null;
    return w.HZ_STROKES[sid][ch] || null;
  }

  /* ---------------- 坐标工具 ---------------- */
  function medianScreen(pts) {                 // 数据坐标 -> viewBox 坐标
    return pts.map(function (p) { return [p[0], BASE - p[1]]; });
  }
  function polyLen(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      L += Math.sqrt(dx * dx + dy * dy);
    }
    return L;
  }
  function resample(pts, n) {
    if (pts.length < 2) return pts.slice();
    var total = polyLen(pts), out = [pts[0].slice()], step = total / (n - 1), acc = 0, i = 1, prev = pts[0];
    while (out.length < n && i < pts.length) {
      var seg = Math.sqrt(Math.pow(pts[i][0] - prev[0], 2) + Math.pow(pts[i][1] - prev[1], 2));
      if (acc + seg >= step) {
        var t = (step - acc) / (seg || 1);
        var np = [prev[0] + (pts[i][0] - prev[0]) * t, prev[1] + (pts[i][1] - prev[1]) * t];
        out.push(np); prev = np; acc = 0;
      } else { acc += seg; prev = pts[i]; i++; }
    }
    while (out.length < n) out.push(pts[pts.length - 1].slice());
    return out;
  }

  /* ---------------- 判定 ---------------- */
  var TH = { mean: 132, start: 178, end: 190, dir: 0.50, lenLo: 0.42, lenHi: 2.3 };

  function scoreStroke(user, refMed) {
    if (!refMed || !refMed.length) return null;
    var ref = medianScreen(refMed);
    if (!user || user.length < 2 || ref.length < 2) return null;
    var uL = polyLen(user), rL = polyLen(ref);
    if (uL < 28) return null;
    var u = resample(user, 14), r = resample(ref, 14);
    var sum = 0, mx = 0, i;
    for (i = 0; i < u.length; i++) {
      var d = Math.sqrt(Math.pow(u[i][0] - r[i][0], 2) + Math.pow(u[i][1] - r[i][1], 2));
      sum += d; if (d > mx) mx = d;
    }
    var mean = sum / u.length;
    var d0 = Math.sqrt(Math.pow(u[0][0] - r[0][0], 2) + Math.pow(u[0][1] - r[0][1], 2));
    var d1 = Math.sqrt(Math.pow(u[13][0] - r[13][0], 2) + Math.pow(u[13][1] - r[13][1], 2));
    var uv = [u[13][0] - u[0][0], u[13][1] - u[0][1]], rv = [r[13][0] - r[0][0], r[13][1] - r[0][1]];
    var ul = Math.sqrt(uv[0] * uv[0] + uv[1] * uv[1]) || 1, rl = Math.sqrt(rv[0] * rv[0] + rv[1] * rv[1]) || 1;
    var cos = (uv[0] * rv[0] + uv[1] * rv[1]) / (ul * rl);
    var lenRatio = uL / (rL || 1);
    var ok = (mean < TH.mean) && (d0 < TH.start) && (d1 < TH.end) && (cos > TH.dir) &&
             (lenRatio > TH.lenLo) && (lenRatio < TH.lenHi);
    var score = Math.max(0, 1 - mean / (TH.mean * 1.5)) * .45 +
                Math.max(0, cos) * .30 +
                Math.max(0, 1 - Math.abs(1 - lenRatio) / .7) * .15 +
                Math.max(0, 1 - d0 / (TH.start * 1.4)) * .10;
    return { ok: ok, score: score, mean: mean, cos: cos, lenRatio: lenRatio, d0: d0,
             mx: mx, dir: strokeDirName(u) };
  }

  /* 依据轨迹走向粗略判断笔画名称（仅作提示用） */
  function strokeDirName(pts) {
    var a = pts[0], b = pts[pts.length - 1];
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ang = Math.atan2(dy, dx) * 180 / Math.PI;   // y 向下为正
    var seg = polyLen(pts) / 1024;
    if (seg < 0.16) return '点';
    if (ang > -25 && ang <= 25) return '横';
    if (ang > 25 && ang <= 65) return '捺';     // 向左下? 不：y 向下为正，25~65° 是向右下 = 捺
    if (ang > 65 && ang <= 115) return '竖';
    if (ang > 115 && ang <= 180) return '撇';
    if (ang < -115 || ang > 180) return '撇';
    if (ang < -65 && ang >= -115) return '竖';
    if (ang < -25 && ang >= -65) return '提';
    return '笔画';
  }

  /* ---------------- SVG 渲染 ---------------- */
  function svgEl(d, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', d);
    for (var k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    return e;
  }
  function gridGroup(opt) {
    opt = opt || {};
    var g = svgEl('g', { class: 'gridg' });
    var c = opt.color || '#F3B0AE';
    var c2 = opt.color2 || '#F7CFCE';
    g.appendChild(svgEl('rect', { x: 12, y: 12, width: BOX - 24, height: BOX - 24, rx: 26, ry: 26,
      fill: 'none', stroke: c, 'stroke-width': 7 }));
    var d = [];
    d.push('M512 12 L512 1012'); d.push('M12 512 L1012 512');
    d.push('M12 12 L1012 1012'); d.push('M1012 12 L12 1012');
    g.appendChild(svgEl('path', { d: d.join(' '), stroke: c2, 'stroke-width': 4,
      'stroke-dasharray': '16 18', fill: 'none', 'stroke-linecap': 'round' }));
    return g;
  }
  function newId() { return 'hz' + Math.random().toString(36).slice(2, 9); }

  /* 把字形（轮廓）加入一个 g；revealed = 已完成的笔画下标集合 */
  function appendGlyph(g, ch, opt) {
    opt = opt || {};
    var data = dataOf(ch);
    if (!data) return [];
    var paths = [];
    var fillAll = opt.fill || '#2F2F3D';
    var fillGhost = opt.ghost || '#ECE8E0';
    for (var i = 0; i < data.s.length; i++) {
      var isDone = !opt.doneSet || opt.doneSet.indexOf(i) >= 0 || opt.allSolid;
      var p = svgEl('path', {
        d: data.s[i],
        fill: isDone ? fillAll : fillGhost,
        opacity: isDone ? 1 : (opt.ghostOpacity || 1)
      });
      p.setAttribute('data-si', i);
      g.appendChild(p);
      paths.push(p);
    }
    return paths;
  }

  /* 单字静态 SVG（用于字表格子） */
  function staticSvg(ch, opt) {
    opt = opt || {};
    var s = svgEl('svg', { viewBox: '0 0 ' + BOX + ' ' + BOX, preserveAspectRatio: 'xMidYMid meet' });
    var data = dataOf(ch);
    var g = svgEl('g', { transform: 'translate(0,' + BASE + ') scale(1,-1)' });
    if (data) {
      var solid = !!opt.solid || Store.isCharDone(ch);
      for (var i = 0; i < data.s.length; i++) {
        g.appendChild(svgEl('path', { d: data.s[i], fill: opt.fill || (solid ? '#2F2F3D' : '#C9C6BE') }));
      }
    } else {
      var t = svgEl('text', { x: 512, y: 700, 'text-anchor': 'middle', 'font-size': 620,
        fill: '#C9C6BE', 'font-family': 'Kaiti SC, KaiTi, STKaiti, serif' });
      t.textContent = ch;
      g.appendChild(t);
      g.setAttribute('transform', 'translate(0,0) scale(1,1)');
    }
    s.appendChild(g);
    return s;
  }

  /* ---------------- 笔顺动画 ---------------- */
  /* 祖先链上是否已有 y 翻转（数据坐标 -> viewBox） */
  function isFlipped(el) {
    var n = el;
    while (n && n.getAttribute) {
      var t = n.getAttribute('transform') || '';
      if (/scale\(\s*1\s*,\s*-1\s*\)/.test(t)) return true;
      n = n.parentNode;
    }
    return false;
  }

  function animateStroke(g, ch, idx, opt) {
    opt = opt || {};
    var data = dataOf(ch); if (!data) return Promise.resolve();
    /* 中线必须用「数据坐标」（y 向上为正）：clipPath 用 data.s[idx]（同为数据坐标），
       两者都在外层 g 的 scale(1,-1) 翻转组内被一次性翻正。若这里再用 medianScreen()
       转成 viewBox 坐标，就会被翻转两次 —— 笔刷沿上下镜像的轨迹推进，笔画看起来
       从下往上写（如「上」的竖倒着走）。 */
    var med = data.m[idx] || [];
    var flip = isFlipped(g);
    var inner = flip ? g : svgEl('g', { transform: 'translate(0,' + BASE + ') scale(1,-1)' });
    // 演示速度：固定时长与「按笔画长度推算的时长」都乘速度倍率
    var dur = spd(opt.dur || (240 + Math.min(560, polyLen(med) * 0.55)));
    var id = newId();
    var clip = svgEl('clipPath', { id: id });
    clip.appendChild(svgEl('path', { d: data.s[idx] }));
    var defs = svgEl('defs'); defs.appendChild(clip);

    var dstr = 'M' + med.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    var L = polyLen(med) + 60;
    var wrap = svgEl('g', {});
    var brush = svgEl('path', {
      d: dstr, fill: 'none', stroke: opt.color || '#2F2F3D',
      'stroke-width': opt.width || 300, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'stroke-dasharray': L, 'stroke-dashoffset': L
    });
    var clipped = svgEl('g', { 'clip-path': 'url(#' + id + ')' });
    clipped.appendChild(brush);
    var startDot = null;
    if (opt.dot) {
      startDot = svgEl('circle', { cx: med[0][0], cy: med[0][1], r: 52, fill: opt.dotColor || '#FF8FA3', opacity: .9 });
      startDot.appendChild(svgEl('animate', { attributeName: 'r', values: '40;62;40', dur: '1s', repeatCount: 'indefinite' }));
      wrap.appendChild(startDot);
    }
    wrap.appendChild(defs); wrap.appendChild(clipped);
    if (flip) g.appendChild(wrap);
    else { inner.appendChild(wrap); g.appendChild(inner); }

    var t0 = null, finished = false;
    return new Promise(function (res) {
      function finish() {
        if (finished) return;
        finished = true;
        if (startDot && startDot.parentNode) startDot.parentNode.removeChild(startDot);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (!flip && inner.parentNode) inner.parentNode.removeChild(inner);
        if (opt.onEnd) opt.onEnd();
        res();
      }
      function step(ts) {
        if (finished) return;
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        brush.setAttribute('stroke-dashoffset', (L * (1 - e)).toFixed(1));
        if (p < 1) requestAnimationFrame(step);
        else finish();
      }
      requestAnimationFrame(step);
      // 兜底：标签页切到后台时 rAF 会暂停，这里保证动画状态一定能收尾
      setTimeout(finish, dur + 600);
    });
  }

  /* 逐笔演示整字 */
  function playChar(g, ch, opt) {
    opt = opt || {};
    var data = dataOf(ch); if (!data) return Promise.resolve();
    return new Promise(function (res) {
      var i = 0;
      var tmp = svgEl('g', {});
      g.appendChild(tmp);
      function next() {
        if (i >= data.s.length || (opt.stop && opt.stop())) {
          if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
          if (opt.onEnd) opt.onEnd();
          return res();
        }
        animateStroke(tmp, ch, i, {
          color: opt.color || '#2F2F3D', width: opt.width || 300, dur: opt.dur,
          onEnd: function () {
            if (opt.onStroke) opt.onStroke(i);
            i++;
            setTimeout(next, spd(opt.gap === undefined ? 140 : opt.gap));
          }
        });
      }
      next();
    });
  }

  /* ---------------- 手写练习 ---------------- */
  function createPractice(cfg) {
    var svg = cfg.svg, canvas = cfg.canvas, ch = cfg.char, stage = cfg.stage;
    var data = dataOf(ch);
    if (!data) return null;
    var P = {
      ch: ch, mode: cfg.mode || 'trace', idx: 0, mistakes: 0, hints: 0,
      inkStrokes: [], cur: null, drawing: false, locked: false,
      onStroke: cfg.onStroke || function () { },
      onDone: cfg.onDone || function () { }
    };
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(2.5, w.devicePixelRatio || 1);
    var CW = 0, CH = 0;                   // canvas 的 CSS 尺寸（与 svg 完全重合）
    var VBX = 0, VBY = 0, VBS = 1;        // 1024×1024 字身框实际落在 canvas 内的偏移与缩放

    /* SVG 用的是 preserveAspectRatio="xMidYMid meet"：当格子不是正方形时，字身框会被
       居中留白。这里把「字身框在 canvas 中的真实矩形」算出来，手写轨迹和描红才不会错开。 */
    function measure() {
      var r = canvas.getBoundingClientRect();
      CW = r.width; CH = r.height;
      VBS = (CW && CH) ? Math.min(CW / BOX, CH / BOX) : 1;
      VBX = (CW - BOX * VBS) / 2;
      VBY = (CH - BOX * VBS) / 2;
    }
    /* 画布像素 <-> viewBox 坐标（唯一换算入口，别处不再各自缩放） */
    function toVB(px, py) { return [(px - VBX) / VBS, (py - VBY) / VBS]; }
    function toPx(vx, vy) { return [VBX + vx * VBS, VBY + vy * VBS]; }

    function resize() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;   // 页面还没显示（rect 为 0），等显示后再量
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
      redrawInk();
      return true;
    }
    P.resize = resize;

    /* ---- SVG 内容 ---- */
    function paint() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(gridGroup());
      var g = svgEl('g', { transform: 'translate(0,' + BASE + ') scale(1,-1)' });
      var ghost = P.mode === 'write' ? '#F7F4EE' : '#D6CFC4';   // 描红底字：比纸深、比墨迹浅，便于照着描
      for (var i = 0; i < data.s.length; i++) {
        var p = svgEl('path', { d: data.s[i], fill: i < P.idx ? '#2F2F3D' : ghost });
        p.setAttribute('data-si', i);
        g.appendChild(p);
      }
      svg.appendChild(g);
      P._glyph = g;
    }
    P.paint = paint;

    /* ---- 画布 ----
       约定：所有笔迹点一律存 viewBox 坐标（1024 空间），只在真正落笔时才换算成画布像素。
       以前这里混用了「像素」和「viewBox」两套坐标，绘制时被乘了两次缩放，墨迹会缩到左上角。 */
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function redrawInk() {
      ctx.clearRect(0, 0, CW || canvas.width, CH || canvas.height);
      P.inkStrokes.forEach(function (s) { drawStroke(s.pts, s.solid); });
      if (P.cur) drawStroke(P.cur, false);
    }
    function drawStroke(pts, solid) {          // pts：viewBox 坐标
      if (!pts || pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = solid ? '#2E4A8B' : '#31435F';
      ctx.globalAlpha = solid ? 1 : .96;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var seg = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));   // viewBox 长度
        var base = 19 * VBS;
        var wdt = base * Math.max(0.58, Math.min(1.22, 1.34 - seg / 46));
        var A = toPx(a[0], a[1]), B = toPx(b[0], b[1]);
        ctx.lineWidth = wdt;
        ctx.beginPath();
        ctx.moveTo(A[0], A[1]);
        ctx.lineTo(B[0], B[1]);
        ctx.stroke();
      }
      ctx.restore();
    }

    var activeId = null;
    function down(e) {
      if (P.locked) return;
      if (activeId !== null && e.pointerId !== activeId) return;   // 防误触（手掌）
      activeId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      P.drawing = true;
      var p0 = pos(e);
      P.cur = [toVB(p0[0], p0[1])];
      e.preventDefault();
    }
    function move(e) {
      if (!P.drawing || e.pointerId !== activeId) return;
      var p = pos(e), last = P.cur[P.cur.length - 1];
      var lp = toPx(last[0], last[1]);
      var dx = p[0] - lp[0], dy = p[1] - lp[1];
      if (dx * dx + dy * dy < 4) return;                 // 抖动阈值按屏幕像素算
      P.cur.push(toVB(p[0], p[1]));
      drawStroke(P.cur.slice(-3), false);
      e.preventDefault();
    }
    function up(e) {
      if (!P.drawing || (activeId !== null && e.pointerId !== activeId)) return;
      P.drawing = false; activeId = null;
      var pts = P.cur; P.cur = null;
      if (!pts || pts.length < 3) { redrawInk(); return; }
      if (polyLen(pts) < 40) { redrawInk(); return; }    // 误触（pts 已是 viewBox 坐标）
      judge(pts);
    }
    function blockTouch(e) { e.preventDefault(); }
    var HANDLERS = [
      ['pointerdown', down, { passive: false }],
      ['pointermove', move, { passive: false }],
      ['pointerup', up, false],
      ['pointercancel', up, false],
      ['touchstart', blockTouch, { passive: false }]
    ];
    HANDLERS.forEach(function (h) { canvas.addEventListener(h[0], h[1], h[2]); });
    /* 换字时必须注销，否则同一个 canvas 上会叠加两组监听，一笔被判定两次 */
    P.destroy = function () {
      HANDLERS.forEach(function (h) { canvas.removeEventListener(h[0], h[1], h[2]); });
      if (P._ro) { try { P._ro.disconnect(); } catch (err) { } P._ro = null; }
    };
    /* 尺寸变化（旋屏、地址栏收放、页面刚显示）自动重新量，避免量到 0 导致墨迹缩在角上 */
    if (w.ResizeObserver) {
      P._ro = new w.ResizeObserver(function () { resize(); });
      P._ro.observe(canvas);
    }

    function judge(userVB) {
      if (!userVB || userVB.length < 2) return;
      if (P.idx >= data.s.length) { redrawInk(); return; }   // 已写完，忽略多余笔画
      var cur = P.idx;
      var resCur = scoreStroke(userVB, data.m[cur]);
      var best = null, bestI = -1;
      for (var i = 0; i < data.s.length; i++) {
        var r = scoreStroke(userVB, data.m[i]);
        if (r && r.ok && (!best || r.score > best.score)) { best = r; bestI = i; }
      }
      var accept = resCur && resCur.ok;
      P.inkStrokes.push({ pts: userVB.slice(), solid: accept, vb: userVB });
      redrawInk();

      if (accept) {
        P.idx++;
        paint();                                   // 写对的笔画在字帖上层层「亮」起来
        P.onStroke({ type: 'ok', idx: cur, dir: resCur.dir, name: data.s.length });
        if (P.idx >= data.s.length) {
          P.locked = true;
          setTimeout(function () { P.onDone({ mistakes: P.mistakes, hints: P.hints, total: data.s.length }); }, 420);
        }
      } else if (best && bestI !== cur) {
        P.mistakes++;
        P.onStroke({ type: 'order', idx: cur, got: bestI, dir: best.dir });
      } else {
        P.mistakes++;
        P.onStroke({ type: 'miss', idx: cur });
      }
    }
    P.judge = judge;

    P.removeLast = function () {                 // 擦掉最后一笔（用户手动）
      if (!P.inkStrokes.length) return;
      var last = P.inkStrokes.pop();
      if (last.solid && P.idx > 0) P.idx--;
      P.locked = false;
      redrawInk(); paint();
    };
    P.clearInk = function (all) {
      P.inkStrokes = []; P.cur = null;
      if (all) { P.idx = 0; P.locked = false; }
      redrawInk(); paint();
    };
    /* 判定失败时闪一下并清除这一笔 */
    P.flashWrong = function (cb) {
      var last = P.inkStrokes[P.inkStrokes.length - 1];
      if (!last) return cb && cb();
      var n = 0;
      var timer = setInterval(function () {
        redrawInk();
        if (n % 2 === 0) {
          ctx.save();
          ctx.strokeStyle = '#FF6B6B'; ctx.lineWidth = Math.max(6, 15 * VBS);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          last.pts.forEach(function (p, i) {
            var q = toPx(p[0], p[1]);
            i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
          });
          ctx.stroke(); ctx.restore();
        }
        if (++n > 5) {
          clearInterval(timer);
          P.inkStrokes.pop();
          redrawInk();
          cb && cb();
        }
      }, 130);
    };
    P.hint = function () {                       // 演示下一笔（黄色高亮 + 笔尖动画）
      P.hints++;
      var ghost = P.mode === 'write' ? '#F7F4EE' : '#D6CFC4';   // 描红底字：比纸深、比墨迹浅，便于照着描
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(gridGroup());
      var wrap = svgEl('g', { transform: 'translate(0,' + BASE + ') scale(1,-1)' });
      for (var i = 0; i < data.s.length; i++) {
        if (i === P.idx) continue;
        wrap.appendChild(svgEl('path', {
          d: data.s[i],
          fill: i < P.idx ? '#2F2F3D' : ghost,
          opacity: i < P.idx ? 1 : .45
        }));
      }
      svg.appendChild(wrap);
      var cur = svgEl('g', { transform: 'translate(0,' + BASE + ') scale(1,-1)' });
      svg.appendChild(cur);
      return animateStroke(cur, ch, P.idx, { color: '#FFA94D', width: 300, dot: true })
        .then(function () {
          // 500ms 后恢复真实状态
          return new Promise(function (r) { setTimeout(function () { paint(); r(); }, 480); });
        });
    };
    P.demo = function () {
      var wrap = svgEl('g', { transform: 'translate(0,' + BASE + ') scale(1,-1)' });
      var shown = [];
      svg.appendChild(wrap);
      return playChar(wrap, ch, {
        color: '#2F2F3D',
        onStroke: function (i) { shown.push(i); },
        gap: 120
      });
    };
    P.setMode = function (m) { P.mode = m; paint(); redrawInk(); };
    P.index = function () { return P.idx; };
    P.total = data.s.length;
    P.totalStrokes = data.s.length;  return P;
  }

  buildIndex();
  w.HZ = {
    BOX: BOX, BASE: BASE,
    loadSem: loadSem, loadChar: loadChar, dataOf: dataOf,
    setSpeed: function (m) { SPEED = Math.min(4, Math.max(0.3, Number(m) || 1)); return SPEED; },
    getSpeed: function () { return SPEED; },
    staticSvg: staticSvg, gridGroup: gridGroup, svgEl: svgEl,
    appendGlyph: appendGlyph, animateStroke: animateStroke, playChar: playChar,
    createPractice: createPractice, scoreStroke: scoreStroke,
    whereIs: whereIs, medianScreen: medianScreen, polyLen: polyLen, resample: resample,
    loadedSem: function (sid) { return !!LOADED[sid]; }
  };
})(window);
