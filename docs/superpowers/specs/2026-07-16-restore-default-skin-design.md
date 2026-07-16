# Restore Default Skin Button — Design

**Date:** 2026-07-16
**Status:** Approved

## Summary

Add a "Restore Default Skin" button to the Glass Skin card on the main page,
directly below the existing "Import / Update Skin" button. Clicking it
re-uploads the fresh bundled default TopStats skin (`TopStats_Full_Skin.json`),
re-injecting the user's saved custom backdrop icon so it survives the restore.
This gives users a clear way to recover the stock TopStats skin after local
TiddlyWiki edits, without losing their custom commander tag icon.

## Motivation

The Glass Skin (TiddlyWiki theme) can be modified by users inside their wiki.
When a user wants to get back to the shipped default appearance, there is
currently only the "Import / Update Skin" button, which is framed around update
checking. Users need an explicit, clearly labeled "restore" action. The
requirement: restoring must **keep the custom backdrop icon**, not wipe it.

## Existing Behavior (reference)

- **Glass Skin card:** `index.html` lines 342–378 (`#backdrop-icon-card`).
  - `#upload-import-skin` — Import / Update Skin button.
  - `#skin-update-badge` — "Update Available!" badge (hidden by default).
  - `#backdrop-icon-*` — custom backdrop icon controls; saved icon lives in
    `localStorage` key `customBackdropIcon`.
- **Import handler:** `renderer.js` lines 785–828. It already:
  1. Reads `customBackdropIcon` from localStorage (line 803).
  2. Fetches the skin via `window.electronAPI.getSkinContent(customIcon)`,
     which injects the custom icon into the bundled skin (line 804).
  3. Opens the upload window via `openUploadWindow(url, [skin], false, {...})`.
  4. On success, stores `skinVersion` and hides `#skin-update-badge`
     (lines 815–818).
- **Backend:** `main.js` `get-skin-content` IPC handler reads bundled
  `TopStats_Full_Skin.json` and injects the custom icon when provided.

The new button reuses all of this. No backend or preload changes are needed.

## Design

### UI (`index.html`)

Inside `#backdrop-icon-card`, add a "Restore Default Skin" button and a one-line
helper immediately below the existing import button block (after the
`#skin-update-badge` span, still within the import section's bordered div, or in
its own block directly under it).

- Button id: `restore-default-skin`.
- Label: `Restore Default Skin`.
- Helper text: "Re-applies the default TopStats skin. Keeps your custom
  backdrop icon."
- Styled as a **secondary** action (match the neutral `.small-btn` look rather
  than the brand-gradient primary import button), so it reads as the fallback
  action.

### Handler (`renderer.js`)

Add a click handler for `#restore-default-skin` that mirrors the existing
`#upload-import-skin` handler:

1. Resolve and validate the upload URL (same guard as the import handler).
2. Disable the button and show a loading label while working.
3. Read `customBackdropIcon` from localStorage and call
   `getSkinContent(customIcon)` — this re-injects the custom icon.
4. Call `openUploadWindow(url, [skin], false, { callback })`.
5. In the callback: set `skinVersion` to `skin.version` and hide
   `#skin-update-badge` (restoring applies the current bundled version, so the
   update badge should clear), then re-enable the button.
6. On error, alert and re-enable the button.

The logic is intentionally near-identical to the import handler; the difference
is user-facing framing (restore vs. update). Where practical, factor the shared
upload logic into a small helper both buttons call, to avoid duplicated code —
but keeping it a focused copy is acceptable if a clean shared helper isn't
obvious.

## Out of Scope

- Any control in the Log Combiner settings window (the button lives on the main
  page, under the glass skin button).
- Removing or resetting the custom backdrop icon (icon is preserved by design).
- Backend / `main.js` / `preload.js` changes.

## Testing

- Manual: with a custom backdrop icon set, click Restore Default Skin; confirm
  the upload window opens with the default skin and the custom icon still
  injected, and that the update badge clears afterward.
- Manual: with no custom icon set, confirm restore still works and uploads the
  plain default skin.
- Manual: with an invalid/empty upload URL, confirm the same validation alert
  as the import button.
