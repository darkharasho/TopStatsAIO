const fs = require('fs');
const os = require('os');
const path = require('path');
const { ensureDeps, readVersions, writeVersions, editEIConfig, editTopStatsConfig } = require('../utils');

describe('utils', () => {
  test('ensureDeps creates directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaio-'));
    const target = path.join(dir, 'deps');
    expect(fs.existsSync(target)).toBe(false);
    ensureDeps(target);
    expect(fs.existsSync(target)).toBe(true);
  });

  test('readVersions returns empty object when file missing', () => {
    const file = path.join(os.tmpdir(), `versions-${Date.now()}.json`);
    const data = readVersions(file);
    expect(data).toEqual({});
  });

  test('writeVersions writes data readable by readVersions', () => {
    const file = path.join(os.tmpdir(), `versions-${Date.now()}.json`);
    writeVersions(file, { a: 1 });
    const data = readVersions(file);
    expect(data).toEqual({ a: 1 });
  });

  test('editEIConfig replaces values', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaio-'));
    const dest = path.join(tempDir, 'out.conf');
    await editEIConfig(path.join(__dirname, '..', 'EliteInsightsConfigTemplate.conf'), dest, 'C:/out', 'token123', { anonymizePlayers: true });
    const content = fs.readFileSync(dest, 'utf8');
    expect(content).toMatch('OutLocation=C:/out');
    expect(content).toMatch('DPSReportUserToken=token123');
    expect(content).toMatch('Anonymous=True');
  });

  test('editTopStatsConfig replaces values', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaio-'));
    const dest = path.join(tempDir, 'out.ini');
    await editTopStatsConfig(path.join(__dirname, '..', 'top_stats_config.ini'), dest, {
      guildName: 'Test',
      guildId: '123',
      apiKey: 'ABC',
      dbPath: 'C:/data',
      dbUpdate: true,
      fightCharts: true,
      hideColumns: true,
      boonsDetailed: true,
      offensiveDetailed: true,
      defensesDetailed: true,
      supportDetailed: true,
      webhookUrl: 'https://example.com/webhook',
      blacklistAccounts: 'user1.1234, user2.5678, user3.9012',
    });
    const content = fs.readFileSync(dest, 'utf8');
    expect(content).toMatch('guild_name = Test');
    expect(content).toMatch('guild_id = 123');
    expect(content).toMatch('api_key = ABC');
    expect(content).toMatch('db_path = C:/data');
    expect(content).toMatch('db_output_filename = Top_Stats.db');
    expect(content).toMatch('db_update = true');
    expect(content).toMatch('fight_data_charts = true');
    expect(content).toMatch('hide_columns = true');
    expect(content).toMatch('Boons_Detailed = true');
    expect(content).toMatch('Offensive_Detailed = true');
    expect(content).toMatch('Defenses_Detailed = true');
    expect(content).toMatch('Support_Detailed = true');
    expect(content).toMatch('webhook_url = https://example.com/webhook');
    expect(content).toMatch('accounts = user1.1234,\n           user2.5678,\n           user3.9012');
  });

  test('editTopStatsConfig enforces webhook_url formatting', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaio-'));
    const dest = path.join(tempDir, 'out-invalid.ini');
    await editTopStatsConfig(path.join(__dirname, '..', 'top_stats_config.ini'), dest, {
      webhookUrl: 'notaurl',
    });
    const content = fs.readFileSync(dest, 'utf8');
    expect(content).toMatch('webhook_url = false');

    const dest2 = path.join(tempDir, 'out-valid.ini');
    await editTopStatsConfig(path.join(__dirname, '..', 'top_stats_config.ini'), dest2, {
      webhookUrl: ' https://discord.com/api/webhooks/123 ',
    });
    const content2 = fs.readFileSync(dest2, 'utf8');
    expect(content2).toMatch('webhook_url = https://discord.com/api/webhooks/123');

    const dest3 = path.join(tempDir, 'out-no-scheme.ini');
    await editTopStatsConfig(path.join(__dirname, '..', 'top_stats_config.ini'), dest3, {
      webhookUrl: 'discord.com/api/webhooks/123',
    });
    const content3 = fs.readFileSync(dest3, 'utf8');
    expect(content3).toMatch('webhook_url = https://discord.com/api/webhooks/123');
  });
});
