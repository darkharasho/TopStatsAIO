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

async function requestUpload(url, token, fileName, filePath) {
  const data = fs.readFileSync(filePath);
  const response = await fetch(`${url}?name=${encodeURIComponent(fileName)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/octet-stream'
    },
    body: data
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, data: json, text };
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
  const outputDir = path.join(
    rootDir,
    packageJson &&
      packageJson.build &&
      packageJson.build.directories &&
      packageJson.build.directories.output
      ? packageJson.build.directories.output
      : 'dist'
  );

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
  if (!fs.existsSync(outputDir)) {
    console.error(`Build output directory not found: ${outputDir}`);
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
  const preferredTag = `v${version}`;
  const releaseType =
    packageJson &&
    packageJson.build &&
    packageJson.build.publish &&
    packageJson.build.publish.releaseType
      ? String(packageJson.build.publish.releaseType).toLowerCase()
      : 'draft';
  const createAsDraft = releaseType === 'draft';
  let release = null;

  const byTagRes = await request('GET', `${baseUrl}/releases/tags/${encodeURIComponent(preferredTag)}`, token);
  if (byTagRes.ok && byTagRes.data && byTagRes.data.id) {
    release = byTagRes.data;
  }

  if (!release || !release.id) {
    const createRes = await request('POST', `${baseUrl}/releases`, token, {
      tag_name: preferredTag,
      name: preferredTag,
      body: notes,
      draft: createAsDraft,
      prerelease: false
    });
    if (!createRes.ok || !createRes.data || !createRes.data.id) {
      console.error(`Failed to create release for ${preferredTag}: ${createRes.text}`);
      process.exit(1);
    }
    release = createRes.data;
  }

  if (release.tag_name !== preferredTag) {
    console.error(`Resolved release has unexpected tag "${release.tag_name}". Expected ${preferredTag}.`);
    process.exit(1);
  }

  const patchRes = await request('PATCH', `${baseUrl}/releases/${release.id}`, token, {
    tag_name: preferredTag,
    name: preferredTag,
    body: notes
  });
  if (!patchRes.ok) {
    console.error(`Failed to update release notes (${patchRes.status}): ${patchRes.text}`);
    process.exit(1);
  }

  let refreshed = patchRes.data && patchRes.data.id ? patchRes.data : release;
  if (!refreshed || refreshed.tag_name !== preferredTag) {
    console.error(`Updated release tag became "${refreshed && refreshed.tag_name ? refreshed.tag_name : 'unknown'}". Expected ${preferredTag}.`);
    process.exit(1);
  }

  const uploadUrl = refreshed.upload_url ? refreshed.upload_url.replace('{?name,label}', '') : '';
  if (!uploadUrl) {
    console.error('Release upload URL missing.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name);

  if (files.length === 0) {
    console.error(`No build artifacts found in ${outputDir}.`);
    process.exit(1);
  }

  const detailsRes = await request('GET', `${baseUrl}/releases/${refreshed.id}`, token);
  if (detailsRes.ok && detailsRes.data) {
    refreshed = detailsRes.data;
  }
  const existingAssets = Array.isArray(refreshed.assets) ? refreshed.assets : [];

  for (const fileName of files) {
    const existing = existingAssets.find(asset => asset && asset.name === fileName);
    if (existing && existing.id) {
      const delRes = await request('DELETE', `${baseUrl}/releases/assets/${existing.id}`, token);
      if (!delRes.ok) {
        console.error(`Failed to delete existing asset ${fileName}: ${delRes.text}`);
        process.exit(1);
      }
    }

    const filePath = path.join(outputDir, fileName);
    const uploadRes = await requestUpload(uploadUrl, token, fileName, filePath);
    if (!uploadRes.ok) {
      console.error(`Failed to upload asset ${fileName} (${uploadRes.status}): ${uploadRes.text}`);
      process.exit(1);
    }
  }

  const publishRes = await request('PATCH', `${baseUrl}/releases/${refreshed.id}`, token, {
    draft: false,
    tag_name: preferredTag,
    name: preferredTag,
    body: notes
  });
  if (!publishRes.ok) {
    console.error(`Failed to publish release (${publishRes.status}): ${publishRes.text}`);
    process.exit(1);
  }

  console.log(`Published GitHub release ${preferredTag} with ${files.length} assets.`);
}

main().catch(error => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
