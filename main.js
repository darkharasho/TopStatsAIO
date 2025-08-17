const { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');

const depsDir = path.join(__dirname, 'dependencies');
const versionsFile = path.join(depsDir, 'versions.json');
let currentParseCancel = null;

function ensureDeps() {
  if (!fs.existsSync(depsDir)) {
    fs.mkdirSync(depsDir, { recursive: true });
  }
}

function readVersions() {
  try {
    return JSON.parse(fs.readFileSync(versionsFile, 'utf8'));
  } catch {
    return {};
  }
}

function writeVersions(v) {
  fs.writeFileSync(versionsFile, JSON.stringify(v));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'TopStatsAIO' } });
  if (!res.ok) throw new Error('Fetch failed');
  return await res.json();
}

async function getLatest(repo) {
  return await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
}

async function downloadFile(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'TopStatsAIO' } });
  if (!res.ok) throw new Error('Download failed');
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buf);
}

async function downloadDependency(which) {
  ensureDeps();
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
    const versions = readVersions();
    versions.cli = rel.tag_name || rel.name;
    writeVersions(versions);
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
    const versions = readVersions();
    versions.combiner = rel.tag_name || rel.name;
    writeVersions(versions);
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
    const versions = readVersions();
    versions.parser = rel.tag_name || rel.name;
    writeVersions(versions);
  }
}

async function checkDependencies() {
  ensureDeps();
  const versions = readVersions();
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
    backgroundColor: '#00000000',
    backgroundMaterial: 'mica',
    titleBarStyle: 'hidden',
    visualEffectState: 'active',
    title: 'Top Stats AIO',
    icon: path.join(__dirname, 'media', 'TopStatsAIO-Logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', async info => {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: `Version ${info.version} is available. Update now?`
    });
    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Install and Restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Install Updates',
      message: 'Updates downloaded. Install now?'
    });
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.on('error', err => {
    console.error('Update error:', err);
  });
  autoUpdater.checkForUpdates().catch(err => {
    console.error('Update check failed:', err);
  });

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
        const node = {
          name: entry.name,
          path: fullPath,
          relativePath: path.relative(rootDir, fullPath),
          type: entry.isDirectory() ? 'directory' : 'file',
          mtime: stat.mtimeMs
        };
        wc.send('tree-node', { parent: dir, node });
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
ipcMain.handle('get-theme', () => nativeTheme.themeSource);
ipcMain.handle('get-version', () => app.getVersion());

ipcMain.on('set-theme', (event, theme) => {
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
    console.error(e);
    return false;
  }
});

ipcMain.handle('check-dependencies', async () => {
  try {
    return await checkDependencies();
  } catch (e) {
    console.error(e);
    return { cli: { needsUpdate: false }, combiner: { needsUpdate: false }, parser: { needsUpdate: false } };
  }
});

ipcMain.handle('open-parsed-folder', async () => {
  const dir = path.join(__dirname, 'parsed_files');
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    return await shell.openPath(dir);
  } catch (e) {
    console.error('Failed to open parsed folder', e);
    return '';
  }
});

ipcMain.on('cancel-parse', () => {
  if (currentParseCancel) currentParseCancel();
});

ipcMain.handle('start-parse', async (event, data) => {
  const wc = event.sender;
  const files = data.files || [];
  const opts = data.options || {};
  const parsedDir = path.join(__dirname, 'parsed_files');
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

async function editEIConfig(template, dest, outDir, token) {
  try {
    const lines = await fs.promises.readFile(template, 'utf8');
    const replaced = lines.split(/\r?\n/).map(l => {
      if (l.startsWith('OutLocation=')) return `OutLocation=${outDir}`;
      if (l.startsWith('DPSReportUserToken=')) return `DPSReportUserToken=${token || ''}`;
      return l;
    }).join('\n');
    await fs.promises.writeFile(dest, replaced, 'utf8');
  } catch (e) { throw e; }
}

async function editTopStatsConfig(template, dest, opts) {
  const lines = await fs.promises.readFile(template, 'utf8');
  const replaced = lines.split(/\r?\n/).map(l => {
    if (l.startsWith('guild_name = ')) return `guild_name = ${opts.guildName || ''}`;
    if (l.startsWith('guild_id = ')) return `guild_id = ${opts.guildId || ''}`;
    if (l.startsWith('api_key = ')) return `api_key = ${opts.apiKey || ''}`;
    if (l.startsWith('db_update = ')) return `db_update = ${opts.dbUpdate ? 'true' : 'false'}`;
    return l;
  }).join('\n');
  await fs.promises.writeFile(dest, replaced, 'utf8');
}

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
