const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const wineUtils = require('./wineUtils');

async function test() {
    console.log('--- Checking Wine Environment ---');
    const userDataPath = '/var/home/mstephens/.config/topstatsaio';

    // 1. Check Z: mapping explicitly
    const zLink = path.join(userDataPath, 'wine', 'dosdevices', 'z:');
    try {
        if (fs.existsSync(zLink)) {
            const dest = fs.readlinkSync(zLink);
            console.log(`[Check] Z: maps to: ${dest}`);
        } else {
            console.error('[Check] Z: drive is MISSING!');
        }
    } catch (e) { console.error('[Check] Error checking Z:', e); }

    // 2. Mock the CLI execution
    const cliExe = '/var/home/mstephens/.config/topstatsaio/dependencies/eicli/GuildWars2EliteInsights-CLI.exe';

    // We assume the real CLI is there.
    if (!fs.existsSync(cliExe)) {
        console.error('[Error] CLI exe not found at: ' + cliExe);
        return;
    }

    // Try running "dir" on the folder containing the exe using Z: path
    // This confirms if wine can see the folder via Z:
    const exDir = path.dirname(cliExe);
    const zDir = 'Z:' + exDir.replace(/\//g, '\\');

    console.log(`\n--- Test 1: Can Wine see the folder via Z:? ---`);
    console.log(`Target: ${zDir}`);
    try {
        cp.execSync(`wine cmd /c dir "${zDir}"`, {
            env: wineUtils.resolveWindowsCommand('cmd.exe', [], null, null, userDataPath).env, // Hack to get env
            stdio: 'inherit'
        });
        console.log('[Success] Wine listed directory.');
    } catch (e) {
        console.error('[Fail] Wine failed to list directory:', e.message);
    }

    console.log(`\n--- Test 2: Launch CLI using Linux Path ---`);
    try {
        // Just run --help or something harmless
        cp.execSync(`wine "${cliExe}" --help`, { stdio: 'inherit' });
    } catch (e) {
        console.log(`[Info] Linux path launch exited with ${e.status}`);
    }

    console.log(`\n--- Test 3: Launch CLI using Z: Path ---`);
    try {
        const zExe = 'Z:' + cliExe.replace(/\//g, '\\');
        console.log(`Command: wine "${zExe}" --help`);
        cp.execSync(`wine "${zExe}" --help`, { stdio: 'inherit' });
    } catch (e) {
        console.log(`[Info] Windows path launch exited with ${e.status}`);
    }
}

test();
