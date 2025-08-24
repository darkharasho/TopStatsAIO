(function(){
  function applyScrollFix(doc = document) {
    function enforce() {
      const html = doc.documentElement;
      const body = doc.body;
      if (html) {
        if (html.style.overflow !== 'auto') html.style.overflow = 'auto';
        if (html.style.height !== 'auto') html.style.height = 'auto';
      }
      if (body) {
        if (body && body.style.overflow !== 'auto') body.style.overflow = 'auto';
        if (body && body.style.height !== 'auto') body.style.height = 'auto';
      }
    }
    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['style'] });
    if (doc.body) observer.observe(doc.body, { attributes: true, attributeFilter: ['style'] });
    return { enforce, observer };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyScrollFix };
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyScrollFix());
    } else {
      applyScrollFix();
    }
  }
})();
