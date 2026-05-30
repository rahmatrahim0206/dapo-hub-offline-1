/**
 * DAPO-HUB Service Worker
 * Dikembangkan oleh Rahmat Rahim (OPS SMP Negeri 3 Makassar)
 * Berkas ini menangani caching aset statis dan fungsionalitas offline PWA secara presisi.
 */

const CACHE_NAME = 'dapohub-cache-v5';

// Daftar aset utama yang disimpan di dalam cache untuk akses offline penuh
// PERBAIKAN: Menggunakan rujukan path relatif 'index.html' tanpa './' agar kompatibel penuh dengan sub-direktori GitHub Pages
const ASSETS_TO_CACHE = [
  'index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdn-icons-png.flaticon.com/512/2210/2210143.png'
];

// Event: Install (Penyimpanan aset awal ke dalam cache)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Melakukan pre-cache seluruh aset statis secara paksa
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Event: Activate (Pembersihan cache versi lama yang sudah usang)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            // Hapus cache versi lama demi mencegah bentrok data
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Event: Fetch (Strategi Gabungan: Cache-First untuk CDN & Network-First untuk berkas lokal)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Strategi 1: Cache-First untuk CDN eksternal (Tailwind, Fonts, FontAwesome, Favicon)
  if (
    requestUrl.hostname.includes('cdn.tailwindcss.com') ||
    requestUrl.hostname.includes('fonts.googleapis.com') ||
    requestUrl.hostname.includes('fonts.gstatic.com') ||
    requestUrl.hostname.includes('cdnjs.cloudflare.com') ||
    requestUrl.hostname.includes('cdn-icons-png.flaticon.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Segera kembalikan cache lokal (instan 0ms)
          // Lakukan pembaruan di latar belakang jika online
          if (navigator.onLine) {
            fetch(event.request).then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            }).catch(() => { /* Silent ignore */ });
          }
          return cachedResponse;
        }

        // Jika belum ada di cache, unduh dari jaringan luar dan simpan ke cache
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  } else {
    // Strategi 2: Network-First untuk berkas lokal (index.html, dll.) agar pembaruan kode instan terasa saat online
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback aman mengarah langsung ke index.html lokal di GitHub Pages
            if (event.request.mode === 'navigate') {
              return caches.match('index.html');
            }
          });
        })
    );
  }
});
