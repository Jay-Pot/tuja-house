// 오프라인 대비: 항상 새 파일을 먼저 받고, 인터넷이 안 될 때만 저장해 둔 것을 쓴다.
// (새 파일 우선이라 앱을 고쳐 올리면 다음에 열 때 바로 반영된다.)
const CACHE = 'tuja-house-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // 브라우저에 남은 옛 파일을 쓰지 않고 서버에 바뀌었는지 물어본다(안 바뀌었으면 내려받지 않는다).
      const res = await fetch(e.request, { cache: 'no-cache' }).catch(() => fetch(e.request));
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      return hit || Response.error();
    }
  })());
});
