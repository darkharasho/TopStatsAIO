<img width="3560" height="930" alt="top_stats_aio_banner" src="https://github.com/user-attachments/assets/64a5124f-792d-483d-94a0-e541a10ae457" />

---

<img width="1100" height="800" alt="image" src="https://github.com/user-attachments/assets/cec60373-5ae8-4afd-90fe-458016560340" />

<img width="1100" height="800" alt="image" src="https://github.com/user-attachments/assets/38195b55-af42-419d-8b53-51554faa0006" />

<img width="1100" height="800" alt="image" src="https://github.com/user-attachments/assets/a3bf7bf7-6581-4ac2-956e-0db0dce8e18e" />


A simple Electron application demonstrating a Windows 11 Mica themed window
with a modern file explorer. Users can choose a folder and the choice persists
between runs. The file picker streams directory contents with a progress bar
for faster initial loads and lists files in a flat, icon-backed table where
clicking names toggles selection. Selections display with check icons and
appear in a removable list that scrolls when long. The window features
Win11-style minimize, maximize and close buttons, a fixed "Top Stats AIO" title
bar and a settings cog that opens a full-screen settings view for switching
between dark and light Mica themes. Scrollbars and cards adapt to the theme,
each row shows a
timestamp column, and a date picker can bulk-select files created on or after
the chosen time beside an optional description field and a placeholder Parse
button. The selection time saves only the hh:mm portion and defaults the day to
today on startup. The date/time selection and last folder both persist across
restarts, and an "Unselect All" button clears the current selection.
Subfolders populate on demand when expanded, keeping startup snappy even for
large directory trees. The file picker shows a loading indicator while
directories stream in so the window appears immediately on launch.

## Development

```bash
npm install
npm start
```

## Tests

```bash
npm test
```

## Windows Package

Run `npm run dist` to build Windows artifacts. The script packages a portable
build, zips it, runs `electron-builder` for an installer, and compiles a
standalone uninstaller when NSIS is available. The app icon at
`media/TopStatsAIO-Logo.ico` is applied automatically.

```bash
npm run dist
```

After the command completes, the gitignored `dist` directory contains
versioned files like:

- `TopStatsAIO-1_0_0-standalone.zip` – zipped portable executable
- `TopStatsAIO-1_0_0-setup.exe` – Windows installer
- `TopStatsAIO-1_0_0-uninstaller.exe` – standalone uninstaller (if `makensis`
  is installed)
