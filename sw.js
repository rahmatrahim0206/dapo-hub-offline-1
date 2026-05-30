/**
 * DAPO-HUB Service Worker
 * Dikembangkan oleh Rahmat Rahim (OPS SMP Negeri 3 Makassar)
 * Berkas ini menangani caching aset statis dan fungsionalitas offline PWA secara presisi.
 * Dioptimalkan khusus untuk Domain Produksi: app.dapohub.web.id
 */

const CACHE_NAME = 'dapohub-spentig-cache-v4';

// Daftar aset utama yang wajib disimpan di dalam cache untuk akses offline penuh tanpa interupsi
// Dioptimalkan untuk navigasi root domain kustom app.dapohub.web.id
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'manifest.json',
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
      // Melakukan caching secara individual agar jika salah satu aset gagal (404),
      // Service Worker tetap sukses terinstall dan tombol PWA Chrome Windows tidak terblokir!
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
            // Hapus cache versi lama demi mencegah bentrok data luring
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Event: Fetch (Strategi Gabungan Cerdas: Stale-While-Revalidate untuk PWA Tercepat)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (!event.request.url.startsWith('http')) return;

  // Intersepsi khusus untuk permintaan Navigasi Utama (Offline Fallback ke index.html atau root)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('index.html', { ignoreSearch: true }) || 
               caches.match('/', { ignoreSearch: true }) || 
               caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pencarian cache yang mengabaikan parameter pencarian URL (?query) agar lebih akurat di Chrome
      const cachedResponse = await cache.match(event.request, { ignoreSearch: true });
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
        // Abaikan error fetch untuk aset non-navigasi saat offline
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Menambahkan listener pesan untuk memaksa Service Worker langsung aktif tanpa menunggu halaman dimuat ulang
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
