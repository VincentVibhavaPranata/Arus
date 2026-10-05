/* Service worker kecil untuk Arus.
   - Aset ber-hash (/assets/*) tidak pernah berubah isinya: cache dulu, cepat dan bisa offline.
   - Halaman (HTML): jaringan dulu, cache sebagai cadangan offline, supaya versi baru
     langsung terlihat tanpa harus hapus cache.
   - Yang TIDAK pernah disentuh: permintaan lintas origin (mis. Google Gemini), /api/, dan non-GET.
   Naikkan VERSION kalau struktur cache berubah. */
var VERSION = 'arus-v1';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/api/') === 0) return;

  var hashed = /\/assets\//.test(u.pathname);
  if (hashed) {
    e.respondWith(caches.match(r).then(function (hit) {
      return hit || fetch(r).then(function (res) {
        if (res.ok) { var c = res.clone(); caches.open(VERSION).then(function (ca) { ca.put(r, c); }); }
        return res;
      });
    }));
    return;
  }
  e.respondWith(
    fetch(r).then(function (res) {
      if (res.ok) { var c = res.clone(); caches.open(VERSION).then(function (ca) { ca.put(r, c); }); }
      return res;
    }).catch(function () { return caches.match(r).then(function (hit) { return hit || caches.match('./'); }); })
  );
});
