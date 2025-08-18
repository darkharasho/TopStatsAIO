const { app, BrowserWindow, ipcMain, nativeTheme, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');
const semver = require('semver');
const { ensureDeps, readVersions, writeVersions, editEIConfig, editTopStatsConfig } = require('./utils');
const useMica = process.platform === 'win32' && parseInt(os.release().split('.')[2], 10) >= 22000;

let depsDir;
let versionsFile;
let logFile;
let currentParseCancel = null;
let appTheme = nativeTheme.themeSource;
let mainWindow = null;
let pendingUpdate = null;

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

process.on('uncaughtException', logError);
process.on('unhandledRejection', logError);

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

async function downloadFile(url, dest, onProgress) {
  const res = await fetch(url, { headers: { 'User-Agent': 'TopStatsAIO' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed: ${res.status} ${res.statusText}\n${text}`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  const file = fs.createWriteStream(dest);
  if (res.body && res.body.getReader) {
    const reader = res.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      file.write(Buffer.from(value));
      received += value.length;
      if (onProgress && total) onProgress(received / total);
    }
    file.end();
    await new Promise((resolve, reject) => {
      file.on('finish', resolve);
      file.on('error', reject);
    });
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    file.write(buf);
    file.end();
    if (onProgress) onProgress(1);
  }
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
    ...(useMica ? { backgroundMaterial: 'mica', visualEffectState: 'active' } : {}),
    titleBarStyle: 'hidden',
    title: 'Top Stats AIO',
    icon: path.join(__dirname, 'media', 'TopStatsAIO-Logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
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
    height: 180,
    resizable: false,
    frame: false,
    backgroundColor: useMica ? '#00000000' : '#2d2d2d',
    ...(useMica ? { backgroundMaterial: 'mica', visualEffectState: 'active' } : {}),
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  const mode = isInstalled() && pendingUpdate.setupUrl ? 'install' : 'link';
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
      const setup = assets.find(a => /setup.*\.exe$/i.test(a.name));
      const canShow = !isInstalled() || setup;
      if (canShow) {
        pendingUpdate = {
          version: latest,
          releaseUrl: rel.html_url,
          setupUrl: setup ? setup.browser_download_url : null
        };
        if (parent && parent.webContents) {
          parent.webContents.send('show-update-notice');
        }
        showUpdatePrompt(parent);
      }
    }
  } catch (err) {
    logError('Update check failed:', err);
  }
}

async function performAppUpdate(wc) {
  if (!pendingUpdate) return;
  try {
    if (!isInstalled()) {
      await shell.openExternal(pendingUpdate.releaseUrl);
      return;
    }
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tsa-update-'));
    const send = (stage, progress) => wc && wc.send('update-progress', { stage, progress });
    log('performAppUpdate temp dir', tmpDir);
    if (!pendingUpdate.setupUrl) throw new Error('No installer available');
    const setupPath = path.join(tmpDir, 'setup.exe');
    log('Downloading installer to', setupPath);
    await downloadFile(pendingUpdate.setupUrl, setupPath, p => send('download', p));
    send('apply', 1);
    log('Launching installer');
    const err = await shell.openPath(setupPath);
    if (err) throw new Error(err);
    app.quit();
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
  } else {
    console.log('Skipping update check; app not packaged');
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
  nativeTheme.themeSource = theme;
  BrowserWindow.getAllWindows().forEach(w => {
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

ipcMain.handle('open-parser-folder', async (event, which) => {
  ensureDeps();
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
    opts.dbPath = basePath.replace(/\\/g, '/');
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
  currentParseCancel = () => {
    cancelled = true;
    if (child) child.kill();
  };
  try {
    send(`Created temp folder at ${tempDir}`);
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
        wc.send('parse-complete', false);
        return;
      }
    }

    const eiTemplate = path.join(__dirname, 'EliteInsightsConfigTemplate.conf');
    const eiConf = path.join(tempDir, 'EliteInsightConfig.conf');
    await editEIConfig(eiTemplate, eiConf, tempDir, opts.dpsUserToken);
    const combTemplate = path.join(__dirname, 'top_stats_config.ini');
    const combConf = path.join(tempDir, 'top_stats_config.ini');
    await editTopStatsConfig(combTemplate, combConf, opts);
    send('Config files prepared');

    let cliExe = path.join(depsDir, 'eicli', 'GuildWars2EliteInsights-CLI.exe');
    const processedDir = path.join(tempDir, 'ProcessedLogs');
    if (!fs.existsSync(cliExe)) {
      const alt = path.join(depsDir, 'eicli', 'gw2eicli.exe');
      if (fs.existsSync(alt)) {
        cliExe = alt;
      } else {
        send('EI CLI not found.');
        wc.send('parse-complete', false);
        return;
      }
    }

    const zevtc = await fs.promises.readdir(tempDir);
    const logs = zevtc.filter(f => f.toLowerCase().endsWith('.zevtc'));
    if (logs.length > 0) {
      step('cli', 'EI CLI', 0, null, 0, logs.length);
      for (let i = 0; i < logs.length; i++) {
        try {
          send(`Running EI CLI on ${logs[i]}`);
          await runProcess(cliExe, ['-c', eiConf, path.join(tempDir, logs[i])], tempDir, wc, false, c => child = c);
          step('cli', 'EI CLI', (i + 1) / logs.length, null, i + 1, logs.length);
        } catch (e) {
          step('cli', 'EI CLI', (i + 1) / logs.length, 'Error', i + 1, logs.length);
          throw e;
        }
        if (cancelled) {
          send('Parsing cancelled.');
          wc.send('parse-complete', false);
          return;
        }
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
            await runProcess(combExe, combArgs, tempDir, wc, false, c => child = c);
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
      wc.send('parse-complete', false);
      return;
    }

    const outDir = opts.parser === 'combiner' ? processedDir : tempDir;
    if (!fs.existsSync(outDir)) {
      send(`Output directory missing: ${outDir}`);
      wc.send('parse-complete', false);
      return;
    }
    const outputs = await fs.promises.readdir(outDir);
    for (const file of outputs) {
      if (file.toLowerCase().endsWith('.json') || file.toLowerCase().endsWith('.tid')) {
        await fs.promises.rename(path.join(outDir, file), path.join(parsedDir, file));
        send(`Output: ${file}`);
      }
    }
    wc.send('parse-complete', true);
  } catch (e) {
    if (cancelled) {
      send('Parsing cancelled.');
    } else {
      send(`Error: ${e.message}`);
    }
    wc.send('parse-complete', false);
  } finally {
    currentParseCancel = null;
    try { await fs.promises.rm(tempDir, { recursive: true, force: true }); } catch {}
  }
});

function runProcess(cmd, args, cwd, wc, useShell = false, registerChild) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: useShell, windowsHide: true });
    if (registerChild) registerChild(child);
    child.stdout.on('data', d => wc.send('parse-progress', d.toString().trim()));
    child.stderr.on('data', d => wc.send('parse-progress', `Error: ${d.toString().trim()}`));
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
