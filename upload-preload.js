(function(){
  function applyScrollFix(doc = document) {
    function enforce() {
      const html = doc.documentElement;
      const body = doc.body;
      if (html) {
        if (html.style.getPropertyValue('overflow') !== 'auto' || html.style.getPropertyPriority('overflow') !== 'important') {
          html.style.setProperty('overflow', 'auto', 'important');
        }
        if (html.style.getPropertyValue('height') !== 'auto' || html.style.getPropertyPriority('height') !== 'important') {
          html.style.setProperty('height', 'auto', 'important');
        }
      }
      if (body) {
        if (body.style.getPropertyValue('overflow') !== 'auto' || body.style.getPropertyPriority('overflow') !== 'important') {
          body.style.setProperty('overflow', 'auto', 'important');
        }
        if (body.style.getPropertyValue('height') !== 'auto' || body.style.getPropertyPriority('height') !== 'important') {
          body.style.setProperty('height', 'auto', 'important');
        }
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
