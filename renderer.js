console.time('renderer-init');
requestAnimationFrame(() => requestAnimationFrame(init));

function init() {
  const chooseFolderBtn = document.getElementById('choose-folder');
  const fileTreeContainer = document.getElementById('file-tree-list');
  const selectedList = document.getElementById('selected-list');
  const selectedFolderSpan = document.getElementById('selected-folder');
  const titlebar = document.getElementById('titlebar');
  const dateFilterInput = document.getElementById('date-filter');
  const dateSelectBtn = document.getElementById('date-select');
  const unselectAllBtn = document.getElementById('unselect-all');
  const settingsBtn = document.getElementById('settings');
  const updateNoticeBtn = document.getElementById('update-notice');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress');
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
  const dpsUserTokenInput = document.getElementById('dps-user-token');
  const combinerGuildNameInput = document.getElementById('combiner-guild-name');
  const combinerGuildIdInput = document.getElementById('combiner-guild-id');
  const combinerApiKeyInput = document.getElementById('combiner-api-key');
  const combinerGlickoCheckbox = document.getElementById('combiner-glicko');
  const versionText = document.getElementById('version-text');
  const gradientRadios = document.querySelectorAll('input[name="gradient-theme"]');
  const selected = new Map();
  let currentFolder = '';
  let rootList;
  let folderLists = new Map();
  let loadAll = false;

  dpsUserTokenInput.value = localStorage.getItem('dpsReportUserToken') || '';
  combinerGuildNameInput.value = localStorage.getItem('combinerGuildName') || '';
  combinerGuildIdInput.value = localStorage.getItem('combinerGuildId') || '';
  combinerApiKeyInput.value = localStorage.getItem('combinerApiKey') || '';
  combinerGlickoCheckbox.checked = localStorage.getItem('combinerGlickoUpdate') === 'true';

  document.getElementById('minimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('maximize').addEventListener('click', () => window.electronAPI.maximize());
  document.getElementById('close').addEventListener('click', () => window.electronAPI.close());
  titlebar.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  settingsBtn.addEventListener('click', openSettings);
  updateNoticeBtn.addEventListener('click', () => window.electronAPI.showUpdatePrompt());
  closeSettingsBtn.addEventListener('click', closeSettings);

  function openSettings() {
    mainWindowEl.classList.add('fade-out');
    settingsWindow.classList.add('active');
  }

  function closeSettings() {
    mainWindowEl.classList.remove('fade-out');
    settingsWindow.classList.remove('active');
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
    setTimeout(() => checkDeps().catch(console.error), 0);
  });
  downloadCombinerBtn.addEventListener('click', async () => {
    downloadCombinerBtn.disabled = true;
    await window.electronAPI.downloadDependency('combiner');
    downloadCombinerBtn.disabled = false;
    setTimeout(() => checkDeps().catch(console.error), 0);
  });
  downloadParserBtn.addEventListener('click', async () => {
    downloadParserBtn.disabled = true;
    await window.electronAPI.downloadDependency('parser');
    downloadParserBtn.disabled = false;
    setTimeout(() => checkDeps().catch(console.error), 0);
  });
  parserTopStatsRadio.addEventListener('change', () => {
    if (parserTopStatsRadio.checked) {
      localStorage.setItem('parserSelection', 'topstats');
    }
  });
  parserCombinerRadio.addEventListener('change', () => {
    if (parserCombinerRadio.checked) {
      localStorage.setItem('parserSelection', 'combiner');
    }
  });
  dpsUserTokenInput.addEventListener('input', () => {
    localStorage.setItem('dpsReportUserToken', dpsUserTokenInput.value);
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
async function checkDeps() {
  console.time('renderer-check-deps');
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
  console.timeEnd('renderer-check-deps');
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
    renderSelected();
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
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
  console.timeEnd(`renderer-load:${parent}`);
  if (parent === currentFolder) {
    progressContainer.classList.add('hidden');
    fileTreeContainer.classList.remove('hidden');
    const skeleton = document.getElementById('skeleton-screen');
    if (skeleton) {
      skeleton.classList.add('hidden');
      setTimeout(() => skeleton.remove(), 300);
    }
  }
});
window.electronAPI.onLoadProgress(data => {
  if (data.parent === currentFolder) {
    progressBar.style.width = `${Math.floor(data.progress * 100)}%`;
  }
});

  console.timeEnd('renderer-init');
  console.time('dom-content');
  const savedTheme = localStorage.getItem('theme');
  applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark');
  const grad = localStorage.getItem('gradientTheme') || 'default';
  applyGradient(grad);
  const gradRadio = document.querySelector(`input[name="gradient-theme"][value="${grad}"]`);
  if (gradRadio) gradRadio.checked = true;
  setTimeout(async () => {
    console.time('post-frame');
    if (!savedTheme) {
      const sysTheme = await window.electronAPI.getTheme();
      if (sysTheme === 'light' || sysTheme === 'dark') {
        applyTheme(sysTheme);
      }
    }
    const ver = await window.electronAPI.getAppVersion();
    versionText.textContent = `v${ver}`;
    console.timeEnd('post-frame');
  }, 0);
  const saved = localStorage.getItem('lastFolder');
  const lastTime = localStorage.getItem('lastTimeFilter');
  const parserSel = localStorage.getItem('parserSelection') || 'topstats';
  if (parserSel === 'combiner') {
    parserCombinerRadio.checked = true;
  } else {
    parserTopStatsRadio.checked = true;
  }
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
    setTimeout(() => startLoad(saved, true), 0);
  } else {
    const skeleton = document.getElementById('skeleton-screen');
    if (skeleton) {
      skeleton.classList.add('hidden');
      setTimeout(() => skeleton.remove(), 300);
    }
  }
  // Defer dependency checks until the browser is idle so startup renders faster
  const deferDeps = () => {
    checkDeps().catch(console.error);
  };
  if (window.requestIdleCallback) {
    requestIdleCallback(deferDeps);
  } else {
    setTimeout(deferDeps, 0);
  }
  // Delay parse UI wiring until idle to speed up first paint
  const deferParse = () => initParseUI();
  if (window.requestIdleCallback) {
    requestIdleCallback(deferParse);
  } else {
    setTimeout(deferParse, 0);
  }
  console.timeEnd('dom-content');

chooseFolderBtn.addEventListener('click', async () => {
  const dir = await window.electronAPI.selectFolder();
  if (!dir) return;
  startLoad(dir, true);
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
      selected.set(li.dataset.path, li.dataset.rel);
      li.classList.add('selected');
    }
  });
  renderSelected();
});

unselectAllBtn.addEventListener('click', () => {
  selected.clear();
  fileTreeContainer.querySelectorAll('li.file-item.selected').forEach(li => li.classList.remove('selected'));
  renderSelected();
});

function startLoad(dir, loadEverything = false) {
  const label = `renderer-load:${dir}`;
  console.time(label);
  currentFolder = dir;
  loadAll = loadEverything;
  fileTreeContainer.innerHTML = '';
  fileTreeContainer.classList.add('hidden');
  progressContainer.classList.remove('hidden');
  progressBar.style.width = '0%';
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
    arrow.addEventListener('click', toggle);
    nameSpan.addEventListener('click', toggle);
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

    li.addEventListener('click', () => {
      const p = li.dataset.path;
      if (selected.has(p)) {
        selected.delete(p);
        li.classList.remove('selected');
      } else {
        selected.set(p, li.dataset.rel);
        li.classList.add('selected');
      }
      renderSelected();
    });
  }
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
  for (const [path, rel] of selected.entries()) {
    const li = document.createElement('li');
    li.textContent = rel;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.classList.add('remove-btn');
    btn.addEventListener('click', () => {
      selected.delete(path);
      const item = fileTreeContainer.querySelector(`li.file-item[data-path="${CSS.escape(path)}"]`);
      if (item) {
        item.classList.remove('selected');
      }
      renderSelected();
    });
    li.appendChild(btn);
    selectedList.appendChild(li);
  }
}

function initParseUI() {
  const descriptionInput = document.getElementById('description');
  const parseBtn = document.getElementById('parse-btn');
  const parseWindow = document.getElementById('parse-window');
  const parseOutput = document.getElementById('parse-output');
  const parseSteps = document.getElementById('parse-steps');
  const parseOpenFolderBtn = document.getElementById('parse-open-folder');
  const parseCloseBtn = document.getElementById('parse-close');
  const parseCancelBtn = document.getElementById('parse-cancel');
  let currentStepId = null;

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
    parseOutput.textContent = '';
    parseSteps.innerHTML = '';
    currentStepId = null;
    parseOpenFolderBtn.disabled = true;
    parseCloseBtn.disabled = true;
    parseCancelBtn.disabled = false;
  }

  function closeParseWindow() {
    parseWindow.classList.remove('active');
    mainWindowEl.classList.remove('fade-out');
    document.getElementById('title-text').textContent = 'Top Stats AIO';
  }

  async function startParse() {
    if (selected.size === 0) {
      alert('Please select at least one file to parse.');
      return;
    }
    openParseWindow();
    const files = Array.from(selected.keys());
    const options = {
      parser: localStorage.getItem('parserSelection') || 'topstats',
      dpsUserToken: localStorage.getItem('dpsReportUserToken') || '',
      guildName: localStorage.getItem('combinerGuildName') || '',
      guildId: localStorage.getItem('combinerGuildId') || '',
      apiKey: localStorage.getItem('combinerApiKey') || '',
      dbUpdate: localStorage.getItem('combinerGlickoUpdate') === 'true',
      description: descriptionInput.value.trim()
    };
    await window.electronAPI.startParse({ files, options });
  }

  parseBtn.addEventListener('click', startParse);
  parseCloseBtn.addEventListener('click', closeParseWindow);
  parseOpenFolderBtn.addEventListener('click', () => window.electronAPI.openParsedFolder());
  parseCancelBtn.addEventListener('click', () => {
    parseCancelBtn.disabled = true;
    window.electronAPI.cancelParse();
  });
  window.electronAPI.onParseProgress(msg => {
    parseOutput.textContent += msg + '\n';
    parseOutput.scrollTop = parseOutput.scrollHeight;
  });
  window.electronAPI.onParseStep(data => updateStep(data));
  window.electronAPI.onParseComplete(success => {
    parseOpenFolderBtn.disabled = !success;
    parseCloseBtn.disabled = false;
    parseCancelBtn.disabled = true;
    updateStep({ id: 'complete', title: success ? 'Completed' : 'Failed', progress: 1, error: success ? null : 'Error', success });
  });
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

}
