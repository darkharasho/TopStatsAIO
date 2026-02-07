#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) return;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) return;
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

async function request(method, url, token, body) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data, text };
}

async function main() {
  const rootDir = process.cwd();
  loadEnvFile(path.join(rootDir, '.env'));
  loadEnvFile(path.join(rootDir, '.env.local'));

  const packageJsonPath = path.join(rootDir, 'package.json');
  const releaseNotesPath = path.join(rootDir, 'RELEASE_NOTES.md');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const publish = packageJson && packageJson.build ? packageJson.build.publish : null;

  const owner = process.env.GITHUB_RELEASE_OWNER || (publish && publish.owner);
  const repo = process.env.GITHUB_RELEASE_REPO || (publish && publish.repo);
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const version = packageJson && packageJson.version ? String(packageJson.version) : '';

  if (!owner || !repo) {
    console.error('Missing GitHub owner/repo (configure build.publish.owner/repo or env overrides).');
    process.exit(1);
  }
  if (!token) {
    console.error('Missing GITHUB_TOKEN or GH_TOKEN.');
    process.exit(1);
  }
  if (!version) {
    console.error('Missing package version.');
    process.exit(1);
  }
  if (!fs.existsSync(releaseNotesPath)) {
    console.error('RELEASE_NOTES.md not found.');
    process.exit(1);
  }

  const notes = fs.readFileSync(releaseNotesPath, 'utf8').trim();
  if (!notes) {
    console.error('RELEASE_NOTES.md is empty.');
    process.exit(1);
  }

  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const candidateTags = [`v${version}`, version];
  let release = null;

  for (const tag of candidateTags) {
    const res = await request('GET', `${baseUrl}/releases/tags/${encodeURIComponent(tag)}`, token);
    if (res.ok && res.data && res.data.id) {
      release = res.data;
      break;
    }
  }

  if (!release) {
    const listRes = await request('GET', `${baseUrl}/releases?per_page=100`, token);
    if (listRes.ok && Array.isArray(listRes.data)) {
      const byVersion = listRes.data.find(r => r && candidateTags.includes(r.tag_name));
      if (byVersion) release = byVersion;
    }
  }

  if (!release || !release.id) {
    console.error(`Could not find release for ${candidateTags.join(' or ')}.`);
    process.exit(1);
  }

  const patchRes = await request('PATCH', `${baseUrl}/releases/${release.id}`, token, {
    body: notes
  });
  if (!patchRes.ok) {
    console.error(`Failed to update release notes (${patchRes.status}): ${patchRes.text}`);
    process.exit(1);
  }

  const refreshed = patchRes.data && patchRes.data.id ? patchRes.data : release;
  if (refreshed && refreshed.draft) {
    const publishRes = await request('PATCH', `${baseUrl}/releases/${refreshed.id}`, token, {
      draft: false
    });
    if (!publishRes.ok) {
      console.error(`Failed to publish draft release (${publishRes.status}): ${publishRes.text}`);
      process.exit(1);
    }
    console.log(`Updated notes and published GitHub release ${refreshed.tag_name}.`);
    return;
  }

  console.log(`Updated GitHub release notes for ${refreshed.tag_name}. Release already published.`);
}

main().catch(error => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
