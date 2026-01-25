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

const {
  SUPPORTED_BOONS,
  SUPPORTED_BOON_IDS,
  DEFAULT_SUPPORT_PROFS,
  SUPPORT_PROFS_STORAGE_KEY,
  LEGACY_SUPPORT_PROFS_STORAGE_KEY,
  normalizeUrl,
  isTiddlyhostSignIn,
  makeTiddlyhostLoginScript,
  cloneSupportProfEntry,
  loadRendererSettings,
  saveRendererSetting,
  loadSupportProfs,
  saveSupportProfs,
  loadWeights,
  saveWeights,
  getLoginTargetUrl
} = window.rendererUtils;

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
const combinerSettingsWindow = document.getElementById('combiner-settings-window');
const openCombinerSettingsBtn = document.getElementById('open-combiner-settings');
const combinerSettingsBackBtn = document.getElementById('combiner-settings-back');
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
const combinerGuildLookupBtn = document.getElementById('combiner-guild-lookup');
const combinerApiKeyInput = document.getElementById('combiner-api-key');
const combinerWebhookInput = document.getElementById('combiner-webhook-url');
const combinerGlickoCheckbox = document.getElementById('combiner-glicko');
const combinerFightChartsCheckbox = document.getElementById('combiner-fight-charts');
const combinerHideColumnsCheckbox = document.getElementById('combiner-hide-columns');
const combinerBoonsDetailedCheckbox = document.getElementById('combiner-boons-detailed');
const combinerOffensiveDetailedCheckbox = document.getElementById('combiner-offensive-detailed');
const combinerDefensesDetailedCheckbox = document.getElementById('combiner-defenses-detailed');
const combinerSupportDetailedCheckbox = document.getElementById('combiner-support-detailed');
const tiddlyhostUsernameInput = document.getElementById('tiddlyhost-username');
const tiddlyhostPasswordInput = document.getElementById('tiddlyhost-password');
const combinerBlacklistInput = document.getElementById('combiner-blacklist-accounts');
const combinerInputDirectoryInput = document.getElementById('combiner-input-directory');
const combinerOutputFilenameInput = document.getElementById('combiner-output-filename');
const combinerJsonOutputFilenameInput = document.getElementById('combiner-json-output-filename');
const combinerDbFilenameInput = document.getElementById('combiner-db-filename');
const combinerDbPathInput = document.getElementById('combiner-db-path');
const combinerWriteAllJsonCheckbox = document.getElementById('combiner-write-all-json');
const combinerWriteExcelCheckbox = document.getElementById('combiner-write-excel');
const combinerExcelFilenameInput = document.getElementById('combiner-excel-filename');
const combinerExcelPathInput = document.getElementById('combiner-excel-path');
const combinerSkillCastLimitInput = document.getElementById('combiner-skill-cast-limit');
const combinerSortModeSelect = document.getElementById('combiner-sort-mode');
const combinerDiscordNotesInput = document.getElementById('combiner-discord-notes');
const boonWeightsContainer = document.getElementById('boon-weights');
const conditionWeightsContainer = document.getElementById('condition-weights');
const supportProfsContainer = document.getElementById('supported-profs');
const addSupportProfBtn = document.getElementById('add-supported-prof');
const supportProfsMessage = document.getElementById('supported-profs-message');
const eiAnonymizeCheckbox = document.getElementById('ei-anonymize');
const descriptionInput = document.getElementById('description');
const parseBtn = document.getElementById('parse-btn');
const parseWindow = document.getElementById('parse-window');
const parseOutput = document.getElementById('parse-output');
const parseSteps = document.getElementById('parse-steps');
const parseOpenFolderBtn = document.getElementById('parse-open-folder');
const parseUploadBtn = document.getElementById('parse-upload');
const parseSaveTailwindBtn = document.getElementById('parse-save-tailwind');
const parseCloseBtn = document.getElementById('parse-close');

const parseCancelBtn = document.getElementById('parse-cancel');
const versionText = document.getElementById('version-text');
const uploadWindow = document.getElementById('upload-window');
const uploadUrlBar = document.getElementById('upload-url-display');
const uploadCloseBtn = document.getElementById('upload-close');
const uploadRefreshBtn = document.getElementById('upload-refresh');
const uploadBackBtn = document.getElementById('upload-back');
const uploadForwardBtn = document.getElementById('upload-forward');
const uploadHomeBtn = document.getElementById('upload-home');
const uploadCopyBtn = document.getElementById('upload-copy');
const uploadFrame = document.getElementById('upload-frame');
const uploadLoading = document.getElementById('upload-loading');
const uploadStatus = document.getElementById('upload-status');
const copyToast = document.getElementById('copy-toast');
const setupTiddlyhostBtn = document.getElementById('setup-tiddlyhost');
const tiddlyGuide = document.getElementById('tiddly-guide');
const tiddlyGuideText = document.getElementById('tiddly-guide-text');
const tiddlySetupBtn = document.getElementById('tiddly-setup');
const tiddlyRefreshBtn = document.getElementById('tiddly-refresh');
const tiddlyUseUrlBtn = document.getElementById('tiddly-use-url');
const uploadImportSkinBtn = document.getElementById('upload-import-skin');
const skinUpdateBadge = document.getElementById('skin-update-badge');
const gradientRadios = document.querySelectorAll('input[name="gradient-theme"]');
const gradientSummary = document.getElementById('gradient-summary');
const backdropIconSelectBtn = document.getElementById('backdrop-icon-select');
const backdropIconClearBtn = document.getElementById('backdrop-icon-clear');
const backdropIconInput = document.getElementById('backdrop-icon-input');
const backdropIconImg = document.getElementById('backdrop-icon-img');
const backdropIconPlaceholder = document.getElementById('backdrop-icon-placeholder');
const PARSE_STEPS_CONFIG = [
  { id: 'copy', title: 'Copying Logs', icon: '1' },
  { id: 'cli', title: 'EI CLI Analysis', icon: '2' },
  { id: 'final', title: 'Processing Stats', icon: '3' },
  { id: 'complete', title: 'Finalizing', icon: '4' }
];

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
let tiddlyMode = false;
let tiddlySitePollId = 0;
let tiddlySetupStage = 0;
let supportProfsMessageTimeout = null;
let boonWeightsState = {};
let conditionWeightsState = {};
let tiddlyhostCredentials = { username: '', password: '' };
let pendingSkinImport = null;
const webviewProgress = document.getElementById('webview-progress');
const uploadLoadingText = document.getElementById('upload-loading-text');
let uploadStuckTimer = null;



const BOON_WEIGHT_KEYS = [
  'Aegis',
  'Alacrity',
  'Fury',
  'Might',
  'Protection',
  'Quickness',
  'Regeneration',
  'Resistance',
  'Resolution',
  'Stability',
  'Swiftness',
  'Vigor',
  'Superspeed'
];

const CONDITION_WEIGHT_KEYS = [
  'Bleeding',
  'Burning',
  'Confusion',
  'Poison',
  'Torment',
  'Blind',
  'Chilled',
  'Crippled',
  'Fear',
  'Immobile',
  'Slow',
  'Taunt',
  'Weakness',
  'Vulnerability'
];

const GW2_PROFESSION_GROUPS = [
  { label: 'Guardian', options: ['Guardian', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary'] },
  { label: 'Warrior', options: ['Warrior', 'Berserker', 'Spellbreaker', 'Bladesworn', 'Paragon'] },
  { label: 'Revenant', options: ['Revenant', 'Herald', 'Renegade', 'Vindicator', 'Conduit'] },
  { label: 'Engineer', options: ['Engineer', 'Scrapper', 'Holosmith', 'Mechanist', 'Amalgam'] },
  { label: 'Ranger', options: ['Ranger', 'Druid', 'Soulbeast', 'Untamed', 'Galeshot'] },
  { label: 'Thief', options: ['Thief', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary'] },
  { label: 'Elementalist', options: ['Elementalist', 'Tempest', 'Weaver', 'Catalyst', 'Evoker'] },
  { label: 'Mesmer', options: ['Mesmer', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'] },
  { label: 'Necromancer', options: ['Necromancer', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist'] }
];
const GW2_PROFESSION_SET = new Set(
  GW2_PROFESSION_GROUPS.flatMap(group => group.options)
);
const BOON_WEIGHTS_STORAGE_KEY = 'combinerBoonWeights';
const CONDITION_WEIGHTS_STORAGE_KEY = 'combinerConditionWeights';

let supportProfs = [];



function renderWeightInputs(container, weights, storageKey) {
  if (!container) return;
  container.innerHTML = '';
  Object.entries(weights).forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'weight-row';
    const label = document.createElement('label');
    label.textContent = key;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '0.1';
    input.value = value;
    input.addEventListener('input', () => {
      const num = Number(input.value);
      weights[key] = Number.isFinite(num) ? num : 1;
      saveWeights(localStorage, storageKey, weights);
    });
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

async function loadTiddlyhostCredentials() {
  if (!window.electronAPI?.getTiddlyhostCredentials) return;
  try {
    const creds = await window.electronAPI.getTiddlyhostCredentials();
    tiddlyhostCredentials = {
      username: typeof creds?.username === 'string' ? creds.username : '',
      password: typeof creds?.password === 'string' ? creds.password : ''
    };
    if (tiddlyhostUsernameInput) tiddlyhostUsernameInput.value = tiddlyhostCredentials.username;
    if (tiddlyhostPasswordInput) tiddlyhostPasswordInput.value = tiddlyhostCredentials.password;
  } catch { }
}

function saveTiddlyhostCredentials() {
  if (!window.electronAPI?.setTiddlyhostCredentials) return;
  tiddlyhostCredentials = {
    username: tiddlyhostUsernameInput?.value.trim() || '',
    password: tiddlyhostPasswordInput?.value || ''
  };
  window.electronAPI.setTiddlyhostCredentials(tiddlyhostCredentials);
}

function showSupportProfsMessage(text) {
  if (!supportProfsMessage) return;
  supportProfsMessage.textContent = text;
  supportProfsMessage.classList.remove('hidden');
  if (supportProfsMessageTimeout) clearTimeout(supportProfsMessageTimeout);
  supportProfsMessageTimeout = setTimeout(() => {
    supportProfsMessage.classList.add('hidden');
  }, 3000);
}

function getSupportProfsForOptions() {
  return supportProfs
    .map(entry => {
      const name = (entry.name || '').trim();
      if (!name) return null;
      const seen = new Set();
      const boons = Array.isArray(entry.boons)
        ? entry.boons.filter(id => {
          if (!SUPPORTED_BOON_IDS.has(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        }).slice(0, 5)
        : [];
      if (!boons.length) return null;
      return { name, boons };
    })
    .filter(Boolean);
}

function removeSupportProf(index) {
  supportProfs.splice(index, 1);
  saveSupportProfs(localStorage, supportProfs);
  renderSupportProfs();
}

function toggleSupportProfBoon(index, boonId, checked, checkbox) {
  const prof = supportProfs[index];
  if (!prof) return;
  if (!Array.isArray(prof.boons)) {
    prof.boons = [];
  }
  if (checked) {
    if (prof.boons.includes(boonId)) return;
    if (prof.boons.length >= 5) {
      if (checkbox) checkbox.checked = false;
      showSupportProfsMessage('A profession can only track up to five boons.');
      return;
    }
    prof.boons.push(boonId);
  } else {
    prof.boons = prof.boons.filter(id => id !== boonId);
  }
  saveSupportProfs(localStorage, supportProfs);
}

function renderSupportProfs() {
  if (!supportProfsContainer) return;
  supportProfsContainer.innerHTML = '';
  if (!supportProfs.length) {
    const empty = document.createElement('p');
    empty.className = 'supported-profs-empty';
    empty.textContent = 'No professions configured.';
    supportProfsContainer.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  supportProfs.forEach((prof, index) => {
    const entry = document.createElement('div');
    entry.className = 'supported-prof-entry';

    const header = document.createElement('div');
    header.className = 'supported-prof-header';
    const nameSelect = document.createElement('select');
    nameSelect.className = 'config-input';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select a profession';
    nameSelect.appendChild(placeholderOption);
    GW2_PROFESSION_GROUPS.forEach(group => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      group.options.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        optgroup.appendChild(option);
      });
      nameSelect.appendChild(optgroup);
    });
    if (prof.name && !GW2_PROFESSION_SET.has(prof.name)) {
      const customOption = document.createElement('option');
      customOption.value = prof.name;
      customOption.textContent = prof.name;
      nameSelect.appendChild(customOption);
    }
    nameSelect.value = prof.name || '';
    nameSelect.addEventListener('change', () => {
      supportProfs[index].name = nameSelect.value;
      saveSupportProfs(localStorage, supportProfs);
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'small-btn remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeSupportProf(index));
    header.appendChild(nameSelect);
    header.appendChild(removeBtn);
    entry.appendChild(header);

    const boonList = document.createElement('div');
    boonList.className = 'supported-prof-boons';
    SUPPORTED_BOONS.forEach(boon => {
      const label = document.createElement('label');
      label.className = 'boon-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = boon.id;
      checkbox.checked = Array.isArray(prof.boons) && prof.boons.includes(boon.id);
      checkbox.addEventListener('change', () =>
        toggleSupportProfBoon(index, boon.id, checkbox.checked, checkbox)
      );
      label.appendChild(checkbox);
      const text = document.createElement('span');
      text.textContent = boon.label;
      label.appendChild(text);
      boonList.appendChild(label);
    });
    entry.appendChild(boonList);
    fragment.appendChild(entry);
  });
  supportProfsContainer.appendChild(fragment);
}



function applyTiddlyhostScrollFix() {
  try {
    const url = uploadFrame.getURL();
    if (!url) return;
    const host = new URL(url).hostname.toLowerCase();
    if (!host.endsWith('tiddlyhost.com')) return;
    if (typeof uploadFrame.insertCSS !== 'function') return;
    uploadFrame.insertCSS(`
       /* html, body { overflow: hidden !important; } */
       /* ::-webkit-scrollbar { width: 0 !important; height: 0 !important; } */
    `).catch(() => { });
  } catch { }
}

function navigateUploadFrame(url) {
  if (!url) return;

  const doNav = (attempts = 0) => {
    try {
      // First, check if we're even correctly referencing the frame
      if (!uploadFrame) return;

      // Try setting src directly as a fallback/initial attempt
      // but loadURL is better as it always triggers a fresh reload.
      if (typeof uploadFrame.loadURL === 'function') {
        uploadFrame.loadURL(url);
      } else {
        uploadFrame.src = url;
      }
    } catch (e) {
      // If unattached, retry with backoff. 10 attempts over ~1.5s
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('attached') && attempts < 10) {
        setTimeout(() => doNav(attempts + 1), 100 + (attempts * 50));
      } else {
        console.warn('Navigation failed, trying direct src assignment:', e);
        try { uploadFrame.src = url; } catch { }
      }
    }
  };

  doNav();
}



const initialSettings = loadRendererSettings(localStorage);

dpsUserTokenInput.value = initialSettings.dpsReportUserToken;
uploadUrlInput.value = initialSettings.uploadUrl;
combinerGuildNameInput.value = initialSettings.combinerGuildName;
combinerGuildIdInput.value = initialSettings.combinerGuildId;
function updateGuildLookupState() {
  combinerGuildLookupBtn.disabled = !combinerGuildNameInput.value.trim();
}
updateGuildLookupState();
combinerApiKeyInput.value = initialSettings.combinerApiKey;
combinerWebhookInput.value = initialSettings.combinerWebhookUrl;
combinerGlickoCheckbox.checked = initialSettings.combinerGlickoUpdate;
combinerFightChartsCheckbox.checked = initialSettings.combinerFightCharts;
combinerHideColumnsCheckbox.checked = initialSettings.combinerHideColumns;
combinerBoonsDetailedCheckbox.checked = initialSettings.combinerBoonsDetailed;
combinerOffensiveDetailedCheckbox.checked = initialSettings.combinerOffensiveDetailed;
combinerDefensesDetailedCheckbox.checked = initialSettings.combinerDefensesDetailed;
combinerSupportDetailedCheckbox.checked = initialSettings.combinerSupportDetailed;
combinerBlacklistInput.value = initialSettings.combinerBlacklistAccounts;
combinerInputDirectoryInput.value = initialSettings.combinerInputDirectory;
combinerOutputFilenameInput.value = initialSettings.combinerOutputFilename;
combinerJsonOutputFilenameInput.value = initialSettings.combinerJsonOutputFilename;
combinerDbFilenameInput.value = initialSettings.combinerDbFilename;
combinerDbPathInput.value = initialSettings.combinerDbPath;
combinerWriteAllJsonCheckbox.checked = initialSettings.combinerWriteAllJson;
combinerWriteExcelCheckbox.checked = initialSettings.combinerWriteExcel;
combinerExcelFilenameInput.value = initialSettings.combinerExcelFilename;
combinerExcelPathInput.value = initialSettings.combinerExcelPath;
combinerSkillCastLimitInput.value = initialSettings.combinerSkillCastLimit;
combinerSortModeSelect.value = initialSettings.combinerSortMode;
combinerDiscordNotesInput.value = initialSettings.combinerDiscordNotes;
eiAnonymizeCheckbox.checked = initialSettings.eiAnonymizePlayers;
supportProfs = loadSupportProfs(localStorage);
renderSupportProfs();
boonWeightsState = loadWeights(localStorage, BOON_WEIGHTS_STORAGE_KEY, BOON_WEIGHT_KEYS);
conditionWeightsState = loadWeights(localStorage, CONDITION_WEIGHTS_STORAGE_KEY, CONDITION_WEIGHT_KEYS);
renderWeightInputs(boonWeightsContainer, boonWeightsState, BOON_WEIGHTS_STORAGE_KEY);
renderWeightInputs(conditionWeightsContainer, conditionWeightsState, CONDITION_WEIGHTS_STORAGE_KEY);
if (addSupportProfBtn) {
  addSupportProfBtn.addEventListener('click', () => {
    supportProfs.push({ name: '', boons: [] });
    saveSupportProfs(localStorage, supportProfs);
    renderSupportProfs();
  });
}

// Custom Backdrop Icon handling
function loadBackdropIcon() {
  const savedIcon = localStorage.getItem('customBackdropIcon');
  if (savedIcon && backdropIconImg && backdropIconPlaceholder) {
    backdropIconImg.src = savedIcon;
    backdropIconImg.style.display = 'block';
    backdropIconPlaceholder.style.display = 'none';
  }
}

function saveBackdropIcon(base64Data) {
  localStorage.setItem('customBackdropIcon', base64Data);
  if (backdropIconImg && backdropIconPlaceholder) {
    backdropIconImg.src = base64Data;
    backdropIconImg.style.display = 'block';
    backdropIconPlaceholder.style.display = 'none';
  }
}

function clearBackdropIcon() {
  localStorage.removeItem('customBackdropIcon');
  if (backdropIconImg && backdropIconPlaceholder) {
    backdropIconImg.src = '';
    backdropIconImg.style.display = 'none';
    backdropIconPlaceholder.style.display = 'block';
  }
}

loadBackdropIcon();

if (backdropIconSelectBtn && backdropIconInput) {
  backdropIconSelectBtn.addEventListener('click', () => {
    backdropIconInput.click();
  });

  backdropIconInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      saveBackdropIcon(base64Data);
    };
    reader.readAsDataURL(file);
    backdropIconInput.value = ''; // Reset for re-selection
  });
}

if (backdropIconClearBtn) {
  backdropIconClearBtn.addEventListener('click', clearBackdropIcon);
}

document.getElementById('minimize').addEventListener('click', () => window.electronAPI.minimize());
document.getElementById('maximize').addEventListener('click', () => window.electronAPI.maximize());
document.getElementById('close').addEventListener('click', () => window.electronAPI.close());
titlebar.addEventListener('wheel', e => e.preventDefault(), { passive: false });
settingsBtn.addEventListener('click', openSettings);

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
if (openCombinerSettingsBtn) {
  console.log('Attaching listener to openCombinerSettingsBtn');
  openCombinerSettingsBtn.addEventListener('click', () => {
    console.log('openCombinerSettingsBtn clicked');
    if (settingsWindow) settingsWindow.classList.remove('active');
    if (combinerSettingsWindow) {
      combinerSettingsWindow.classList.add('active');
    } else {
      console.error('combinerSettingsWindow element not found');
    }
    const titleText = document.getElementById('title-text');
    if (titleText) titleText.textContent = 'Log Combiner Settings';
  });
} else {
  console.error('openCombinerSettingsBtn element not found');
}
if (combinerSettingsBackBtn) {
  combinerSettingsBackBtn.addEventListener('click', () => {
    combinerSettingsWindow.classList.remove('active');
    settingsWindow.classList.add('active');
    document.getElementById('title-text').textContent = 'Settings';
  });
}

function openSettings() {
  mainWindowEl.classList.add('fade-out');
  settingsWindow.classList.add('active');
  if (combinerSettingsWindow) {
    combinerSettingsWindow.classList.remove('active');
  }
  document.getElementById('title-text').textContent = 'Settings';
}

function closeSettings() {
  mainWindowEl.classList.remove('fade-out');
  settingsWindow.classList.remove('active');
  if (combinerSettingsWindow) {
    combinerSettingsWindow.classList.remove('active');
  }
  document.getElementById('title-text').textContent = 'Top Stats AIO';
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

gradientRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      applyGradient(radio.value);
      const span = radio.nextElementSibling;
      if (gradientSummary && span) {
        gradientSummary.textContent = span.textContent;
      }
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
    saveRendererSetting(localStorage, 'parserSelection', 'topstats');
    updateDescriptionVisibility();
  }
});
parserCombinerRadio.addEventListener('change', () => {
  if (parserCombinerRadio.checked) {
    saveRendererSetting(localStorage, 'parserSelection', 'combiner');
    updateDescriptionVisibility();
  }
});
openParserFolderBtn.addEventListener('click', () => {
  const sel = localStorage.getItem('parserSelection') || 'combiner';
  window.electronAPI.openParserFolder(sel);
});
// Utility: Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

dpsUserTokenInput.addEventListener('input', debounce(() => {
  localStorage.setItem('dpsReportUserToken', dpsUserTokenInput.value.trim());
}, 500));

uploadUrlInput.addEventListener('input', debounce(() => {
  localStorage.setItem('uploadUrl', uploadUrlInput.value.trim());
}, 500));

if (tiddlyhostUsernameInput) {
  tiddlyhostUsernameInput.addEventListener('input', debounce(saveTiddlyhostCredentials, 500));
}
if (tiddlyhostPasswordInput) {
  tiddlyhostPasswordInput.addEventListener('input', debounce(saveTiddlyhostCredentials, 500));
}
tiddlySetupBtn.addEventListener('click', async () => {
  const combinerPayload = await window.electronAPI.getExampleOutput('combiner');
  const customIcon = localStorage.getItem('customBackdropIcon');
  const skinPayload = await window.electronAPI.getSkinContent(customIcon);
  const payload = [...(combinerPayload || [])];
  if (skinPayload) payload.push(skinPayload);

  if (payload && payload.length) {
    const dropScript = makeDropScript(payload, true);
    setTimeout(() => {
      uploadFrame
        .executeJavaScript(dropScript, true)
        .then(() => {
          tiddlyGuideText.textContent = 'Press the Import button, and then the Red save dot on the right, once done hit refresh';
          tiddlySetupBtn.classList.add('hidden');
          tiddlyRefreshBtn.classList.remove('hidden');
          tiddlySetupStage = 1;
        })
        .catch(() => { });
    }, 1000);
  }
});
tiddlyRefreshBtn.addEventListener('click', () => {
  tiddlySetupStage = 2;
  tiddlyUseUrlBtn.classList.add('hidden');
  uploadFrame.reload();
});
tiddlyUseUrlBtn.addEventListener('click', () => {
  const url = normalizeUrl(uploadFrame.getURL());
  if (url) {
    uploadUrlInput.value = url;
    localStorage.setItem('uploadUrl', url);
  }
  tiddlyGuide.classList.add('hidden');
  tiddlyUseUrlBtn.classList.add('hidden');
});
uploadLoginBtn.addEventListener('click', () => {
  const hasCredentials = Boolean(tiddlyhostCredentials.username && tiddlyhostCredentials.password);
  let url = normalizeUrl(uploadUrlInput.value);
  if (!hasCredentials) {
    if (!url) {
      alert('Upload URL is invalid.');
      return;
    }
    localStorage.setItem('uploadUrl', url);
    uploadUrlInput.value = url;
  } else if (url) {
    localStorage.setItem('uploadUrl', url);
    uploadUrlInput.value = url;
  }
  const loginUrl = hasCredentials ? 'https://tiddlyhost.com/users/sign_in' : (getLoginTargetUrl(url) || url);
  openUploadWindow(loginUrl, [], false, { syncInput: false, loginDetails: hasCredentials ? tiddlyhostCredentials : null });
});

if (uploadImportSkinBtn) {
  uploadImportSkinBtn.addEventListener('click', async () => {
    let url = localStorage.getItem('uploadUrl') || uploadUrlInput.value;
    if (!url || !url.includes('tiddlyhost.com')) {
      alert('Please configure a valid Tiddlyhost Upload URL first.');
      return;
    }
    url = normalizeUrl(url);
    if (!url) {
      alert('Invalid Upload URL format.');
      return;
    }

    uploadImportSkinBtn.disabled = true;
    const originalText = uploadImportSkinBtn.childNodes[0].textContent;
    uploadImportSkinBtn.childNodes[0].textContent = 'Loading Skin...';

    try {
      const customIcon = localStorage.getItem('customBackdropIcon');
      const skin = await window.electronAPI.getSkinContent(customIcon);
      if (!skin) throw new Error('Could not load skin content.');

      // Close skin import window re-enables button
      const finalize = () => {
        uploadImportSkinBtn.disabled = false;
        uploadImportSkinBtn.childNodes[0].textContent = originalText;
      };

      openUploadWindow(url, [skin], false, {
        callback: () => {
          if (skin.version) {
            localStorage.setItem('skinVersion', skin.version);
            if (skinUpdateBadge) skinUpdateBadge.classList.add('hidden');
          }
          finalize();
        }
      });
    } catch (e) {
      alert('Failed to import skin: ' + e.message);
      uploadImportSkinBtn.disabled = false;
      uploadImportSkinBtn.childNodes[0].textContent = originalText;
    }
  });
}
setupTiddlyhostBtn.addEventListener('click', () => {
  openUploadWindow('https://tiddlyhost.com/', [], true);
});
tiddlyhostUsernameInput.addEventListener('input', () => {
  saveTiddlyhostCredentials();
});
tiddlyhostPasswordInput.addEventListener('input', () => {
  saveTiddlyhostCredentials();
});
combinerGuildNameInput.addEventListener('input', () => {
  localStorage.setItem('combinerGuildName', combinerGuildNameInput.value);
  updateGuildLookupState();
});
combinerGuildIdInput.addEventListener('input', () => {
  localStorage.setItem('combinerGuildId', combinerGuildIdInput.value);
});
combinerGuildLookupBtn.addEventListener('click', async () => {
  const name = combinerGuildNameInput.value.trim();
  if (!name) {
    alert('Please enter a guild name.');
    return;
  }
  const url = `https://api.guildwars2.com/v2/guild/search?name=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        alert('No guild found. Ensure the name is spelled exactly and does not include the guild tag.');
      } else {
        alert('Error looking up guild.');
      }
      return;
    }
    const ids = await res.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      alert('No guild found. Ensure the name is spelled exactly and does not include the guild tag.');
      return;
    }
    const guildId = ids[0];
    combinerGuildIdInput.value = guildId;
    localStorage.setItem('combinerGuildId', guildId);
    showToast('Guild lookup successful');
  } catch {
    alert('Error looking up guild.');
  }
});
combinerApiKeyInput.addEventListener('input', () => {
  localStorage.setItem('combinerApiKey', combinerApiKeyInput.value);
});
combinerWebhookInput.addEventListener('input', () => {
  localStorage.setItem('combinerWebhookUrl', combinerWebhookInput.value);
});
combinerGlickoCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerGlickoUpdate', combinerGlickoCheckbox.checked ? 'true' : 'false');
});
combinerFightChartsCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerFightCharts', combinerFightChartsCheckbox.checked ? 'true' : 'false');
});
combinerHideColumnsCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerHideColumns', combinerHideColumnsCheckbox.checked ? 'true' : 'false');
});
combinerBoonsDetailedCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerBoonsDetailed', combinerBoonsDetailedCheckbox.checked ? 'true' : 'false');
});
combinerOffensiveDetailedCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerOffensiveDetailed', combinerOffensiveDetailedCheckbox.checked ? 'true' : 'false');
});
combinerDefensesDetailedCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerDefensesDetailed', combinerDefensesDetailedCheckbox.checked ? 'true' : 'false');
});
combinerSupportDetailedCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerSupportDetailed', combinerSupportDetailedCheckbox.checked ? 'true' : 'false');
});
combinerBlacklistInput.addEventListener('input', () => {
  localStorage.setItem('combinerBlacklistAccounts', combinerBlacklistInput.value);
});
combinerInputDirectoryInput.addEventListener('input', () => {
  localStorage.setItem('combinerInputDirectory', combinerInputDirectoryInput.value);
});
combinerOutputFilenameInput.addEventListener('input', () => {
  localStorage.setItem('combinerOutputFilename', combinerOutputFilenameInput.value);
});
combinerJsonOutputFilenameInput.addEventListener('input', () => {
  localStorage.setItem('combinerJsonOutputFilename', combinerJsonOutputFilenameInput.value);
});
combinerDbFilenameInput.addEventListener('input', () => {
  localStorage.setItem('combinerDbFilename', combinerDbFilenameInput.value);
});
combinerDbPathInput.addEventListener('input', () => {
  localStorage.setItem('combinerDbPath', combinerDbPathInput.value);
});
combinerWriteAllJsonCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerWriteAllJson', combinerWriteAllJsonCheckbox.checked ? 'true' : 'false');
});
combinerWriteExcelCheckbox.addEventListener('change', () => {
  localStorage.setItem('combinerWriteExcel', combinerWriteExcelCheckbox.checked ? 'true' : 'false');
});
combinerExcelFilenameInput.addEventListener('input', () => {
  localStorage.setItem('combinerExcelFilename', combinerExcelFilenameInput.value);
});
combinerExcelPathInput.addEventListener('input', () => {
  localStorage.setItem('combinerExcelPath', combinerExcelPathInput.value);
});
combinerSkillCastLimitInput.addEventListener('input', () => {
  localStorage.setItem('combinerSkillCastLimit', combinerSkillCastLimitInput.value);
});
combinerSortModeSelect.addEventListener('change', () => {
  localStorage.setItem('combinerSortMode', combinerSortModeSelect.value);
});
combinerDiscordNotesInput.addEventListener('input', () => {
  localStorage.setItem('combinerDiscordNotes', combinerDiscordNotesInput.value);
});
eiAnonymizeCheckbox.addEventListener('change', () => {
  localStorage.setItem('eiAnonymizePlayers', eiAnonymizeCheckbox.checked ? 'true' : 'false');
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
  openUploadWindow(url, payload, false);
});


parseCancelBtn.addEventListener('click', () => {
  parseCancelBtn.disabled = true;
  window.electronAPI.cancelParse();
});
uploadCloseBtn.addEventListener('click', closeUploadWindow);
uploadWindow.addEventListener('mouseenter', () => {
  if (!uploadIsLoading) uploadFrame.focus();
});
uploadRefreshBtn.addEventListener('click', () => {
  if (uploadIsLoading) {
    uploadFrame.stop();
  } else {
    uploadFrame.reload();
  }
});
uploadBackBtn.addEventListener('click', () => {
  if (uploadFrame.canGoBack()) uploadFrame.goBack();
});
uploadForwardBtn.addEventListener('click', () => {
  if (uploadFrame.canGoForward()) uploadFrame.goForward();
});
uploadHomeBtn.addEventListener('click', () => {
  const url = normalizeUrl(localStorage.getItem('uploadUrl') || uploadUrlInput.value);
  if (url) {
    uploadLoading.classList.add('active');
    uploadFrame.style.visibility = 'hidden';
    navigateUploadFrame(url);
    uploadUrlBar.value = url;
  }
});
function showToast(message) {
  copyToast.textContent = message;
  copyToast.classList.add('show');
  setTimeout(() => copyToast.classList.remove('show'), 2000);
}
uploadCopyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(uploadUrlBar.value)
    .then(() => showToast('Address Copied to Clipboard'))
    .catch(() => { });
});
uploadUrlBar.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    let url = normalizeUrl(uploadUrlBar.value);
    if (url) {
      uploadLoading.classList.add('active');
      uploadFrame.style.visibility = 'hidden';
      navigateUploadFrame(url);
      uploadUrlBar.value = url;
    } else {
      alert('URL is invalid.');
    }
  }
});
const setUploadProgress = (percent) => {
  if (webviewProgress) {
    webviewProgress.style.width = percent + '%';
    if (percent >= 100) {
      setTimeout(() => {
        if (!uploadIsLoading && webviewProgress) webviewProgress.style.width = '0%';
      }, 800);
    }
  }
};

uploadFrame.addEventListener('did-start-loading', () => {
  uploadIsLoading = true;
  uploadRefreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';
  uploadRefreshBtn.title = 'Stop Loading';
  uploadRefreshBtn.ariaLabel = 'Stop Loading';
  uploadRefreshBtn.classList.add('loading');
  uploadStatus.textContent = '';
  uploadStatus.classList.remove('error');
  uploadLoading.classList.add('active');
  if (uploadLoadingText) uploadLoadingText.textContent = 'Loading page...';
  uploadFrame.style.visibility = 'hidden';
  setUploadProgress(15);

  // Clear any existing stuck timer
  if (uploadStuckTimer) clearTimeout(uploadStuckTimer);

  // Set a timer to check if we're "stuck" (e.g. 10 seconds with no progress)
  uploadStuckTimer = setTimeout(() => {
    if (uploadIsLoading && uploadLoadingText) {
      uploadLoadingText.textContent = 'Still loading... This site might be slow.';
      uploadStatus.textContent = 'Request is taking longer than usual.';
    }
  }, 12000);
});
uploadFrame.addEventListener('did-stop-loading', () => {
  uploadIsLoading = false;
  uploadRefreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>';
  uploadRefreshBtn.title = 'Refresh';
  uploadRefreshBtn.ariaLabel = 'Refresh';
  uploadRefreshBtn.classList.remove('loading');
  uploadLoading.classList.remove('active');
  uploadFrame.style.visibility = 'visible';
  setUploadProgress(100);

  if (uploadStuckTimer) {
    clearTimeout(uploadStuckTimer);
    uploadStuckTimer = null;
  }

  updateUploadNav();
  if (tiddlyMode && tiddlySetupStage === 2) {
    tiddlyGuideText.textContent = 'Congrats! Tiddlywiki successfully set up. Set your upload URL to this page?';
    tiddlyRefreshBtn.classList.add('hidden');
    tiddlyUseUrlBtn.classList.remove('hidden');
    tiddlySetupStage = 3;
  }
});
// Redirect attempts to open a new window into the current frame
uploadFrame.addEventListener('new-window', e => {
  e.preventDefault();
  const url = e.url;
  if (url) {
    navigateUploadFrame(url);
    uploadUrlBar.value = url;
    updateUploadNav();
    if (tiddlyMode) updateTiddlyGuide(url);
  }
});
uploadFrame.addEventListener('dom-ready', () => {
  // Defensive check for attachment
  try {
    // Methods like insertCSS and executeJavaScript require the webview to be attached
    setTimeout(() => {
      try {
        if (uploadFrame && typeof uploadFrame.insertCSS === 'function') {
          uploadFrame
            .insertCSS('html, body { height: auto !important; overflow: auto !important; }')
            .catch(() => { });
        }
      } catch (err) {
        console.warn('Deferred WebView interaction failed:', err);
      }
    }, 250);

    // Capture attempts to open a new window and redirect within the current frame
    if (typeof uploadFrame.getWebContents === 'function') {
      const wc = uploadFrame.getWebContents();
      if (wc && wc.setWindowOpenHandler) {
        wc.setWindowOpenHandler(({ url }) => {
          navigateUploadFrame(url);
          uploadUrlBar.value = url;
          updateUploadNav();
          if (tiddlyMode) updateTiddlyGuide(url);
          return { action: 'deny' };
        });
      }
    }
  } catch (err) {
    console.error('WebView dom-ready handler error:', err);
  }

  try { uploadFrame.focus(); } catch { }
});
uploadFrame.addEventListener('did-fail-load', e => {
  uploadIsLoading = false;
  uploadRefreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>';
  uploadRefreshBtn.classList.remove('loading');
  uploadLoading.classList.remove('active');
  uploadFrame.style.visibility = 'visible';
  setUploadProgress(0);

  if (uploadStuckTimer) {
    clearTimeout(uploadStuckTimer);
    uploadStuckTimer = null;
  }

  updateUploadNav();
  if (e.errorCode !== -3) {
    uploadStatus.textContent = `Failed to load: ${e.errorDescription} (${e.errorCode})`;
    uploadStatus.classList.add('error');
  }
});
uploadFrame.addEventListener('did-finish-load', () => {
  uploadFrame.focus();
});

function updateUploadNav() {
  try {
    // canGoBack/Forward throw "must be attached to DOM" if called prematurely
    if (uploadFrame && typeof uploadFrame.canGoBack === 'function') {
      uploadBackBtn.disabled = !uploadFrame.canGoBack();
      uploadForwardBtn.disabled = !uploadFrame.canGoForward();
    }
  } catch {
    uploadBackBtn.disabled = true;
    uploadForwardBtn.disabled = true;
  }
}
window.electronAPI.onParseProgress(msg => {
  const line = document.createElement('div');
  line.classList.add('parse-line');

  // Format timestamp
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // Determine message type and apply styling
  const msgLower = msg.toLowerCase();
  let icon = '';
  let cssClass = '';

  if (msgLower.includes('error') || msgLower.includes('failed') || msgLower.includes('exception')) {
    icon = '✗';
    cssClass = 'log-error';
  } else if (msgLower.includes('warning') || msgLower.includes('warn')) {
    icon = '⚠';
    cssClass = 'log-warn';
  } else if (msgLower.includes('success') || msgLower.includes('completed') || msgLower.includes('done')) {
    icon = '✓';
    cssClass = 'log-success';
  } else if (msgLower.includes('copied') || msgLower.includes('copying') || msgLower.includes('running')) {
    icon = '→';
    cssClass = 'log-info';
  } else if (msgLower.includes('config') || msgLower.includes('created') || msgLower.includes('prepared')) {
    icon = '●';
    cssClass = 'log-dim';
  } else {
    icon = '·';
    cssClass = '';
  }

  // Build formatted line
  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp-span';
  timestamp.textContent = ts;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon-span';
  iconSpan.textContent = icon;

  const content = document.createElement('span');
  content.className = 'content-span';
  content.textContent = msg;

  if (cssClass) {
    line.classList.add(cssClass);
  }

  line.appendChild(timestamp);
  line.appendChild(iconSpan);
  line.appendChild(content);

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

  if (!success) {
    // If failed/cancelled, mark all non-success steps as error
    PARSE_STEPS_CONFIG.forEach(config => {
      const step = parseSteps.querySelector(`[data-step-id="${config.id}"]`);
      if (step && !step.classList.contains('success')) {
        updateStep({ id: config.id, title: config.title, progress: 1, error: 'Cancelled' });
      }
    });
  } else {
    updateStep({ id: 'complete', title: 'Completed', progress: 1, success: true });
  }
});
async function checkDeps() {
  const info = await window.electronAPI.checkDependencies();
  const needCli = info.cli.needsUpdate;
  const needComb = info.combiner.needsUpdate;
  const needParser = info.parser.needsUpdate;
  const hasCli = !!info.cli.current;
  const hasComb = !!info.combiner.current;
  const hasParser = !!info.parser.current;

  // Show/hide buttons and set text based on install status
  if (!hasCli || needCli) {
    downloadCliBtn.classList.remove('hidden');
    downloadCliBtn.textContent = hasCli ? 'Update' : 'Download';
  } else {
    downloadCliBtn.classList.add('hidden');
  }

  if (!hasComb || needComb) {
    downloadCombinerBtn.classList.remove('hidden');
    downloadCombinerBtn.textContent = hasComb ? 'Update' : 'Download';
  } else {
    downloadCombinerBtn.classList.add('hidden');
  }

  if (!hasParser || needParser) {
    downloadParserBtn.classList.remove('hidden');
    downloadParserBtn.textContent = hasParser ? 'Update' : 'Download';
  } else {
    downloadParserBtn.classList.add('hidden');
  }

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

async function checkSkinVersion() {
  if (!skinUpdateBadge) return;
  const customIcon = localStorage.getItem('customBackdropIcon');
  const skin = await window.electronAPI.getSkinContent(customIcon);
  if (!skin || !skin.version) return;
  const stored = localStorage.getItem('skinVersion');

  // Simple check: if stored is different/missing, allow update.
  // Or strictly if new version is greater. assuming semantic versioning isn't strictly needed for a single file yet, but let's just check inequality or simple gt.
  if (!stored || skin.version !== stored) {
    skinUpdateBadge.classList.remove('hidden');
  } else {
    skinUpdateBadge.classList.add('hidden');
  }
}
window.electronAPI.onThemeChanged(applyTheme);

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
  let theme = ['light', 'dark', 'acrylic'].includes(savedTheme) ? savedTheme : await window.electronAPI.getTheme();
  if (!['light', 'dark', 'acrylic'].includes(theme)) {
    theme = 'dark';
  }
  applyTheme(theme);
  window.electronAPI.setTheme(theme);
  await loadTiddlyhostCredentials();
  const grad = localStorage.getItem('gradientTheme') || 'neon';
  applyGradient(grad);
  const savedRadio = document.querySelector(`input[name="gradient-theme"][value="${grad}"]`);
  if (savedRadio) {
    savedRadio.checked = true;
    const span = savedRadio.nextElementSibling;
    if (gradientSummary && span) {
      gradientSummary.textContent = span.textContent;
    }
  }
  const ver = await window.electronAPI.getAppVersion();
  versionText.textContent = `v${ver}`;
  let saved = localStorage.getItem('lastFolder');
  try {
    const uiState = await window.electronAPI.getUiState();
    if (uiState && typeof uiState.lastFolder === 'string' && uiState.lastFolder.trim()) {
      saved = uiState.lastFolder;
    }
  } catch { }
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
  checkDeps().catch(console.error);
  checkSkinVersion().catch(console.error);
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
  const dateObj = new Date(val);
  if (isNaN(dateObj.getTime())) return;
  const since = dateObj.getTime();

  fileTreeContainer.querySelectorAll('li.file-item').forEach(li => {
    const p = li.dataset.path;
    const mtime = parseInt(li.dataset.mtime, 10);
    if (mtime >= since) {
      if (!selected.has(p)) {
        selected.set(p, { rel: li.dataset.rel, mtime: mtime });
        li.classList.add('selected');
      }
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
  localStorage.setItem('lastFolder', currentFolder);
  selectedFolderSpan.textContent = currentFolder;
  selectedFolderInput.value = currentFolder;
  if (window.electronAPI && window.electronAPI.setUiState) {
    window.electronAPI.setUiState({ lastFolder: currentFolder });
  }
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
  const step = parseSteps.querySelector(`[data-step-id="${id}"]`);
  if (!step) return;

  step.classList.remove('error', 'success');
  // Only remove active if it's NOT the current step
  if (id !== currentStepId) {
    step.classList.remove('active');
  } else {
    step.classList.add('active');
  }

  // If progress implies activity (even 0% if it's current), enforce active
  if ((progress >= 0 && progress < 1 && !error && !success) || id === currentStepId) {
    step.classList.add('active');
  }

  // Find and update current step index for "active" highlight logic
  if (progress > 0 && progress < 1) {
    currentStepId = id;
    // Highlight active step
    parseSteps.querySelectorAll('.parse-step').forEach(s => s.classList.remove('active'));
    step.classList.add('active');
  }

  if (error) {
    step.classList.add('error');
    step.querySelector('.step-status').textContent = error;
  } else if (success || progress >= 1) {
    step.classList.add('success');
    step.querySelector('.step-status').textContent = 'Completed';
    step.querySelector('.step-icon').textContent = '✓';

    // Auto-activate next step to show ongoing progress
    const currentIndex = PARSE_STEPS_CONFIG.findIndex(s => s.id === id);
    if (currentIndex !== -1 && currentIndex < PARSE_STEPS_CONFIG.length - 1) {
      const nextId = PARSE_STEPS_CONFIG[currentIndex + 1].id;
      const nextStep = parseSteps.querySelector(`[data-step-id="${nextId}"]`);
      if (nextStep) {
        // Only activate if not already handled
        if (!nextStep.classList.contains('active') && !nextStep.classList.contains('success')) {
          nextStep.classList.add('active');
          nextStep.querySelector('.step-status').textContent = 'Preparing...';
          // Highlight active step
          parseSteps.querySelectorAll('.parse-step').forEach(s => s.classList.remove('active'));
          nextStep.classList.add('active');
          currentStepId = nextId;
        }
      }
    }
  } else {
    step.querySelector('.step-status').textContent = title;
  }

  const fill = step.querySelector('.step-fill');
  if (fill) fill.style.width = `${Math.floor((progress || 0) * 100)}%`;

  const countEl = step.querySelector('.step-count');
  if (countEl) {
    if (total > 0) {
      countEl.textContent = `${current}/${total}`;
    } else {
      countEl.textContent = '';
    }
  }
}

function openParseWindow() {
  mainWindowEl.classList.add('fade-out');
  parseWindow.classList.add('active');
  document.getElementById('title-text').textContent = 'Processing';
  parseOutput.innerHTML = '';
  currentStepId = null;

  // Render initial steps outline
  parseSteps.innerHTML = '';
  PARSE_STEPS_CONFIG.forEach(config => {
    const step = document.createElement('div');
    step.classList.add('parse-step');
    step.dataset.stepId = config.id;

    step.innerHTML = `
      <div class="step-header">
        <div class="step-icon">${config.icon}</div>
        <div class="step-title">${config.title}</div>
      </div>
      <div class="step-bar"><div class="step-fill"></div></div>
      <div class="step-meta">
        <div class="step-count"></div>
        <div class="step-status">Pending...</div>
      </div>
    `;
    parseSteps.appendChild(step);
  });

  // Initialize first step as active immediately
  const firstId = PARSE_STEPS_CONFIG[0].id;
  currentStepId = firstId;
  const firstStep = parseSteps.querySelector(`[data-step-id="${firstId}"]`);
  if (firstStep) {
    firstStep.classList.add('active');
    firstStep.querySelector('.step-status').textContent = 'Preparing...';
  }

  parseOpenFolderBtn.disabled = true;
  parseUploadBtn.disabled = true;
  if (parseSaveTailwindBtn) parseSaveTailwindBtn.disabled = true;
  parseUploadBtn.dataset.files = '[]';
  if (parseSaveTailwindBtn) parseSaveTailwindBtn.dataset.files = '[]';
  parseCloseBtn.disabled = true;
  parseCancelBtn.disabled = false;
}

function closeParseWindow() {
  parseWindow.classList.remove('active');
  mainWindowEl.classList.remove('fade-out');
  document.getElementById('title-text').textContent = 'Top Stats AIO';
}

function makeDropScript(files, corner) {
  return `(() => {
    const files = ${JSON.stringify(files)};
    function b64ToBlob(b64){
      const bin=atob(b64);const len=bin.length;const bytes=new Uint8Array(len);
      for(let i=0;i<len;i++){bytes[i]=bin.charCodeAt(i);}return new Blob([bytes]);
    }
    function applyFiles(input, dt){
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files').set;
      setter.call(input, dt.files);
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    function doDrop(){
      try{
        const dt=new DataTransfer();
        files.forEach(f=>{
          const ext=f.name.split('.').pop().toLowerCase();
          const mime={html:'text/html',htm:'text/html',json:'application/json',txt:'text/plain',tid:'text/vnd.tiddlywiki'}[ext]||'application/octet-stream';
          const file=new File([b64ToBlob(f.data)], f.name, {type:mime});
          dt.items.add(file);
        });
        dt.effectAllowed='copy';
        dt.dropEffect='copy';
        const useCorner=${corner ? 'true' : 'false'};
        const x=useCorner?window.innerWidth-10:window.innerWidth/2;
        const y=useCorner?window.innerHeight-10:window.innerHeight/2;
        const el=document.elementFromPoint(x,y);
        const targets=[document.body,document.documentElement];
        if(el && !targets.includes(el)) targets.push(el);
        targets.forEach(target=>{
          ['dragenter','dragover','drop'].forEach(type=>{
            const ev=new DragEvent(type,{dataTransfer:dt,bubbles:true,cancelable:true,clientX:x,clientY:y});
            if(type!=='drop') ev.preventDefault();
            target.dispatchEvent(ev);
          });
        });
        const inputs=document.querySelectorAll('input[type="file"]');
        if(inputs.length){
          inputs.forEach(input=>applyFiles(input,dt));
        }else{
          const input=document.createElement('input');
          input.type='file';
          input.multiple=true;
          input.style.display='none';
          document.body.appendChild(input);
          applyFiles(input,dt);
        }
      }catch(err){}
    }
    if(document.readyState==='loading'){
      window.addEventListener('DOMContentLoaded',()=>{doDrop();});
    }else{
      doDrop();
    }
  })();`;
}

function updateTiddlyGuide(url) {
  if (!tiddlyMode) return;
  if (tiddlySetupStage >= 2) return;
  const rootRe = /^https?:\/\/(www\.)?tiddlyhost\.com\/?$/;
  const sitesListRe = /^https?:\/\/(www\.)?tiddlyhost\.com\/sites\/?$/;
  const newSiteRe = /^https?:\/\/(www\.)?tiddlyhost\.com\/sites\/new\/?$/;
  const subRe = /^https?:\/\/[^./]+\.tiddlyhost\.com/;
  tiddlySitePollId++;
  tiddlySetupBtn.classList.add('hidden');
  tiddlyRefreshBtn.classList.add('hidden');
  tiddlyUseUrlBtn.classList.add('hidden');
  let message = '';
  if (rootRe.test(url)) {
    message = 'Log in or sign up for a Tiddlyhost account';
  } else if (newSiteRe.test(url)) {
    message = 'Give your site a name, keep the other settings, and hit Create';
  } else if (sitesListRe.test(url)) {
    const pollId = tiddlySitePollId;
    const checkForNewSite = (attempts = 0) => {
      if (pollId !== tiddlySitePollId) return;
      if (typeof uploadFrame.executeJavaScript !== 'function') {
        setTimeout(() => checkForNewSite(attempts + 1), 1000);
        return;
      }
      uploadFrame.executeJavaScript('document.body.innerText').then(text => {
        if (pollId !== tiddlySitePollId) return;
        if (text.includes('less than a minute ago')) {
          tiddlyGuideText.textContent = 'Navigate to your new site.';
        } else if (attempts >= 5) {
          tiddlyGuideText.textContent = 'Click the "+ Create" button.';
        } else {
          setTimeout(() => checkForNewSite(attempts + 1), 1000);
        }
      }).catch(() => {
        if (pollId !== tiddlySitePollId) return;
        if (attempts >= 5) {
          tiddlyGuideText.textContent = 'Click the "+ Create" button.';
        } else {
          setTimeout(() => checkForNewSite(attempts + 1), 1000);
        }
      });
    };
    message = 'Looking for your new site...';
    checkForNewSite();
  } else if (subRe.test(url)) {
    message = 'Click Setup to upload example output';
    tiddlySetupBtn.classList.remove('hidden');
  }
  if (message.trim()) {
    tiddlyGuideText.textContent = message;
    tiddlyGuide.classList.remove('hidden');
  } else {
    tiddlyGuideText.textContent = '';
    tiddlyGuide.classList.add('hidden');
  }
  tiddlySetupStage = 0;
}

function openUploadWindow(url, payload, isSetup, options = {}) {
  const { syncInput = true, loginDetails = null } = options;
  tiddlyMode = !!isSetup;
  previousWindow = settingsWindow.classList.contains('active') ? 'settings' : 'parse';
  if (previousWindow === 'settings') {
    settingsWindow.classList.remove('active');
  } else {
    parseWindow.classList.remove('active');
  }
  uploadWindow.classList.add('active');
  uploadWindow.classList.remove('hidden');
  document.body.classList.add('upload-open');
  document.getElementById('title-text').textContent = 'Upload';
  uploadUrlBar.value = url;
  if (!tiddlyMode && syncInput) {
    uploadUrlInput.value = url;
  }
  uploadStatus.textContent = '';
  uploadStatus.classList.remove('error');
  uploadRefreshBtn.innerHTML = '&#x2715;';
  uploadIsLoading = true;
  uploadLoading.classList.add('active');
  uploadFrame.style.visibility = 'hidden';
  tiddlyUseUrlBtn.classList.add('hidden');
  if (!tiddlyMode) {
    tiddlyGuideText.textContent = '';
    tiddlyGuide.classList.add('hidden');
    tiddlySetupBtn.classList.add('hidden');
    tiddlyRefreshBtn.classList.add('hidden');
    tiddlySetupStage = 0;
  }
  const dropScript = payload.length ? makeDropScript(payload, isSetup) : null;
  const handleFinish = () => {
    if (dropScript) {
      uploadFrame.executeJavaScript(dropScript, true)
        .then(() => {
          if (options.callback) options.callback();
        })
        .catch(() => { });
    } else {
      if (options.callback) options.callback();
    }

    if (loginDetails && isTiddlyhostSignIn(uploadFrame.getURL())) {
      const loginScript = makeTiddlyhostLoginScript(loginDetails);
      uploadFrame.executeJavaScript(loginScript, true).catch(() => { });
    }
    applyTiddlyhostScrollFix();
    uploadFrame.focus();
    uploadFrame.removeEventListener('did-stop-loading', handleFinish);
  };
  uploadFrame.addEventListener('did-stop-loading', handleFinish);
  uploadNavHandler = e => {
    uploadUrlBar.value = e.url;
    updateUploadNav();
    if (tiddlyMode) updateTiddlyGuide(e.url);
    setTimeout(applyTiddlyhostScrollFix, 0);
  };
  uploadFrame.addEventListener('did-navigate', uploadNavHandler);
  uploadFrame.addEventListener('did-navigate-in-page', uploadNavHandler);
  navigateUploadFrame(url);
  if (tiddlyMode) updateTiddlyGuide(url);

  // Guard the initial nav state update to avoid attachment race conditions
  setTimeout(updateUploadNav, 200);
}

function closeUploadWindow() {
  uploadWindow.classList.remove('active');
  uploadWindow.classList.add('hidden');
  document.body.classList.remove('upload-open');
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
  if (tiddlyMode) {
    tiddlyMode = false;
    tiddlyGuideText.textContent = '';
    tiddlyGuide.classList.add('hidden');
    tiddlySetupBtn.classList.add('hidden');
    tiddlyRefreshBtn.classList.add('hidden');
    tiddlyUseUrlBtn.classList.add('hidden');
    tiddlySetupStage = 0;
  }
}

async function startParse() {
  if (selected.size === 0) {
    alert('Please select at least one file to parse.');
    return;
  }
  openParseWindow();
  console.log('[parse] startParse clicked', { fileCount: selected.size });
  if (!window.electronAPI || typeof window.electronAPI.startParse !== 'function') {
    const msg = 'IPC bridge unavailable. Preload failed to load or is blocked.';
    alert(msg);
    console.error(msg, window.electronAPI);
    return;
  }
  const files = Array.from(selected.keys());
  const options = {
    parser: localStorage.getItem('parserSelection') || 'combiner',
    dpsUserToken: localStorage.getItem('dpsReportUserToken') || '',
    guildName: localStorage.getItem('combinerGuildName') || '',
    guildId: localStorage.getItem('combinerGuildId') || '',
    apiKey: localStorage.getItem('combinerApiKey') || '',
    dbUpdate: localStorage.getItem('combinerGlickoUpdate') === 'true',
    fightCharts: localStorage.getItem('combinerFightCharts') === 'true',
    hideColumns: localStorage.getItem('combinerHideColumns') === 'true',
    boonsDetailed: localStorage.getItem('combinerBoonsDetailed') === 'true',
    offensiveDetailed: localStorage.getItem('combinerOffensiveDetailed') === 'true',
    defensesDetailed: localStorage.getItem('combinerDefensesDetailed') === 'true',
    supportDetailed: localStorage.getItem('combinerSupportDetailed') === 'true',
    webhookUrl: combinerWebhookInput.value.trim(),
    inputDirectory: combinerInputDirectoryInput.value.trim(),
    outputFilename: combinerOutputFilenameInput.value.trim(),
    jsonOutputFilename: combinerJsonOutputFilenameInput.value.trim(),
    dbFilename: combinerDbFilenameInput.value.trim(),
    dbPath: combinerDbPathInput.value.trim(),
    writeAllDataToJson: combinerWriteAllJsonCheckbox.checked,
    writeExcel: combinerWriteExcelCheckbox.checked,
    excelOutputFilename: combinerExcelFilenameInput.value.trim(),
    excelPath: combinerExcelPathInput.value.trim(),
    skillCastsByRoleLimit: combinerSkillCastLimitInput.value,
    sortMode: combinerSortModeSelect.value,
    discordNotes: combinerDiscordNotesInput.value.trim(),
    boonWeights: boonWeightsState,
    conditionWeights: conditionWeightsState,
    blacklistAccounts: combinerBlacklistInput.value,
    supportProfs: getSupportProfsForOptions(),
    anonymizePlayers: localStorage.getItem('eiAnonymizePlayers') === 'true',
    description: descriptionInput.value.trim()
  };
  await window.electronAPI.startParse({ files, options });
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  // Acrylic removed, treat as default dark if not light
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
      c2 = '#228b22';
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
      c1 = '#667eea';
      c2 = '#764ba2';
      break;
    case 'mint':
      c1 = '#a8ff78';
      c2 = '#78ffd6';
      break;
    case 'sky':
      c1 = '#a1c4fd';
      c2 = '#c2e9fb';
      break;
    case 'blush':
      c1 = '#ff9a9e';
      c2 = '#fecfef';
      break;
    case 'sand':
      c1 = '#eacda3';
      c2 = '#d6ae7b';
      break;
    case 'melon':
      c1 = '#ffe29f';
      c2 = '#ffa99f';
      break;
    case 'coral':
      c1 = '#ff9966';
      c2 = '#ff5e62';
      break;
    case 'berry':
      c1 = '#a18cd1';
      c2 = '#fbc2eb';
      break;
    case 'lagoon':
      c1 = '#64b3f4';
      c2 = '#c2e59c';
      break;
    case 'neon':
      c1 = '#00f5d4';
      c2 = '#f72585';
      break;
    case 'aurora':
      c1 = '#43e97b';
      c2 = '#38f9d7';
      break;
    case 'ember':
      c1 = '#ff6b35';
      c2 = '#f7931e';
      break;
    case 'frost':
      c1 = '#74ebd5';
      c2 = '#acb6e5';
      break;
    case 'dusk':
      c1 = '#9d50bb';
      c2 = '#6e48aa';
      break;
    default:
      c1 = '#6ec1e4';
      c2 = '#8e44ad';
  }
  // Set comprehensive CSS variables for theme colors
  const root = document.documentElement;

  // Gradient and border variables
  const grad = `linear-gradient(to bottom right, ${c1}, ${c2}) 1`;
  root.style.setProperty('--card-border', grad);
  root.style.setProperty('--btn-border', c1);
  root.style.setProperty('--btn-border-hover', c2);
  const barGrad = `linear-gradient(to right, ${c1}, ${c2})`;
  root.style.setProperty('--progress-bar', barGrad);

  // Brand color variables for UI elements
  root.style.setProperty('--brand-primary', c1);
  root.style.setProperty('--brand-primary-rgb', hexToRgb(c1));
  root.style.setProperty('--brand-secondary', c2);
  root.style.setProperty('--brand-secondary-rgb', hexToRgb(c2));
  root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${c1}, ${c2})`);

  // Glow and accent colors - MORE PROMINENT VALUES
  root.style.setProperty('--glow-primary', `rgba(${hexToRgb(c1)}, 0.45)`);
  root.style.setProperty('--glow-secondary', `rgba(${hexToRgb(c2)}, 0.4)`);
  root.style.setProperty('--accent-bg', `rgba(${hexToRgb(c1)}, 0.15)`);
  root.style.setProperty('--accent-bg-strong', `rgba(${hexToRgb(c1)}, 0.25)`);
  root.style.setProperty('--accent-border', `rgba(${hexToRgb(c1)}, 0.45)`);

  // Background tinting for colorful UI
  root.style.setProperty('--bg-tinted', `rgba(${hexToRgb(c1)}, 0.06)`);
  root.style.setProperty('--card-bg-tinted', `linear-gradient(180deg, rgba(${hexToRgb(c1)}, 0.08) 0%, transparent 50%)`);

  // Border glow for window - MORE PROMINENT
  root.style.setProperty('--window-glow', `0 0 80px rgba(${hexToRgb(c1)}, 0.25), 0 0 120px rgba(${hexToRgb(c2)}, 0.18)`);

  // Shadow with color
  root.style.setProperty('--shadow-glow', `0 0 25px rgba(${hexToRgb(c1)}, 0.25)`);

  if (gradientSummary) {
    gradientSummary.classList.remove(
      ...Array.from(gradientSummary.classList).filter(c => c.startsWith('gradient-') && c !== 'gradient-text')
    );
    gradientSummary.classList.add('gradient-text', `gradient-${name}`);
  }
  localStorage.setItem('gradientTheme', name);
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '110, 193, 228';
}

// Update Notification Logic
const updateNotification = document.getElementById('update-notification');
const updateSpinner = document.getElementById('update-spinner');
const updateStatusText = document.getElementById('update-status-text');
const restartBtn = document.getElementById('restart-btn');

if (window.electronAPI) {
  window.electronAPI.onCheckingForUpdate(() => {
    updateNotification.classList.remove('hidden');
    updateStatusText.textContent = 'Checking for updates...';
    updateSpinner.classList.remove('hidden');
    restartBtn.classList.add('hidden');
  });

  window.electronAPI.onUpdateAvailable((info) => {
    updateNotification.classList.remove('hidden');
    updateStatusText.textContent = 'Update found!';
    updateSpinner.classList.remove('hidden');
    restartBtn.classList.add('hidden');
  });

  window.electronAPI.onUpdateNotAvailable(() => {
    updateStatusText.textContent = 'Up to date';
    updateSpinner.classList.add('hidden');
    setTimeout(() => {
      updateNotification.classList.add('hidden');
    }, 3000);
  });

  window.electronAPI.onDownloadProgress((progressObj) => {
    updateNotification.classList.remove('hidden');
    const percent = Math.round(progressObj.percent);
    updateStatusText.textContent = `Downloading... ${percent}%`;
    updateSpinner.classList.remove('hidden');
  });

  window.electronAPI.onUpdateDownloaded((info) => {
    updateNotification.classList.remove('hidden');
    updateStatusText.textContent = 'Ready to Install';
    updateSpinner.classList.add('hidden');
    restartBtn.classList.remove('hidden');
  });

  window.electronAPI.onUpdateError((err) => {
    updateNotification.classList.remove('hidden');
    updateStatusText.textContent = 'Update Error';
    updateSpinner.classList.add('hidden');
    setTimeout(() => {
      updateNotification.classList.add('hidden');
    }, 5000);
  });
}

if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    if (window.electronAPI) {
      window.electronAPI.restartApp();
    }
  });
}
