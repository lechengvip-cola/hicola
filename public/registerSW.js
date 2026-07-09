(function () {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    return Promise.all(registrations.map(function (registration) {
      return registration.unregister();
    }));
  }).then(function () {
    if (!window.caches) return;
    return caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return caches.delete(key);
      }));
    });
  }).catch(function (error) {
    console.warn("清理旧 Service Worker 失败", error);
  });
})();
