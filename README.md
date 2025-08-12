![top-stats-aio-banner](https://github.com/user-attachments/assets/d413569d-ecb1-4618-936e-5f6fa071ba0c)

Your one stop shop for generating top stats. This program uses both Elite Insights Parser as well as the GW2 EI Log combiner to create a joined aggregate of multiple WvW fight logs. This is helpful for being able to see a holistic picture of your squad's performance. Internally the codebase has been refactored into a modular `topstats` package that separates configuration, aggregation, downloads and the UI. **AS WITH ALL ANALYTICS, PLEASE TAKE STATS AS A TOOL AND NOT AN ABSOLUTE AUTHORITY** There are always varying circumstances to a player's performance, you should never take any analytics entirely at face value.
[An example of a summary can be found here](https://wvwlogs.com/#202503052206-Log-Summary)
![image](https://github.com/user-attachments/assets/d5482ea4-7de8-4d78-90f0-88e11e6b2223)

The primary directive of this application is to increase the user friendliness of these tools. Key features:
- Ability to easily select which logs you want to aggregate
- Ability to set a static raid time and grab logs older than a start time
- Automatically configures and uses both EliteInsightsParser and GW2EILogCombiner to generate the final `.json` to be used with TiddlyWiki
- Built-in downloader to automatically fetch the latest versions of required prerequisites
- Persistent settings saved to `config.json` (paths, tokens, theme, default time)
- Option to switch between the legacy `arcdps_top_stats_parser` and the newer `GW2_EI_log_combiner`
- Sleek Sun Valley theme with optional Windows 11 Mica/Acrylic effects

## Setup
### 1. Download Prerequisites
You have two options for downloading the required prerequisites:

#### Option A: Download prerequisites automatically through TopStatsAIO
1. Run TopStatsAIO and click the "Config" button
2. In the configuration window, use the "Download Prerequisites" section to automatically download:
   - GW2EICLI (Elite Insights Parser) - downloads and extracts the latest release
   - GW2 EI Log Combiner - downloads and extracts the latest prerelease
3. By default, prerequisites are downloaded to a "prerequisites" folder in the application directory:
   - Prerequisites/GW2EICLI - for the Elite Insights Parser
   - Prerequisites/GW2_EI_log_combiner - for the GW2 EI Log Combiner
4. You can choose a different location during the download process if preferred

#### Option B: Download prerequisites manually
**Elite Insights Parser:**
https://github.com/baaron4/GW2-Elite-Insights-Parser/releases
1. Download the `GW2EICLI.zip` file
2. Extract the folder somewhere convenient

**GW2 EI Log Combiner:**
https://github.com/Drevarr/GW2_EI_log_combiner/releases
1. Download the `TopStats_v...zip` file
2. Extract the ZIP somewhere convenient
### 2. Download the TopStatsAIO
1. Head to the Releases [TopStatsAIO Releases](https://github.com/darkharasho/TopStatsAIO/releases) and download the latest ZIP
2. Extract the ZIP and put it someplace you don't mind it staying
3. Run the TopStatsAIO.exe file
4. At the top, hit the `Select Folder` button and select the top level folder of your ArcDPS logs (by default its `Documents\Guild Wars 2\addons\arcdps\arcdps.cbtlogs`
![image](https://github.com/user-attachments/assets/b472737f-8723-4d95-bcad-077dbbe24f69)
5. Hit the Config button on the bottom left
![image](https://github.com/user-attachments/assets/d45a4b0f-44f6-4ea1-8ada-0a0d0f3d0e3e)
6. In the config window, set the Elite Insights Parser and GW2 EI Log Combiner values to wherever you saved it in steps 1 & 2

![image](https://github.com/user-attachments/assets/9d56eb2d-f04e-4acd-a5f7-4bea5859dd65)

8. **OPTIONALLY**
   - Configure a `DPSReportUserToken` for authenticated uploads
   - Set a `Default Hour` and `Default Minute` to prefill the raid start time
   - Choose between `GW2_EI_log_combiner` and the legacy `arcdps_top_stats_parser` and supply paths for both
   - Switch between light and dark themes
   - Provide guild name, ID and API key for the combiner and optionally enable Glicko DB updates

    ![image](https://github.com/user-attachments/assets/a84bcfe6-73ce-4ec3-9435-4a261fd1cf5f)

9. Use the file tree on the left to expand folders and select .zetvc
![image](https://github.com/user-attachments/assets/e017b720-d872-49f1-9b79-9b208bdbb148)
10. As you select files, they should appear in the `Selected Files` window
![image](https://github.com/user-attachments/assets/8ae1dac9-d7d1-405d-9fde-c35e4240e2de)
11. After selection, hit the `Generate Aggregate` button at the bottom right of the window
12. Let the process run, once complete you will see a button appear to `Open Folder`
![image](https://github.com/user-attachments/assets/0a6b786b-ab30-4903-9050-b3502fa7e9c9)
13. Drag & Drop that `.json` file into your TiddlyWiki of choice!

## NOTE
This generates the `json`/`tid` files necessary to use with TiddlyWiki. To see the actual results, please follow the steps in the [GW2 EI Log Parser](https://github.com/Drevarr/GW2_EI_log_combiner?tab=readme-ov-file#gw2_ei_log_combiner--):
- Navigate to your `Top Stats Parser` Folder
- Open the file `/Example_Output/Top_Stats_Index.html` in your browser of choice.
- Drag and Drop the file `Drag_and_Drop_Log_Summary_for_2024yourdatatime.json` onto the opened `Top_Stats_Index.html` in your browser and click import
- Open the 1. imported file link to view the summary

## Local Dev
### Compile EXE
To compile the Python script into an executable (`.exe`), follow these steps:

1. **Install PyInstaller**
Open a terminal or command prompt and install PyInstaller using `pip`:
```bash
pip install pyinstaller
```
2. **Compile the Script**
Use the included helper script or run the command manually:

```bash
# preferred: runs the PyInstaller build
python build_exe.py

# equivalent manual invocation
pyinstaller --onefile --noconsole --name TopStatsAIO --distpath . --add-data "config.json;." --add-data "themes;themes" --icon "top-stats-aio.ico" main.py
```
### Running locally
1. Clone the repository
2. Navigate to it in a terminal
3. Install dependencies
   - `pip install sv-ttk pywinstyles` (pywinstyles requires Windows)
4. Run `python main.py` (thin entry script that imports the package)
   - or run `python -m topstats.app`

## Recognition
Thank you to the GW2 Analytics communinty and Drevarr specifically for helping create this. Shout out to my PAN friends for the excitement and eagerness to help test. Thank you Aza for inspiring me to finally write this UI! Huge thanks to Paralda for informing me of the latest and greatest

<img src="https://github.com/user-attachments/assets/81650120-8d69-4259-90b0-f84ba5a8d986" width=350>

