#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const allowedBumps = new Set(['patch', 'minor', 'major']);

function readBumpArg() {
  if (args.length === 0) return null;
  const bumpIndex = args.findIndex(arg => arg === '--bump');
  if (bumpIndex >= 0 && args[bumpIndex + 1]) return args[bumpIndex + 1];
  const direct = args.find(arg => allowedBumps.has(arg));
  return direct || null;
}

const bumpType = readBumpArg();
const skipTests = args.includes('--skip-tests') || args.includes('--no-tests');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const gitCmd = isWin ? 'git.exe' : 'git';

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    const error = new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

function bumpVersion(current, type) {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Unsupported version format: ${current}`);
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else if (type === 'patch') {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

const packagePath = path.resolve('package.json');
const packageRaw = fs.readFileSync(packagePath, 'utf8');
const packageJson = JSON.parse(packageRaw);

try {
  if (!skipTests) {
    run(npmCmd, ['test']);
  }

  if (bumpType) {
    if (!allowedBumps.has(bumpType)) {
      console.error(`Invalid bump type: ${bumpType}. Use patch, minor, or major.`);
      process.exit(1);
    }

    const currentVersion = String(packageJson.version || '').trim();
    if (!currentVersion) {
      console.error('package.json is missing a version.');
      process.exit(1);
    }

    const nextVersion = bumpVersion(currentVersion, bumpType);
    packageJson.version = nextVersion;
    fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

    run(npmCmd, ['install']);
    run(gitCmd, ['add', 'package.json', 'package-lock.json']);
    run(gitCmd, ['commit', '-m', `chore: bump version to ${nextVersion}`]);
    run(gitCmd, ['push']);
  }

  run(npmCmd, ['run', 'dist:all']);
} catch (error) {
  const exitCode = error && error.exitCode ? error.exitCode : 1;
  process.exit(exitCode);
}
