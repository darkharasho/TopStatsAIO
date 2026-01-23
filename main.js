const { app, BrowserWindow, ipcMain, nativeTheme, shell, dialog, safeStorage, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, spawn } = require('child_process');
const AdmZip = require('adm-zip');
const semver = require('semver');
const { ensureDeps, readVersions, writeVersions, editEIConfig, editTopStatsConfig } = require('./utils');
const { downloadFile, downloadUpdateAsset, collectAssetInfo, resolveUpdateMode, setLogger } = require('./update');

const {
  performPreFlightCheck,
  getWineDotnetAlerted,
  setWineDotnetAlerted,
  toWindowsPath,
  hasWine,
  resolveWindowsCommand,
  getNativeDotnetPath,
  hasNativeDotnet
} = require('./wineUtils');
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

if (process.platform === 'linux') {
  // Ensure WM_CLASS matches the desktop entry so the panel shows the correct icon.
  app.setName('TopStatsAIO');
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// FIX: Ensure AppImage uses a stable User Data directory
if (isLinux && process.env.APPIMAGE) {
  const home = os.homedir();
  const stableUserData = path.join(home, '.config', 'TopStatsAIO');
  try {
    if (!fs.existsSync(stableUserData)) {
      fs.mkdirSync(stableUserData, { recursive: true });
    }
    app.setPath('userData', stableUserData);
    console.log('Force-set User Data path for AppImage:', stableUserData);
  } catch (e) {
    console.error('Failed to set stable User Data path:', e);
  }
}

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

// Wine functions moved to wineUtils.js

function saveTiddlyhostCredentials({ username = '', password = '' } = {}) {
  if (!safeStorage.isEncryptionAvailable()) {
    return false;
  }
  const hasValues = Boolean(username || password);
  const filePath = getTiddlyhostCredentialsPath();
  if (!hasValues) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch { }
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
  } catch { }
}

function log(...args) {
  console.log(...args);
  if (!logFile) return;
  const msg = args.map(a => String(a)).join(' ');
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { }
}

setLogger(logError);

process.on('uncaughtException', logError);
process.on('uncaughtException', logError);
process.on('unhandledRejection', logError);

// Enable transparency on Linux - REMOVED


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


function getApiCachePath() {
  return path.join(app.getPath('userData'), 'api-cache.json');
}

function getUiStatePath() {
  return path.join(app.getPath('userData'), 'ui-state.json');
}

function loadApiCache() {
  try {
    const data = fs.readFileSync(getApiCachePath(), 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function loadUiState() {
  try {
    const data = fs.readFileSync(getUiStatePath(), 'utf8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveApiCache(cache) {
  try {
    fs.writeFileSync(getApiCachePath(), JSON.stringify(cache, null, 2), 'utf8');
  } catch { }
}

function saveUiState(patch = {}) {
  const next = { ...loadUiState() };
  if (typeof patch.lastFolder === 'string') {
    next.lastFolder = patch.lastFolder;
  }
  try {
    fs.writeFileSync(getUiStatePath(), JSON.stringify(next, null, 2), 'utf8');
  } catch (e) {
    logError('Failed to save UI state', e);
  }
  return next;
}

async function fetchJson(url) {
  const cache = loadApiCache();
  const cachedEntry = cache[url];

  const headers = {
    'User-Agent': 'TopStatsAIO',
    Accept: 'application/vnd.github+json'
  };

  if (cachedEntry && cachedEntry.etag) {
    headers['If-None-Match'] = cachedEntry.etag;
  }
  if (cachedEntry && cachedEntry.lastModified) {
    headers['If-Modified-Since'] = cachedEntry.lastModified;
  }

  try {
    const res = await fetch(url, { headers });

    // 304 Not Modified - Return cached data
    if (res.status === 304 && cachedEntry) {
      console.log(`[Cache Hit] 304 Not Modified for ${url}`);
      return cachedEntry.data;
    }

    if (!res.ok) {
      // 403 Forbidden (Rate Limit) or other errors - Fallback to cache if available
      if ((res.status === 403 || res.status >= 500) && cachedEntry) {
        console.warn(`[Cache Fallback] API Error ${res.status} for ${url}. Using cached data.`);
        return cachedEntry.data;
      }

      const text = await res.text().catch(() => '');
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}\n${text}`);
    }

    const data = await res.json();

    // Store new cache entry
    const newEntry = {
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      data: data,
      timestamp: Date.now()
    };

    cache[url] = newEntry;
    saveApiCache(cache);

    return data;
  } catch (err) {
    // Network failure - Fallback to cache
    if (cachedEntry) {
      console.warn(`[Cache Fallback] Network Error for ${url}: ${err.message}. Using cached data.`);
      return cachedEntry.data;
    }
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
  } catch { }
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

  // Verify actual file existence
  const cliDir = path.join(depsDir, 'eicli');
  const cliExe1 = path.join(cliDir, 'GuildWars2EliteInsights-CLI.exe');
  const cliExe2 = path.join(cliDir, 'gw2eicli.exe');
  const hasCli = fs.existsSync(cliExe1) || fs.existsSync(cliExe2);

  const combDir = path.join(depsDir, 'logcombiner');
  const hasComb = fs.existsSync(combDir);

  const parserDir = path.join(depsDir, 'topstatsparser');
  const hasParser = fs.existsSync(parserDir);

  // Clear cached versions if files don't exist
  if (!hasCli) versions.cli = null;
  if (!hasComb) versions.combiner = null;
  if (!hasParser) versions.parser = null;

  const [cliRel, combRel, parserRel] = await Promise.all([
    getLatest('baaron4/GW2-Elite-Insights-Parser'),
    getLatest('Drevarr/GW2_EI_log_combiner'),
    getLatest('Drevarr/arcdps_top_stats_parser')
  ]);
  const cliVer = cliRel.tag_name || cliRel.name;
  const combVer = combRel.tag_name || combRel.name;
  const parserVer = parserRel.tag_name || parserRel.name;
  return {
    cli: {
      current: versions.cli,
      latest: cliVer,
      needsUpdate: !hasCli || (versions.cli !== cliVer)
    },
    combiner: {
      current: versions.combiner,
      latest: combVer,
      needsUpdate: !hasComb || (versions.combiner !== combVer)
    },
    parser: {
      current: versions.parser,
      latest: parserVer,
      needsUpdate: !hasParser || (versions.parser !== parserVer)
    }
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#2d2d2d',
    ...(useMica ? { backgroundMaterial: 'mica', visualEffectState: 'active' } : {}),
    roundedCorners: true,
    titleBarStyle: 'hidden',
    title: 'Top Stats AIO',
    icon: path.join(__dirname, 'media', process.platform === 'win32' ? 'TopStatsAIO-Logo.ico' : 'TopStatsAIO-Logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  });

  win.loadURL('app://-/index.html');
  return win;
}



function isInstalled() {
  const p = process.execPath.toLowerCase();
  if (process.platform === 'win32') {
    return p.includes('program files') || p.includes(path.join('appdata', 'local', 'programs').toLowerCase());
  }
  return p.startsWith('/opt/') || p.startsWith('/usr/');
}

// Simplified auto-update logic for slide-out UI
async function autoStartDownload(wc) {
  if (!pendingUpdate) return;

  // Update renderer that update is available
  wc.send('update-available', { version: pendingUpdate.version });

  try {
    const send = (stage, progress) => {
      // Map stages to renderer expectations if needed, or just send progress
      if (stage === 'download') {
        wc.send('download-progress', { percent: progress * 100 });
      }
    };

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tsa-update-'));
    pendingUpdate.tmpDir = tmpDir; // Store for restart phase

    let asset;
    let destPath;

    if (pendingUpdate.mode === 'portable') {
      asset = pendingUpdate.assets.portable || pendingUpdate.assets.installer;
      const zipName = asset.name && asset.name.toLowerCase().endsWith('.zip') ? asset.name : 'update.zip';
      destPath = path.join(tmpDir, zipName);
    } else if (pendingUpdate.mode === 'installer') {
      asset = pendingUpdate.assets.installer;
      destPath = path.join(tmpDir, asset.name || 'setup.exe');
    } else if (pendingUpdate.mode === 'deb' || pendingUpdate.mode === 'appimage') {
      asset = pendingUpdate.mode === 'appimage' ? pendingUpdate.assets.appimage : pendingUpdate.assets.deb;
      destPath = path.join(tmpDir, asset.name);
    } else {
      // Link, just show notice?
      return;
    }

    if (!asset) throw new Error('Update asset not found');

    pendingUpdate.localPath = destPath;
    await downloadUpdateAsset(asset, destPath, p => send('download', p));

    // Download complete
    wc.send('update-downloaded', { version: pendingUpdate.version });

  } catch (e) {
    logError('Auto-download failed:', e);
    wc.send('update-error', { message: e.message });
  }
}

async function performRestartAndInstall() {
  if (!pendingUpdate || !pendingUpdate.localPath) return;

  if (fakeUpdateMode && pendingUpdate.localPath === 'MOCK_PATH') {
    log('Fake update install triggered. Quitting app...');
    app.quit();
    return;
  }

  try {
    if (pendingUpdate.mode === 'portable') {
      // Basic portable apply logic
      const tmpDir = pendingUpdate.tmpDir;
      const extractDir = path.join(tmpDir, 'payload');
      await fs.promises.mkdir(extractDir, { recursive: true });
      const zip = new AdmZip(pendingUpdate.localPath);
      zip.extractAllTo(extractDir, true);
      const payloadRoot = await findPayloadRoot(extractDir);
      const scriptPath = await createPortableUpdateScript(payloadRoot, path.dirname(process.execPath), tmpDir);
      spawn('cmd.exe', ['/c', 'start', '', scriptPath], { detached: true, windowsHide: true });
      app.quit();
    } else if (pendingUpdate.mode === 'installer') {
      const err = await shell.openPath(pendingUpdate.localPath);
      if (err) throw new Error(err);
      app.quit();
    } else if (pendingUpdate.mode === 'appimage') {
      await fs.promises.chmod(pendingUpdate.localPath, 0o755);
      spawn(pendingUpdate.localPath, [], { detached: true, stdio: 'ignore' }).unref();
      app.quit();
    } else if (pendingUpdate.mode === 'deb') {
      const err = await shell.openPath(pendingUpdate.localPath);
      if (err) throw new Error(err);
      app.quit(); // Optional? Usually system installer handles it
    }
  } catch (e) {
    logError('Install failed:', e);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', { message: e.message });
    }
  }
}


const fakeUpdateMode = process.argv.includes('--fake-update');

const allowDevUpdates = process.argv.includes('--dev-update') || fakeUpdateMode;

async function simulateFakeDownload(wc) {
  if (!pendingUpdate) return;

  // 1. Checking state
  wc.send('checking-for-update');
  await new Promise(r => setTimeout(r, 1500));

  wc.send('update-available', { version: pendingUpdate.version });

  // Simulate steps 0% to 100%
  const steps = [10, 25, 45, 60, 80, 95, 100];
  for (const p of steps) {
    await new Promise(r => setTimeout(r, 600)); // Delay between steps
    wc.send('download-progress', { percent: p });
  }

  wc.send('update-downloaded', { version: pendingUpdate.version });
}

async function checkForAppUpdates(parent) {
  if (fakeUpdateMode) {
    log('Fake update mode active. Simulating update...');
    pendingUpdate = {
      version: '9.9.9',
      releaseUrl: 'https://github.com/darkharasho/TopStatsAIO/releases/tag/v9.9.9',
      assets: { portable: { name: 'FakeUpdate.zip', browser_download_url: '' } },
      mode: 'portable',
      localPath: 'MOCK_PATH' // flag for restart handler
    };

    if (parent && parent.webContents) {
      simulateFakeDownload(parent.webContents);
    }
    return;
  }

  try {
    if (parent && parent.webContents) {
      parent.webContents.send('checking-for-update');
    }

    const rel = await getLatest('darkharasho/TopStatsAIO');
    const latest = semver.clean(rel.tag_name || rel.name);
    const current = app.getVersion();

    if (latest && semver.gt(latest, current)) {
      const assets = rel.assets || [];
      const portable = collectAssetInfo(assets, /standalone.*\.zip$/i);
      const installer = collectAssetInfo(assets, /setup.*\.exe$/i);
      const deb = collectAssetInfo(assets, /.*\.deb$/i);
      const appimage = collectAssetInfo(assets, /.*\.AppImage$/i);
      const isAppImage = !!process.env.APPIMAGE;
      const mode = resolveUpdateMode(isInstalled(), { portable, installer, deb, appimage }, isAppImage);
      pendingUpdate = {
        version: latest,
        releaseUrl: rel.html_url,
        assets: { portable, installer, deb, appimage },
        mode
      };

      // Auto-start download for seamless experience
      if (parent && parent.webContents) {
        autoStartDownload(parent.webContents);
      }
    } else {
      if (parent && parent.webContents) {
        parent.webContents.send('update-not-available');
      }
    }
  } catch (err) {
    logError('Update check failed:', err);
    if (parent && parent.webContents) {
      // Optionally notify user of error or just silent fail
      // parent.webContents.send('update-error', { message: err.message });
    }
  }
}

// IPC Handlers for new update flow
ipcMain.on('restart-app', () => {
  performRestartAndInstall();
});

app.whenReady().then(() => {
  console.log('DEBUG: User Data Path:', app.getPath('userData'));
  console.log('DEBUG: WINEPREFIX:', path.join(app.getPath('userData'), 'wine'));
  const userData = app.getPath('userData');
  depsDir = path.join(userData, 'dependencies');
  versionsFile = path.join(depsDir, 'versions.json');
  logFile = path.join(userData, 'debug.log');

  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
      const resolvedPath = path.normalize(path.join(__dirname, pathname));
      if (!resolvedPath.startsWith(path.normalize(__dirname + path.sep))) {
        callback({ error: -6 });
        return;
      }
      callback({ path: resolvedPath });
    } catch (error) {
      logError('Failed to resolve app:// URL', error);
      callback({ error: -324 });
    }
  });

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
ipcMain.handle('get-ui-state', () => loadUiState());
ipcMain.handle('set-ui-state', (event, patch) => saveUiState(patch));

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
    } catch { }
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

ipcMain.handle('get-skin-content', async () => {
  try {
    const skinPath = path.join(__dirname, 'TopStats_Full_Skin.json');
    if (!fs.existsSync(skinPath)) return null;
    const raw = await fs.promises.readFile(skinPath, 'utf8');
    const json = JSON.parse(raw);
    const versionTiddler = json.find(t => t.title === '$:/TopStats/Skin/Version');
    const version = versionTiddler ? versionTiddler.text.trim() : '1.0.0';

    return {
      name: 'TopStats_Full_Skin.json',
      data: Buffer.from(raw).toString('base64'),
      version: version
    };
  } catch (e) {
    logError('Failed to get skin content', e);
    return null;
  }
});



ipcMain.on('cancel-parse', () => {
  if (currentParseCancel) currentParseCancel();
});

ipcMain.handle('start-parse', async (event, data) => {
  const wc = event.sender;
  const files = data.files || [];
  const opts = data.options || {};
  log('[parse] start-parse called', { fileCount: files.length, parser: opts.parser });
  wc.send('parse-progress', 'Parse request received.');
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
    log('[parse] temp dir created', tempDir);
    if (keepTempDirs) {
      send('Debug mode active: temporary folder will not be deleted automatically.');
    }

    if (process.platform !== 'win32') {
      log('[parse] running preflight check', { depsDir, userData: app.getPath('userData') });
      const ready = await performPreFlightCheck(wc, depsDir, app.getPath('userData'));
      log('[parse] preflight check complete', { ready });
      if (!ready) {
        wc.send('parse-complete', { success: false, files: [] });
        return;
      }
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
    let configOutDir = tempDir;
    let configInputDir = processedDir;

    // Check for native dotnet support
    const nativeDotnetPath = process.platform !== 'win32' ? getNativeDotnetPath(depsDir) : null;
    const hasNativeHelper = nativeDotnetPath && fs.existsSync(nativeDotnetPath);

    // Only convert to Windows paths if we are strictly using Wine AND NOT using native dotnet
    if (process.platform !== 'win32' && hasWine() && !hasNativeHelper) {
      try {
        const converted = await toWindowsPath([tempDir, processedDir]);
        if (converted && converted.length === 2) {
          configOutDir = converted[0];
          configInputDir = converted[1];
        }
      } catch (e) {
        console.warn('Failed to convert paths for config:', e);
      }
    }

    if (!opts.inputDirectory) {
      opts.inputDirectory = configInputDir.replace(/\\/g, '/');
    }
    const eiTemplate = path.join(__dirname, 'EliteInsightsConfigTemplate.conf');
    const eiConf = path.join(tempDir, 'EliteInsightConfig.conf');
    // Use the Windows-friendly path for the config file content
    await editEIConfig(eiTemplate, eiConf, configOutDir, opts.dpsUserToken, { anonymizePlayers: opts.anonymizePlayers });



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
        const nativeDotnet = process.platform !== 'win32' ? getNativeDotnetPath(depsDir) : null;
        const useNative = nativeDotnet && fs.existsSync(nativeDotnet);

        let cmdToRun = cliExe;
        let argsToRun = [];

        if (useNative) {
          send('Using Native Linux .NET Runtime');
          const dllPath = cliExe.replace(/\.exe$/i, '.dll');
          cmdToRun = nativeDotnet;
          // Use Linux paths directly
          const linuxPaths = [eiConf, ...logs.map(f => path.join(tempDir, f))];
          argsToRun = [dllPath, '-c', linuxPaths[0], ...linuxPaths.slice(1)];
        } else {
          // Legacy/Windows Logic
          const linuxPaths = [eiConf, ...logs.map(f => path.join(tempDir, f))];
          let windowsPaths = linuxPaths;
          if (process.platform !== 'win32' && hasWine()) {
            try {
              windowsPaths = await toWindowsPath(linuxPaths);
            } catch (e) { console.warn('Path conversion failed', e); }
          }

          const confPath = windowsPaths[0];
          const logPaths = windowsPaths.slice(1);

          argsToRun = ['-c', confPath, ...logPaths];

          if (process.platform !== 'win32' && hasWine()) {
            const dllPath = cliExe.replace(/\.exe$/i, '.dll');
            if (fs.existsSync(dllPath)) {
              cmdToRun = 'dotnet.exe';
              let winDllPath = dllPath;
              try {
                const converted = await toWindowsPath(dllPath);
                if (converted && converted.length > 0) winDllPath = converted[0];
              } catch (e) { console.warn('DLL path conversion failed', e); }
              argsToRun = [winDllPath, '-c', confPath, ...logPaths];
            }
          }
        }

        await runProcess(cmdToRun, argsToRun, tempDir, wc, false, c => child = c);
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
        await moveFile(path.join(tempDir, f), path.join(processedDir, f));
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
            const nativeDotnet = process.platform !== 'win32' ? getNativeDotnetPath(depsDir) : null;
            const useNative = nativeDotnet && fs.existsSync(nativeDotnet);

            let cmdToRun = combExe;
            let argsToRun = [];

            // Base Linux args (valid if native or if no path conversion needed yet)
            let currentProcessedDir = processedDir;
            let currentCombConf = combConf;

            if (useNative) {
              // Native Mode: Use Linux paths + Native Runtime
              send('Using Native Linux .NET Runtime for Combiner');
              const dllPath = combExe.replace(/\.exe$/i, '.dll');
              if (fs.existsSync(dllPath)) {
                cmdToRun = nativeDotnet;
                argsToRun = [dllPath, '-i', currentProcessedDir, '-c', currentCombConf];
              } else {
                // Fallback if DLL missing? Should not happen.
                argsToRun = ['-i', currentProcessedDir, '-c', currentCombConf];
              }
            } else {
              // Legacy/Wine Mode
              // If path conversion ran earlier (lines 681), processedDir/combConf are already Windows paths.
              // But if they weren't converted (e.g. no wine detected or platform=win32), they are raw.

              // Note: The previous logic relied on configOutDir/configInputDir being converted.
              // But processedDir variable itself was NOT updated in the previous code block?
              // Let's re-check lines 681..
              // "if (converted) { configOutDir = converted[0]; configInputDir = converted[1]; }"
              // processedDir was NOT reassigned.

              // So if Wine, we MUST convert processedDir and combConf here if they aren't already.
              if (process.platform !== 'win32' && hasWine()) {
                try {
                  const wins = await toWindowsPath([processedDir, combConf]);
                  if (wins && wins.length === 2) {
                    currentProcessedDir = wins[0];
                    currentCombConf = wins[1];
                  }
                } catch (e) { console.warn('Combiner path conversion failed', e); }
              }

              argsToRun = ['-i', currentProcessedDir, '-c', currentCombConf];

              // Try to use dotnet.exe shim if possible for Wine stability
              if (process.platform !== 'win32' && hasWine()) {
                const dllPath = combExe.replace(/\.exe$/i, '.dll');
                if (fs.existsSync(dllPath)) {
                  cmdToRun = 'dotnet.exe';
                  let winDllPath = dllPath;
                  try {
                    const converted = await toWindowsPath(dllPath);
                    if (converted && converted.length > 0) winDllPath = converted[0];
                  } catch (e) { }
                  argsToRun = [winDllPath, '-i', currentProcessedDir, '-c', currentCombConf];
                }
              }
            }

            if (opts.description) {
              argsToRun.push('-d', opts.description);
            }

            const prettyCombCmd = `${cmdToRun} ${argsToRun.map(a => /[\s]/.test(a) ? `"${a}"` : a).join(' ')}`;
            send(`GW2 EI Log Combiner command: ${prettyCombCmd}`);

            await runProcess(cmdToRun, argsToRun, tempDir, wc, false, c => child = c, '\r\n');
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
        await moveFile(path.join(outDir, file), dest);
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
      try { await fs.promises.rm(tempDir, { recursive: true, force: true }); } catch { }
    }
  }
});

async function runProcess(cmd, args, cwd, wc, useShell = false, registerChild, inputOnSpawn = null) {
  let resolved;
  try {
    resolved = await resolveWindowsCommand(cmd, args, wc, depsDir, app.getPath('userData'));
  } catch (error) {
    throw error;
  }

  log('[parse] running process', { cmd: resolved.cmd, args: resolved.args, cwd, useShell });

  return new Promise((resolve, reject) => {
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
        } catch { }
      });
    }
    child.stdout.on('data', d => wc.send('parse-progress', d.toString().trim()));
    child.stderr.on('data', d => {
      const text = d.toString().trim();
      if (!text) return;
      if (resolved.cmd === 'wine') {
        const lower = text.toLowerCase();
        if (!getWineDotnetAlerted() && (lower.includes('you must install .net') || lower.includes('hostfxr.dll'))) {
          setWineDotnetAlerted(true);
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

// Helper to handle cross-device moves (EXDEV)
async function moveFile(source, target) {
  try {
    await fs.promises.rename(source, target);
  } catch (error) {
    if (error.code === 'EXDEV') {
      await fs.promises.copyFile(source, target);
      await fs.promises.unlink(source);
    } else {
      throw error;
    }
  }
}
