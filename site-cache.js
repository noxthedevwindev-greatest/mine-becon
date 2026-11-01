(() => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => false);
})();
