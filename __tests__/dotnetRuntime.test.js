const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    readRuntimeFrameworks,
    getRequiredFrameworks,
    getRequiredRuntimeMajor,
    parseMissingFramework,
    runtimeDownloadUrl,
    hasCompatibleRuntime,
    DEFAULT_RUNTIME_MAJOR
} = require('../dotnetRuntime');

function writeRuntimeConfig(dir, name, frameworks) {
    fs.mkdirSync(dir, { recursive: true });
    const runtimeOptions = Array.isArray(frameworks)
        ? { frameworks }
        : { framework: frameworks };
    fs.writeFileSync(path.join(dir, `${name}.runtimeconfig.json`), JSON.stringify({ runtimeOptions }));
}

describe('dotnetRuntime', () => {
    let depsDir;

    beforeEach(() => {
        depsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsa-dotnet-'));
    });

    afterEach(() => {
        fs.rmSync(depsDir, { recursive: true, force: true });
    });

    describe('readRuntimeFrameworks', () => {
        test('reads single framework from runtimeconfig', () => {
            const dir = path.join(depsDir, 'eicli');
            writeRuntimeConfig(dir, 'GuildWars2EliteInsights-CLI', { name: 'Microsoft.NETCore.App', version: '10.0.0' });
            expect(readRuntimeFrameworks(dir)).toEqual([{ name: 'Microsoft.NETCore.App', version: '10.0.0' }]);
        });

        test('reads frameworks array', () => {
            const dir = path.join(depsDir, 'logcombiner');
            writeRuntimeConfig(dir, 'TopStats', [
                { name: 'Microsoft.NETCore.App', version: '8.0.0' },
                { name: 'Microsoft.WindowsDesktop.App', version: '8.0.0' }
            ]);
            expect(readRuntimeFrameworks(dir)).toHaveLength(2);
        });

        test('returns empty for missing dir or bad json', () => {
            expect(readRuntimeFrameworks(path.join(depsDir, 'nope'))).toEqual([]);
            const dir = path.join(depsDir, 'bad');
            fs.mkdirSync(dir);
            fs.writeFileSync(path.join(dir, 'x.runtimeconfig.json'), '{not json');
            expect(readRuntimeFrameworks(dir)).toEqual([]);
        });
    });

    describe('getRequiredFrameworks / getRequiredRuntimeMajor', () => {
        test('takes the highest version per framework across tools', () => {
            writeRuntimeConfig(path.join(depsDir, 'eicli'), 'cli', { name: 'Microsoft.NETCore.App', version: '10.0.0' });
            writeRuntimeConfig(path.join(depsDir, 'logcombiner'), 'TopStats', { name: 'Microsoft.NETCore.App', version: '8.0.0' });
            expect(getRequiredFrameworks(depsDir)).toEqual({ 'Microsoft.NETCore.App': '10.0.0' });
            expect(getRequiredRuntimeMajor(depsDir)).toBe(10);
        });

        test('compares versions numerically, not lexically', () => {
            writeRuntimeConfig(path.join(depsDir, 'eicli'), 'cli', { name: 'Microsoft.NETCore.App', version: '9.0.0' });
            writeRuntimeConfig(path.join(depsDir, 'logcombiner'), 'TopStats', { name: 'Microsoft.NETCore.App', version: '10.0.0' });
            expect(getRequiredRuntimeMajor(depsDir)).toBe(10);
        });

        test('falls back to default when no tools are downloaded', () => {
            expect(getRequiredRuntimeMajor(depsDir)).toBe(DEFAULT_RUNTIME_MAJOR);
            expect(getRequiredRuntimeMajor(null)).toBe(DEFAULT_RUNTIME_MAJOR);
        });
    });

    describe('parseMissingFramework', () => {
        test('parses the hostfxr error from the Discord report', () => {
            const text = "You must install or update .NET to run this application.\n\n" +
                "Framework: 'Microsoft.NETCore.App', version '10.0.0' (x64)\n" +
                ".NET location: C:\\Program Files\\dotnet\\";
            expect(parseMissingFramework(text)).toEqual({ name: 'Microsoft.NETCore.App', version: '10.0.0' });
        });

        test('returns null when nothing matches', () => {
            expect(parseMissingFramework('some other error')).toBeNull();
            expect(parseMissingFramework('')).toBeNull();
        });
    });

    describe('runtimeDownloadUrl', () => {
        test('builds an applaunch link for the requested framework', () => {
            const url = runtimeDownloadUrl({ name: 'Microsoft.NETCore.App', version: '10.0.0' });
            expect(url).toBe('https://aka.ms/dotnet-core-applaunch?framework=Microsoft.NETCore.App&framework_version=10.0.0&arch=x64&rid=win-x64&os=win10');
        });

        test('generic link when framework unknown', () => {
            expect(runtimeDownloadUrl(null)).toBe('https://aka.ms/dotnet-core-applaunch?missing_runtime=true&arch=x64&rid=win-x64&os=win10');
        });
    });

    describe('hasCompatibleRuntime', () => {
        test('matches the same major only', () => {
            const dotnetRoot = path.join(depsDir, 'dotnet_native');
            fs.mkdirSync(path.join(dotnetRoot, 'shared', 'Microsoft.NETCore.App', '8.0.34'), { recursive: true });
            expect(hasCompatibleRuntime(dotnetRoot, 8)).toBe(true);
            expect(hasCompatibleRuntime(dotnetRoot, 10)).toBe(false);
            fs.mkdirSync(path.join(dotnetRoot, 'shared', 'Microsoft.NETCore.App', '10.0.1'), { recursive: true });
            expect(hasCompatibleRuntime(dotnetRoot, 10)).toBe(true);
        });

        test('false when runtime dir missing', () => {
            expect(hasCompatibleRuntime(path.join(depsDir, 'none'), 8)).toBe(false);
        });
    });
});
