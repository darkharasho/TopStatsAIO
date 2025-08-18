const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

async function apply(zipPath, parentPid, targetDir, exeName) {
  const execDir = targetDir;
  // wait for parent to exit
  while (parentPid) {
    try {
      process.kill(parentPid, 0);
      await new Promise(r => setTimeout(r, 500));
    } catch {
      break;
    }
  }
  try {
    const tmpDir = await fs.promises.mkdtemp(path.join(path.dirname(zipPath), 'extract-'));
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tmpDir, true);
    const entries = await fs.promises.readdir(tmpDir);
    let rootDir = tmpDir;
    if (entries.length === 1) {
      const inner = path.join(tmpDir, entries[0]);
      try {
        if ((await fs.promises.stat(inner)).isDirectory()) rootDir = inner;
      } catch {}
    }
    const items = await fs.promises.readdir(rootDir);
    for (const item of items) {
      await fs.promises.cp(path.join(rootDir, item), path.join(execDir, item), { recursive: true, force: true });
    }
    await fs.promises.unlink(zipPath).catch(() => {});
    await fs.promises.rm(path.dirname(zipPath), { recursive: true, force: true }).catch(() => {});
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    spawn(path.join(execDir, exeName), [], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    console.error('Failed to apply update:', e);
  }
}

const [zipPath, parentPidStr, targetDir, exeName] = process.argv.slice(2);
apply(zipPath, Number(parentPidStr), targetDir, exeName);
