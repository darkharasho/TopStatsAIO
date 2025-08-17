const fs = require('fs');
const os = require('os');
const path = require('path');
const appName = require('../package.json').name;

let userData;
if (process.platform === 'win32') {
  userData = path.join(process.env.APPDATA || '', appName);
} else if (process.platform === 'darwin') {
  userData = path.join(os.homedir(), 'Library', 'Application Support', appName);
} else {
  userData = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), appName);
}

if (fs.existsSync(userData)) {
  fs.rmSync(userData, { recursive: true, force: true });
  console.log(`Cleared settings at ${userData}`);
} else {
  console.log(`No settings found at ${userData}`);
}
