
(function (exports) {

    const SUPPORTED_BOONS = [
        { id: 'b740', label: 'Might' },
        { id: 'b725', label: 'Fury' },
        { id: 'b1187', label: 'Quickness' },
        { id: 'b30328', label: 'Alacrity' },
        { id: 'b717', label: 'Protection' },
        { id: 'b718', label: 'Regeneration' },
        { id: 'b726', label: 'Vigor' },
        { id: 'b743', label: 'Aegis' },
        { id: 'b1122', label: 'Stability' },
        { id: 'b719', label: 'Swiftness' },
        { id: 'b26980', label: 'Resistance' },
        { id: 'b873', label: 'Resolution' }
    ];

    const SUPPORTED_BOON_IDS = new Set(SUPPORTED_BOONS.map(boon => boon.id));

    const DEFAULT_SUPPORT_PROFS = [
        { name: 'Firebrand', boons: ['b1122', 'b717', 'b26980', 'b740', 'b1187'] },
        { name: 'Chronomancer', boons: ['b1122', 'b717', 'b740', 'b725'] },
        { name: 'Specter', boons: ['b1122', 'b717', 'b740', 'b725'] }
    ];

    const SUPPORT_PROFS_STORAGE_KEY = 'combinerSupportProfs';
    const LEGACY_SUPPORT_PROFS_STORAGE_KEY = 'combinerSupportedProfs';

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

    function isTiddlyhostSignIn(url) {
        if (!url) return false;
        try {
            const parsed = new URL(url);
            return parsed.hostname.endsWith('tiddlyhost.com') && parsed.pathname.replace(/\/+$/, '') === '/users/sign_in';
        } catch {
            return false;
        }
    }

    function makeTiddlyhostLoginScript({ username, password }) {
        return `(() => {
    const username = ${JSON.stringify(username || '')};
    const password = ${JSON.stringify(password || '')};
    if (!username || !password) return;
    const userField = document.querySelector(
      'input[name="user[email]"], input[name="user[login]"], input#user_email, input#user_login, input[type="email"]'
    );
    const passField = document.querySelector(
      'input[name="user[password]"], input#user_password, input[type="password"]'
    );
    if (!userField || !passField) return;
    userField.focus();
    userField.value = username;
    userField.dispatchEvent(new Event('input', { bubbles: true }));
    userField.dispatchEvent(new Event('change', { bubbles: true }));
    passField.value = password;
    passField.dispatchEvent(new Event('input', { bubbles: true }));
    passField.dispatchEvent(new Event('change', { bubbles: true }));
    const remember = document.querySelector(
      'input[name="user[remember_me]"], input#user_remember_me, input[type="checkbox"][name*="remember"]'
    );
    if (remember) {
      remember.checked = true;
      remember.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })();`;
    }

    function cloneSupportProfEntry(entry = {}) {
        const boons = [];
        const seen = new Set();
        if (Array.isArray(entry.boons)) {
            entry.boons.forEach(id => {
                if (!SUPPORTED_BOON_IDS.has(id) || seen.has(id) || boons.length >= 5) return;
                seen.add(id);
                boons.push(id);
            });
        }
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        return {
            name,
            boons
        };
    }

    function loadSupportProfs(storage) {
        try {
            let stored = storage.getItem(SUPPORT_PROFS_STORAGE_KEY);
            if (!stored) {
                stored = storage.getItem(LEGACY_SUPPORT_PROFS_STORAGE_KEY);
            }
            if (!stored) return DEFAULT_SUPPORT_PROFS.map(obj => cloneSupportProfEntry(obj));
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) {
                return DEFAULT_SUPPORT_PROFS.map(obj => cloneSupportProfEntry(obj));
            }
            return parsed.map(obj => cloneSupportProfEntry(obj));
        } catch {
            return DEFAULT_SUPPORT_PROFS.map(obj => cloneSupportProfEntry(obj));
        }
    }

    function saveSupportProfs(storage, supportProfs) {
        try {
            const payload = supportProfs.map(entry => cloneSupportProfEntry(entry));
            storage.setItem(SUPPORT_PROFS_STORAGE_KEY, JSON.stringify(payload));
            storage.removeItem(LEGACY_SUPPORT_PROFS_STORAGE_KEY);
        } catch { }
    }

    function loadWeights(storage, storageKey, keys) {
        try {
            const stored = storage.getItem(storageKey);
            if (!stored) {
                return keys.reduce((acc, key) => {
                    acc[key] = 1;
                    return acc;
                }, {});
            }
            const parsed = JSON.parse(stored);
            return keys.reduce((acc, key) => {
                const raw = parsed && typeof parsed[key] !== 'undefined' ? parsed[key] : 1;
                const num = Number(raw);
                acc[key] = Number.isFinite(num) ? num : 1;
                return acc;
            }, {});
        } catch {
            return keys.reduce((acc, key) => {
                acc[key] = 1;
                return acc;
            }, {});
        }
    }

    function saveWeights(storage, storageKey, weights) {
        try {
            storage.setItem(storageKey, JSON.stringify(weights));
        } catch { }
    }

    function getLoginTargetUrl(url) {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();
            if (host.endsWith('.tiddlyhost.com')) {
                parsed.hostname = 'tiddlyhost.com';
            } else if (host.endsWith('.github.io')) {
                parsed.hostname = 'github.io';
            }
            parsed.pathname = '/';
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString();
        } catch {
            return null;
        }
    }

    exports.SUPPORTED_BOONS = SUPPORTED_BOONS;
    exports.SUPPORTED_BOON_IDS = SUPPORTED_BOON_IDS;
    exports.DEFAULT_SUPPORT_PROFS = DEFAULT_SUPPORT_PROFS;
    exports.SUPPORT_PROFS_STORAGE_KEY = SUPPORT_PROFS_STORAGE_KEY;
    exports.LEGACY_SUPPORT_PROFS_STORAGE_KEY = LEGACY_SUPPORT_PROFS_STORAGE_KEY;
    exports.normalizeUrl = normalizeUrl;
    exports.isTiddlyhostSignIn = isTiddlyhostSignIn;
    exports.makeTiddlyhostLoginScript = makeTiddlyhostLoginScript;
    exports.cloneSupportProfEntry = cloneSupportProfEntry;
    exports.loadSupportProfs = loadSupportProfs;
    exports.saveSupportProfs = saveSupportProfs;
    exports.loadWeights = loadWeights;
    exports.saveWeights = saveWeights;
    exports.getLoginTargetUrl = getLoginTargetUrl;


    function saveRendererSetting(storage, key, value) {
        try {
            if (value === null || value === undefined) {
                storage.removeItem(key);
            } else {
                storage.setItem(key, String(value));
            }
        } catch { }
    }

    function loadRendererSettings(storage) {
        const get = (key, def = '') => {
            try {
                const val = storage.getItem(key);
                return val === null ? def : val;
            } catch {
                return def;
            }
        };
        const getBool = (key, def = false) => {
            try {
                const val = storage.getItem(key);
                return val === null ? def : val === 'true';
            } catch {
                return def;
            }
        };

        return {
            dpsReportUserToken: get('dpsReportUserToken'),
            uploadUrl: get('uploadUrl'),
            combinerGuildName: get('combinerGuildName'),
            combinerGuildId: get('combinerGuildId'),
            combinerApiKey: get('combinerApiKey'),
            combinerWebhookUrl: get('combinerWebhookUrl'),
            combinerGlickoUpdate: getBool('combinerGlickoUpdate'),
            combinerFightCharts: getBool('combinerFightCharts'),
            combinerHideColumns: getBool('combinerHideColumns'),
            combinerBoonsDetailed: getBool('combinerBoonsDetailed'),
            combinerOffensiveDetailed: getBool('combinerOffensiveDetailed'),
            combinerDefensesDetailed: getBool('combinerDefensesDetailed'),
            combinerSupportDetailed: getBool('combinerSupportDetailed'),
            combinerBlacklistAccounts: get('combinerBlacklistAccounts'),
            combinerInputDirectory: get('combinerInputDirectory', 'd:/gw2logs/output'),
            combinerOutputFilename: get('combinerOutputFilename'),
            combinerJsonOutputFilename: get('combinerJsonOutputFilename'),
            combinerDbFilename: get('combinerDbFilename', 'Top_Stats.db'),
            combinerDbPath: get('combinerDbPath', '.'),
            combinerWriteAllJson: getBool('combinerWriteAllJson', true),
            combinerWriteExcel: getBool('combinerWriteExcel', false),
            combinerExcelFilename: get('combinerExcelFilename', 'Top_Stats.xlsx'),
            combinerExcelPath: get('combinerExcelPath', '.'),
            combinerSkillCastLimit: get('combinerSkillCastLimit', '40'),
            combinerSortMode: get('combinerSortMode', 'Total'),
            combinerDiscordNotes: get('combinerDiscordNotes'),
            eiAnonymizePlayers: getBool('eiAnonymizePlayers'),
            parserSelection: get('parserSelection')
        };
    }

    exports.saveRendererSetting = saveRendererSetting;
    exports.loadRendererSettings = loadRendererSettings;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.rendererUtils = {}));
