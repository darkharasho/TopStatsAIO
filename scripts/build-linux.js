const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function hasFlatpakBuilder() {
  try {
    execSync('flatpak-builder --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

if (!process.argv.includes('--no-clean')) {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir);
}

const flatpakAvailable = hasFlatpakBuilder();
const linuxTargets = flatpakAvailable ? 'AppImage flatpak' : 'AppImage';

if (!flatpakAvailable) {
  console.warn('flatpak-builder not found; building AppImage only.');
}

run(`npx electron-builder --linux ${linuxTargets}`, {
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
});
