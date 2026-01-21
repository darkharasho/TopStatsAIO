const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const wineUtils = require('./wineUtils');

async function test() {
    console.log('--- Deep Diagnostic: EI CLI Crash (Exit 35) ---');
    const userDataPath = '/var/home/mstephens/.config/topstatsaio';
    const cliExe = '/var/home/mstephens/.config/topstatsaio/dependencies/eicli/GuildWars2EliteInsights-CLI.exe';

    // Check .NET functionality first
    try {
        console.log('[1] Checking dotnet --info');
        const info = cp.execSync(`wine cmd /c "dotnet --info"`, {
            env: wineUtils.resolveWindowsCommand('cmd.exe', [], null, null, userDataPath).env,
            encoding: 'utf8',
            timeout: 5000
        });
        console.log(info.split('\n').slice(0, 5).join('\n') + '...');
    } catch (e) { console.error('[1] Failed:', e.message); }

    const cliDll = cliExe.replace('.exe', '.dll');
    if (!fs.existsSync(cliDll)) {
        console.error('[Error] DLL not found!');
        return;
    }

    const runWineDotnet = async (label, args) => {
        console.log(`\n--- Test: ${label} ---`);
        try {
            const winDllPath = (await wineUtils.toWindowsPath(cliDll))[0];
            const resolved = await wineUtils.resolveWindowsCommand('dotnet.exe', [winDllPath, ...args], null, null, userDataPath);

            console.log(`CMD: ${resolved.cmd} ${resolved.args.join(' ')}`);

            const out = cp.execSync(`${resolved.cmd} ${resolved.args.map(a => `"${a}"`).join(' ')}`, {
                env: resolved.env,
                stdio: 'pipe', // Capture output
                encoding: 'utf8',
                timeout: 10000 // 10s timeout
            });
            console.log('[Stdout]:\n', out);
            console.log(`[Success] ${label} finished with Exit 0`);
        } catch (e) {
            console.error(`[Fail] ${label} exited with code ${e.status || e.code}`);
            if (e.stdout) console.log('[Stdout]:\n', e.stdout.toString());
            if (e.stderr) console.log('[Stderr]:\n', e.stderr.toString());
        }
    };

    // Test 1: Help only
    await runWineDotnet('Help Command', ['--help']);

    // Test 2: Dummy Parse
    const dummyLog = path.join(userDataPath, 'test.txt');
    fs.writeFileSync(dummyLog, 'dummy content');
    // const winLog = (await wineUtils.toWindowsPath(dummyLog))[0];
    await runWineDotnet('Parse Dummy', [path.basename(dummyLog)]);
}

test();
