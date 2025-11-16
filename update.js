const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const api = {};
let logError = (...args) => console.error(...args);

api.setLogger = (logger) => {
  if (typeof logger === 'function') {
    logError = logger;
  } else {
    logError = () => {};
  }
};

api.downloadFile = async function downloadFile(url, dest, onProgress) {
  const res = await fetch(url, { headers: { 'User-Agent': 'TopStatsAIO' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed: ${res.status} ${res.statusText}\n${text}`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  const file = fs.createWriteStream(dest);
  if (res.body && res.body.getReader) {
    const reader = res.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      file.write(Buffer.from(value));
      received += value.length;
      if (onProgress && total) onProgress(received / total);
    }
    file.end();
    await new Promise((resolve, reject) => {
      file.on('finish', resolve);
      file.on('error', reject);
    });
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    file.write(buf);
    file.end();
    await new Promise((resolve, reject) => {
      file.on('finish', resolve);
      file.on('error', reject);
    });
    if (onProgress) onProgress(1);
  }
};

api.fetchBlockMap = async function fetchBlockMap(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'TopStatsAIO' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Blockmap download failed: ${res.status} ${res.statusText}\n${text}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const json = JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
  const file = json.files && json.files[0];
  if (!file || !Array.isArray(file.sizes)) {
    throw new Error('Invalid blockmap file');
  }
  const size = file.sizes.reduce((acc, n) => acc + Number(n || 0), 0);
  return { data: json, size };
};

api.downloadWithBlockMap = async function downloadWithBlockMap(url, blockMapUrl, dest, onProgress) {
  const info = await api.fetchBlockMap(blockMapUrl);
  const total = info.size;
  let existing = 0;
  try {
    const stat = await fs.promises.stat(dest);
    existing = Math.min(stat.size, total || stat.size);
  } catch {}
  const headers = { 'User-Agent': 'TopStatsAIO' };
  if (existing > 0 && total && existing < total) {
    headers.Range = `bytes=${existing}-`;
  } else if (existing >= total && total > 0) {
    if (onProgress) onProgress(1);
    return;
  } else {
    existing = 0;
  }
  const res = await fetch(url, { headers });
  if (!res.ok || (headers.Range && res.status !== 206 && res.status !== 200)) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed: ${res.status} ${res.statusText}\n${text}`);
  }
  const fd = await fs.promises.open(dest, existing > 0 ? 'r+' : 'w');
  if (existing > 0) {
    await fd.truncate(existing);
  }
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  let downloaded = existing;
  let position = existing;
  const writeChunk = async (buffer) => {
    if (!buffer || buffer.length === 0) return;
    await fd.write(buffer, 0, buffer.length, position);
    position += buffer.length;
    downloaded += buffer.length;
    if (onProgress && total) {
      onProgress(Math.min(downloaded / total, 1));
    }
  };
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    await writeChunk(buf);
  } else {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writeChunk(Buffer.from(value));
    }
  }
  await fd.close();
  if (total && downloaded < total) {
    throw new Error('Download incomplete');
  }
  if (onProgress && !total) {
    onProgress(1);
  }
};

api.downloadUpdateAsset = async function downloadUpdateAsset(asset, dest, onProgress) {
  if (!asset || !asset.url) {
    throw new Error('No asset available for update');
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  if (asset.blockMapUrl) {
    try {
      await api.downloadWithBlockMap(asset.url, asset.blockMapUrl, dest, onProgress);
      return;
    } catch (err) {
      logError('Blockmap download failed, falling back to full download:', err);
    }
  }
  await api.downloadFile(asset.url, dest, onProgress);
};

api.collectAssetInfo = function collectAssetInfo(assets, pattern) {
  const primary = assets.find(a => pattern.test(a.name));
  if (!primary) return null;
  const blockMap = assets.find(a => a.name === `${primary.name}.blockmap`);
  return {
    name: primary.name,
    url: primary.browser_download_url,
    blockMapUrl: blockMap ? blockMap.browser_download_url : null
  };
};

api.resolveUpdateMode = function resolveUpdateMode(installedCopy, available) {
  if (installedCopy) {
    if (available.installer) return 'installer';
    if (available.portable) return 'portable';
    return 'link';
  }
  if (available.portable) return 'portable';
  if (available.installer) return 'installer';
  return 'link';
};

module.exports = api;
