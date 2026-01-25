const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const pkg = require('../package.json');
const version = pkg.version.replace(/\./g, '_');
const distDir = path.join(__dirname, '..', 'dist');

function getAppBuilderPath() {
  const platform = process.platform;
  const arch = process.arch;
  const platformDir = platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'linux';
  const archDir = arch === 'arm64' ? 'arm64' : 'x64';
  const exe = platform === 'win32' ? 'app-builder.exe' : 'app-builder';
  return path.join(__dirname, '..', 'node_modules', 'app-builder-bin', platformDir, archDir, exe);
}

function generateBlockmap(filePath) {
  if (!fs.existsSync(filePath)) return;
  const builderPath = getAppBuilderPath();
  const blockmapPath = `${filePath}.blockmap`;
  const cmd = `"${builderPath}" blockmap --input "${filePath}" --output "${blockmapPath}"`;
  console.log('Generating blockmap for', path.basename(filePath));
  execSync(cmd, { stdio: 'pipe' });
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

// clean dist if not disabled
if (!process.argv.includes('--no-clean')) {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir);
}

// build installer
run('npx electron-builder --win', {
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
});

// rename installer
const installer = path.join(distDir, 'TopStatsAIO Setup.exe');
if (fs.existsSync(installer)) {
  const renamed = path.join(distDir, `TopStatsAIO-${version}-setup.exe`);
  fs.renameSync(installer, renamed);
  generateBlockmap(renamed);
}
