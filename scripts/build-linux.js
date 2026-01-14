const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir);

run('npx electron-builder --linux', {
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
});
