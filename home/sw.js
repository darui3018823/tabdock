// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.24.x_sw-r1

const CACHE_NAME = 'tabdock-v5';
const ASSETS = [
  '/home/',
  '/home/index.html',
  '/home/style.css',
  '/home/script.js',
  '/home/manifest.json',
  '/home/assets/icon/pwa/tabdock_betalogo-192.png',
  '/home/assets/icon/pwa/tabdock_betalogo-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
