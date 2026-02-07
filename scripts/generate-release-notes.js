#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const releaseNotesPath = path.join(rootDir, 'RELEASE_NOTES.md');
const isWin = process.platform === 'win32';
const gitCmd = isWin ? 'git.exe' : 'git';

function execGit(args) {
  const result = spawnSync(gitCmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `git ${args.join(' ')} failed`);
  }
  return (result.stdout || '').trim();
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;
    const key = match[1];
    let value = match[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function parseResponseText(data) {
  if (data.output_text) return String(data.output_text).trim();
  if (!Array.isArray(data.output)) return '';
  const parts = [];
  for (const item of data.output) {
    if (item && item.type === 'message' && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (content && content.type === 'output_text' && content.text) {
          parts.push(content.text);
        }
      }
    }
  }
  return parts.join('\n').trim();
}

async function main() {
  loadEnvFile(path.join(rootDir, '.env'));
  loadEnvFile(path.join(rootDir, '.env.local'));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set. Aborting release notes generation.');
    process.exit(1);
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5-nano';
  const org = process.env.OPENAI_ORG;
  const project = process.env.OPENAI_PROJECT;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson && packageJson.version ? packageJson.version : '0.0.0';
  const nextTag = `v${version}`;

  let lastTag = '';
  try {
    const tags = execGit(['tag', '--sort=-v:refname'])
      .split('\n')
      .map(tag => tag.trim())
      .filter(Boolean);
    lastTag = tags.find(tag => tag !== nextTag) || '';
  } catch {
    lastTag = '';
  }

  const rangeArgs = lastTag ? [`${lastTag}..HEAD`] : ['-n', '30'];
  let commits = '';
  try {
    commits = execGit(['log', ...rangeArgs, '--no-merges', '--pretty=format:%s']);
  } catch {
    commits = '';
  }

  const rawCommitLines = commits
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const ignoreCommitPatterns = [
    /release notes/i,
    /update release notes/i,
    /bump version/i,
    /^chore:/i,
    /^build:/i,
    /dependency/i,
    /dependencies/i
  ];

  const commitLines = rawCommitLines.filter(
    line => !ignoreCommitPatterns.some(pattern => pattern.test(line))
  );

  let diffStat = '';
  let diffPatch = '';
  try {
    diffStat = execGit(['diff', lastTag ? `${lastTag}..HEAD` : 'HEAD~30..HEAD', '--stat']);
  } catch {
    diffStat = '';
  }
  try {
    diffPatch = execGit(['diff', lastTag ? `${lastTag}..HEAD` : 'HEAD~30..HEAD', '--unified=2', '--no-color']);
  } catch {
    diffPatch = '';
  }

  const ignoreDiffFiles = new Set(['RELEASE_NOTES.md', 'package.json', 'package-lock.json']);
  const filteredDiffPatch = diffPatch
    .split('\n')
    .reduce((acc, line) => {
      if (line.startsWith('diff --git ')) {
        const match = line.match(/^diff --git a\/([^\s]+) b\/([^\s]+)/);
        const file = match ? match[1] : '';
        acc.skip = ignoreDiffFiles.has(file);
      }
      if (!acc.skip) acc.lines.push(line);
      return acc;
    }, { lines: [], skip: false }).lines.join('\n');

  const maxPatchChars = 12000;
  const trimmedPatch = filteredDiffPatch.length > maxPatchChars
    ? `${filteredDiffPatch.slice(0, maxPatchChars)}\n... (diff truncated)`
    : filteredDiffPatch;

  const prompt = [
    `Write friendly, non-technical release notes for the "TopStatsAIO" app (v${version}).`,
    'Use ONLY the commit summary and diff below; do not invent features.',
    'Keep it concise for end users and focus on user-facing improvements and fixes.',
    'Avoid version bumps, release chores, dependency updates, or build/publish metadata.',
    'Use these markdown sections (with emojis in the headings):',
    '## 🌟 Highlights',
    '## 🛠️ Improvements',
    '## 🧯 Fixes',
    '## ⚠️ Breaking Changes',
    'If a section has nothing, write "None."',
    'Aim for 2-5 bullets per section. Do not output commit hashes.',
    '',
    `Commit summary since ${lastTag || 'project start'}:`,
    commitLines.length ? commitLines.map(line => `- ${line}`).join('\n') : '- No commits found.',
    '',
    'Diff summary:',
    diffStat || 'No diff stats found.',
    '',
    'Code changes:',
    trimmedPatch || 'No diff found.'
  ].join('\n');

  const body = {
    model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: 'You generate polished release notes for end users.' }]
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }
    ],
    text: { format: { type: 'text' } }
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
  if (org) headers['OpenAI-Organization'] = org;
  if (project) headers['OpenAI-Project'] = project;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error (${response.status}): ${errorText}`);
    process.exit(1);
  }

  const data = await response.json();
  const outputText = parseResponseText(data);
  if (!outputText) {
    console.error('OpenAI API returned no usable output for release notes.');
    process.exit(1);
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const finalNotes = [
    '# Release Notes',
    '',
    `Version v${version} - ${dateLabel}`,
    '',
    outputText.trim(),
    ''
  ].join('\n');

  fs.writeFileSync(releaseNotesPath, finalNotes, 'utf8');
  console.log(`Release notes written to ${releaseNotesPath}`);
}

main().catch(error => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
