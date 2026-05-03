const CACHE_NAME = 'luffy-dodge-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  // A simple pass-through fetch handler is enough to trigger the install prompt.
  // For a true offline experience, you would cache assets here.
  event.respondWith(fetch(event.request).catch(() => new Response('Offline')));
});