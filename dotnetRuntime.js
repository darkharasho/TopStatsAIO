// Helpers for working out which .NET runtime the downloaded tools need.
// Elite Insights and the log combiner pick their own target framework, so we
// read it from their *.runtimeconfig.json instead of hardcoding a version.
const fs = require('fs');
const path = require('path');

const DEFAULT_RUNTIME_MAJOR = 8;
const TOOL_DIRS = ['eicli', 'logcombiner', 'topstatsparser'];

function compareVersions(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function readRuntimeFrameworks(dir) {
    let files;
    try {
        files = fs.readdirSync(dir).filter(f => f.endsWith('.runtimeconfig.json'));
    } catch {
        return [];
    }
    const out = [];
    for (const file of files) {
        try {
            const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
            const opts = (json && json.runtimeOptions) || {};
            const list = opts.frameworks || (opts.framework ? [opts.framework] : []);
            for (const fw of list) {
                if (fw && fw.name && fw.version) out.push({ name: fw.name, version: fw.version });
            }
        } catch { /* unreadable config: ignore */ }
    }
    return out;
}

// Highest required version per framework name across all downloaded tools.
function getRequiredFrameworks(depsDir) {
    const required = {};
    if (!depsDir) return required;
    for (const sub of TOOL_DIRS) {
        for (const fw of readRuntimeFrameworks(path.join(depsDir, sub))) {
            if (!required[fw.name] || compareVersions(fw.version, required[fw.name]) > 0) {
                required[fw.name] = fw.version;
            }
        }
    }
    return required;
}

// .NET only rolls forward within a major version by default, so the major is
// what decides which runtime has to be installed.
function getRequiredRuntimeMajor(depsDir) {
    const required = getRequiredFrameworks(depsDir);
    const majors = Object.values(required).map(v => parseInt(String(v).split('.')[0], 10)).filter(n => n > 0);
    return majors.length ? Math.max(...majors) : DEFAULT_RUNTIME_MAJOR;
}

// Parses hostfxr's "Framework: 'Microsoft.NETCore.App', version '10.0.0' (x64)".
function parseMissingFramework(text) {
    if (!text) return null;
    const m = /Framework:\s*'([^']+)',\s*version\s*'([^']+)'/i.exec(text);
    return m ? { name: m[1], version: m[2] } : null;
}

function runtimeDownloadUrl(framework) {
    const base = 'https://aka.ms/dotnet-core-applaunch?';
    if (!framework || !framework.name || !framework.version) {
        return `${base}missing_runtime=true&arch=x64&rid=win-x64&os=win10`;
    }
    return `${base}framework=${encodeURIComponent(framework.name)}&framework_version=${encodeURIComponent(framework.version)}&arch=x64&rid=win-x64&os=win10`;
}

// True if a dotnet install root has a Microsoft.NETCore.App of the given major.
function hasCompatibleRuntime(dotnetRoot, major) {
    try {
        return fs.readdirSync(path.join(dotnetRoot, 'shared', 'Microsoft.NETCore.App'))
            .some(v => parseInt(v.split('.')[0], 10) === major);
    } catch {
        return false;
    }
}

module.exports = {
    DEFAULT_RUNTIME_MAJOR,
    compareVersions,
    readRuntimeFrameworks,
    getRequiredFrameworks,
    getRequiredRuntimeMajor,
    parseMissingFramework,
    runtimeDownloadUrl,
    hasCompatibleRuntime
};
