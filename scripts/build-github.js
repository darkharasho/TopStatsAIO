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
const skipReleaseNotes = args.includes('--skip-release-notes') || args.includes('--no-release-notes');
const skipPublish = args.includes('--skip-publish') || args.includes('--no-publish');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const gitCmd = isWin ? 'git.exe' : 'git';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadDotEnv() {
  loadDotEnvFile(path.resolve('.env'));
  loadDotEnvFile(path.resolve('.env.local'));
}

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

function hasGitTagLocal(tagName) {
  const result = spawnSync(gitCmd, ['rev-parse', '-q', '--verify', `refs/tags/${tagName}`], {
    stdio: 'ignore'
  });
  return result.status === 0;
}

function hasGitTagRemote(tagName) {
  const result = spawnSync(gitCmd, ['ls-remote', '--tags', 'origin', tagName], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  return result.status === 0 && Boolean((result.stdout || '').trim());
}

function ensureReleaseTag(version) {
  const tagName = `v${version}`;
  const localExists = hasGitTagLocal(tagName);
  const remoteExists = hasGitTagRemote(tagName);

  if (!localExists) {
    run(gitCmd, ['tag', tagName]);
  }
  if (!remoteExists) {
    run(gitCmd, ['push', 'origin', tagName]);
  }
}

const packagePath = path.resolve('package.json');
const packageRaw = fs.readFileSync(packagePath, 'utf8');
const packageJson = JSON.parse(packageRaw);

try {
  loadDotEnv();

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

  if (!skipReleaseNotes) {
    run(npmCmd, ['run', 'generate:release-notes']);
  }

  const currentVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
  if (!currentVersion) {
    console.error('package.json is missing a version.');
    process.exit(1);
  }
  ensureReleaseTag(String(currentVersion).trim());

  if (skipPublish) {
    run(npmCmd, ['run', 'dist:all']);
    process.exit(0);
  }

  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.error('GH_TOKEN or GITHUB_TOKEN is required to publish a GitHub release.');
    process.exit(1);
  }

  run(npxCmd, ['electron-builder', '--win', '--linux', 'AppImage', '--publish', 'always'], {
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
  });
  run(process.execPath, ['scripts/update-github-release-notes.js']);
} catch (error) {
  const exitCode = error && error.exitCode ? error.exitCode : 1;
  process.exit(exitCode);
}
