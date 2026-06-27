if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', window.location.href)

    navigator.serviceWorker.register(swUrl).catch(() => {
      // The app remains fully usable without offline caching.
    })
  })
}
