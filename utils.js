const fs = require('fs');
const { URL } = require('url');

const SUPPORTED_BOON_IDS = new Set([
  'b740',
  'b725',
  'b1187',
  'b30328',
  'b717',
  'b718',
  'b726',
  'b743',
  'b1122',
  'b719',
  'b26980',
  'b873'
]);

function ensureDeps(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readVersions(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeVersions(file, v) {
  fs.writeFileSync(file, JSON.stringify(v));
}

async function editEIConfig(template, dest, outDir, token, opts = {}) {
  const lines = await fs.promises.readFile(template, 'utf8');
  const replaced = lines.split(/\r?\n/).map(l => {
    if (l.startsWith('OutLocation=')) {
      // FORCE empty OutLocation on Linux/Wine to prevent crashes due to invalid paths/permissions.
      // CLI will default to input directory, which is safe and what we want.
      if (process.platform !== 'win32') return 'OutLocation=';
      return `OutLocation=${outDir || ''}`;
    }
    if (l.startsWith('DPSReportUserToken=')) return `DPSReportUserToken=${token || ''}`;
    if (l.startsWith('Anonymous=')) return `Anonymous=${opts.anonymizePlayers ? 'True' : 'False'}`;
    return l;
  }).join('\n');
  await fs.promises.writeFile(dest, replaced, 'utf8');
}

function formatAccounts(accounts) {
  const list = (accounts || '')
    .split(/[,\n]/)
    .map(a => a.trim())
    .filter(Boolean);
  if (list.length === 0) return 'accounts = ';
  const [first, ...rest] = list;
  let line = `accounts = ${first}`;
  if (rest.length) {
    line += ',\n           ';
    line += rest
      .map((acc, idx) => (idx < rest.length - 1 ? `${acc},` : acc))
      .join('\n           ');
  }
  return line;
}

function sanitizeSupportProfs(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map(entry => {
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!name) return null;
      const seen = new Set();
      const boons = Array.isArray(entry.boons)
        ? entry.boons
          .filter(id => {
            if (!SUPPORTED_BOON_IDS.has(id) || seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .slice(0, 5)
        : [];
      if (!boons.length) return null;
      return { name, boons };
    })
    .filter(Boolean);
}

async function editTopStatsConfig(template, dest, opts) {
  const lines = await fs.promises.readFile(template, 'utf8');
  const accountsLine = formatAccounts(opts.blacklistAccounts);
  const optionalValue = value => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return 'None';
  };
  const stringValue = (value, fallback) => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return fallback;
  };
  const boolValue = value => (value ? 'true' : 'false');
  const numericValue = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };
  const normalizeWebhookUrl = hook => {
    if (hook instanceof URL) {
      return hook.protocol === 'http:' || hook.protocol === 'https:' ? hook.toString() : 'false';
    }
    if (typeof hook !== 'string') return 'false';
    const hookTrimmed = hook.trim();
    if (!hookTrimmed) return 'false';
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(hookTrimmed);
    const hasDotHost = /^[^/\s]+\.[^/\s]+/i.test(hookTrimmed);
    const candidate = !hasScheme && hasDotHost ? `https://${hookTrimmed}` : hookTrimmed;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'false';
      return parsed.toString();
    } catch {
      return 'false';
    }
  };
  const boonWeights = opts.boonWeights && typeof opts.boonWeights === 'object' ? opts.boonWeights : null;
  const conditionWeights = opts.conditionWeights && typeof opts.conditionWeights === 'object'
    ? opts.conditionWeights
    : null;
  let section = '';
  let replaced = lines.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      section = trimmed.slice(1, -1);
      return line;
    }
    if (line.startsWith('guild_name = ')) return `guild_name = ${opts.guildName || ''}`;
    if (line.startsWith('guild_id = ')) return `guild_id = ${opts.guildId || ''}`;
    if (line.startsWith('api_key = ')) return `api_key = ${opts.apiKey || ''}`;
    if (line.startsWith('input_directory = ')) return `input_directory = ${stringValue(opts.inputDirectory, 'd:/gw2logs/output')}`;
    if (line.startsWith('output_filename = ')) return `output_filename = ${optionalValue(opts.outputFilename)}`;
    if (line.startsWith('json_output_filename = ')) return `json_output_filename = ${optionalValue(opts.jsonOutputFilename)}`;
    if (line.startsWith('db_output_filename = ')) return `db_output_filename = ${stringValue(opts.dbFilename, 'Top_Stats.db')}`;
    if (line.startsWith('db_path = ')) return `db_path = ${stringValue(opts.dbPath, '.')}`;
    if (line.startsWith('write_all_data_to_json = ')) return `write_all_data_to_json = ${boolValue(opts.writeAllDataToJson)}`;
    if (line.startsWith('db_update = ')) return `db_update = ${boolValue(opts.dbUpdate)}`;
    if (line.startsWith('fight_data_charts = ')) return `fight_data_charts = ${boolValue(opts.fightCharts)}`;
    if (line.startsWith('write_excel = ')) return `write_excel = ${boolValue(opts.writeExcel)}`;
    if (line.startsWith('excel_output_filename = ')) {
      return `excel_output_filename = ${stringValue(opts.excelOutputFilename, 'Top_Stats.xlsx')}`;
    }
    if (line.startsWith('excel_path = ')) return `excel_path = ${stringValue(opts.excelPath, '.')}`;
    if (line.startsWith('skill_casts_by_role_limit = ')) {
      return `skill_casts_by_role_limit = ${numericValue(opts.skillCastsByRoleLimit, 40)}`;
    }
    if (line.startsWith('hide_columns = ')) return `hide_columns = ${boolValue(opts.hideColumns)}`;
    if (line.startsWith('Boons_Detailed = ')) return `Boons_Detailed = ${boolValue(opts.boonsDetailed)}`;
    if (line.startsWith('Offensive_Detailed = ')) return `Offensive_Detailed = ${boolValue(opts.offensiveDetailed)}`;
    if (line.startsWith('Defenses_Detailed = ')) return `Defenses_Detailed = ${boolValue(opts.defensesDetailed)}`;
    if (line.startsWith('Support_Detailed = ')) return `Support_Detailed = ${boolValue(opts.supportDetailed)}`;
    if (line.startsWith('Sort_Mode = ')) return `Sort_Mode = ${stringValue(opts.sortMode, 'Total')}`;
    if (section === 'DiscordCfg' && line.startsWith('webhook_url = ')) {
      return `webhook_url = ${normalizeWebhookUrl(opts.webhookUrl)}`;
    }
    if (section === 'DiscordCfg' && line.startsWith('discord_additional_notes = ')) {
      return `discord_additional_notes = ${opts.discordNotes || ''}`;
    }
    if (line.startsWith('accounts =')) return accountsLine;
    if (section === 'Boon_Weights') {
      const match = line.match(/^(\w+)\s*=\s*(.*)$/);
      if (match && boonWeights && Object.prototype.hasOwnProperty.call(boonWeights, match[1])) {
        return `${match[1]} = ${numericValue(boonWeights[match[1]], 1)}`;
      }
    }
    if (section === 'Condition_Weights') {
      const match = line.match(/^(\w+)\s*=\s*(.*)$/);
      if (match && conditionWeights && Object.prototype.hasOwnProperty.call(conditionWeights, match[1])) {
        return `${match[1]} = ${numericValue(conditionWeights[match[1]], 1)}`;
      }
    }
    return line;
  }).join('\n');

  if (Array.isArray(opts.supportProfs)) {
    const normalized = sanitizeSupportProfs(opts.supportProfs);
    const startMarker = '# -- TopStatsAIO Support Professions Start --';
    const endMarker = '# -- TopStatsAIO Support Professions End --';
    if (normalized && replaced.includes(startMarker) && replaced.includes(endMarker)) {
      const escape = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blockPattern = String.raw`[\s\S]*?`;
      const markerRegex = new RegExp(`${escape(startMarker)}${blockPattern}${escape(endMarker)}`);
      const formatted = normalized.map(({ name, boons }) => `${name} = ${boons.join(', ')}`).join('\n');
      const block = formatted ? `${startMarker}\n${formatted}\n${endMarker}` : `${startMarker}\n${endMarker}`;
      replaced = replaced.replace(markerRegex, block);
    }
  }
  await fs.promises.writeFile(dest, replaced, 'utf8');
}

module.exports = {
  ensureDeps,
  readVersions,
  writeVersions,
  editEIConfig,
  editTopStatsConfig,
};
