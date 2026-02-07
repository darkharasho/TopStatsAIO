# Release Notes

Version v3.4.0 - February 7, 2026

## 🌟 Highlights
- New tooling to help with GitHub version bumps and packaging.
- Enhanced Elite Insights (EI) config editing to support batch setups for multiple logs.
- Smarter log file staging with efficient file handling to avoid unnecessary copies.

## 🛠️ Improvements
- Staging now tracks each input file and handles duplicate names by renaming with a suffix (e.g., base__1.ext), plus clearer progress messages showing original and staged names.
- When multiple logs are staged, EI config is updated to handle batch parsing (ParseMultipleLogs) and applies related settings.
- Log staging prefers hard linking to avoid duplicating large log files; falls back to copying only if hard links aren’t possible.

## 🧯 Fixes
- Corrected the version number in package.json (from 3.3.2 to 3.3.1).

## ⚠️ Breaking Changes
- None.
