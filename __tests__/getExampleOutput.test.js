const fs = require('fs');
const os = require('os');
const path = require('path');

const handlers = {};

const mockUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsa-test-'));

jest.mock('electron', () => {
  const electronMock = {
    app: {
      getPath: jest.fn(() => mockUserDataDir),
      whenReady: jest.fn(() => Promise.resolve()),
      on: jest.fn(),
      isPackaged: false,
      getVersion: jest.fn(() => '1.0.0'),
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
      webContents: { once: jest.fn(), send: jest.fn() },
      show: jest.fn(),
      once: jest.fn(),
    })),
    Menu: { setApplicationMenu: jest.fn() },
    nativeTheme: { themeSource: 'dark' },
    dialog: { showOpenDialog: jest.fn(), showErrorBox: jest.fn() },
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

describe('get-example-output', () => {
  test('returns files from Example_Output', async () => {
    const exDir = path.join(mockUserDataDir, 'dependencies', 'topstatsparser', 'Example_Output');
    fs.mkdirSync(exDir, { recursive: true });
    const filePath = path.join(exDir, 'sample.txt');
    fs.writeFileSync(filePath, 'hello');

    require('../main');
    await Promise.resolve();

    const handler = handlers['get-example-output'];
    expect(handler).toBeDefined();

    const result = await handler({}, 'topstats');
    const expected = Buffer.from('hello').toString('base64');
    expect(result).toEqual([{ name: 'sample.txt', data: expected }]);

    const utils = require('../utils');
    expect(utils.ensureDeps).toHaveBeenCalledWith(path.join(mockUserDataDir, 'dependencies'));
  });
});

