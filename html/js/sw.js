const CACHE_NAME = 'wk2026-poule-v2';
const ASSETS_TO_CACHE = [
    '../',
    '../index.html',
    '../home.html',
    '../standings.html',
    '../voorspellingen.html',
    '../leaderboard.html',
    '../aankondigingen.html',
    '../css/index.css',
    '../css/header.css',
    '../js/home.js',
    '../js/voorspellingen.js',
    '../js/leaderboard.js',
    '../js/config.js',
    '../pictures/giphy.gif'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url => cache.add(url))
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Stale-while-revalidate strategy
    if (event.request.method === 'GET' && !event.request.url.includes('supabase.co')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            })
        );
    }
});
