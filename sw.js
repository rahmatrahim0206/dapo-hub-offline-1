/**
 * DAPO-HUB Service Worker (sw.js)
 * Dikembangkan oleh Rahmat Rahim
 * Berkas ini menangani caching aset statis dan fungsionalitas offline PWA secara presisi.
 * Dioptimalkan untuk file utama: index.html
 */

const CACHE_NAME = 'dapohub-universal-cache-v5';

// Daftar aset utama yang wajib disimpan di dalam cache untuk akses luring penuh tanpa interupsi
// Diselaraskan penuh ke index.html
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/2210/2210143.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-regular-400.woff2'
];

// Event: Install (Penyimpanan aset awal ke dalam cache)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const cachePromises = ASSETS_TO_CACHE.map((asset) => {
        return cache.add(asset).catch((err) => {
          console.warn(`[Service Worker] Gagal menyimpan aset ke cache: ${asset}`, err);
        });
      });
      return Promise.all(cachePromises);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Event: Activate (Pembersihan cache versi lama yang sudah usang)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Menghapus cache usang:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Event: Fetch (Strategi: Stale-While-Revalidate untuk performa terbaik)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Intersepsi Navigasi Utama (Offline Fallback dialihkan ke index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('./index.html', { ignoreSearch: true }) || 
               caches.match('./', { ignoreSearch: true }) || 
               caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request, { ignoreSearch: true });
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
        // Mengabaikan error fetch saat offline mendadak
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listener pesan untuk memaksa Service Worker langsung aktif tanpa menunggu restart browser
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
