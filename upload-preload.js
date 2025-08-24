const { ipcRenderer } = require('electron');

function forceScroll() {
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
}

window.addEventListener('DOMContentLoaded', () => {
  forceScroll();
  const opts = { attributes: true, attributeFilter: ['style', 'class'] };
  new MutationObserver(forceScroll).observe(document.documentElement, opts);
  new MutationObserver(forceScroll).observe(document.body, opts);
  window.addEventListener(
    'wheel',
    e => {
      ipcRenderer.sendToHost('wheel', { deltaX: e.deltaX, deltaY: e.deltaY });
    },
    { passive: true }
  );
  ipcRenderer.sendToHost('scroll-injected');
});
