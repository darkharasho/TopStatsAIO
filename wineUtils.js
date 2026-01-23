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
function ensureWineReady(userDataPath) {
    const env = getWineEnv(userDataPath);
    try {
        // Ensure Z: is mapped to /
        // This is critical for our fallback path conversion to work.
        const prefix = env.WINEPREFIX;
        const zPath = path.join(prefix, 'dosdevices', 'z:');
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

        // Zombie Killer: 
        // Sometimes wineserver gets stuck. We try to be nice first.
        try {
            // We only kill wineservers running on THIS prefix to be safe? 
            // Actually, `wineserver -k` kills the server associated with the current WINEPREFIX.
            cp.execFileSync(getWineToolPath('wineserver'), ['-k'], { stdio: 'ignore', env });
        } catch (e) { /* ignore */ }

        // We use execSync for these quick checks/inits
        cp.execFileSync(getWineToolPath('wineboot'), ['-u'], { stdio: 'ignore', env });
        // Start wineserver to ensure prompt readiness
        cp.execFileSync(getWineToolPath('wineserver'), ['-w'], { stdio: 'ignore', env });
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
function checkInstalledRuntimes(wineEnv) {
    const status = {
        net48: false,
        netDesktop8: false
    };

    const wineBin = resolveSystemWineBinary() || 'wine';

    try {
        // Check .NET 4.8 via Registry
        // Key: HKLM\Software\Microsoft\NET Framework Setup\NDP\v4\Full
        // Value: Release >= 528040 (for 4.8)
        cp.execFileSync(
            wineBin,
            ['reg', 'query', 'HKLM\\Software\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full', '/v', 'Release'],
            { stdio: 'ignore', env: wineEnv }
        );
        status.net48 = true;
    } catch (e) { /* ignore */ }

    try {
        // Check .NET 8 Desktop Runtime via dotnet --list-runtimes
        // We look for "Microsoft.WindowsDesktop.App 8."
        const output = cp.execFileSync(
            wineBin,
            ['cmd', '/c', 'dotnet --list-runtimes'],
            { env: wineEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        );
        if (output.includes('Microsoft.WindowsDesktop.App 8.')) {
            status.netDesktop8 = true;
        }
    } catch (e) { /* ignore */ }

    return status;
}

/**
 * Ensures all required dependencies are installed.
 */
async function ensureWineDotnet(depsDir, wc, wineEnv) {
    // 1. Check what we already have
    const status = checkInstalledRuntimes(wineEnv);
    const wineBin = resolveSystemWineBinary() || 'wine';

    // Diagnostic: Log dotnet info to see what Wine sees
    try {
        const info = cp.execFileSync(wineBin, ['cmd', '/c', 'dotnet --info'], { env: wineEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        wc.send('parse-progress', `[Diagnostic] dotnet --info:\n${info.trim()}`);
    } catch (e) {
        wc.send('parse-progress', `[Diagnostic] Failed to run dotnet --info: ${e.message}`);
    }

    if (status.net48 && status.netDesktop8) {
        return; // All good
    }

    // 2. Prepare winetricks
    const winetricksCmd = await ensureWinetricks(depsDir, wc);
    const cmd = winetricksCmd;
    // winetricks can be run directly if it's the script

    wc.send('parse-progress', 'Missing Wine dependencies. Installing...');

    // 3. Install missing pieces
    if (!status.net48) {
        wc.send('parse-progress', 'Installing .NET Framework 4.8 (may take 5-10 mins)...');
        try {
            await runCommand(cmd, ['-q', 'dotnet48'], { stdio: 'pipe', env: wineEnv }, wc, '[winetricks] ');
        } catch (e) {
            wc.send('parse-progress', `Warning: dotnet48 install returned error (might be benign): ${e.message}`);
        }
    }

    if (!status.netDesktop8) {
        wc.send('parse-progress', 'Installing .NET Desktop Runtime 8...');
        try {
            // verb for dotnet 8 desktop runtime
            await runCommand(cmd, ['-q', 'dotnetdesktop8'], { stdio: 'pipe', env: wineEnv }, wc, '[winetricks] ');
        } catch (e) {
            wc.send('parse-progress', `Warning: dotnetdesktop8 install returned error: ${e.message}`);
        }
    }

    // 4. Verification
    const finalStatus = checkInstalledRuntimes(wineEnv);
    if (!finalStatus.net48 || !finalStatus.netDesktop8) {
        const missing = [];
        if (!finalStatus.net48) missing.push('.NET 4.8');
        if (!finalStatus.netDesktop8) missing.push('.NET Desktop 8');
        const msg = `Output verification failed for: ${missing.join(', ')}. Please manually verify or try running 'winetricks dotnet48 dotnetdesktop8'.`;
        wc.send('parse-progress', msg);
        throw new Error(msg);
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

    const wineEnv = getWineEnv(userDataPath);
    const systemWine = resolveSystemWineBinary();

    // Ensure Basic Wine State (sync checks)
    if (systemWine) {
        ensureWineReady(userDataPath);
    }

    // Convert the command itself to a Windows path to ensure dotNET is happy
    // about where it is running from (AppDomain.BaseDirectory).
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

    // Fallback Strategy:
    // 1. Identify valid Wine Binary: Proton (Best) > System Wine (Fallback)
    // 2. Identify Wrapper: steam-run (Best for immutable OS) > None

    // Strategy:
    // 1. Prefer using the 'proton' script directly. It handles namespaces, libraries (libicu), and prefix setup.
    // 2. Fallback to 'steam-run' if available (wrapping headers).
    // 3. Fallback to system wine.

    const protonBin = findProton();
    let protonBase = null;
    if (protonBin) {
        // protonBin is typically .../files/bin/wine
        // We want the base dir .../Proton - Experimental/
        protonBase = path.resolve(protonBin, '../../../');
    }

    let finalCmd = systemWine || 'wine';
    let finalArgs = [winCmd, ...args];
    let customEnv = { ...wineEnv };
    let useScript = false;

    if (protonBase) {
        const protonScript = path.join(protonBase, 'proton');
        if (fs.existsSync(protonScript)) {
            console.log(`[wineUtils] Found Proton Script: ${protonScript}`);
            useScript = true;

            // Prepare environment for Proton Script
            // It requires STEAM_COMPAT_DATA_PATH
            const compatPath = path.join(userDataPath, 'proton_compat');
            if (!fs.existsSync(compatPath)) fs.mkdirSync(compatPath, { recursive: true });

            // Symlink pfx -> wine folder to ensure we use the environment where we installed prerequisites
            const pfxLink = path.join(compatPath, 'pfx');
            const existingWine = path.join(userDataPath, 'wine');

            try {
                if (!fs.existsSync(pfxLink)) {
                    if (fs.existsSync(existingWine)) {
                        console.log('[wineUtils] Symlinking Proton pfx to existing wine dir');
                        fs.symlinkSync(existingWine, pfxLink);
                    }
                } else {
                    const stats = fs.lstatSync(pfxLink);
                    if (stats.isDirectory() && !stats.isSymbolicLink()) {
                        // Proton might have created a fresh pfx directory.
                        // We prefer our 'wine' dir which has dependencies.
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

            customEnv.STEAM_COMPAT_DATA_PATH = compatPath;
            customEnv.STEAM_COMPAT_CLIENT_INSTALL_PATH = path.join(os.homedir(), '.steam/steam');

            // IMPORTANT: Proton uses <compatPath>/pfx as WINEPREFIX.
            // We update our env to match, so child processes see the correct prefix.
            customEnv.WINEPREFIX = pfxLink;

            finalCmd = protonScript;
            finalArgs = ['runinprefix', winCmd, ...args];

            // Ensure PATH includes python3 location if needed
            if (!customEnv.PATH) customEnv.PATH = process.env.PATH;

            // WRAP WITH STEAM-RUN IF AVAILABLE
            // The proton script provides the wine execution logic, but it RELIES on the 
            // Steam Runtime (libicu, etc.) being present in the environment.
            // On raw Linux (Bazzite), we must invoke it via steam-run.
            if (hasSteamRun()) {
                console.log('[wineUtils] Wrapping Proton script with steam-run');
                finalArgs = [finalCmd, ...finalArgs];
                finalCmd = 'steam-run';
            }
        }
    }

    if (!useScript) {
        // Fallback to legacy methods
        if (protonBin) {
            console.log(`[wineUtils] Using Raw Proton Wine: ${protonBin}`);
            finalCmd = protonBin;
        } else if (!systemWine) {
            const msg = 'Wine is not installed/found in PATH (or standard locations) and Proton was not detected.';
            wc.send('parse-progress', msg);
            throw new Error(msg);
        }

        // Wrap with steam-run if available (and we aren't using the full script which might do its own wrapping)
        if (hasSteamRun()) {
            console.log('[wineUtils] steam-run detected. Wrapping command.');
            finalArgs = [finalCmd, ...finalArgs];
            finalCmd = 'steam-run';
        } else if (protonBin) {
            // Last ditch effort to patch LD_LIBRARY_PATH if we are forced to use raw proton without script or steam-run
            try {
                const binDir = path.dirname(protonBin);
                const filesDir = path.dirname(binDir);
                const libDir = path.join(filesDir, 'lib');
                const libPaths = [
                    libDir,
                    path.join(libDir, 'x86_64-linux-gnu'),
                    path.join(libDir, 'i386-linux-gnu'),
                    path.join(filesDir, 'lib64')
                ];
                // Add steam runtime paths just in case
                const steamRuntimePaths = [
                    path.join(os.homedir(), '.local/share/Steam/steamrt64/pv-runtime/steam-runtime-steamrt/steamrt3c_platform_3c.0.20251202.187499/files/lib/x86_64-linux-gnu'),
                    path.join(os.homedir(), '.steam/steam/ubuntu12_32/steam-runtime/lib/x86_64-linux-gnu')
                ];

                const allLibPaths = [...libPaths, ...steamRuntimePaths];
                const currentLd = customEnv.LD_LIBRARY_PATH || '';
                const newLd = allLibPaths.filter(p => fs.existsSync(p)).join(path.delimiter) +
                    (currentLd ? path.delimiter + currentLd : '');
                customEnv.LD_LIBRARY_PATH = newLd;
            } catch (e) { }
        }
    }

    return {
        cmd: finalCmd,
        args: finalArgs,
        env: customEnv
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
        // Try to ensure native dotnet is available
        const nativeReady = await ensureNativeDotnet(depsDir, wc);
        if (nativeReady) return true;

        // If native failed, fall back to Wine checks?
        // But Wine is broken for this app.
        // Let's return true anyway so valid wine paths might try (and fail), 
        // OR return false to stop.
        // Given the state, if native fails, we are likely stuck.
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
