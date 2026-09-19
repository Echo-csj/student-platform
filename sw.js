// 学员管理平台 · Service Worker（PWA 离线 + 安装到桌面）
// 策略：页面导航 network-first（始终拿到最新 HTML），静态资源 cache-first + 后台更新。
const CACHE = 'sp-shell-v20260919b';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/styles.css?v=20260919b',
  './js/config.js?v=20260919b',
  './js/engine.js?v=20260919b',
  './js/store.js?v=20260919b',
  './js/ai.js?v=20260919b',
  './js/app.js?v=20260919b'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 只处理同源（Supabase 等走网络）

  if (req.mode === 'navigate') {
    // 页面：先网络，失败回退已缓存的壳
    e.respondWith(
      fetch(req)
        .then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：先缓存，未命中再网络并写入缓存
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return res; })
    )
  );
});
