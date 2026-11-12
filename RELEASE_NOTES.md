# Release Notes

Version v3.4.6 - November 11, 2026

## 🌟 Highlights
- Fixed parsing for users without .NET 10: Elite Insights v3.32 now requires the .NET 10 runtime, and TopStatsAIO points you to the right download.

## 🛠️ Improvements
- The required .NET version is now read from the downloaded tools instead of being hardcoded, so future runtime bumps are handled automatically.

## 🧯 Fixes
- The "Missing .NET runtime" message linked .NET 8 even when a tool needed a newer version. It now links the version the tool asked for (currently .NET 10).
- Linux (native): the bundled .NET runtime is installed or upgraded to the version the tools need, instead of always .NET 8.
- Linux (Wine/Proton): installs the matching .NET Desktop Runtime (e.g. `dotnetdesktop10`) instead of always `dotnetdesktop8`.

## ⚠️ Breaking Changes
- None.
