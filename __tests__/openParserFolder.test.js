const fs = require('fs');
const os = require('os');
const path = require('path');

const handlers = {};

const mockUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsa-test-'));

jest.mock('electron', () => {
  const openPath = jest.fn(() => Promise.resolve(''));
  const electronMock = {
    app: {
      getPath: jest.fn(() => mockUserDataDir),
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
    shell: { openPath, openExternal: jest.fn() },
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

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    ensureDeps: jest.fn(actual.ensureDeps),
  };
});

describe('open-parser-folder', () => {
  test('ensures deps and opens correct folder', async () => {
    require('../main');
    await Promise.resolve();

    const { shell } = require('electron');
    const utils = require('../utils');

    const handler = handlers['open-parser-folder'];
    expect(handler).toBeDefined();

    const result = await handler({}, 'topstats');
    const expectedDepsDir = path.join(mockUserDataDir, 'dependencies');
    expect(utils.ensureDeps).toHaveBeenCalledWith(expectedDepsDir);
    expect(shell.openPath).toHaveBeenCalledWith(path.join(expectedDepsDir, 'topstatsparser'));
    expect(result).toBe(true);
  });
});
