/* ================================================================
   sw.js — 离线缓存（PWA）
   目的：把页面和笔顺字帖缓存在本机，装到平板后断网也能练字。
   原则：只做「加速 + 断网兜底」。任何一步出错都直接走网络，
        不会让页面打不开，也不会让用户看到过期代码。
   ================================================================ */
/* 版本号：改动过 data/ 下的字帖数据后必须 +1，
   否则老设备会用「缓存优先」的旧字帖，看不到新增的课文与生字。 */
var VER = 'hzpb-v2';

/* 首次安装就缓存的「外壳」：首屏 + 6 个入口都要用到的资源 */
var SHELL = [
  './index.html',
  './css/app.css',
  './js/store.js',
  './js/hanzi.js',
  './js/app.js',
  './data/curriculum.js',
  './data/dict.js',
  './manifest.webmanifest',
  'assets/apple-touch-icon.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/pets/egg.png',
  'assets/pets/egg-crack.png',
  'assets/pets/shu-0.png',
  'assets/pets/shu-1.png',
  'assets/pets/shu-2.png',
  'assets/pets/huo-0.png',
  'assets/pets/huo-1.png',
  'assets/pets/huo-2.png',
  'assets/pets/shui-0.png',
  'assets/pets/shui-1.png',
  'assets/pets/shui-2.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(VER).then(function (c) {
      // 逐条缓存：某一个文件拿不到也不会让整次安装失败
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === VER ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;      // 跨域一概不碰
  ev.respondWith(handle(req, url));
});

async function handle(req, url) {
  var cache = await caches.open(VER);
  // 笔顺数据与图片：体积大、内容稳定 → 缓存优先
  var heavy = /\/(data\/strokes|assets)\//.test(url.pathname);
  if (heavy) {
    var hit = await cache.match(req);
    if (hit) return hit;
    try {
      var res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return hit || Response.error();
    }
  }
  // 页面与脚本样式：网络优先，保证改了代码能立刻生效；断网时回退缓存
  try {
    var r = await fetch(req);
    if (r && r.ok) cache.put(req, r.clone());
    return r;
  } catch (e2) {
    var old = await cache.match(req);
    if (old) return old;
    if (req.mode === 'navigate') {
      var idx = (await cache.match('./index.html')) || (await cache.match('index.html'));
      if (idx) return idx;
    }
    return Response.error();
  }
}
