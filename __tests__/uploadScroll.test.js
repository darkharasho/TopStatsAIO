/**
 * @jest-environment jsdom
 */

describe('upload webview scroll fix', () => {
  beforeEach(() => {
    jest.resetModules();
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  });

  test('forces overflow auto on load and after mutations', async () => {
    const { applyScrollFix } = require('../upload-preload.js');
    const { observer } = applyScrollFix(document);
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(document.body.style.overflow).toBe('auto');

    document.body.style.overflow = 'hidden';
    await new Promise(r => setTimeout(r, 0));
    expect(document.body.style.overflow).toBe('auto');

    observer.disconnect();
  });
});
