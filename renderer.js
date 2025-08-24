const chooseFolderBtn = document.getElementById('choose-folder');
const fileTreeContainer = document.getElementById('file-tree-list');
const selectedList = document.getElementById('selected-list');
const selectedFolderSpan = document.getElementById('selected-folder');
const selectedFolderInput = document.getElementById('selected-folder-input');
const titlebar = document.getElementById('titlebar');
const dateFilterInput = document.getElementById('date-filter');
const dateSelectBtn = document.getElementById('date-select');
const unselectAllBtn = document.getElementById('unselect-all');
const settingsBtn = document.getElementById('settings');
const updateNoticeBtn = document.getElementById('update-notice');
const selectAllBtn = document.getElementById('select-all');
const refreshBtn = document.getElementById('refresh-files');
const contextMenu = document.getElementById('context-menu');
const contextSelectAll = document.getElementById('context-select-all');
const contextUnselectAll = document.getElementById('context-unselect-all');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress');
const fileLoading = document.getElementById('file-tree-loading');
const mainWindowEl = document.getElementById('main-window');
const settingsWindow = document.getElementById('settings-window');
const closeSettingsBtn = document.getElementById('close-settings');
const darkBtn = document.getElementById('theme-dark');
const lightBtn = document.getElementById('theme-light');
const downloadCliBtn = document.getElementById('download-cli');
const downloadCombinerBtn = document.getElementById('download-combiner');
const downloadParserBtn = document.getElementById('download-parser');
const cliVersionText = document.getElementById('cli-version');
const combinerVersionText = document.getElementById('combiner-version');
const parserVersionText = document.getElementById('parser-version');
const parserTopStatsRadio = document.getElementById('parser-topstats');
const parserCombinerRadio = document.getElementById('parser-combiner');
const openParserFolderBtn = document.getElementById('open-parser-folder');
const dpsUserTokenInput = document.getElementById('dps-user-token');
const uploadUrlInput = document.getElementById('upload-url');
const uploadLoginBtn = document.getElementById('upload-login');
const combinerGuildNameInput = document.getElementById('combiner-guild-name');
const combinerGuildIdInput = document.getElementById('combiner-guild-id');
const combinerApiKeyInput = document.getElementById('combiner-api-key');
const combinerGlickoCheckbox = document.getElementById('combiner-glicko');
const combinerFightChartsCheckbox = document.getElementById('combiner-fight-charts');
const descriptionInput = document.getElementById('description');
const parseBtn = document.getElementById('parse-btn');
const parseWindow = document.getElementById('parse-window');
const parseOutput = document.getElementById('parse-output');
const parseSteps = document.getElementById('parse-steps');
const parseOpenFolderBtn = document.getElementById('parse-open-folder');
const parseUploadBtn = document.getElementById('parse-upload');
const parseCloseBtn = document.getElementById('parse-close');
const parseCancelBtn = document.getElementById('parse-cancel');
const versionText = document.getElementById('version-text');
const uploadWindow = document.getElementById('upload-window');
const uploadUrlBar = document.getElementById('upload-url-display');
const uploadCloseBtn = document.getElementById('upload-close');
const uploadRefreshBtn = document.getElementById('upload-refresh');
const uploadHomeBtn = document.getElementById('upload-home');
const uploadCopyBtn = document.getElementById('upload-copy');
const uploadFrame = document.getElementById('upload-frame');
const uploadLoading = document.getElementById('upload-loading');
const uploadStatus = document.getElementById('upload-status');
const gradientRadios = document.querySelectorAll('input[name="gradient-theme"]');
const selected = new Map();
let currentFolder = '';
let rootList;
let folderLists = new Map();
let loadAll = false;
let currentStepId = null;
let lastSelectedItem = null;
let uploadNavHandler = null;
let uploadIsLoading = false;
let previousWindow = null;

function normalizeUrl(url) {
  const trimmed = (url || '').trim();
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }
}


dpsUserTokenInput.value = localStorage.getItem('dpsReportUserToken') || '';
uploadUrlInput.value = localStorage.getItem('uploadUrl') || '';
combinerGuildNameInput.value = localStorage.getItem('combinerGuildName') || '';
combinerGuildIdInput.value = localStorage.getItem('combinerGuildId') || '';
combinerApiKeyInput.value = localStorage.getItem('combinerApiKey') || '';
combinerGlickoCheckbox.checked = localStorage.getItem('combinerGlickoUpdate') === 'true';
combinerFightChartsCheckbox.checked = localStorage.getItem('combinerFightCharts') === 'true';

document.getElementById('minimize').addEventListener('click', () => window.electronAPI.minimize());
document.getElementById('maximize').addEventListener('click', () => window.electronAPI.maximize());
document.getElementById('close').addEventListener('click', () => window.electronAPI.close());
titlebar.addEventListener('wheel', e => e.preventDefault(), { passive: false });
settingsBtn.addEventListener('click', openSettings);
updateNoticeBtn.addEventListener('click', () => window.electronAPI.showUpdatePrompt());
selectAllBtn.addEventListener('click', () => {
  fileTreeContainer.querySelectorAll('li.file-item').forEach(li => {
    const p = li.dataset.path;
    if (!selected.has(p)) {
      selected.set(p, { rel: li.dataset.rel, mtime: parseInt(li.dataset.mtime, 10) });
      li.classList.add('selected');
    }
  });
  renderSelected();
});
refreshBtn.addEventListener('click', () => {
  if (currentFolder) {
    startLoad(currentFolder, true);
  }
});
contextSelectAll.addEventListener('click', () => {
  contextMenu.classList.add('hidden');
  const path = contextMenu.dataset.path;
  if (path) selectAllInFolder(path);
});
contextUnselectAll.addEventListener('click', () => {
  contextMenu.classList.add('hidden');
  const rel = contextMenu.dataset.path;
  if (rel) unselectAllInFolder(rel);
});
document.addEventListener('click', () => contextMenu.classList.add('hidden'));
selectedFolderSpan.addEventListener('click', () => {
  selectedFolderInput.value = currentFolder;
  const width = selectedFolderSpan.offsetWidth;
  const style = window.getComputedStyle(selectedFolderSpan);
  selectedFolderInput.style.width = width + 'px';
  selectedFolderInput.style.fontSize = style.fontSize;
  selectedFolderSpan.classList.add('hidden');
  selectedFolderInput.classList.remove('hidden');
  selectedFolderInput.focus();
  selectedFolderInput.select();
});
selectedFolderInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const dir = selectedFolderInput.value.trim();
    if (dir) startLoad(dir);
    selectedFolderInput.blur();
  } else if (e.key === 'Escape') {
    selectedFolderInput.value = currentFolder;
    selectedFolderInput.blur();
  }
});
selectedFolderInput.addEventListener('blur', () => {
  selectedFolderSpan.textContent = currentFolder;
  selectedFolderSpan.classList.remove('hidden');
  selectedFolderInput.classList.add('hidden');
  selectedFolderInput.style.width = '';
  selectedFolderInput.style.fontSize = '';
});
closeSettingsBtn.addEventListener('click', closeSettings);

function openSettings() {
  mainWindowEl.classList.add('fade-out');
  settingsWindow.classList.add('active');
}

function closeSettings() {
  mainWindowEl.classList.remove('fade-out');
  settingsWindow.classList.remove('active');
}

function updateDescriptionVisibility() {
  if (localStorage.getItem('parserSelection') === 'topstats') {
    descriptionInput.classList.add('hidden');
    descriptionInput.value = '';
  } else {
    descriptionInput.classList.remove('hidden');
  }
}

darkBtn.addEventListener('click', () => window.electronAPI.setTheme('dark'));
lightBtn.addEventListener('click', () => window.electronAPI.setTheme('light'));
gradientRadios.forEach(r => {
  r.addEventListener('change', () => {
    if (r.checked) {
      applyGradient(r.value);
    }
  });
});
downloadCliBtn.addEventListener('click', async () => {
  downloadCliBtn.disabled = true;
  await window.electronAPI.downloadDependency('cli');
  downloadCliBtn.disabled = false;
  checkDeps();
});
downloadCombinerBtn.addEventListener('click', async () => {
  downloadCombinerBtn.disabled = true;
  await window.electronAPI.downloadDependency('combiner');
  downloadCombinerBtn.disabled = false;
  checkDeps();
});
downloadParserBtn.addEventListener('click', async () => {
  downloadParserBtn.disabled = true;
  await window.electronAPI.downloadDependency('parser');
  downloadParserBtn.disabled = false;
  checkDeps();
});
parserTopStatsRadio.addEventListener('change', () => {
  if (parserTopStatsRadio.checked) {
    localStorage.setItem('parserSelection', 'topstats');
    updateDescriptionVisibility();
  }
});
parserCombinerRadio.addEventListener('change', () => {
  if (parserCombinerRadio.checked) {
    localStorage.setItem('parserSelection', 'combiner');
    updateDescriptionVisibility();
  }
});
openParserFolderBtn.addEventListener('click', () => {
  const sel = localStorage.getItem('parserSelection') || 'combiner';
  window.electronAPI.openParserFolder(sel);
});
dpsUserTokenInput.addEventListener('input', () => {
  localStorage.setItem('dpsReportUserToken', dpsUserTokenInput.value);
});
uploadUrlInput.addEventListener('input', () => {
  localStorage.setItem('uploadUrl', uploadUrlInput.value.trim());
});
uploadLoginBtn.addEventListener('click', () => {
  let url = normalizeUrl(uploadUrlInput.value);
  if (!url) {
    alert('Upload URL is invalid.');
    return;
  }
  localStorage.setItem('uploadUrl', url);
  uploadUrlInput.value = url;
  openUploadWindow(url, []);
});
combinerGuildNameInput.addEventListener('input', () => {
  localStorage.setItem('combinerGuildName', combinerGuildNameInput.value);
});
combinerGuildIdInput.addEventListener('input', () => {
  localStorage.setItem('combinerGuildId', combinerGuildIdInput.value);
});
combinerApiKeyInput.addEventListener('input', () => {
  localStorage.setItem('combinerApiKey', combinerApiKeyInput.value);
});
combinerGlickoCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerGlickoUpdate', combinerGlickoCheckbox.checked ? 'true' : 'false');
});
combinerFightChartsCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerFightCharts', combinerFightChartsCheckbox.checked ? 'true' : 'false');
});
parseBtn.addEventListener('click', startParse);
parseCloseBtn.addEventListener('click', closeParseWindow);
parseOpenFolderBtn.addEventListener('click', () => window.electronAPI.openParsedFolder());
parseUploadBtn.addEventListener('click', async () => {
  const files = parseUploadBtn.dataset.files ? JSON.parse(parseUploadBtn.dataset.files) : [];
  let url = localStorage.getItem('uploadUrl') || '';
  if (!url) {
    alert('Upload URL not configured in settings.');
    return;
  }
  url = normalizeUrl(url);
  if (!url) {
    alert('Upload URL is invalid.');
    return;
  }
  localStorage.setItem('uploadUrl', url);
  const payload = await window.electronAPI.uploadParsedFiles(files);
  openUploadWindow(url, payload);
});
parseCancelBtn.addEventListener('click', () => {
  parseCancelBtn.disabled = true;
  window.electronAPI.cancelParse();
});
uploadCloseBtn.addEventListener('click', closeUploadWindow);
uploadWindow.addEventListener('mouseenter', () => {
  if (!uploadIsLoading) uploadFrame.focus();
});
uploadWindow.addEventListener('wheel', e => {
  if (uploadIsLoading) return;
  const rect = uploadFrame.getBoundingClientRect();
  uploadFrame.focus();
  uploadFrame.sendInputEvent({
    type: 'mouseWheel',
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    deltaX: e.deltaX,
    deltaY: e.deltaY
  });
  e.preventDefault();
}, { passive: false });
uploadRefreshBtn.addEventListener('click', () => {
  if (uploadIsLoading) {
    uploadFrame.stop();
  } else {
    uploadFrame.reload();
  }
});
uploadHomeBtn.addEventListener('click', () => {
  let url = localStorage.getItem('uploadUrl') || '';
  url = normalizeUrl(url);
  if (url) {
    uploadFrame.src = url;
    uploadUrlBar.value = url;
  }
});
uploadCopyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(uploadUrlBar.value).catch(() => {});
});
uploadUrlBar.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const url = normalizeUrl(uploadUrlBar.value);
    if (url) {
      uploadFrame.src = url;
      uploadUrlBar.value = url;
    }
  }
});
uploadFrame.addEventListener('did-start-loading', () => {
  uploadIsLoading = true;
  uploadRefreshBtn.innerHTML = '&#x2715;';
  uploadStatus.textContent = '';
  uploadStatus.classList.remove('error');
  uploadLoading.classList.add('active');
  uploadFrame.style.visibility = 'hidden';
});
uploadFrame.addEventListener('did-stop-loading', () => {
  uploadIsLoading = false;
  uploadRefreshBtn.innerHTML = '&#x21bb;';
  uploadLoading.classList.remove('active');
  uploadFrame.style.visibility = 'visible';
});
uploadFrame.addEventListener('dom-ready', () => {
  uploadFrame.focus();
});
uploadFrame.addEventListener('did-fail-load', e => {
  uploadIsLoading = false;
  uploadRefreshBtn.innerHTML = '&#x21bb;';
  uploadLoading.classList.remove('active');
  uploadFrame.style.visibility = 'visible';
  if (e.errorCode !== -3) {
    uploadStatus.textContent = `Failed to load: ${e.errorDescription}`;
    uploadStatus.classList.add('error');
  }
});
uploadFrame.addEventListener('did-finish-load', () => {
  uploadFrame.focus();
});
window.electronAPI.onParseProgress(msg => {
  const line = document.createElement('div');
  line.textContent = msg;
  line.classList.add('parse-line');
  if (msg.toLowerCase().includes('error')) {
    line.classList.add('error');
  }
  parseOutput.appendChild(line);
  parseOutput.scrollTop = parseOutput.scrollHeight;
});
window.electronAPI.onParseStep(data => updateStep(data));
window.electronAPI.onParseComplete(result => {
  const { success, files = [] } = typeof result === 'object' ? result : { success: !!result, files: [] };
  parseOpenFolderBtn.disabled = !success;
  parseUploadBtn.disabled = !success;
  parseUploadBtn.dataset.files = JSON.stringify(files);
  parseCloseBtn.disabled = false;
  parseCancelBtn.disabled = true;
  updateStep({ id: 'complete', title: success ? 'Completed' : 'Failed', progress: 1, error: success ? null : 'Error', success });
});
async function checkDeps() {
  const info = await window.electronAPI.checkDependencies();
  const needCli = info.cli.needsUpdate;
  const needComb = info.combiner.needsUpdate;
  const needParser = info.parser.needsUpdate;
  downloadCliBtn.classList.toggle('notify', needCli);
  downloadCombinerBtn.classList.toggle('notify', needComb);
  downloadParserBtn.classList.toggle('notify', needParser);
  settingsBtn.classList.toggle('notify', needCli || needComb || needParser);
  cliVersionText.textContent = info.cli.current ? `Current: ${info.cli.current}` : 'Not installed';
  if (needCli) {
    cliVersionText.textContent += ` (Latest: ${info.cli.latest})`;
  }
  combinerVersionText.textContent = info.combiner.current ? `Current: ${info.combiner.current}` : 'Not installed';
  if (needComb) {
    combinerVersionText.textContent += ` (Latest: ${info.combiner.latest})`;
  }
  parserVersionText.textContent = info.parser.current ? `Current: ${info.parser.current}` : 'Not installed';
  if (needParser) {
    parserVersionText.textContent += ` (Latest: ${info.parser.latest})`;
  }
}
window.electronAPI.onThemeChanged(applyTheme);
window.electronAPI.onShowUpdateNotice(() => {
  updateNoticeBtn.classList.remove('hidden');
  updateNoticeBtn.classList.add('notify');
});
window.electronAPI.onHideUpdateNotice(() => {
  updateNoticeBtn.classList.add('hidden');
  updateNoticeBtn.classList.remove('notify');
});
window.electronAPI.onTreeStart(data => {
  const container = folderLists.get(data.path);
  if (container) {
    container.innerHTML = '';
  }
  if (data.path === currentFolder) {
    selectedFolderSpan.textContent = currentFolder;
    selected.clear();
    lastSelectedItem = null;
    renderSelected();
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    fileLoading.classList.remove('hidden');
    localStorage.setItem('lastFolder', currentFolder);
  }
});
window.electronAPI.onTreeNode(data => {
  const container = folderLists.get(data.parent);
  if (container) {
    renderNode(data.node, container);
  }
});
window.electronAPI.onTreeEnd(parent => {
  if (parent === currentFolder) {
    progressContainer.classList.add('hidden');
    fileLoading.classList.add('hidden');
  }
});
window.electronAPI.onLoadProgress(data => {
  if (data.parent === currentFolder) {
    progressBar.style.width = `${Math.floor(data.progress * 100)}%`;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const savedTheme = localStorage.getItem('theme');
  let theme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : await window.electronAPI.getTheme();
  if (theme !== 'light' && theme !== 'dark') {
    theme = 'dark';
  }
  applyTheme(theme);
  const grad = localStorage.getItem('gradientTheme') || 'default';
  applyGradient(grad);
  const gradRadio = document.querySelector(`input[name="gradient-theme"][value="${grad}"]`);
  if (gradRadio) gradRadio.checked = true;
  const ver = await window.electronAPI.getAppVersion();
  versionText.textContent = `v${ver}`;
  const saved = localStorage.getItem('lastFolder');
  const lastTime = localStorage.getItem('lastTimeFilter');
  const parserSel = localStorage.getItem('parserSelection') || 'combiner';
  if (parserSel === 'combiner') {
    parserCombinerRadio.checked = true;
  } else {
    parserTopStatsRadio.checked = true;
  }
  updateDescriptionVisibility();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  if (lastTime) {
    dateFilterInput.value = `${yyyy}-${mm}-${dd}T${lastTime}`;
  } else {
    dateFilterInput.value = `${yyyy}-${mm}-${dd}T00:00`;
  }
  if (saved) {
    startLoad(saved);
  }
  await checkDeps();
});

chooseFolderBtn.addEventListener('click', async () => {
  const dir = await window.electronAPI.selectFolder();
  if (!dir) return;
  startLoad(dir);
});

dateFilterInput.addEventListener('change', () => {
  const val = dateFilterInput.value;
  const time = val.split('T')[1]?.slice(0, 5);
  if (time) {
    localStorage.setItem('lastTimeFilter', time);
  }
});

dateSelectBtn.addEventListener('click', () => {
  const val = dateFilterInput.value;
  if (!val) return;
  const ts = new Date(val).getTime();
  if (isNaN(ts)) return;
  fileTreeContainer.querySelectorAll('li.file-item').forEach(li => {
    const m = parseInt(li.dataset.mtime, 10);
    if (m >= ts && !selected.has(li.dataset.path)) {
      selected.set(li.dataset.path, { rel: li.dataset.rel, mtime: m });
      li.classList.add('selected');
    }
  });
  renderSelected();
});

unselectAllBtn.addEventListener('click', () => {
  selected.clear();
  fileTreeContainer.querySelectorAll('li.file-item.selected').forEach(li => li.classList.remove('selected'));
  lastSelectedItem = null;
  renderSelected();
});

function startLoad(dir, loadEverything = true) {
  currentFolder = dir;
  loadAll = loadEverything;
  fileTreeContainer.innerHTML = '';
  fileLoading.classList.remove('hidden');
  rootList = document.createElement('ul');
  rootList.classList.add('file-root');
  fileTreeContainer.appendChild(rootList);
  folderLists = new Map();
  folderLists.set(dir, rootList);
  window.electronAPI.loadFolder(dir, dir);
}

function insertSorted(container, li, node) {
  li.dataset.mtime = node.mtime;
  li.dataset.name = node.name;
  li.dataset.type = node.type;
  const items = Array.from(container.querySelectorAll(':scope > li.file-row'));
  const cmp = (a, b) => {
    if (a.type === b.type) {
      if (a.mtime !== b.mtime) return b.mtime - a.mtime;
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  };
  for (const existing of items) {
    const other = {
      type: existing.dataset.type,
      mtime: parseInt(existing.dataset.mtime, 10),
      name: existing.dataset.name
    };
    if (cmp(node, other) < 0) {
      container.insertBefore(li, existing);
      return;
    }
  }
  container.appendChild(li);
}

function renderNode(node, container) {
  const li = document.createElement('li');
  li.classList.add('file-row');

  if (node.type === 'directory') {
    li.classList.add('folder');
    li.dataset.path = node.path;
    li.dataset.loaded = 'false';

    const arrow = document.createElement('span');
    arrow.textContent = '▶';
    arrow.classList.add('arrow');
    li.appendChild(arrow);

    const icon = document.createElement('span');
    icon.textContent = '📁';
    icon.classList.add('item-icon');
    li.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name;
    nameSpan.classList.add('file-name');
    li.appendChild(nameSpan);

    const dateSpan = document.createElement('span');
    dateSpan.textContent = formatDate(node.mtime);
    dateSpan.classList.add('file-date');
    li.appendChild(dateSpan);

    insertSorted(container, li, node);

    const childList = document.createElement('ul');
    childList.classList.add('hidden');
    container.insertBefore(childList, li.nextSibling);
    folderLists.set(node.path, childList);

    const toggle = () => {
      const hidden = childList.classList.toggle('hidden');
      arrow.textContent = hidden ? '▶' : '▼';
      if (!hidden && li.dataset.loaded === 'false') {
        li.dataset.loaded = 'true';
        window.electronAPI.loadFolder(node.path, currentFolder);
      }
    };
    li.addEventListener('click', toggle);
    li.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(node.path, e.pageX, e.pageY, 'select');
    });
    if (loadAll) {
      li.dataset.loaded = 'true';
      window.electronAPI.loadFolder(node.path, currentFolder);
    }
  } else {
    li.classList.add('file-item');
    li.dataset.path = node.path;
    li.dataset.rel = node.relativePath;

    const check = document.createElement('span');
    check.classList.add('select-icon');
    li.appendChild(check);

    const icon = document.createElement('span');
    icon.textContent = '📄';
    icon.classList.add('item-icon');
    li.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name;
    nameSpan.classList.add('file-name');
    li.appendChild(nameSpan);

    const dateSpan = document.createElement('span');
    dateSpan.textContent = formatDate(node.mtime);
    dateSpan.classList.add('file-date');
    li.appendChild(dateSpan);

    insertSorted(container, li, node);

    li.addEventListener('click', e => {
      const p = li.dataset.path;
      if (e.shiftKey && lastSelectedItem) {
        const items = Array.from(fileTreeContainer.querySelectorAll('li.file-item'));
        const startIndex = items.indexOf(lastSelectedItem);
        const endIndex = items.indexOf(li);
        if (startIndex !== -1 && endIndex !== -1) {
          const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
          const shouldSelect = !selected.has(p);
          for (let i = from; i <= to; i++) {
            const item = items[i];
            const path = item.dataset.path;
            if (shouldSelect) {
              if (!selected.has(path)) {
                selected.set(path, { rel: item.dataset.rel, mtime: parseInt(item.dataset.mtime, 10) });
                item.classList.add('selected');
              }
            } else {
              if (selected.has(path)) {
                selected.delete(path);
                item.classList.remove('selected');
              }
            }
          }
        }
      } else {
        if (selected.has(p)) {
          selected.delete(p);
          li.classList.remove('selected');
        } else {
          selected.set(p, { rel: li.dataset.rel, mtime: parseInt(li.dataset.mtime, 10) });
          li.classList.add('selected');
        }
      }
      lastSelectedItem = li;
      renderSelected();
    });
  }
}

function showContextMenu(path, x, y, mode) {
  contextMenu.dataset.path = path;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.left = `${x}px`;
  contextSelectAll.classList.toggle('hidden', mode !== 'select');
  contextUnselectAll.classList.toggle('hidden', mode !== 'unselect');
  contextMenu.classList.remove('hidden');
}

function selectAllInFolder(path) {
  const container = folderLists.get(path);
  if (!container) return;
  const selectIn = ul => {
    ul.querySelectorAll(':scope > li.file-item').forEach(li => {
      const p = li.dataset.path;
      if (!selected.has(p)) {
        selected.set(p, { rel: li.dataset.rel, mtime: parseInt(li.dataset.mtime, 10) });
        li.classList.add('selected');
      }
    });
    ul.querySelectorAll(':scope > li.folder').forEach(f => {
      const child = folderLists.get(f.dataset.path);
      if (child) selectIn(child);
    });
  };
  selectIn(container);
  renderSelected();
}

function unselectAllInFolder(rel) {
  const normalizedRel = rel.replace(/\\/g, '/');
  for (const [path, data] of [...selected.entries()]) {
    const dr = data.rel.replace(/\\/g, '/');
    if (dr === normalizedRel || dr.startsWith(`${normalizedRel}/`)) {
      selected.delete(path);
      const item = fileTreeContainer.querySelector(
        `li.file-item[data-path="${CSS.escape(path)}"]`
      );
      if (item) {
        item.classList.remove('selected');
      }
    }
  }
  renderSelected();
}

function formatDate(ms) {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

function renderSelected() {
  selectedList.innerHTML = '';
  const tree = {};
  for (const [path, data] of selected.entries()) {
    const parts = data.rel.split(/[\\/]/);
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node.files = node.files || [];
        node.files.push({ name: part, path, mtime: data.mtime });
      } else {
        node.children = node.children || {};
        node = node.children[part] = node.children[part] || {};
      }
    }
  }
  const renderNode = (node, container, prefix = '') => {
    if (node.children) {
      for (const [name, child] of Object.entries(node.children)) {
        const li = document.createElement('li');
        li.classList.add('file-row', 'folder');
        const arrow = document.createElement('span');
        arrow.textContent = '▼';
        arrow.classList.add('arrow');
        li.appendChild(arrow);
        const icon = document.createElement('span');
        icon.textContent = '📁';
        icon.classList.add('item-icon');
        li.appendChild(icon);
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.classList.add('file-name');
        li.appendChild(nameSpan);
        const rel = prefix ? `${prefix}/${name}` : name;
        li.dataset.rel = rel;
        container.appendChild(li);
        const ul = document.createElement('ul');
        container.appendChild(ul);
        const toggle = () => {
          const hidden = ul.classList.toggle('hidden');
          arrow.textContent = hidden ? '▶' : '▼';
        };
        li.addEventListener('click', toggle);
        li.addEventListener('contextmenu', e => {
          e.preventDefault();
          showContextMenu(rel, e.pageX, e.pageY, 'unselect');
        });
        renderNode(child, ul, rel);
      }
    }
    if (node.files) {
      for (const file of node.files) {
        const li = document.createElement('li');
        li.classList.add('file-row');
        const icon = document.createElement('span');
        icon.textContent = '📄';
        icon.classList.add('item-icon');
        li.appendChild(icon);
        const nameSpan = document.createElement('span');
        nameSpan.textContent = file.name;
        nameSpan.classList.add('file-name');
        li.appendChild(nameSpan);
        const dateSpan = document.createElement('span');
        dateSpan.textContent = formatDate(file.mtime);
        dateSpan.classList.add('file-date');
        li.appendChild(dateSpan);
        const btn = document.createElement('button');
        btn.textContent = 'Remove';
        btn.classList.add('remove-btn');
        btn.addEventListener('click', e => {
          e.stopPropagation();
          selected.delete(file.path);
          const item = fileTreeContainer.querySelector(`li.file-item[data-path="${CSS.escape(file.path)}"]`);
          if (item) {
            item.classList.remove('selected');
          }
          renderSelected();
        });
        li.appendChild(btn);
        container.appendChild(li);
      }
    }
  };
  renderNode(tree, selectedList);
}

function updateStep({ id, title, progress, error, success, current = 0, total = 0 }) {
  if (id !== currentStepId) {
    parseSteps.innerHTML = '';
    currentStepId = id;
    const step = document.createElement('div');
    step.classList.add('parse-step');
    const titleEl = document.createElement('div');
    titleEl.classList.add('step-title');
    const bar = document.createElement('div');
    bar.classList.add('step-bar');
    const fill = document.createElement('div');
    fill.classList.add('step-fill');
    bar.appendChild(fill);
    const meta = document.createElement('div');
    meta.classList.add('step-meta');
    const countEl = document.createElement('div');
    countEl.classList.add('step-count');
    const status = document.createElement('div');
    status.classList.add('step-status');
    meta.appendChild(countEl);
    meta.appendChild(status);
    step.appendChild(titleEl);
    step.appendChild(bar);
    step.appendChild(meta);
    parseSteps.appendChild(step);
  }
  const step = parseSteps.querySelector('.parse-step');
  if (!step) return;
  step.classList.remove('error', 'success');
  step.querySelector('.step-title').textContent = title;
  step.querySelector('.step-fill').style.width = `${Math.floor((progress || 0) * 100)}%`;
  const countEl = step.querySelector('.step-count');
  if (total > 0) {
    countEl.textContent = `${current}/${total}`;
  } else {
    countEl.textContent = '';
  }
  const status = step.querySelector('.step-status');
  if (error) {
    step.classList.add('error');
    status.textContent = error;
  } else {
    status.textContent = '';
    if (success) {
      step.classList.add('success');
    }
  }
  if (progress >= 1 && !error && id !== 'complete') {
    currentStepId = null;
  }
}

function openParseWindow() {
  mainWindowEl.classList.add('fade-out');
  parseWindow.classList.add('active');
  document.getElementById('title-text').textContent = 'Parse';
  parseOutput.innerHTML = '';
  parseSteps.innerHTML = '';
  currentStepId = null;
  parseOpenFolderBtn.disabled = true;
  parseUploadBtn.disabled = true;
  parseUploadBtn.dataset.files = '[]';
  parseCloseBtn.disabled = true;
  parseCancelBtn.disabled = false;
}

function closeParseWindow() {
  parseWindow.classList.remove('active');
  mainWindowEl.classList.remove('fade-out');
  document.getElementById('title-text').textContent = 'Top Stats AIO';
}

function openUploadWindow(url, payload) {
  previousWindow = settingsWindow.classList.contains('active') ? 'settings' : 'parse';
  if (previousWindow === 'settings') {
    settingsWindow.classList.remove('active');
  } else {
    parseWindow.classList.remove('active');
  }
  uploadWindow.classList.add('active');
  document.getElementById('title-text').textContent = 'Upload';
  uploadUrlBar.value = url;
  uploadUrlInput.value = url;
  uploadStatus.textContent = '';
  uploadStatus.classList.remove('error');
  uploadRefreshBtn.innerHTML = '&#x2715;';
  uploadIsLoading = true;
  uploadLoading.classList.add('active');
  uploadFrame.style.visibility = 'hidden';
  let dropScript;
  if (payload.length) {
    dropScript = `(() => {
    const files = ${JSON.stringify(payload)};
    function b64ToBlob(b64){const bin=atob(b64);const len=bin.length;const bytes=new Uint8Array(len);for(let i=0;i<len;i++){bytes[i]=bin.charCodeAt(i);}return new Blob([bytes]);}
    function doDrop(){
      const x = window.innerWidth/2;
      const y = window.innerHeight/2;
      const target=document.elementFromPoint(x,y)||document.body||document.documentElement;
      if(!target) return;
      const dt=new DataTransfer();
      files.forEach(f=>{
        const file=new File([b64ToBlob(f.data)], f.name, {type:'application/json'});
        dt.items.add(file);
      });
      dt.effectAllowed='copy';
      dt.dropEffect='copy';
      ['dragenter','dragover','drop'].forEach(type=>{
        const ev=new DragEvent(type,{dataTransfer:dt,bubbles:true,cancelable:true,clientX:x,clientY:y});
        if(type!=='drop') ev.preventDefault();
        target.dispatchEvent(ev);
      });
    }
    const fire=()=>setTimeout(doDrop,1000);
    if(document.readyState==='complete'){
      fire();
    }else{
      window.addEventListener('load',fire);
    }
  })();`;
  }
  const handleFinish = () => {
    if (dropScript) uploadFrame.executeJavaScript(dropScript).catch(()=>{});
    uploadFrame.focus();
    uploadFrame.removeEventListener('did-stop-loading', handleFinish);
  };
  uploadFrame.addEventListener('did-stop-loading', handleFinish);
  uploadNavHandler = e => {
    uploadUrlBar.value = e.url;
  };
  uploadFrame.addEventListener('did-navigate', uploadNavHandler);
  uploadFrame.addEventListener('did-navigate-in-page', uploadNavHandler);
  uploadFrame.src = url;
}

function closeUploadWindow() {
  uploadWindow.classList.remove('active');
  if (previousWindow === 'settings') {
    settingsWindow.classList.add('active');
    document.getElementById('title-text').textContent = 'Settings';
  } else {
    parseWindow.classList.add('active');
    document.getElementById('title-text').textContent = 'Parse';
  }
  uploadStatus.textContent = '';
  uploadStatus.classList.remove('error');
  uploadIsLoading = false;
  uploadRefreshBtn.innerHTML = '&#x21bb;';
  uploadFrame.style.visibility = 'visible';
  if (uploadNavHandler) {
    uploadFrame.removeEventListener('did-navigate', uploadNavHandler);
    uploadFrame.removeEventListener('did-navigate-in-page', uploadNavHandler);
    uploadNavHandler = null;
  }
  previousWindow = null;
}

async function startParse() {
  if (selected.size === 0) {
    alert('Please select at least one file to parse.');
    return;
  }
  openParseWindow();
  const files = Array.from(selected.keys());
  const options = {
    parser: localStorage.getItem('parserSelection') || 'combiner',
    dpsUserToken: localStorage.getItem('dpsReportUserToken') || '',
    guildName: localStorage.getItem('combinerGuildName') || '',
    guildId: localStorage.getItem('combinerGuildId') || '',
    apiKey: localStorage.getItem('combinerApiKey') || '',
    dbUpdate: localStorage.getItem('combinerGlickoUpdate') === 'true',
    fightCharts: localStorage.getItem('combinerFightCharts') === 'true',
    description: descriptionInput.value.trim()
  };
  await window.electronAPI.startParse({ files, options });
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  if (theme === 'light') {
    lightBtn.classList.add('selected');
    darkBtn.classList.remove('selected');
  } else {
    darkBtn.classList.add('selected');
    lightBtn.classList.remove('selected');
  }
  localStorage.setItem('theme', theme);
}

function applyGradient(name) {
  let c1, c2;
  switch (name) {
    case 'sunset':
      c1 = '#ffeb3b';
      c2 = '#f44336';
      break;
    case 'grey':
      c1 = '#d3d3d3';
      c2 = '#a6a6a6';
      break;
    case 'forest':
      c1 = '#a8e063';
      c2 = '#05621f';
      break;
    case 'ocean':
      c1 = '#4facfe';
      c2 = '#00f2fe';
      break;
    case 'rose':
      c1 = '#ff9a9e';
      c2 = '#fad0c4';
      break;
    case 'peach':
      c1 = '#f6d365';
      c2 = '#fda085';
      break;
    case 'lavender':
      c1 = '#e0c3fc';
      c2 = '#8ec5fc';
      break;
    case 'midnight':
      c1 = '#000428';
      c2 = '#004e92';
      break;
    default:
      c1 = '#6ec1e4';
      c2 = '#8e44ad';
  }
  const grad = `linear-gradient(to bottom right, ${c1}, ${c2}) 1`;
  document.documentElement.style.setProperty('--card-border', grad);
  document.documentElement.style.setProperty('--btn-border', c1);
  document.documentElement.style.setProperty('--btn-border-hover', c2);
  localStorage.setItem('gradientTheme', name);
}
