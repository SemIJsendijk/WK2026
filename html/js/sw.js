const CACHE_NAME = 'wk2026-poule-v1';
const ASSETS_TO_CACHE = [
    '../',
    '../index.html',
    '../css/index.css',
    '../css/header.css'
    // Add other critical assets here if you want offline support
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Best effort caching. If some fail, it's fine.
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
    // Optioneel: Offline support strategy
    // For now, we prefer going to the network, and fallback to cache if offline
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
