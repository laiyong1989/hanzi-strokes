/* 笔顺数据体检：从几何反推每笔的类型/位置/包围盒，再按规则找可疑项。
   只读分析，不修改任何数据文件。输出报告到 .build/order-report.json */
const fs = require('fs');
const A = JSON.parse(fs.readFileSync(__dirname + '/strokes.json', 'utf8'));
const BASE = 900;                 // 数据 y 向上为正 -> 屏幕 y = BASE - y

function plen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i-1][0], p[i][1] - p[i-1][1]); return s; }
function scr(p) { return p.map(q => [q[0], BASE - q[1]]); }
function nums(d) { const m = d.match(/-?\d+(?:\.\d+)?/g) || []; const r = []; for (let i = 0; i + 1 < m.length; i += 2) r.push([+m[i], +m[i+1]]); return r; }
function bb(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { l: x0, t: y0, r: x1, b: y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
function typeOf(dx, dy, straight, len) {
  if (len < 0.10 * 1024) return '点';
  if (!straight || straight < 0.9) return '折';
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  if (Math.abs(ang) <= 25) return '横';
  if (ang > 25 && ang <= 62) return '捺';
  if (ang > 62 && ang <= 118) return '竖';
  if (ang > 118) return '撇';
  if (ang >= -78 && ang < -25) return '提';      // 三点水的提很陡，约 -60°~-75°
  if (ang >= -102 && ang < -78) return '上竖';
  return '上撇';                     // <-102：向左上（异常）
}
function analyze(ch, d) {
  const st = [];
  for (let i = 0; i < d.m.length; i++) {
    const sp = scr(d.m[i]);
    const a = sp[0], b = sp[sp.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = plen(sp);
    const straight = len ? Math.hypot(dx, dy) / len : 0;
    const box = bb(nums(d.s[i]).map(q => [q[0], BASE - q[1]]));
    st.push({
      i, a, b, dx, dy, len, straight, box,
      ang: Math.round(Math.atan2(dy, dx) * 180 / Math.PI),
      type: typeOf(dx, dy, straight, len)
    });
  }
  const whole = bb(st.map(s => [s.box.l, s.box.t]).concat(st.map(s => [s.box.r, s.box.b])));
  return { ch, n: st.length, st, box: whole };
}

const seen = new Set(), chars = [];
for (const sem of Object.keys(A)) for (const ch of Object.keys(A[sem])) {
  if (seen.has(ch)) continue; seen.add(ch);
  chars.push(analyze(ch, A[sem][ch]));
}

/* ---------- R1：单笔方向异常（直笔才有确定方向） ---------- */
const R1 = [];
for (const c of chars) for (const s of c.st) {
  if (s.len < 0.18 * 1024 || s.straight < 0.93) continue;   // 只看够长且笔直的笔画
  let bad = null;
  if (s.type === '横' && s.dx < 0) bad = '横画从右往左';
  else if (s.type === '竖' && s.dy < 0) bad = '竖画从下往上';
  else if (s.type === '上竖') bad = '竖直向上（倒置）';
  else if (s.type === '撇' && s.dy < 0) bad = '撇向左上（应为左下）';
  else if (s.type === '上撇') bad = '直笔向左上（异常方向）';
  else if (s.type === '捺' && s.dx < 0) bad = '捺向左下（应为右下）';
  else if (s.type === '提' && s.dx < 0) bad = '提向左上（应为右上）';
  if (bad) R1.push({ ch: c.ch, i: s.i + 1, n: c.n, bad, ang: s.ang, type: s.type,
    from: s.a.map(v => Math.round(v)), to: s.b.map(v => Math.round(v)) });
}

/* ---------- R2：底部长横不是最后一笔 ---------- */
const R2 = [];
for (const c of chars) {
  const hs = c.st.filter(s => s.type === '横' && s.len > 0.42 * 1024);
  if (!hs.length) continue;
  const low = hs.reduce((m, s) => (s.box.cy > m.box.cy ? s : m));
  const isLowest = c.st.every(s => s.box.b <= low.box.b + 40);
  if (isLowest && low.i !== c.n - 1) R2.push({ ch: c.ch, n: c.n, at: low.i + 1,
    y: Math.round(low.box.cy), seq: c.st.map(s => s.type).join('') });
}

/* ---------- R3：后一笔整体在上一笔上方（可能违反从上到下） ---------- */
const R3 = [];
function ovl(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
for (const c of chars) {
  for (let i = 1; i < c.st.length; i++) {
    const p = c.st[i - 1], q = c.st[i];
    const gap = p.box.t - q.box.b;                              // 后一笔整体高出多少
    if (gap <= 0.12 * 1024) continue;
    const ho = ovl(p.box.l, p.box.r, q.box.l, q.box.r) / Math.min(p.box.w, q.box.w || 1);
    if (ho < 0.3) continue;                                     // 水平不重叠：属于左右部件交替，不算上下逆序
    R3.push({ ch: c.ch, n: c.n, from: i, to: i + 1, gap: Math.round(gap),
      seq: c.st.map(s => s.type).join(''), py: Math.round(p.box.cy), qy: Math.round(q.box.cy) });
  }
}

/* ---------- R4：后一笔整体在上一笔左侧（可能违反从左到右） ---------- */
const R4 = [];
for (const c of chars) {
  for (let i = 1; i < c.st.length; i++) {
    const p = c.st[i - 1], q = c.st[i];
    const gap = p.box.l - q.box.r;                              // 后一笔整体偏左多少
    if (gap <= 0.10 * 1024) continue;
    const vo = ovl(p.box.t, p.box.b, q.box.t, q.box.b) / Math.min(p.box.h || 1, q.box.h || 1);
    if (vo < 0.3) continue;                                     // 垂直不重叠：属于上下部件交替，不算左右逆序
    R4.push({ ch: c.ch, n: c.n, from: i, to: i + 1, gap: Math.round(gap),
      seq: c.st.map(s => s.type).join(''), px: Math.round(p.box.cx), qx: Math.round(q.box.cx) });
  }
}

/* ---------- R5：轮廓 s[i] 与中线 m[i] 是否配对（中线应落在该笔轮廓内） ---------- */
const R5 = [];
for (const c of chars) for (const s of c.st) {
  const inside = s.a[0] > s.box.l - 60 && s.a[0] < s.box.r + 60 && s.a[1] > s.box.t - 60 && s.a[1] < s.box.b + 60;
  const inside2 = s.b[0] > s.box.l - 60 && s.b[0] < s.box.r + 60 && s.b[1] > s.box.t - 60 && s.b[1] < s.box.b + 60;
  if (!inside || !inside2) R5.push({ ch: c.ch, i: s.i + 1, n: c.n,
    a: s.a.map(v => Math.round(v)), b: s.b.map(v => Math.round(v)),
    box: [Math.round(s.box.l), Math.round(s.box.t), Math.round(s.box.r), Math.round(s.box.b)] });
}

const out = { total: chars.length, R1, R2, R3, R4, R5,
  chars: chars.map(c => ({ ch: c.ch, n: c.n, seq: c.st.map(s => s.type).join(''),
    st: c.st.map(s => ({ i: s.i + 1, t: s.type, a: s.a.map(v => Math.round(v)), b: s.b.map(v => Math.round(v)),
      l: Math.round(s.box.l), t2: Math.round(s.box.t), r: Math.round(s.box.r), b2: Math.round(s.box.b) })) })) };
fs.writeFileSync(__dirname + '/order-report.json', JSON.stringify(out));

const L = [];
const p = s => L.push(s);
p('总字数（去重）: ' + chars.length);
p('R1 单笔方向异常: ' + R1.length + (R1.length ? '  ' + R1.slice(0, 40).map(x => x.ch + '#' + x.i + x.bad).join(' ') : ''));
p('R2 底长横不在最后: ' + R2.length + (R2.length ? '  ' + R2.slice(0, 40).map(x => x.ch + '(' + x.at + '/' + x.n + ')').join(' ') : ''));
p('R3 后笔整体在上: ' + R3.length);
p('R4 后笔整体在左: ' + R4.length);
p('R5 轮廓与中线不配对: ' + R5.length + (R5.length ? '  ' + R5.slice(0, 30).map(x => x.ch + '#' + x.i).join(' ') : ''));
console.log(L.join('\n'));
