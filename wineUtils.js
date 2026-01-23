const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { dialog, app } = require('electron');
const { downloadFile } = require('./update');

// -------------------------------------------------------------------------
// Global State & Constants
// -------------------------------------------------------------------------
let cachedWineAvailable = null;
let wineDotnetAlerted = false;
let cachedWineBinary = null;

// We'll cache the calculated WinePrefix to avoid re-computing it constantly,
// though it usually depends on userDataPath which is stable.
let cachedWinePrefix = null;

// Timeout for winepath operations in milliseconds
const WINEPATH_TIMEOUT = 3000;

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * Get the Wine environment variables.
 * @param {string} userDataPath
 * @returns {Object}
 */
function getWineEnv(userDataPath) {
    if (!cachedWinePrefix) {
        cachedWinePrefix = path.join(userDataPath, 'wine');
    }
    return {
        ...process.env,
        WINEPREFIX: cachedWinePrefix,
        WINEARCH: 'win64', // Enforce 64-bit for modern .NET
        WINEDEBUG: process.env.WINEDEBUG || '-all', // Suppress wine spam by default
        DOTNET_ROOT: 'C:\\Program Files\\dotnet', // Help the app find the runtime
    };
}

/**
 * Check if "wine" command is available in PATH.
 */
function hasWine() {
    if (cachedWineAvailable !== null) {
        return cachedWineAvailable;
    }
    try {
        cachedWineAvailable = !!resolveSystemWineBinary();
    } catch (error) {
        cachedWineAvailable = false;
    }
    return cachedWineAvailable;
}

/**
 * Resolve a usable system wine binary, even if PATH is missing common locations.
 */
function resolveSystemWineBinary() {
    if (cachedWineBinary !== null) return cachedWineBinary || null;

    const candidates = [];
    const envWine = process.env.TOPSTATS_WINE || process.env.WINE_BINARY || process.env.WINE;
    if (envWine) candidates.push(envWine);
    candidates.push('wine', 'wine64');

    const fallbackPaths = [
        '/usr/bin/wine',
        '/usr/local/bin/wine',
        '/bin/wine',
        '/snap/bin/wine',
        '/opt/wine-staging/bin/wine',
        '/opt/wine/bin/wine'
    ];

    const seen = new Set();
    const allCandidates = [...candidates, ...fallbackPaths].filter((c) => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
    });

    for (const candidate of allCandidates) {
        try {
            if (candidate.includes(path.sep) && !fs.existsSync(candidate)) {
                continue;
            }
            cp.execFileSync(candidate, ['--version'], { stdio: 'ignore' });
            cachedWineBinary = candidate;
            return candidate;
        } catch {
            // continue
        }
    }

    cachedWineBinary = false;
    return null;
}

function getWineToolPath(toolName) {
    const wineBin = resolveSystemWineBinary();
    if (!wineBin || wineBin === 'wine') return toolName;
    return path.join(path.dirname(wineBin), toolName);
}

/**
 * Check if "steam-run" is available in PATH.
 * steam-run provides a containerized environment with standard libraries,
 * often fixing missing dependency issues on immutable distros (Bazzite, SteamOS).
 */
function hasSteamRun() {
    // ALWAYS check freshly (bypass cache) to debug issues
    // if (cachedSteamRunAvailable !== null) return cachedSteamRunAvailable;

    console.log('[wineUtils] Checking for steam-run...');
    try {
        // Try standard check
        cp.execSync('which steam-run', { stdio: 'ignore' });
        console.log('[wineUtils] steam-run found in PATH.');
        return true;
    } catch {
        // Fallback: check /usr/bin/steam-run directly
        if (fs.existsSync('/usr/bin/steam-run')) {
            console.log('[wineUtils] steam-run found at /usr/bin/steam-run.');
            return true;
        }
        console.log('[wineUtils] steam-run not found in PATH or standard location.');
        return false;
    }
}

/**
 * Check for installed Proton versions (Proton - Experimental, Proton 9.0, etc.)
 * Returns the path to the 'wine' binary inside Proton if found, or null.
 */
let cachedProtonBinary = null;
function findProton() {
    if (cachedProtonBinary !== null) return cachedProtonBinary;

    // Common Steam paths on Linux
    const steamPaths = [
        path.join(os.homedir(), '.steam/steam/steamapps/common'),
        path.join(os.homedir(), '.local/share/Steam/steamapps/common'),
        path.join(os.homedir(), '.steam/debian-installation/steamapps/common') // fallback
    ];

    for (const base of steamPaths) {
        if (!fs.existsSync(base)) continue;
        try {
            const dirs = fs.readdirSync(base);
            // Look for Proton* directories
            const protons = dirs.filter(d => d.startsWith('Proton') && fs.statSync(path.join(base, d)).isDirectory());
            // Sort to prefer newer? Experimental usually good. 9.0 > 8.0.
            // Simple string sort might trigger Experimental first or last depending on " - ".
            // Let's just pick the first valid one we verify contains bin/wine.

            for (const p of protons) {
                // Check dist/bin/wine (Proton 5+) or files/bin/wine (Proton Experimental/recent)
                const candidates = [
                    path.join(base, p, 'files', 'bin', 'wine'),
                    path.join(base, p, 'dist', 'bin', 'wine')
                ];
                for (const bin of candidates) {
                    if (fs.existsSync(bin)) {
                        console.log(`[wineUtils] Found Proton Wine at: ${bin}`);
                        cachedProtonBinary = bin;
                        return bin;
                    }
                }
            }
        } catch (e) { console.warn('[wineUtils] Error searching for Proton:', e); }
    }

    cachedProtonBinary = false;
    return null;
}

/**
 * Determine the best available Wine environment (Proton > System).
 * Returns an object containing the resolved binary, script usage, and support tools (server/boot).
 */
function getWineContext(userDataPath) {
    const wineEnv = getWineEnv(userDataPath);
    const systemWine = resolveSystemWineBinary();
    const protonBin = findProton();
    const shouldUseSteamRun = hasSteamRun();

    let context = {
        type: 'none',
        cmd: systemWine || 'wine',
        args: [],
        env: { ...wineEnv },
        serverCmd: [getWineToolPath('wineserver')],
        bootCmd: [getWineToolPath('wineboot')],
        useSteamRun: shouldUseSteamRun,
        protonBase: null
    };

    let protonBase = null;
    if (protonBin) {
        protonBase = path.resolve(protonBin, '../../../');
    }

    if (protonBase) {
        const protonScript = path.join(protonBase, 'proton');
        if (fs.existsSync(protonScript)) {
            // PROTON SCRIPT MODE (Best)
            context.type = 'proton-script';
            context.protonBase = protonBase;

            // Prepare Compat Data
            const compatPath = path.join(userDataPath, 'proton_compat');
            if (!fs.existsSync(compatPath)) fs.mkdirSync(compatPath, { recursive: true });

            // Symlink pfx -> wine folder
            const pfxLink = path.join(compatPath, 'pfx');
            const existingWine = path.join(userDataPath, 'wine');

            try {
                // Ensure the target 'wine' directory exists
                // This is CRITICAL if the user deleted the folder or first run.
                if (!fs.existsSync(existingWine)) {
                    console.log('[wineUtils] Creating fresh wine directory');
                    fs.mkdirSync(existingWine, { recursive: true });
                }

                if (!fs.existsSync(pfxLink)) {
                    console.log('[wineUtils] Symlinking Proton pfx to existing wine dir');
                    fs.symlinkSync(existingWine, pfxLink);
                } else {
                    const stats = fs.lstatSync(pfxLink);
                    if (stats.isDirectory() && !stats.isSymbolicLink()) {
                        // Proton nuked our symlink and made a real dir?
                        // We should probably respect it or try to swap it back.
                        // For safety, let's just accept what is there OR force swap.
                        // forcing swap ensures dependencies we install in 'wine' are visible.
                        if (fs.existsSync(existingWine)) {
                            console.log('[wineUtils] Replacing empty Proton pfx with symlink to wine dir');
                            fs.rmSync(pfxLink, { recursive: true, force: true });
                            fs.symlinkSync(existingWine, pfxLink);
                        }
                    }
                }
            } catch (e) {
                console.warn('[wineUtils] Failed to manage pfx symlink:', e);
            }

            context.env.STEAM_COMPAT_DATA_PATH = compatPath;
            context.env.STEAM_COMPAT_CLIENT_INSTALL_PATH = path.join(os.homedir(), '.steam/steam');
            context.env.WINEPREFIX = pfxLink;
            if (!context.env.PATH) context.env.PATH = process.env.PATH;

            context.cmd = protonScript;
            context.args = ['runinprefix']; // caller appends "wine" or binary

            context.bootCmd = [protonScript, 'runinprefix', 'wineboot'];

            // Resolve Wineserver binary for killing
            const candidates = [
                path.join(protonBase, 'files', 'bin', 'wineserver'),
                path.join(protonBase, 'dist', 'bin', 'wineserver')
            ];
            for (const c of candidates) {
                if (fs.existsSync(c)) {
                    context.serverCmd = [c];
                    break;
                }
            }
        } else if (protonBin) {
            // PROTON RAW BINARY
            context.type = 'proton-raw';
            context.cmd = protonBin;

            const binDir = path.dirname(protonBin);
            context.serverCmd = [path.join(binDir, 'wineserver')];
            context.bootCmd = [path.join(binDir, 'wineboot')];

            // LD_LIBRARY_PATH patching...
            try {
                const filesDir = path.dirname(binDir);
                const libDir = path.join(filesDir, 'lib');
                const libPaths = [
                    libDir,
                    path.join(libDir, 'x86_64-linux-gnu'),
                    path.join(libDir, 'i386-linux-gnu'),
                    path.join(filesDir, 'lib64')
                ];
                const steamRuntimePaths = [
                    path.join(os.homedir(), '.local/share/Steam/steamrt64/pv-runtime/steam-runtime-steamrt/steamrt3c_platform_3c.0.20251202.187499/files/lib/x86_64-linux-gnu'),
                    path.join(os.homedir(), '.steam/steam/ubuntu12_32/steam-runtime/lib/x86_64-linux-gnu')
                ];
                const allLibPaths = [...libPaths, ...steamRuntimePaths];
                const currentLd = context.env.LD_LIBRARY_PATH || '';
                context.env.LD_LIBRARY_PATH = allLibPaths.filter(p => fs.existsSync(p)).join(path.delimiter) +
                    (currentLd ? path.delimiter + currentLd : '');
            } catch (e) { }
        }
    } else if (systemWine) {
        // SYSTEM WINE
        context.type = 'system';
        const sysDir = path.dirname(systemWine);
        context.serverCmd = [path.join(sysDir, 'wineserver')];
        context.bootCmd = [path.join(sysDir, 'wineboot')];
    }

    // Apply Steam Run Wrapper to maintenance tools immediately
    if (context.useSteamRun) {
        context.serverCmd.unshift('steam-run');
        context.bootCmd.unshift('steam-run');
    }

    return context;
}

/**
 * Helper to run a command and return a promise.
 * Handles stdout/stderr collection and exit codes.
 */
function runCommand(cmd, args, options, wc, progressPrefix = '') {
    const fullCmd = `${cmd} ${args.join(' ')}`;
    console.log(`[wineUtils] Executing: ${fullCmd}`);
    if (wc) wc.send('parse-progress', `[DEBUG] Executing: ${fullCmd}`);

    return new Promise((resolve, reject) => {
        const child = cp.spawn(cmd, args, options);

        if (wc) {
            if (child.stdout) {
                child.stdout.on('data', (data) => {
                    const msg = data.toString().trim();
                    if (msg) wc.send('parse-progress', `${progressPrefix}${msg}`);
                });
            }
            if (child.stderr) {
                child.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    if (msg) wc.send('parse-progress', `${progressPrefix}${msg}`);
                });
            }
        }

        child.on('close', (code) => {
            console.log(`[wineUtils] Command finished: ${fullCmd} -> Code ${code}`);
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command ${cmd} ${args.join(' ')} failed with code ${code}`));
            }
        });

        child.on('error', (err) => {
            console.error(`[wineUtils] Command failed to spawn: ${fullCmd}`, err);
            reject(err);
        });
    });
}

// -------------------------------------------------------------------------
// Core Wine Management
// -------------------------------------------------------------------------

/**
 * Boot wine (wineboot) and start wineserver if needed.
 */
function ensureWineReady(userDataPath, env, serverCmd, bootCmd) {
    if (!env) env = getWineEnv(userDataPath);
    if (!serverCmd) serverCmd = [getWineToolPath('wineserver')];
    if (!bootCmd) bootCmd = [getWineToolPath('wineboot')];

    try {
        const [serverBin, ...serverArgs] = serverCmd;

        // 1. Zombie Killer: 
        // Kill existing server to ensure we don't conflict with previous runs
        try {
            cp.execFileSync(serverBin, [...serverArgs, '-k'], { stdio: 'ignore', env });
        } catch (e) { /* ignore */ }

        // 2. BOOT:
        // Initialize the prefix. This creates the directory structure if missing.
        // We MUST do this before trying to map drives.
        try {
            const [cmd, ...args] = bootCmd;
            cp.execFileSync(cmd, [...args, '-u'], { stdio: 'ignore', env });
            // Start persistent server
            cp.execFileSync(serverBin, [...serverArgs, '-w'], { stdio: 'ignore', env });
        } catch (e) {
            // Log but continue; boot might fail if already running or momentary lock, 
            // but usually creates the dirs we need.
            console.warn('[wineUtils] Wineboot warning:', e.message);
        }

        // 3. Ensure Z: is mapped to /
        // Now that Boot has run, the prefix and dosdevices directory should exist.
        const prefix = env.WINEPREFIX;
        const zPath = path.join(prefix, 'dosdevices', 'z:');

        // Wait briefly for filesystem sync? 
        // Sometimes mkdir fails immediately after boot on slow I/O.
        // But let's try synchronously.

        if (!fs.existsSync(zPath)) {
            try {
                const dosDevices = path.dirname(zPath);
                if (!fs.existsSync(dosDevices)) {
                    fs.mkdirSync(dosDevices, { recursive: true });
                }
                // Symlink z: -> /
                fs.symlinkSync('/', zPath);
            } catch (e) {
                console.error('Failed to create Z: drive mapping:', e);
            }
        }

    } catch (e) {
        console.error('Failed to ensure wine readiness:', e);
        // Continue anyway, wine might just work
    }
}

/**
 * Download winetricks if not present.
 */
async function ensureWinetricks(depsDir, wc) {
    const customWinetricks = path.join(depsDir, 'winetricks');
    if (fs.existsSync(customWinetricks)) {
        return customWinetricks;
    }

    try {
        cp.execSync('winetricks --version', { stdio: 'ignore' });
        return 'winetricks';
    } catch { }

    wc.send('parse-progress', 'Winetricks not found. Downloading...');
    try {
        const url = 'https://raw.githubusercontent.com/Winetricks/winetricks/master/src/winetricks';
        await downloadFile(url, customWinetricks);
        fs.chmodSync(customWinetricks, '755');
        return customWinetricks;
    } catch (err) {
        const message = `Failed to download winetricks: ${err.message}`;
        wc.send('parse-progress', message);
        dialog.showErrorBox('Winetricks missing', message);
        throw err;
    }
}

/**
 * Robustly check for installed .NET runtimes.
 */
/**
 * Robustly check for installed .NET runtimes.
 */
function checkInstalledRuntimes(ctx) {
    const status = {
        net48: false,
        netDesktop8: false
    };

    // Use the command from context (System Wine or Proton)
    // If wrapping is needed, handle it.
    let runCmd = ctx.cmd;
    let runArgs = [...ctx.args];

    if (ctx.useSteamRun) {
        runArgs = [runCmd, ...runArgs];
        runCmd = 'steam-run';
    }

    // Helper to run check commands
    const execCheck = (args) => {
        return cp.execFileSync(
            runCmd,
            [...runArgs, ...args],
            { env: ctx.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        );
    };

    try {
        // Check .NET 4.8 via Registry
        // Key: HKLM\Software\Microsoft\NET Framework Setup\NDP\v4\Full
        // Value: Release >= 528040 (for 4.8)
        // Note: execFileSync args must be flat.
        // We need to be careful with 'args' array for execFileSync.
        const regArgs = ['reg', 'query', 'HKLM\\Software\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full', '/v', 'Release'];
        execCheck(regArgs);
        status.net48 = true;
    } catch (e) { /* ignore */ }

    try {
        // Check .NET 8 Desktop Runtime via dotnet --list-runtimes
        // We look for "Microsoft.WindowsDesktop.App 8."
        const output = execCheck(['cmd', '/c', 'dotnet --list-runtimes']);
        if (output.includes('Microsoft.WindowsDesktop.App 8.')) {
            status.netDesktop8 = true;
        }
    } catch (e) { /* ignore */ }

    return status;
}

/**
 * Ensures all required dependencies are installed.
 */
async function ensureWineDotnet(depsDir, wc, _unusedWineEnv) {
    // We ignore the passed-in env safely and re-calculate context 
    // to ensure we install dependencies into the CORRECT Prefix/Environment.
    const userDataPath = path.resolve(depsDir, '..');
    const ctx = getWineContext(userDataPath);
    const wineEnv = ctx.env;

    // 1. Check what we already have
    const status = checkInstalledRuntimes(ctx);

    // Diagnostic
    try {
        let runCmd = ctx.cmd;
        let runArgs = [...ctx.args, 'cmd', '/c', 'dotnet --info'];

        if (ctx.useSteamRun) {
            runArgs = [runCmd, ...runArgs];
            runCmd = 'steam-run';
        }

        const info = cp.execFileSync(runCmd, runArgs, { env: wineEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        wc.send('parse-progress', `[Diagnostic] dotnet --info:\n${info.trim()}`);
    } catch (e) {
        // wc.send('parse-progress', `[Diagnostic] Failed to run dotnet --info: ${e.message}`);
    }

    if (status.net48 && status.netDesktop8) {
        return; // All good
    }

    // 2. Prepare winetricks
    const winetricksCmd = await ensureWinetricks(depsDir, wc);

    let wineBinaryForTricks = 'wine'; // default
    if (ctx.type === 'proton-script' && ctx.protonBase) {
        // Guess location
        const candidates = [
            path.join(ctx.protonBase, 'files', 'bin', 'wine'),
            path.join(ctx.protonBase, 'dist', 'bin', 'wine')
        ];
        for (const c of candidates) { if (fs.existsSync(c)) { wineBinaryForTricks = c; break; } }
    } else if (ctx.cmd && ctx.cmd.endsWith('wine')) {
        wineBinaryForTricks = ctx.cmd;
    }

    const tricksEnv = {
        ...wineEnv,
        WINE: wineBinaryForTricks,
        WINEFSYNC: '0',
        WINEESYNC: '0'
    };

    wc.send('parse-progress', 'Missing Wine dependencies. Installing...');

    // Helper to wrap winetricks execution
    const runTricks = async (verb) => {
        let tCmd = winetricksCmd;
        let tArgs = ['-q', verb];

        if (ctx.useSteamRun) {
            tArgs = [tCmd, ...tArgs];
            tCmd = 'steam-run';
        }

        await runCommand(tCmd, tArgs, { stdio: 'pipe', env: tricksEnv }, wc, '[winetricks] ');
    };

    // 3. Install missing pieces
    if (!status.net48) {
        wc.send('parse-progress', 'Installing .NET Framework 4.8 (may take 5-10 mins)...');
        try {
            await runTricks('dotnet48');
        } catch (e) {
            wc.send('parse-progress', `Warning: dotnet48 install returned error (might be benign): ${e.message}`);
        }
    }

    if (!status.netDesktop8) {
        wc.send('parse-progress', 'Installing .NET Desktop Runtime 8...');
        try {
            await runTricks('dotnetdesktop8');
        } catch (e) {
            wc.send('parse-progress', `Warning: dotnetdesktop8 install returned error: ${e.message}`);
        }
    }

    // 4. Verification
    const finalStatus = checkInstalledRuntimes(ctx);
    if (!finalStatus.net48 || !finalStatus.netDesktop8) {
        const missing = [];
        if (!finalStatus.net48) missing.push('.NET 4.8');
        if (!finalStatus.netDesktop8) missing.push('.NET Desktop 8');
        wc.send('parse-progress', 'Warning: Verification failed. Attempting to proceed regardless.');
    } else {
        wc.send('parse-progress', 'Wine dependencies verified.');
    }
}


// -------------------------------------------------------------------------
// Path Conversion
// -------------------------------------------------------------------------

/**
 * Async path conversion with timeout and fallback.
 * @param {string|string[]} paths 
 * @returns {Promise<string[]>}
 */
async function toWindowsPath(paths) {
    if (!paths) return [];
    if (!Array.isArray(paths)) paths = [paths];
    if (paths.length === 0) return [];

    const inputArgs = paths.map(p => `"${p}"`); // Quote paths

    // 1. Try winepath with timeout
    try {
        const result = await new Promise((resolve, reject) => {
            const child = cp.spawn(getWineToolPath('winepath'), ['-w', ...paths], {
                stdio: ['ignore', 'pipe', 'ignore'],
                windowsHide: true,
                timeout: WINEPATH_TIMEOUT
            });

            let output = '';

            child.stdout.on('data', d => output += d.toString());

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`Exit code ${code}`));
                }
            });

            child.on('error', (e) => {
                reject(e);
            });
        });

        // Parse winepath output (one per line)
        const lines = result.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
        // Sanity check: length should match
        if (lines.length === paths.length) {
            return lines;
        }
        console.warn('winepath returned different number of lines than inputs, falling back.');
    } catch (e) {
        console.warn(`winepath failed (${e.message}), using fallback path conversion.`);
    }

    // 2. Fallback: manual Z: mapping
    // Assumption: Z: maps to /
    return paths.map(p => {
        const abs = path.resolve(p);
        // Replace forward slashes with backslashes
        const winPath = abs.replace(/\//g, '\\');
        return 'Z:' + winPath;
    });
}

// -------------------------------------------------------------------------
// Main Exported Helpers
// -------------------------------------------------------------------------

async function resolveWindowsCommand(cmd, args, wc, depsDir, userDataPath) {
    if (process.platform === 'win32') {
        return { cmd, args, env: process.env };
    }

    const ext = path.extname(cmd).toLowerCase();
    // Only intercept .exe/.bat
    if (ext !== '.exe' && ext !== '.bat') {
        return { cmd, args, env: process.env };
    }

    const wineEnv = getWineEnv(userDataPath); // only used for initial fallback
    const systemWine = resolveSystemWineBinary();

    // 1. Get Unified Context
    const ctx = getWineContext(userDataPath);

    // 2. Prepare Command
    // Convert the command itself to a Windows path
    let winCmd = cmd;
    try {
        if (path.isAbsolute(cmd)) {
            const converted = await toWindowsPath(cmd);
            if (converted && converted.length > 0) {
                winCmd = converted[0];
            }
        }
    } catch (e) {
        console.warn('Failed to convert command path to Windows format, using original:', e);
    }

    // 3. Ensure Environment Ready (Kill old servers, verify Z: drive)
    // We use the tools from the context to do this.
    ensureWineReady(userDataPath, ctx.env, ctx.serverCmd, ctx.bootCmd);

    let finalCmd = ctx.cmd;
    let finalArgs = [...ctx.args, winCmd, ...args];

    // If using Proton Script, ctx.args includes 'runinprefix'.
    // If using Raw Proton/System Wine, ctx.args is empty.

    // 4. Wrap with steam-run if needed
    if (ctx.useSteamRun) {
        // Warning: getWineContext already wrapped the maintenance tools.
        // We must also wrap the MAIN command.
        finalArgs = [finalCmd, ...finalArgs];
        finalCmd = 'steam-run';
    } else {
        // Fallback checks
        if (!process.env.TOPSTATS_WINE && !resolveSystemWineBinary() && ctx.type === 'none') {
            const msg = 'Wine is not installed/found in PATH and Proton was not detected.';
            wc.send('parse-progress', msg);
            throw new Error(msg);
        }
    }

    return {
        cmd: finalCmd,
        args: finalArgs,
        env: ctx.env
    };
}

function getNativeDotnetPath(depsDir) {
    if (!depsDir) return null;
    return path.join(depsDir, 'dotnet_native', 'dotnet');
}

function hasNativeDotnet(depsDir) {
    const p = getNativeDotnetPath(depsDir);
    return fs.existsSync(p);
}

async function ensureNativeDotnet(depsDir, wc) {
    if (hasNativeDotnet(depsDir)) return true;

    wc.send('parse-progress', 'Native .NET Runtime not found. Attempting to install...');
    const installScriptUrl = 'https://dot.net/v1/dotnet-install.sh';
    const scriptPath = path.join(depsDir, 'dotnet-install.sh');
    const installDir = path.join(depsDir, 'dotnet_native');

    try {
        await downloadFile(installScriptUrl, scriptPath);
        // chmod?
        try { fs.chmodSync(scriptPath, '755'); } catch (e) { }

        wc.send('parse-progress', 'Running .NET install script (this may take a minute)...');
        await new Promise((resolve, reject) => {
            const child = cp.spawn('bash', [scriptPath, '--channel', '8.0', '--runtime', 'dotnet', '--install-dir', installDir, '--no-path'], {
                stdio: 'ignore'
            });
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Install script exited with ${code}`));
            });
            child.on('error', reject);
        });

        if (hasNativeDotnet(depsDir)) {
            wc.send('parse-progress', 'Native .NET Runtime installed successfully.');
            return true;
        } else {
            throw new Error('Install script ran but dotnet binary is missing.');
        }

    } catch (e) {
        wc.send('parse-progress', `Failed to install native .NET: ${e.message}`);
        console.error('Native install failed:', e);
        return false;
    }
}

/**
 * Call this before starting a heavy parse job to ensure everything is ready.
 */
async function performPreFlightCheck(wc, depsDir, userDataPath) {
    if (process.platform !== 'win32') {
        const nativeReady = await ensureNativeDotnet(depsDir, wc);

        // Always ensure Wine deps are present if we can find wine/proton
        // This ensures fallbacks work.
        if (hasWine() || findProton()) {
            console.log('[performPreFlightCheck] Verifying Wine environment for fallback usage...');
            try {
                const wineEnv = getWineEnv(userDataPath);
                await ensureWineDotnet(depsDir, wc, wineEnv);
            } catch (e) {
                console.warn('[performPreFlightCheck] Wine setup failed, but continuing if native is ready:', e);
            }
        }

        if (nativeReady) return true;

        // If native failed, do we fail?
        // If wine setup above succeeded, maybe we can rely on it, but the app prefers native logging.
        // Let's assume if native failed, we return false here unless we want to force full wine fallback.
    }

    if (process.platform === 'win32') return true;
    if (!hasWine()) return false;

    const wineEnv = getWineEnv(userDataPath);
    try {
        await ensureWineDotnet(depsDir, wc, wineEnv);
        return true;
    } catch (e) {
        console.error('Pre-flight check failed:', e);
        return false;
    }
}

function getWineDotnetAlerted() { return wineDotnetAlerted; }
function setWineDotnetAlerted(v) { wineDotnetAlerted = v; }
function resetWineState() {
    cachedWineAvailable = null;
    cachedWinePrefix = null;
    wineDotnetAlerted = false;
    cachedWineBinary = null;
}

module.exports = {
    resolveWindowsCommand,
    toWindowsPath,
    performPreFlightCheck,
    hasWine,
    getWineDotnetAlerted,
    setWineDotnetAlerted,
    resetWineState,
    getNativeDotnetPath,
    hasNativeDotnet
};
