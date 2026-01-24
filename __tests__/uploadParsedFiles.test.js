const fs = require('fs');
const path = require('path');

const handlers = {};

jest.mock('electron', () => {
  const os = require('os');
  const electronMock = {
    app: {
      getPath: jest.fn(() => os.tmpdir()),
      whenReady: jest.fn(() => Promise.resolve()),
      on: jest.fn(),
      isPackaged: false,
      getVersion: jest.fn(() => '1.0.0'),
      setName: jest.fn(),
    },
    ipcMain: {
      handle: jest.fn((channel, handler) => {
        handlers[channel] = handler;
      }),
      on: jest.fn(),
    },
    shell: { openPath: jest.fn(), openExternal: jest.fn() },
    BrowserWindow: jest.fn(() => ({
      loadFile: jest.fn(),
      loadURL: jest.fn(),
      webContents: { once: jest.fn(), send: jest.fn() },
      show: jest.fn(),
      once: jest.fn(),
    })),
    Menu: { setApplicationMenu: jest.fn() },
    nativeTheme: { themeSource: 'dark' },
    dialog: { showOpenDialog: jest.fn(), showErrorBox: jest.fn() },
    protocol: { registerSchemesAsPrivileged: jest.fn(), registerFileProtocol: jest.fn() },
  };
  electronMock.BrowserWindow.getAllWindows = jest.fn(() => []);
  return electronMock;
});

describe('upload-parsed-files', () => {
  test('reads files and returns base64 payload', async () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tsa-test-'));
    const filePath = path.join(tmpDir, 'sample.json');
    fs.writeFileSync(filePath, JSON.stringify({ hello: 'world' }));

    require('../main');
    await Promise.resolve();

    const handler = handlers['upload-parsed-files'];
    expect(handler).toBeDefined();

    const result = await handler({}, [filePath]);
    const expected = Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64');
    expect(result).toEqual([{ name: 'sample.json', data: expected }]);
  });
});
