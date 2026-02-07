# Release Notes

Version v3.4.3 - February 7, 2026

## 🌟 Highlights
- Release automation now attaches and uploads the app installers to GitHub Releases automatically.
- You can choose whether a release is published right away or saved as a draft via configuration.
- The release workflow validates the build output and reports clearly if artifacts are missing.

## 🛠️ Improvements
- Release flow detects and uses the configured output directory for artifacts.
- If an asset already exists for a file, it will be replaced automatically to ensure the latest installer is available.
- The release notes body is populated with the notes and the version tag is consistently applied.

## 🧯 Fixes
- Clear errors are shown when no build artifacts are found in the output directory.
- Assets are cleaned up before uploading new ones to avoid duplicates.
- The script keeps the release in sync with the preferred tag and reports mismatches clearly.

## ⚠️ Breaking Changes
- None.
