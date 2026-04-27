const CACHE_NAME = 'bitrevs-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/album.html',
  '/movies.html',
  '/series.html',
  '/profile.html',
  '/top.html',
  '/wrapped.html',
  '/search.html',
  '/style.css',
  '/db.js',
  '/script.js',
  '/album.js',
  '/media.js',
  '/profile.js',
  '/top.js',
  '/wrapped.js',
  '/search.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});