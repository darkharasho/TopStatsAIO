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

// Ensure dist exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

console.log('Building standalone package...');

// build portable using electron-packager
run(`npx electron-packager . TopStatsAIO --platform=win32 --arch=x64 --icon=media/TopStatsAIO-Logo.png --out=dist --overwrite --ignore="^/dist$"`);

// zip portable folder
const portableDir = path.join(distDir, 'TopStatsAIO-win32-x64');
if (fs.existsSync(portableDir)) {
    console.log('Zipping standalone package...');
    const zip = new AdmZip();
    zip.addLocalFolder(portableDir);
    const zipPath = path.join(distDir, `TopStatsAIO-${version}-standalone.zip`);
    zip.writeZip(zipPath);
    generateBlockmap(zipPath);
    console.log('Standalone package created:', zipPath);
}
