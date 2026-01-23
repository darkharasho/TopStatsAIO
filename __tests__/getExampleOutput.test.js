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

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    ensureDeps: jest.fn(actual.ensureDeps),
  };
});

beforeAll(() => {
  const topDir = path.join(mockUserDataDir, 'dependencies', 'topstatsparser', 'Example_Output');
  fs.mkdirSync(topDir, { recursive: true });
  fs.writeFileSync(path.join(topDir, 'sample.txt'), 'hello');

  const combDir = path.join(mockUserDataDir, 'dependencies', 'logcombiner', 'Example Output');
  fs.mkdirSync(combDir, { recursive: true });
  fs.writeFileSync(path.join(combDir, 'sample2.txt'), 'world');

  require('../main');
});

describe('get-example-output', () => {
  test('returns files from topstats Example_Output', async () => {
    const handler = handlers['get-example-output'];
    expect(handler).toBeDefined();

    const result = await handler({}, 'topstats');
    const expected = Buffer.from('hello').toString('base64');
    expect(result).toEqual([{ name: 'sample.txt', data: expected }]);

    const utils = require('../utils');
    expect(utils.ensureDeps).toHaveBeenCalledWith(path.join(mockUserDataDir, 'dependencies'));
  });

  test('returns files from combiner Example Output', async () => {
    const handler = handlers['get-example-output'];
    const result = await handler({}, 'combiner');
    const expected = Buffer.from('world').toString('base64');
    expect(result).toEqual([{ name: 'sample2.txt', data: expected }]);
  });
});

