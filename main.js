const { app, BrowserWindow, ipcMain, nativeTheme, shell, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, spawn } = require('child_process');
const AdmZip = require('adm-zip');
const semver = require('semver');
const { ensureDeps, readVersions, writeVersions, editEIConfig, editTopStatsConfig } = require('./utils');
const { downloadFile, downloadUpdateAsset, collectAssetInfo, resolveUpdateMode, setLogger } = require('./update');
const isLinux = process.platform === 'linux';
const useMica = !isLinux && process.platform === 'win32' && parseInt(os.release().split('.')[2], 10) >= 22000;
const keepTempDirs = process.argv.includes('--keep-temp');

let depsDir;
let versionsFile;
let logFile;
let currentParseCancel = null;
let appTheme = nativeTheme.themeSource;
let mainWindow = null;
let pendingUpdate = null;
let cachedWineAvailable = null;
let cachedWineReady = false;
let wineDotnetAlerted = false;
let cachedWineDotnetReady = false;

if (keepTempDirs) {
  log('Debug flag detected; parser temporary folders will be preserved.');
}

function getTiddlyhostCredentialsPath() {
  return path.join(app.getPath('userData'), 'tiddlyhost-credentials.json');
}

function loadTiddlyhostCredentials() {
  if (!safeStorage.isEncryptionAvailable()) {
    return { username: '', password: '' };
  }
  try {
    const raw = fs.readFileSync(getTiddlyhostCredentialsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.payload) return { username: '', password: '' };
    const decrypted = safeStorage.decryptString(Buffer.from(parsed.payload, 'base64'));
    const data = JSON.parse(decrypted);
    return {
      username: typeof data.username === 'string' ? data.username : '',
      password: typeof data.password === 'string' ? data.password : ''
    };
  } catch {
    return { username: '', password: '' };
  }
}

function hasWine() {
  if (cachedWineAvailable !== null) {
    return cachedWineAvailable;
  }
  try {
    execSync('wine --version', { stdio: 'ignore' });
    cachedWineAvailable = true;
  } catch (error) {
    cachedWineAvailable = false;
  }
  return cachedWineAvailable;
}

function ensureWineReady() {
  if (cachedWineReady) {
    return;
  }
  const winePrefix = path.join(app.getPath('userData'), 'wine');
  const wineEnv = {
    ...process.env,
    WINEPREFIX: winePrefix
  };
  execSync('wineboot -u', { stdio: 'ignore', env: wineEnv });
  execSync('wineserver -w', { stdio: 'ignore', env: wineEnv });
  cachedWineReady = true;
}

function hasWineDotnet(wineEnv) {
  try {
    execSync(
      'wine reg query "HKLM\\Software\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full" /v Release',
      { stdio: 'ignore', env: wineEnv }
    );
    return true;
  } catch (error) {
    return false;
  }
}

function ensureWineDotnet(wc, wineEnv) {
  if (cachedWineDotnetReady) {
    return;
  }
  if (hasWineDotnet(wineEnv)) {
    cachedWineDotnetReady = true;
    return;
  }
  try {
    execSync('winetricks --version', { stdio: 'ignore', env: wineEnv });
  } catch (error) {
    const message = 'winetricks is required to install the .NET runtime for Wine. Please install winetricks and try again.';
    wc.send('parse-progress', message);
    dialog.showErrorBox('winetricks required', message);
    throw new Error('winetricks is not installed');
  }
  wc.send('parse-progress', 'Installing .NET runtime in Wine. This may take a few minutes...');
  try {
    execSync('winetricks -q dotnet48', { stdio: 'ignore', env: wineEnv });
  } catch (error) {
    const message = 'Failed to install the .NET runtime via winetricks. Please run `winetricks dotnet48` manually and try again.';
    wc.send('parse-progress', message);
    dialog.showErrorBox('.NET install failed', message);
    throw error;
  }
  cachedWineDotnetReady = true;
  wc.send('parse-progress', 'Wine .NET runtime installed.');
}

function resolveWindowsCommand(cmd, args, wc) {
  if (process.platform === 'win32') {
    return { cmd, args, env: process.env };
  }
  const ext = path.extname(cmd).toLowerCase();
  if (ext !== '.exe' && ext !== '.bat') {
    return { cmd, args, env: process.env };
  }
  if (!hasWine()) {
    const message = 'Wine is required on Linux to run Windows dependencies. Please install Wine and try again.';
    wc.send('parse-progress', message);
    dialog.showErrorBox('Wine required', message);
    throw new Error('Wine is not installed');
  }
  try {
    ensureWineReady();
  } catch (error) {
    const message = 'Wine failed to initialize. Please ensure Wine is installed correctly and try again.';
    wc.send('parse-progress', message);
    dialog.showErrorBox('Wine error', message);
    throw error;
  }
  const wineEnv = {
    ...process.env,
    WINEPREFIX: path.join(app.getPath('userData'), 'wine'),
    WINEDEBUG: process.env.WINEDEBUG || '-all'
  };
  try {
    ensureWineDotnet(wc, wineEnv);
  } catch (error) {
    throw error;
  }
  if (ext === '.bat') {
    return { cmd: 'wine', args: ['cmd', '/c', cmd, ...args], env: wineEnv };
  }
  return { cmd: 'wine', args: [cmd, ...args], env: wineEnv };
}

function saveTiddlyhostCredentials({ username = '', password = '' } = {}) {
  if (!safeStorage.isEncryptionAvailable()) {
    return false;
  }
  const hasValues = Boolean(username || password);
  const filePath = getTiddlyhostCredentialsPath();
  if (!hasValues) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {}
    return true;
  }
  const payload = safeStorage.encryptString(JSON.stringify({ username, password }));
  const contents = JSON.stringify({ payload: payload.toString('base64') }, null, 2);
  fs.writeFileSync(filePath, contents, 'utf8');
  return true;
}

function logError(...args) {
  console.error(...args);
  if (!logFile) return;
  const msg = args.map(a => (a instanceof Error ? a.stack : String(a))).join(' ');
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

function log(...args) {
  console.log(...args);
  if (!logFile) return;
  const msg = args.map(a => String(a)).join(' ');
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

setLogger(logError);

process.on('uncaughtException', logError);
process.on('unhandledRejection', logError);

// Redirect any popup attempts from webviews into the same view instead of
// spawning a separate BrowserWindow. This ensures navigation happens within the
// app's existing window and keeps the URL bar in sync.
app.on('web-contents-created', (event, contents) => {
  if (contents.getType && contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (url) {
        contents.loadURL(url);
      }
      return { action: 'deny' };
    });
  }
});

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TopStatsAIO',
        Accept: 'application/vnd.github+json'
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}\n${text}`);
    }
    return await res.json();
  } catch (err) {
    throw new Error(`Fetch failed: ${err.message}`);
  }
}

async function getLatest(repo) {
  return await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
}


async function findPayloadRoot(dir) {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    if (entries.length === 1 && entries[0].isDirectory()) {
      return path.join(dir, entries[0].name);
    }
  } catch {}
  return dir;
}

async function createPortableUpdateScript(srcDir, destDir, tmpDir) {
  const exeName = path.basename(process.execPath);
  const scriptPath = path.join(tmpDir, 'apply-update.cmd');
  const lines = [
    '@echo off',
    'setlocal enableextensions',
    `set "SRC=${srcDir}"`,
    `set "DEST=${destDir}"`,
    `set "PID=${process.pid}"`,
    `set "EXE=${exeName}"`,
    `set "TMPROOT=${tmpDir}"`,
    'echo Waiting for TopStatsAIO to exit...',
    ':wait',
    'tasklist /FI "PID eq %PID%" | find "%PID%" >nul',
    'if %ERRORLEVEL%==0 (',
    '  timeout /t 1 /nobreak >nul',
    '  goto wait',
    ')',
    'robocopy "%SRC%" "%DEST%" /MIR /NFL /NDL /NJH /NJS /NC /NS >nul',
    'rd /s /q "%TMPROOT%"',
    'start "" "%DEST%\\%EXE%"',
    'exit /b 0'
  ];
  await fs.promises.writeFile(scriptPath, lines.join('\r\n'), 'utf8');
  return scriptPath;
}

async function downloadDependency(which) {
  ensureDeps(depsDir);
  if (which === 'cli') {
    const rel = await getLatest('baaron4/GW2-Elite-Insights-Parser');
    const asset = rel.assets.find(a => a.name === 'GW2EICLI.zip');
    if (!asset) throw new Error('Asset not found');
    const zipPath = path.join(depsDir, asset.name);
    await downloadFile(asset.browser_download_url, zipPath);
    const zip = new AdmZip(zipPath);
    const dest = path.join(depsDir, 'eicli');
    if (fs.existsSync(dest)) {
      await fs.promises.rm(dest, { recursive: true, force: true });
    }
    zip.extractAllTo(dest, true);
    await fs.promises.unlink(zipPath);
    const versions = readVersions(versionsFile);
    versions.cli = rel.tag_name || rel.name;
    writeVersions(versionsFile, versions);
  } else if (which === 'combiner') {
    const rel = await getLatest('Drevarr/GW2_EI_log_combiner');
    const asset = rel.assets.find(a => a.name.endsWith('.zip'));
    if (!asset) throw new Error('Asset not found');
    const zipPath = path.join(depsDir, asset.name);
    await downloadFile(asset.browser_download_url, zipPath);
    const zip = new AdmZip(zipPath);
    const dest = path.join(depsDir, 'logcombiner');
    if (fs.existsSync(dest)) {
      await fs.promises.rm(dest, { recursive: true, force: true });
    }
    zip.extractAllTo(dest, true);
    await fs.promises.unlink(zipPath);
    const versions = readVersions(versionsFile);
    versions.combiner = rel.tag_name || rel.name;
    writeVersions(versionsFile, versions);
  } else if (which === 'parser') {
    const rel = await getLatest('Drevarr/arcdps_top_stats_parser');
    const zipPath = path.join(depsDir, 'arcdps_top_stats_parser.zip');
    await downloadFile(rel.zipball_url, zipPath);
    const zip = new AdmZip(zipPath);
    const dest = path.join(depsDir, 'topstatsparser');
    if (fs.existsSync(dest)) {
      await fs.promises.rm(dest, { recursive: true, force: true });
    }
    zip.extractAllTo(dest, true);
    await fs.promises.unlink(zipPath);
    const entries = await fs.promises.readdir(dest);
    if (entries.length === 1) {
      const inner = path.join(dest, entries[0]);
      const stat = await fs.promises.stat(inner);
      if (stat.isDirectory()) {
        const innerEntries = await fs.promises.readdir(inner);
        for (const e of innerEntries) {
          await fs.promises.rename(path.join(inner, e), path.join(dest, e));
        }
        await fs.promises.rm(inner, { recursive: true, force: true });
      }
    }
    const versions = readVersions(versionsFile);
    versions.parser = rel.tag_name || rel.name;
    writeVersions(versionsFile, versions);
  }
}

async function checkDependencies() {
  ensureDeps(depsDir);
  const versions = readVersions(versionsFile);
  const [cliRel, combRel, parserRel] = await Promise.all([
    getLatest('baaron4/GW2-Elite-Insights-Parser'),
    getLatest('Drevarr/GW2_EI_log_combiner'),
    getLatest('Drevarr/arcdps_top_stats_parser')
  ]);
  const cliVer = cliRel.tag_name || cliRel.name;
  const combVer = combRel.tag_name || combRel.name;
  const parserVer = parserRel.tag_name || parserRel.name;
  return {
    cli: { current: versions.cli, latest: cliVer, needsUpdate: versions.cli !== cliVer },
    combiner: { current: versions.combiner, latest: combVer, needsUpdate: versions.combiner !== combVer },
    parser: { current: versions.parser, latest: parserVer, needsUpdate: versions.parser !== parserVer }
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: useMica ? '#00000000' : '#2d2d2d',
    ...(useMica ? { backgroundMaterial: appTheme === 'acrylic' ? 'acrylic' : 'mica', visualEffectState: 'active' } : {}),
    titleBarStyle: 'hidden',
    title: 'Top Stats AIO',
    icon: path.join(__dirname, 'media', 'TopStatsAIO-Logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  });

  win.loadFile('index.html');
  return win;
}

const allowDevUpdates = process.argv.includes('--dev-update');

function isInstalled() {
  const p = process.execPath.toLowerCase();
  return p.includes('program files') || p.includes(path.join('appdata', 'local', 'programs').toLowerCase());
}

function showUpdatePrompt(parent) {
  if (!pendingUpdate) return;
  const prompt = new BrowserWindow({
    parent,
    modal: true,
    width: 360,
    height: 230,
    resizable: false,
    frame: false,
    backgroundColor: useMica ? '#00000000' : '#2d2d2d',
    ...(useMica ? { backgroundMaterial: appTheme === 'acrylic' ? 'acrylic' : 'mica', visualEffectState: 'active' } : {}),
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  const mode = pendingUpdate.mode || 'link';
  prompt.loadFile('update.html', {
    query: { version: pendingUpdate.version, mode, url: pendingUpdate.releaseUrl || '' }
  });
  prompt.once('ready-to-show', () => prompt.show());
}

async function checkForAppUpdates(parent) {
  try {
    const rel = await getLatest('darkharasho/TopStatsAIO');
    const latest = semver.clean(rel.tag_name || rel.name);
    const current = app.getVersion();
    if (latest && semver.gt(latest, current)) {
      const assets = rel.assets || [];
      const portable = collectAssetInfo(assets, /standalone.*\.zip$/i);
      const installer = collectAssetInfo(assets, /setup.*\.exe$/i);
      const mode = resolveUpdateMode(isInstalled(), { portable, installer });
      pendingUpdate = {
        version: latest,
        releaseUrl: rel.html_url,
        assets: { portable, installer },
        mode
      };
      if (parent && parent.webContents) {
        parent.webContents.send('show-update-notice');
      }
      showUpdatePrompt(parent);
    }
  } catch (err) {
    logError('Update check failed:', err);
  }
}

async function applyInstallerUpdate(wc) {
  if (!pendingUpdate.assets || !pendingUpdate.assets.installer) {
    throw new Error('Installer asset not available');
  }
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tsa-update-'));
  const send = (stage, progress) => wc && wc.send('update-progress', { stage, progress });
  const asset = pendingUpdate.assets.installer;
  const setupPath = path.join(tmpDir, asset.name || 'setup.exe');
  await downloadUpdateAsset(asset, setupPath, p => send('download', p));
  send('apply', 1);
  const err = await shell.openPath(setupPath);
  if (err) throw new Error(err);
  app.quit();
}

async function applyPortableUpdate(wc) {
  if (!pendingUpdate.assets) throw new Error('No update assets available');
  const asset = pendingUpdate.assets.portable || pendingUpdate.assets.installer;
  if (!asset) throw new Error('Portable package not available');
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tsa-portable-'));
  const send = (stage, progress) => wc && wc.send('update-progress', { stage, progress });
  const zipName = asset.name && asset.name.toLowerCase().endsWith('.zip') ? asset.name : 'update.zip';
  const zipPath = path.join(tmpDir, zipName);
  await downloadUpdateAsset(asset, zipPath, p => send('download', p));
  send('apply', 0.2);
  const extractDir = path.join(tmpDir, 'payload');
  await fs.promises.mkdir(extractDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDir, true);
  const payloadRoot = await findPayloadRoot(extractDir);
  const scriptPath = await createPortableUpdateScript(payloadRoot, path.dirname(process.execPath), tmpDir);
  send('apply', 1);
  spawn('cmd.exe', ['/c', 'start', '', scriptPath], { detached: true, windowsHide: true });
  app.quit();
}

async function performAppUpdate(wc) {
  if (!pendingUpdate) return;
  try {
    if (pendingUpdate.mode === 'link' || process.platform !== 'win32') {
      await shell.openExternal(pendingUpdate.releaseUrl);
      return;
    }
    if (pendingUpdate.mode === 'portable') {
      await applyPortableUpdate(wc);
    } else {
      await applyInstallerUpdate(wc);
    }
  } catch (e) {
    logError('Failed to apply update:', e);
    wc && wc.send('update-progress', { stage: 'error', error: e.message });
    dialog.showErrorBox('Update failed', e.message);
  }
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  depsDir = path.join(userData, 'dependencies');
  versionsFile = path.join(depsDir, 'versions.json');
  logFile = path.join(userData, 'debug.log');

  const win = createWindow();
  mainWindow = win;

  const shouldCheckUpdates = app.isPackaged || allowDevUpdates;
  if (shouldCheckUpdates) {
    win.webContents.once('did-finish-load', () => {
      checkForAppUpdates(win);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('load-folder', async (event, dir, rootDir) => {
  const wc = event.sender;
  wc.send('tree-start', { path: dir });
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const total = entries.length;
    let count = 0;
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        const stat = await fs.promises.stat(fullPath);
        const isDir = entry.isDirectory();
        const isZevtc = !isDir && entry.name.toLowerCase().endsWith('.zevtc');
        if (isDir || isZevtc) {
          const node = {
            name: entry.name,
            path: fullPath,
            relativePath: path.relative(rootDir, fullPath),
            type: isDir ? 'directory' : 'file',
            mtime: stat.mtimeMs
          };
          wc.send('tree-node', { parent: dir, node });
        }
      } catch { /* ignore failed stats */ }
      count++;
      wc.send('load-progress', { parent: dir, progress: count / total });
    }
    wc.send('tree-end', dir);
    return true;
  } catch {
    wc.send('tree-end', dir);
    return false;
  }
});
ipcMain.handle('get-theme', () => appTheme);
ipcMain.handle('get-version', () => app.getVersion());

ipcMain.on('set-theme', (event, theme) => {
  appTheme = theme;
  nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
  BrowserWindow.getAllWindows().forEach(w => {
    if (useMica) w.setBackgroundMaterial(theme === 'acrylic' ? 'acrylic' : 'mica');
    w.webContents.send('theme-changed', theme);
  });
});

ipcMain.on('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (action === 'minimize') {
    win.minimize();
  } else if (action === 'maximize') {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  } else if (action === 'close') {
    win.close();
  }
});

ipcMain.handle('download-dependency', async (event, which) => {
  try {
    await downloadDependency(which);
    return true;
  } catch (e) {
    logError(e);
    return false;
  }
});

ipcMain.handle('check-dependencies', async () => {
  try {
    return await checkDependencies();
  } catch (e) {
    logError(e);
    return { cli: { needsUpdate: false }, combiner: { needsUpdate: false }, parser: { needsUpdate: false } };
  }
});

ipcMain.handle('open-parsed-folder', async () => {
  const dir = path.join(app.getPath('userData'), 'parsed_files');
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    return await shell.openPath(dir);
  } catch (e) {
    logError('Failed to open parsed folder', e);
    return '';
  }
});

ipcMain.handle('upload-parsed-files', async (event, files) => {
  try {
    const payload = [];
    for (const f of files || []) {
      try {
        const data = await fs.promises.readFile(f);
        payload.push({ name: path.basename(f), data: data.toString('base64') });
      } catch (e) {
        logError('Failed to read file for upload', e);
      }
    }
    return payload;
  } catch (e) {
    logError('Failed to prepare upload', e);
    return [];
  }
});

ipcMain.handle('get-example-output', async (event, which) => {
  try {
    ensureDeps(depsDir);
    const dir = path.join(depsDir, which === 'topstats' ? 'topstatsparser' : 'logcombiner');
    let target = null;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const match = entries.find(e => e.isDirectory() && /example[ _-]*output/i.test(e.name));
      if (match) target = path.join(dir, match.name);
    } catch {}
    if (!target) {
      console.warn('Example output directory not found');
      return [];
    }
    async function gather(p) {
      const entries = await fs.promises.readdir(p, { withFileTypes: true });
      const results = [];
      for (const entry of entries) {
        const res = path.join(p, entry.name);
        if (entry.isDirectory()) {
          results.push(...await gather(res));
        } else {
          results.push(res);
        }
      }
      return results;
    }
    const files = await gather(target);
    const payload = [];
    for (const f of files) {
      try {
        const data = await fs.promises.readFile(f);
        payload.push({ name: path.basename(f), data: data.toString('base64') });
      } catch (e) {
        logError('Failed to read example output file', e);
      }
    }
    return payload;
  } catch (e) {
    logError('Failed to get example output', e);
    return [];
  }
});

ipcMain.handle('open-parser-folder', async (event, which) => {
  ensureDeps(depsDir);
  const dir = path.join(depsDir, which === 'topstats' ? 'topstatsparser' : 'logcombiner');
  try {
    const ex1 = path.join(dir, 'example_output');
    const ex2 = path.join(dir, 'Example_Output');
    const target = fs.existsSync(ex1) ? ex1 : fs.existsSync(ex2) ? ex2 : dir;
    await shell.openPath(target);
    return true;
  } catch (e) {
    logError('Failed to open parser folder', e);
    return false;
  }
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});
ipcMain.handle('get-tiddlyhost-credentials', () => {
  return loadTiddlyhostCredentials();
});
ipcMain.handle('set-tiddlyhost-credentials', async (event, creds) => {
  return saveTiddlyhostCredentials(creds);
});

ipcMain.on('cancel-parse', () => {
  if (currentParseCancel) currentParseCancel();
});

ipcMain.on('update-later', () => {
  if (mainWindow) mainWindow.webContents.send('show-update-notice');
});

ipcMain.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('hide-update-notice');
});

ipcMain.handle('show-update-prompt', () => {
  if (mainWindow) showUpdatePrompt(mainWindow);
});

ipcMain.handle('perform-update', (e) => performAppUpdate(e.sender));

ipcMain.handle('start-parse', async (event, data) => {
  const wc = event.sender;
  const files = data.files || [];
  const opts = data.options || {};
  if (opts.parser === 'combiner') {
    const basePath = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('userData');
    if (!opts.dbPath) {
      opts.dbPath = basePath.replace(/\\/g, '/');
    }
  }
  const parsedDir = path.join(app.getPath('userData'), 'parsed_files');
  await fs.promises.rm(parsedDir, { recursive: true, force: true });
  await fs.promises.mkdir(parsedDir, { recursive: true });
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tsaio-'));
  const send = msg => wc.send('parse-progress', msg);
  const step = (id, title, progress, error, current = 0, total = 0) =>
    wc.send('parse-step', { id, title, progress, error, current, total });
  let cancelled = false;
  let child = null;
  const outputFiles = [];
  currentParseCancel = () => {
    cancelled = true;
    if (child) child.kill();
  };
  try {
    send(`Created temp folder at ${tempDir}`);
    if (keepTempDirs) {
      send('Debug mode active: temporary folder will not be deleted automatically.');
    }
    step('copy', 'Copying files', 0, null, 0, files.length);
    for (let i = 0; i < files.length; i++) {
      const src = files[i];
      const dest = path.join(tempDir, path.basename(src));
      try {
        await fs.promises.copyFile(src, dest);
        send(`Copied (${i + 1}/${files.length}): ${path.basename(src)}`);
        step('copy', 'Copying files', (i + 1) / files.length, null, i + 1, files.length);
      } catch (e) {
        step('copy', 'Copying files', (i + 1) / files.length, 'Error copying file', i + 1, files.length);
        throw e;
      }
      if (cancelled) {
        send('Parsing cancelled.');
        wc.send('parse-complete', { success: false, files: [] });
        return;
      }
    }

    const processedDir = path.join(tempDir, 'ProcessedLogs');
    if (!opts.inputDirectory) {
      opts.inputDirectory = processedDir.replace(/\\/g, '/');
    }
    const eiTemplate = path.join(__dirname, 'EliteInsightsConfigTemplate.conf');
    const eiConf = path.join(tempDir, 'EliteInsightConfig.conf');
    await editEIConfig(eiTemplate, eiConf, tempDir, opts.dpsUserToken, { anonymizePlayers: opts.anonymizePlayers });
    const combTemplate = path.join(__dirname, 'top_stats_config.ini');
    const combConf = path.join(tempDir, 'top_stats_config.ini');
    await editTopStatsConfig(combTemplate, combConf, opts);
    send('Config files prepared');

    let cliExe = path.join(depsDir, 'eicli', 'GuildWars2EliteInsights-CLI.exe');
    if (!fs.existsSync(cliExe)) {
      const alt = path.join(depsDir, 'eicli', 'gw2eicli.exe');
      if (fs.existsSync(alt)) {
        cliExe = alt;
      } else {
        send('EI CLI not found.');
        wc.send('parse-complete', { success: false, files: [] });
        return;
      }
    }

    const zevtc = await fs.promises.readdir(tempDir);
    const logs = zevtc.filter(f => f.toLowerCase().endsWith('.zevtc'));
    if (logs.length > 0) {
      step('cli', 'EI CLI', 0, null, 0, logs.length);
      let cliWatcher = null;
      const seenCliOutputs = new Set();
      let cliCompleted = 0;
      const updateCliProgress = () => {
        const completed = Math.min(cliCompleted, logs.length);
        const progress = logs.length ? completed / logs.length : 1;
        step('cli', 'EI CLI', progress, null, completed, logs.length);
      };
      const beginWatcher = () => {
        try {
          cliWatcher = fs.watch(tempDir, (eventType, filename) => {
            if (!filename || !filename.toLowerCase().endsWith('.json.gz')) return;
            const key = filename.toLowerCase();
            if (seenCliOutputs.has(key)) return;
            seenCliOutputs.add(key);
            cliCompleted = Math.min(cliCompleted + 1, logs.length);
            updateCliProgress();
          });
          cliWatcher.on('error', err => logError('EI CLI watcher error', err));
        } catch (err) {
          logError('Failed to watch EI CLI outputs', err);
        }
      };
      beginWatcher();
      updateCliProgress();
      try {
        send(`Running EI CLI on ${logs.length} log${logs.length === 1 ? '' : 's'}`);
        const args = ['-c', eiConf, ...logs.map(f => path.join(tempDir, f))];
        await runProcess(cliExe, args, tempDir, wc, false, c => child = c);
        cliCompleted = logs.length;
        updateCliProgress();
      } catch (e) {
        step('cli', 'EI CLI', logs.length ? cliCompleted / logs.length : 1, 'Error', cliCompleted, logs.length);
        throw e;
      } finally {
        if (cliWatcher) cliWatcher.close();
      }
      if (cancelled) {
        send('Parsing cancelled.');
        wc.send('parse-complete', { success: false, files: [] });
        return;
      }
    } else {
      step('cli', 'EI CLI', 1, 'No logs', 0, 0);
    }
    await fs.promises.mkdir(processedDir, { recursive: true });
    const generated = await fs.promises.readdir(tempDir);
    for (const f of generated) {
      if (f.toLowerCase().endsWith('.json.gz')) {
        await fs.promises.rename(path.join(tempDir, f), path.join(processedDir, f));
        send(`Moved processed log: ${f}`);
      }
    }

    if (opts.parser === 'combiner') {
      const combExe = path.join(depsDir, 'logcombiner', 'TopStats.exe');
      step('final', 'GW2 EI Log Combiner', 0, null, 0, 1);
      if (fs.existsSync(combExe)) {
        if (fs.existsSync(processedDir) && (await fs.promises.readdir(processedDir)).length > 0) {
          send('Running GW2 EI Log Combiner');
          try {
            const combArgs = ['-i', processedDir, '-c', combConf];
            if (opts.description) {
              combArgs.push('-d', opts.description);
            }
            const prettyCombCmd = [
              combExe,
              ...combArgs.map(arg => (/[\s]/.test(arg) ? `"${arg}"` : arg))
            ].join(' ');
            send(`GW2 EI Log Combiner command: ${prettyCombCmd}`);
            await runProcess(combExe, combArgs, tempDir, wc, false, c => child = c, '\r\n');
            step('final', 'GW2 EI Log Combiner', 1, null, 1, 1);
          } catch (e) {
            step('final', 'GW2 EI Log Combiner', 1, 'Error', 1, 1);
            throw e;
          }
        } else {
          send('No processed logs found. Skipping GW2 EI Log Combiner.');
          step('final', 'GW2 EI Log Combiner', 1, 'No logs', 0, 0);
        }
      } else {
        send('GW2 EI Log Combiner not found.');
        step('final', 'GW2 EI Log Combiner', 1, 'Not found', 0, 0);
      }
    } else {
      const parserScript = path.join(depsDir, 'topstatsparser', 'TW5_parsing_arc_top_stats.bat');
      step('final', 'ArcDPS Top Stats Parser', 0, null, 0, 1);
      if (fs.existsSync(parserScript)) {
        send('Running ArcDPS Top Stats Parser');
        const args = [parserScript, tempDir, path.join(depsDir, 'eicli'), path.join(depsDir, 'topstatsparser')];
        try {
          await runProcess(args[0], args.slice(1), tempDir, wc, true, c => child = c);
          step('final', 'ArcDPS Top Stats Parser', 1, null, 1, 1);
        } catch (e) {
          step('final', 'ArcDPS Top Stats Parser', 1, 'Error', 1, 1);
          throw e;
        }
      } else {
        send('ArcDPS Top Stats Parser not found.');
        step('final', 'ArcDPS Top Stats Parser', 1, 'Not found', 0, 0);
      }
    }

    if (cancelled) {
      send('Parsing cancelled.');
      wc.send('parse-complete', { success: false, files: [] });
      return;
    }

    const outDir = opts.parser === 'combiner' ? processedDir : tempDir;
    if (!fs.existsSync(outDir)) {
      send(`Output directory missing: ${outDir}`);
      wc.send('parse-complete', { success: false, files: [] });
      return;
    }
    const outputs = await fs.promises.readdir(outDir);
    for (const file of outputs) {
      if (file.toLowerCase().endsWith('.json') || file.toLowerCase().endsWith('.tid')) {
        const dest = path.join(parsedDir, file);
        await fs.promises.rename(path.join(outDir, file), dest);
        outputFiles.push(dest);
        send(`Output: ${file}`);
      }
    }
    wc.send('parse-complete', { success: true, files: outputFiles });
  } catch (e) {
    if (cancelled) {
      send('Parsing cancelled.');
    } else {
      send(`Error: ${e.message}`);
    }
    wc.send('parse-complete', { success: false, files: [] });
  } finally {
    currentParseCancel = null;
    if (!keepTempDirs && tempDir) {
      try { await fs.promises.rm(tempDir, { recursive: true, force: true }); } catch {}
    }
  }
});

function runProcess(cmd, args, cwd, wc, useShell = false, registerChild, inputOnSpawn = null) {
  return new Promise((resolve, reject) => {
    let resolved;
    try {
      resolved = resolveWindowsCommand(cmd, args, wc);
    } catch (error) {
      reject(error);
      return;
    }
    const child = spawn(resolved.cmd, resolved.args, {
      cwd,
      shell: useShell,
      windowsHide: true,
      env: resolved.env || process.env
    });
    if (registerChild) registerChild(child);
    if (inputOnSpawn) {
      child.once('spawn', () => {
        try {
          if (child.stdin) child.stdin.write(inputOnSpawn);
        } catch {}
      });
    }
    child.stdout.on('data', d => wc.send('parse-progress', d.toString().trim()));
    child.stderr.on('data', d => {
      const text = d.toString().trim();
      if (!text) return;
      if (resolved.cmd === 'wine') {
        const lower = text.toLowerCase();
        if (!wineDotnetAlerted && (lower.includes('you must install .net') || lower.includes('hostfxr.dll'))) {
          wineDotnetAlerted = true;
          const url = 'https://aka.ms/dotnet-core-applaunch?missing_runtime=true&arch=x64&rid=win-x64&os=win10';
          const message = `Wine requires the .NET Desktop Runtime for these tools. Please install it and try again:\n${url}`;
          wc.send('parse-progress', message);
          dialog.showErrorBox('.NET runtime required', message);
          shell.openExternal(url);
        }
        return;
      }
      wc.send('parse-progress', `Error: ${text}`);
    });
    child.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }
      if (code === 2147516566) {
        const url = 'https://aka.ms/dotnet-core-applaunch?framework=Microsoft.NETCore.App&framework_version=8.0.0&arch=x64&rid=win-x64&os=win10';
        wc.send('parse-progress', `Missing .NET runtime. Please download it from: ${url}`);
        shell.openExternal(url);
      }
      reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}
