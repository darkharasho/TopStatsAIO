# Release Notes

Version v3.4.1 - February 7, 2026

## 🌟 Highlights
- Batch editing options for Elite Insights config to tune parsing and output behavior.
- Smarter file staging that keeps original names and uses hard links when possible to save time and space.
- New release tooling to streamline version bumps and packaging for GitHub.
- Automatic tagging support for releases, handling both local and remote tags.

## 🛠️ Improvements
- EI config editing now supports batch options like parseMultipleLogs, applicationTraces, and saveOutHtml.
- Staging logic now tracks staged files and assigns unique staged names when duplicates exist.
- Hard-link-based staging is preferred to avoid duplicating large log files; falls back to copy if needed.
- Release-related scripts now assist with generating release notes and preparing GitHub releases.

## 🧯 Fixes
- Fixed incorrect version number in package.json (from 3.3.2 to 3.3.1).

## ⚠️ Breaking Changes
- None.
