<img width="3560" height="930" alt="top_stats_aio_banner" src="https://github.com/user-attachments/assets/64a5124f-792d-483d-94a0-e541a10ae457" />

---

Your one stop shop for generating top stats. This program uses both Elite Insights Parser as well as the GW2 EI Log combiner to create a joined aggregate of multiple WvW fight logs. This is helpful for being able to see a holistic picture of your squad's performance. Internally the codebase has been refactored into a modular `topstats` package that separates configuration, aggregation, downloads and the UI. **AS WITH ALL ANALYTICS, PLEASE TAKE STATS AS A TOOL AND NOT AN ABSOLUTE AUTHORITY** There are always varying circumstances to a player's performance, you should never take any analytics entirely at face value.
[An example of a summary can be found here](https://wvwlogs.com/#202503052206-Log-Summary)

---

<img width="1100" height="800" alt="image" src="https://github.com/user-attachments/assets/cec60373-5ae8-4afd-90fe-458016560340" />

<img width="1100" height="800" alt="image" src="https://github.com/user-attachments/assets/38195b55-af42-419d-8b53-51554faa0006" />

<img width="1100" height="800" alt="image" src="https://github.com/user-attachments/assets/a3bf7bf7-6581-4ac2-956e-0db0dce8e18e" />

---

The primary directive of this application is to increase the user friendliness of these tools. Key features:
- Ability to easily select which logs you want to aggregate
- Ability to set a static raid time and grab logs older than a start time
- Automatically configures and uses both EliteInsightsParser and GW2EILogCombiner to generate the final `.json` to be used with TiddlyWiki
- Built-in downloader to automatically fetch the latest versions of required prerequisites
- Option to switch between the legacy `arcdps_top_stats_parser` and the newer `GW2_EI_log_combiner`
- Light and dark themes with customizable accent colors, including a subtle grey option
- Notifies you of new releases after the app loads with a Mica-style prompt and a reminder icon if you postpone

## Setup

### 1. Download the TopStatsAIO
1. Head to the Releases [TopStatsAIO Releases](https://github.com/darkharasho/TopStatsAIO/releases) and download either the installer or the standalone zip
3. Run TopStatsAIO.exe
4. At the top, hit the `Select Folder` button and select the top level folder of your ArcDPS logs (by default its `Documents\Guild Wars 2\addons\arcdps\arcdps.cbtlogs`

### 2. Download Dependencies
1. Run TopStatsAIO and click the Settings cog
2. Click the download button for each of the options


### 3. Optional Settings
   - Configure a `DPSReportUserToken` for authenticated uploads
   - Choose between `GW2_EI_log_combiner` and the legacy `arcdps_top_stats_parser` and supply paths for both
   - Switch between light and dark themes and pick from several accent colors, including a subtle grey
   - Provide guild name, ID and API key for the combiner and optionally enable Glicko DB updates

## How to Use
### Defaults
1. Use the file tree on the left to expand folders and select .zetvc
2. As you select files, they should appear in the `Selected Files` window
3. After selection, hit the `Parse` button at the bottom right of the window
4. Let the process run, once complete you will see a button appear to `Open Folder`
5. Drag & Drop that `.json` file into your TiddlyWiki of choice!
### Options
- You can set a description field at the bottom of the window for that particular parsed log
- There is a date/time picker in the bottom left. It will remember your last selected time. Select a date/time and press `Select Since` to select all logs from all subfolders that are created after that date & time
### IF YOU USE ARCDPS_TOP_STATS_PARSER
This app does not handle downloading the dependencies needed for [arcdps_top_stat_parser](https://github.com/Drevarr/arcdps_top_stats_parser). You will need to install [python](https://www.python.org/downloads/) and run `pip3 install xlrd xlutils xlwt jsons requests xlsxwriter` in order to use the parser. 

## NOTE
This generates the `json`/`tid` files necessary to use with TiddlyWiki. To see the actual results, please follow the steps in the [GW2 EI Log Parser](https://github.com/Drevarr/GW2_EI_log_combiner?tab=readme-ov-file#gw2_ei_log_combiner--):
- Navigate to your `Top Stats Parser` Folder
- Open the file `/Example_Output/Top_Stats_Index.html` in your browser of choice.
- Drag and Drop the file `Drag_and_Drop_Log_Summary_for_2024yourdatatime.json` onto the opened `Top_Stats_Index.html` in your browser and click import
- Open the 1. imported file link to view the summary


## Development

```bash
npm install
npm start
```

To test the update notification in development, launch with the
`--dev-update` flag:

```bash
npm start -- --dev-update
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
