# Restore Default Skin Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Restore Default Skin" button under the existing Glass Skin import button that re-uploads the bundled default TopStats skin while preserving the user's custom backdrop icon, and clears the update badge.

**Architecture:** The new button reuses the existing skin-upload path (`getSkinContent` → `openUploadWindow`). To keep the two handlers DRY, the shared "persist skin version after a successful upload" step is extracted into a small pure helper in `rendererUtils.js` (which is unit-tested), and both the existing import handler and the new restore handler call it. The button + click wiring is DOM glue added to `renderer.js` following the existing import-button pattern.

**Tech Stack:** Electron (CommonJS), vanilla JS renderer, Jest for unit tests (`__tests__/`, node environment, no jsdom — tests target pure functions with a mock storage object).

## Global Constraints

- Custom backdrop icon MUST be preserved on restore (read `customBackdropIcon` from localStorage and pass to `getSkinContent`).
- Restoring MUST clear the `#skin-update-badge` and update stored `skinVersion` to the applied skin's version.
- No changes to `main.js` or `preload.js`.
- Jest runs via `npm test`. Per machine policy, if invoking vitest directly cap workers at 2 — not applicable here (this repo uses Jest).
- `rendererUtils.js` is an IIFE module exporting via the `exports` object at the bottom (lines 232–248); new exports go there.

---

### Task 1: Extract shared `persistSkinVersion` helper (tested)

**Files:**
- Modify: `rendererUtils.js` (add function near other helpers; add export near line 247)
- Test: `__tests__/rendererSettings.test.js` (add a new `describe` block; this file already imports from `../rendererUtils` and defines the `mockStorage` pattern)

**Interfaces:**
- Consumes: nothing.
- Produces: `persistSkinVersion(storage, skin)` — if `skin` is truthy and has a truthy `.version`, calls `storage.setItem('skinVersion', skin.version)` and returns `true`; otherwise makes no storage call and returns `false`. `storage` is a localStorage-like object with `setItem(key, value)`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/rendererSettings.test.js`:

```javascript
const { persistSkinVersion } = require('../rendererUtils');

describe('persistSkinVersion', () => {
    let store;
    let storage;

    beforeEach(() => {
        store = {};
        storage = {
            setItem: jest.fn((k, v) => { store[k] = v; })
        };
    });

    test('stores skinVersion and returns true when skin has a version', () => {
        const result = persistSkinVersion(storage, { version: '1.6.0' });
        expect(result).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith('skinVersion', '1.6.0');
        expect(store.skinVersion).toBe('1.6.0');
    });

    test('returns false and does not write when skin has no version', () => {
        const result = persistSkinVersion(storage, { version: '' });
        expect(result).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    test('returns false when skin is null', () => {
        const result = persistSkinVersion(storage, null);
        expect(result).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/rendererSettings.test.js -t persistSkinVersion`
Expected: FAIL — `persistSkinVersion is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `rendererUtils.js`, add this function (place it just before the `exports.` block, after the other helper definitions):

```javascript
    function persistSkinVersion(storage, skin) {
        if (!skin || !skin.version) return false;
        storage.setItem('skinVersion', skin.version);
        return true;
    }
```

Then add to the exports block (near line 247):

```javascript
    exports.persistSkinVersion = persistSkinVersion;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/rendererSettings.test.js -t persistSkinVersion`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add rendererUtils.js __tests__/rendererSettings.test.js
git commit -m "feat: add persistSkinVersion helper for skin upload"
```

---

### Task 2: Refactor existing import handler to use the helper

**Files:**
- Modify: `renderer.js` lines ~813–818 (inside the `#upload-import-skin` click handler) and the imports at the top (line ~18, where helpers are destructured from `rendererUtils`)

**Interfaces:**
- Consumes: `persistSkinVersion(storage, skin)` from Task 1.
- Produces: nothing new (behavior-preserving refactor).

- [ ] **Step 1: Import the helper**

At the top of `renderer.js`, find the destructuring import that includes `normalizeUrl` (around line 18) and add `persistSkinVersion` to it. For example, if it reads:

```javascript
const {
  normalizeUrl,
  ...
} = require('./rendererUtils');
```

add `persistSkinVersion,` to the destructured names. (Verify the exact require target string matches the existing one in the file — do not change it.)

- [ ] **Step 2: Replace the inline version-persist logic**

In the `#upload-import-skin` handler callback (currently lines ~813–821), replace:

```javascript
      openUploadWindow(url, [skin], false, {
        callback: () => {
          if (skin.version) {
            localStorage.setItem('skinVersion', skin.version);
            if (skinUpdateBadge) skinUpdateBadge.classList.add('hidden');
          }
          finalize();
        }
      });
```

with:

```javascript
      openUploadWindow(url, [skin], false, {
        callback: () => {
          if (persistSkinVersion(localStorage, skin) && skinUpdateBadge) {
            skinUpdateBadge.classList.add('hidden');
          }
          finalize();
        }
      });
```

- [ ] **Step 3: Run the full test suite (no regressions)**

Run: `npm test`
Expected: PASS (all existing tests plus Task 1's).

- [ ] **Step 4: Commit**

```bash
git add renderer.js
git commit -m "refactor: use persistSkinVersion in import skin handler"
```

---

### Task 3: Add the Restore Default Skin button (UI + handler)

**Files:**
- Modify: `index.html` inside `#backdrop-icon-card`, immediately after the `#skin-update-badge` span (line ~355), still within the bordered import section div (closes at line ~356)
- Modify: `renderer.js` — add an element reference near line ~123 (`uploadImportSkinBtn` / `skinUpdateBadge`), and add a new click handler after the existing `#upload-import-skin` handler (after line ~828)

**Interfaces:**
- Consumes: `persistSkinVersion` (Task 1); existing `normalizeUrl`, `openUploadWindow`, `window.electronAPI.getSkinContent`, `uploadUrlInput`, `skinUpdateBadge`.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the button markup**

In `index.html`, inside `#backdrop-icon-card`, after the `#skin-update-badge` `<span>` (line ~355) and before the closing `</div>` of the import section (line ~356), add:

```html
            <button id="restore-default-skin" class="small-btn"
              style="width: 100%; margin-top: 8px;">
              <span style="margin-right: 6px;">↺</span> Restore Default Skin
            </button>
            <p class="config-hint" style="margin-top: 6px; font-size: 0.75em;">Re-applies the
              default TopStats skin. Keeps your custom backdrop icon.</p>
```

- [ ] **Step 2: Add the element reference**

In `renderer.js`, near line ~123 where `uploadImportSkinBtn` and `skinUpdateBadge` are defined, add:

```javascript
const restoreDefaultSkinBtn = document.getElementById('restore-default-skin');
```

- [ ] **Step 3: Add the click handler**

In `renderer.js`, immediately after the existing `#upload-import-skin` handler block (after line ~828), add:

```javascript
if (restoreDefaultSkinBtn) {
  restoreDefaultSkinBtn.addEventListener('click', async () => {
    let url = localStorage.getItem('uploadUrl') || uploadUrlInput.value;
    if (!url || !url.includes('tiddlyhost.com')) {
      alert('Please configure a valid Tiddlyhost Upload URL first.');
      return;
    }
    url = normalizeUrl(url);
    if (!url) {
      alert('Invalid Upload URL format.');
      return;
    }

    restoreDefaultSkinBtn.disabled = true;
    const originalText = restoreDefaultSkinBtn.childNodes[0].textContent;
    restoreDefaultSkinBtn.childNodes[0].textContent = 'Loading Skin...';

    const finalize = () => {
      restoreDefaultSkinBtn.disabled = false;
      restoreDefaultSkinBtn.childNodes[0].textContent = originalText;
    };

    try {
      const customIcon = localStorage.getItem('customBackdropIcon');
      const skin = await window.electronAPI.getSkinContent(customIcon);
      if (!skin) throw new Error('Could not load skin content.');

      openUploadWindow(url, [skin], false, {
        callback: () => {
          if (persistSkinVersion(localStorage, skin) && skinUpdateBadge) {
            skinUpdateBadge.classList.add('hidden');
          }
          finalize();
        }
      });
    } catch (e) {
      alert('Failed to restore skin: ' + e.message);
      finalize();
    }
  });
}
```

Note: the handler's first `childNodes[0]` is the leading `<span>↺</span>` element node, not the text — matching the existing import handler which relies on the same `childNodes[0].textContent` pattern (the import button also leads with a `<span>`). Since the leading node is an element, mutating `.textContent` swaps the icon for the loading text and restores it, exactly as the existing button does. Keep this consistent with the existing handler; do not "fix" it.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (no regressions; no new unit tests here — this is DOM glue verified manually in Step 5).

- [ ] **Step 5: Manual verification**

Run: `npm start`
- With a custom backdrop icon set and the update badge visible: click **Restore Default Skin**. Confirm the upload window opens with the default skin, the custom icon is still present in the skin, and after upload the "Update Available!" badge is hidden.
- With no custom icon set: confirm restore still uploads the plain default skin.
- With an empty/invalid upload URL: confirm the same validation alert as the import button appears and no upload window opens.

- [ ] **Step 6: Commit**

```bash
git add index.html renderer.js
git commit -m "feat: add Restore Default Skin button to Glass Skin card"
```

---

## Self-Review

**Spec coverage:**
- Button below import button, keeps custom icon → Task 3 (markup after badge; passes `customBackdropIcon` to `getSkinContent`).
- Secondary styling → Task 3 uses plain `.small-btn` (no brand gradient), distinct from the import button.
- Helper text → Task 3 `config-hint`.
- Clear badge + update `skinVersion` on restore → Task 1 helper + Task 3 callback.
- Reuse upload logic / factor shared helper → Tasks 1–2.
- No backend/preload changes → confined to `rendererUtils.js`, `renderer.js`, `index.html`.

**Placeholder scan:** none — all steps contain concrete code/commands. The one intentional verify-in-file note (require target string, exact line offsets) is a real instruction, not a placeholder.

**Type consistency:** `persistSkinVersion(storage, skin)` signature and return type are identical across Tasks 1, 2, and 3.
