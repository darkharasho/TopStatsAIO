const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const update = require('../update');

describe('update helpers', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    update.setLogger(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test('collectAssetInfo returns asset with matching blockmap', () => {
    const assets = [
      { name: 'TopStatsAIO-Setup.exe', browser_download_url: 'https://example.com/setup.exe' },
      { name: 'TopStatsAIO-Setup.exe.blockmap', browser_download_url: 'https://example.com/setup.exe.blockmap' },
    ];
    const asset = update.collectAssetInfo(assets, /setup.*\.exe$/i);
    expect(asset).toEqual({
      name: 'TopStatsAIO-Setup.exe',
      url: 'https://example.com/setup.exe',
      blockMapUrl: 'https://example.com/setup.exe.blockmap'
    });
  });

  test('resolveUpdateMode prioritizes installer for installed copies', () => {
    expect(update.resolveUpdateMode(true, { installer: true, portable: true })).toBe('installer');
    expect(update.resolveUpdateMode(true, { installer: null, portable: true })).toBe('portable');
    expect(update.resolveUpdateMode(false, { installer: null, portable: true })).toBe('portable');
    expect(update.resolveUpdateMode(false, { installer: true, portable: null })).toBe('installer');
    expect(update.resolveUpdateMode(false, { installer: null, portable: null })).toBe('link');
  });

  test('downloadWithBlockMap resumes existing downloads using range requests', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsa-update-'));
    const dest = path.join(tmpDir, 'app.zip');
    fs.writeFileSync(dest, Buffer.from('old'));

    const blockMap = { files: [{ sizes: [8] }] };
    const blockMapBody = zlib.gzipSync(Buffer.from(JSON.stringify(blockMap)));
    const payload = Buffer.from('extra');

    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => blockMapBody,
        text: async () => '',
        headers: new Map(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 206,
        arrayBuffer: async () => payload,
        text: async () => '',
        headers: { get: () => null },
        body: null,
      });

    const progressUpdates = [];
    await update.downloadWithBlockMap('https://example.com/app.zip', 'https://example.com/app.zip.blockmap', dest, (p) => progressUpdates.push(p));

    expect(fetch).toHaveBeenNthCalledWith(2, 'https://example.com/app.zip', expect.objectContaining({
      headers: expect.objectContaining({ Range: 'bytes=3-' })
    }));
    expect(fs.readFileSync(dest)).toEqual(Buffer.from('oldextra'));
    expect(progressUpdates[progressUpdates.length - 1]).toBeCloseTo(1, 5);
  });

  test('downloadUpdateAsset falls back to full download when blockmap fails', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsa-update-'));
    const dest = path.join(tmpDir, 'setup.exe');

    const errorResponse = {
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'boom',
    };
    const payload = Buffer.from('installer');

    fetch
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => payload,
        text: async () => '',
        headers: { get: () => payload.length },
        body: null,
      });

    await update.downloadUpdateAsset({
      name: 'setup.exe',
      url: 'https://example.com/setup.exe',
      blockMapUrl: 'https://example.com/setup.exe.blockmap',
    }, dest);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(dest).toString()).toBe('installer');
  });
});
