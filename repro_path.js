const { toWindowsPath } = require('./wineUtils');
const path = require('path');

async function testConversion() {
    console.log('Testing path conversion...');
    const testPaths = [
        '/var/home/mstephens/Documents/GitHub/TopStatsAIO/EliteInsightConfig.conf',
        '/var/home/mstephens/Documents/GitHub/TopStatsAIO/test log.zevtc'
    ];

    try {
        const windowsPaths = await toWindowsPath(testPaths);
        console.log('Converted:', windowsPaths);

        // Verify formatting
        if (windowsPaths.length !== 2) console.error('Length mismatch');
        if (!windowsPaths[0].includes(':')) console.error('Path 0 looks suspicious');

    } catch (e) {
        console.error('Conversion failed:', e);
    }
}

testConversion();
