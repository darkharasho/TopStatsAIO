const fs = require('fs');

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

async function editTopStatsConfig(template, dest, opts) {
  const lines = await fs.promises.readFile(template, 'utf8');
  const replaced = lines.split(/\r?\n/).map(l => {
    if (l.startsWith('guild_name = ')) return `guild_name = ${opts.guildName || ''}`;
    if (l.startsWith('guild_id = ')) return `guild_id = ${opts.guildId || ''}`;
    if (l.startsWith('api_key = ')) return `api_key = ${opts.apiKey || ''}`;
    if (l.startsWith('db_output_filename = ')) return `db_output_filename = ${opts.dbFilename || 'TopStats.db'}`;
    if (l.startsWith('db_path = ')) return `db_path = ${opts.dbPath || '.'}`;
    if (l.startsWith('db_update = ')) return `db_update = ${opts.dbUpdate ? 'true' : 'false'}`;
    if (l.startsWith('fight_data_charts = ')) return `fight_data_charts = ${opts.fightCharts ? 'true' : 'false'}`;
    if (l.startsWith('hide_columns = ')) return `hide_columns = ${opts.hideColumns ? 'true' : 'false'}`;
    return l;
  }).join('\n');
  await fs.promises.writeFile(dest, replaced, 'utf8');
}

module.exports = {
  ensureDeps,
  readVersions,
  writeVersions,
  editEIConfig,
  editTopStatsConfig,
};
