/**
 * @jest-environment jsdom
 */

describe('upload webview scroll fix', () => {
  beforeEach(() => {
    jest.resetModules();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  test('overrides hidden overflow from stylesheets', () => {
    const style = document.createElement('style');
    style.textContent = 'html, body { overflow: hidden !important; height:100% !important; }';
    document.head.appendChild(style);
    const { applyScrollFix } = require('../upload-preload.js');
    const { observer } = applyScrollFix(document);
    const html = document.documentElement;
    const body = document.body;
    expect(html.style.getPropertyValue('overflow')).toBe('auto');
    expect(html.style.getPropertyPriority('overflow')).toBe('important');
    expect(body.style.getPropertyValue('overflow')).toBe('auto');
    expect(body.style.getPropertyPriority('overflow')).toBe('important');

    const laterStyle = document.createElement('style');
    laterStyle.textContent = 'html { overflow:hidden !important; }';
    document.head.appendChild(laterStyle);
    expect(html.style.getPropertyValue('overflow')).toBe('auto');
    expect(html.style.getPropertyPriority('overflow')).toBe('important');

    observer.disconnect();
  });

  test('reapplies overflow after inline style mutations', async () => {
    const { applyScrollFix } = require('../upload-preload.js');
    const { observer } = applyScrollFix(document);
    const html = document.documentElement;
    const body = document.body;
    html.style.setProperty('overflow', 'hidden', 'important');
    body.style.setProperty('overflow', 'hidden', 'important');
    await new Promise(r => setTimeout(r, 0));
    expect(html.style.getPropertyValue('overflow')).toBe('auto');
    expect(html.style.getPropertyPriority('overflow')).toBe('important');
    expect(body.style.getPropertyValue('overflow')).toBe('auto');
    expect(body.style.getPropertyPriority('overflow')).toBe('important');

    observer.disconnect();
  });
});
