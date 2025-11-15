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
    if (l.startsWith('OutLocation=')) return `OutLocation=${outDir}`;
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

function sanitizeSupportedProfs(entries) {
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
  let replaced = lines.split(/\r?\n/).map(l => {
    if (l.startsWith('guild_name = ')) return `guild_name = ${opts.guildName || ''}`;
    if (l.startsWith('guild_id = ')) return `guild_id = ${opts.guildId || ''}`;
    if (l.startsWith('api_key = ')) return `api_key = ${opts.apiKey || ''}`;
    if (l.startsWith('db_output_filename = ')) return `db_output_filename = ${opts.dbFilename || 'TopStats.db'}`;
    if (l.startsWith('db_path = ')) return `db_path = ${opts.dbPath || '.'}`;
    if (l.startsWith('db_update = ')) return `db_update = ${opts.dbUpdate ? 'true' : 'false'}`;
    if (l.startsWith('fight_data_charts = ')) return `fight_data_charts = ${opts.fightCharts ? 'true' : 'false'}`;
    if (l.startsWith('hide_columns = ')) return `hide_columns = ${opts.hideColumns ? 'true' : 'false'}`;
    if (l.startsWith('Boons_Detailed = ')) return `Boons_Detailed = ${opts.boonsDetailed ? 'true' : 'false'}`;
    if (l.startsWith('Offensive_Detailed = ')) return `Offensive_Detailed = ${opts.offensiveDetailed ? 'true' : 'false'}`;
    if (l.startsWith('Defenses_Detailed = ')) return `Defenses_Detailed = ${opts.defensesDetailed ? 'true' : 'false'}`;
    if (l.startsWith('Support_Detailed = ')) return `Support_Detailed = ${opts.supportDetailed ? 'true' : 'false'}`;
    if (l.startsWith('webhook_url = ')) {
      const hook = opts.webhookUrl;
      let value = 'false';
      if (hook instanceof URL) {
        value = hook.toString();
      } else if (typeof hook === 'string') {
        const trimmed = hook.trim();
        if (trimmed) {
          try {
            const parsed = new URL(trimmed);
            value = parsed.toString();
          } catch {
            value = 'false';
          }
        }
      }
      return `webhook_url = ${value}`;
    }
    if (l.startsWith('accounts =')) return accountsLine;
    return l;
  }).join('\n');

  if (Array.isArray(opts.supportedProfs)) {
    const normalized = sanitizeSupportedProfs(opts.supportedProfs);
    const startMarker = '# -- TopStatsAIO Supported Professions Start --';
    const endMarker = '# -- TopStatsAIO Supported Professions End --';
    if (normalized && replaced.includes(startMarker) && replaced.includes(endMarker)) {
      const escape = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const markerRegex = new RegExp(`${escape(startMarker)}[\s\S]*?${escape(endMarker)}`);
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
