/* 检视指定字的笔顺：输出「笔画类型 + 该笔在字内的九宫格位置」，用于人工核对规范。
   用法： node .build/inspect.js 方火九乃...     （或 node .build/inspect.js --file 字表.txt）
   只读，不修改数据。 */
const fs = require('fs');
const A = JSON.parse(fs.readFileSync(__dirname + '/strokes.json', 'utf8'));
const BASE = 900;
const CH = {};
for (const sem of Object.keys(A)) for (const ch of Object.keys(A[sem])) if (!CH[ch]) CH[ch] = A[sem][ch];

function plen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i-1][0], p[i][1] - p[i-1][1]); return s; }
function scr(p) { return p.map(q => [q[0], BASE - q[1]]); }
function nums(d) { const m = d.match(/-?\d+(?:\.\d+)?/g) || []; const r = []; for (let i = 0; i + 1 < m.length; i += 2) r.push([+m[i], +m[i+1]]); return r; }
function bb(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { l: x0, t: y0, r: x1, b: y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }; }

const DIRN = ['右', '右下', '下', '左下', '左', '左上', '上', '右上'];
function dirName(dx, dy) {
  let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < 0) a += 360;
  return DIRN[Math.round(a / 45) % 8];
}
/* 把一条中线拆成「首段 / 中段 / 末段」，判断是直笔还是折笔 */
function seg(pts) {
  const n = pts.length; if (n < 2) return { a: [0, 0], b: [0, 0], mid: [0, 0] };
  const i1 = Math.max(1, Math.round(n * 0.3)), i2 = Math.min(n - 1, Math.round(n * 0.7));
  return { a: [pts[i1][0] - pts[0][0], pts[i1][1] - pts[0][1]],
           mid: [pts[i2][0] - pts[i1][0], pts[i2][1] - pts[i1][1]],
           b: [pts[n-1][0] - pts[i2][0], pts[n-1][1] - pts[i2][1]] };
}
function strokeType(sp, len) {
  const a = sp[0], b = sp[sp.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const straight = len ? Math.hypot(dx, dy) / len : 0;
  if (len < 0.085 * 1024) return '点';
  const s = seg(sp);
  const da = dirName(s.a[0], s.a[1]), db = dirName(s.b[0], s.b[1]), dm = dirName(s.mid[0], s.mid[1]);
  if (straight > 0.94 && (da === db || da === dm)) {
    if (da === '右') return '横'; if (da === '下') return '竖';
    if (da === '左下') return '撇'; if (da === '右下') return '捺';
    if (da === '右上') return '提'; if (da === '上') return '倒竖';
    if (da === '左') return '倒横'; if (da === '左上') return '倒撇';
    return da;
  }
  return da + '折' + db;
}
function cell(cx, cy, box) {
  const gx = cx < box.l + box.w / 3 ? 0 : (cx < box.l + box.w * 2 / 3 ? 1 : 2);
  const gy = cy < box.t + box.h / 3 ? 0 : (cy < box.t + box.h * 2 / 3 ? 1 : 2);
  return '123456789'[gy * 3 + gx];
}
function describe(ch) {
  const d = CH[ch]; if (!d) return ch + ': 无数据';
  const st = [];
  for (let i = 0; i < d.m.length; i++) {
    const sp = scr(d.m[i]);
    st.push({ sp, len: plen(sp), box: bb(nums(d.s[i]).map(q => [q[0], BASE - q[1]])) });
  }
  const all = [];
  for (const s of st) all.push([s.box.l, s.box.t], [s.box.r, s.box.b]);
  const box = bb(all);
  return ch + '(' + st.length + ') ' + st.map((s, i) =>
    (i + 1) + strokeType(s.sp, s.len) + '@' + cell(s.box.cx, s.box.cy, box)).join(' ');
}

let chars = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (chars.length === 1 && /^--file$/.test(process.argv[2])) chars = fs.readFileSync(process.argv[3], 'utf8').trim().split(/\s+/);
if (!chars.length) { console.log('用法: node .build/inspect.js 上 方 火 ...'); process.exit(0); }
const miss = [];
const lines = chars.map(c => { if (!CH[c]) { miss.push(c); return null; } return describe(c); }).filter(Boolean);
console.log(lines.join('\n'));
if (miss.length) console.log('无数据: ' + miss.join(''));
