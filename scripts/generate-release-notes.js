#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const isWin = process.platform === 'win32';
const gitCmd = isWin ? 'git.exe' : 'git';
const packageJson = require('../package.json');

function runGit(args) {
  const result = spawnSync(gitCmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `git ${args.join(' ')} failed`);
  }
  return (result.stdout || '').trim();
}

function listCommits(rangeArgs) {
  const result = spawnSync(gitCmd, ['log', '--pretty=format:%s', ...rangeArgs], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return (result.stdout || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function classifyCommit(message) {
  const lower = message.toLowerCase();
  if (lower.startsWith('feat') || lower.includes('feature')) return 'Features';
  if (lower.startsWith('fix') || lower.includes('bug')) return 'Fixes';
  if (lower.startsWith('perf') || lower.includes('optimiz')) return 'Performance';
  return 'Other';
}

function main() {
  const version = String(packageJson.version || '').trim();
  if (!version) throw new Error('package.json version is missing');

  let lastTag = '';
  try {
    lastTag = runGit(['describe', '--tags', '--abbrev=0']);
  } catch {
    lastTag = '';
  }

  const commits = lastTag
    ? listCommits([`${lastTag}..HEAD`])
    : listCommits(['-n', '30']);

  const grouped = {
    Features: [],
    Fixes: [],
    Performance: [],
    Other: []
  };

  for (const message of commits) {
    grouped[classifyCommit(message)].push(message);
  }

  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# Release Notes - v${version}`);
  lines.push('');
  lines.push(`Date: ${date}`);
  if (lastTag) lines.push(`Changes since: ${lastTag}`);
  lines.push('');

  const order = ['Features', 'Fixes', 'Performance', 'Other'];
  let wroteAny = false;
  for (const section of order) {
    const entries = grouped[section];
    if (!entries.length) continue;
    wroteAny = true;
    lines.push(`## ${section}`);
    lines.push('');
    for (const entry of entries) {
      lines.push(`- ${entry}`);
    }
    lines.push('');
  }

  if (!wroteAny) {
    lines.push('## Notes');
    lines.push('');
    lines.push('- No commit messages found for this release window.');
    lines.push('');
  }

  const outPath = path.resolve('RELEASE_NOTES.md');
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
