import io
import os
import zipfile
import threading
from datetime import datetime
import shutil
import re

import requests
from tkinter import Toplevel, filedialog, messagebox, ttk

from .config import save_config


def download_gw2eicli(parent_window, config, update_callback=None):
    """Download the latest GW2EICLI release from GitHub."""
    progress_dialog = Toplevel(parent_window)
    progress_dialog.title("Downloading GW2EICLI")
    progress_dialog.geometry("400x200")
    progress_dialog.resizable(False, False)
    progress_dialog.transient(parent_window)
    progress_dialog.grab_set()

    selected_theme = config.get("theme", "dark")
    if selected_theme == "dark":
        progress_dialog.configure(bg="#333333")
        label_fg = "#FFFFFF"
    else:
        progress_dialog.configure(bg="#FFFFFF")
        label_fg = "#000000"

    status_label = ttk.Label(progress_dialog, text="Fetching latest release information...", foreground=label_fg)
    status_label.pack(pady=20)

    progress_bar = ttk.Progressbar(progress_dialog, orient="horizontal", length=350, mode="indeterminate")
    progress_bar.pack(pady=10)
    progress_bar.start()

    def download_thread():
        try:
            status_label.config(text="Fetching latest release information...")
            api_url = "https://api.github.com/repos/baaron4/GW2-Elite-Insights-Parser/releases/latest"
            response = requests.get(api_url)
            response.raise_for_status()
            release_data = response.json()

            zip_asset = None
            for asset in release_data.get("assets", []):
                if asset["name"] == "GW2EICLI.zip":
                    zip_asset = asset
                    break

            if not zip_asset:
                progress_dialog.after(0, lambda: messagebox.showerror(
                    "Download Error",
                    "GW2EICLI.zip not found in the latest release",
                    parent=progress_dialog,
                ))
                progress_dialog.after(100, progress_dialog.destroy)
                return

            status_label.config(text="Downloading GW2EICLI.zip...")
            download_url = zip_asset["browser_download_url"]
            response = requests.get(download_url, stream=True)
            response.raise_for_status()

            progress_dialog.after(0, progress_bar.stop)

            def ask_directory():
                nonlocal progress_dialog
                downloads_dir = os.path.join(os.getcwd(), "prerequisites")
                os.makedirs(downloads_dir, exist_ok=True)
                gw2eicli_dir = os.path.join(downloads_dir, "GW2EICLI")
                os.makedirs(gw2eicli_dir, exist_ok=True)
                initial_dir = config.get("elite_insights_path", "") if os.path.exists(config.get("elite_insights_path", "")) else gw2eicli_dir
                use_default = messagebox.askyesno(
                    "Installation Directory",
                    f"Do you want to install GW2EICLI to the default location?\n\n{gw2eicli_dir}",
                    parent=progress_dialog,
                )
                if use_default:
                    install_dir = gw2eicli_dir
                else:
                    install_dir = filedialog.askdirectory(
                        title="Select GW2EICLI Installation Directory",
                        initialdir=initial_dir,
                        parent=progress_dialog,
                    )
                if not install_dir:
                    progress_dialog.destroy()
                    return

                progress_bar.config(mode="determinate", maximum=100, value=0)
                status_label.config(text="Extracting files...")

                try:
                    z = zipfile.ZipFile(io.BytesIO(response.content))
                    total_files = len(z.namelist())
                    os.makedirs(install_dir, exist_ok=True)
                    for i, file in enumerate(z.namelist()):
                        z.extract(file, install_dir)
                        progress = int((i + 1) / total_files * 100)
                        progress_bar.config(value=progress)
                        status_label.config(text=f"Extracting: {progress}% complete")
                        progress_dialog.update()

                    config["elite_insights_path"] = install_dir
                    if "prerequisites" not in config:
                        config["prerequisites"] = {}
                    config["prerequisites"]["GW2EICLI_version"] = release_data.get("tag_name", "unknown")
                    config["prerequisites"]["GW2EICLI_downloaded"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    save_config(config)

                    if update_callback:
                        update_callback("elite_insights_path", install_dir)

                    status_label.config(text="Installation complete!")
                    progress_dialog.after(1000, progress_dialog.destroy)

                    messagebox.showinfo(
                        "Download Complete",
                        f"GW2EICLI has been downloaded and installed to:\n{install_dir}\n\nThe application configuration has been automatically updated to use this path.",
                        parent=parent_window,
                    )
                except Exception as e:
                    messagebox.showerror(
                        "Extraction Error",
                        f"Failed to extract the zip file: {str(e)}",
                        parent=progress_dialog,
                    )
                    progress_dialog.destroy()

            progress_dialog.after(0, ask_directory)
        except Exception as e:
            progress_dialog.after(0, lambda: messagebox.showerror(
                "Download Error",
                f"Failed to download GW2EICLI: {str(e)}",
                parent=progress_dialog,
            ))
            progress_dialog.after(100, progress_dialog.destroy)

    threading.Thread(target=download_thread, daemon=True).start()


def download_gw2_ei_log_combiner(parent_window, config, update_callback=None):
    """Download the latest GW2 EI Log Combiner release from GitHub."""
    progress_dialog = Toplevel(parent_window)
    progress_dialog.title("Downloading GW2 EI Log Combiner")
    progress_dialog.geometry("400x200")
    progress_dialog.resizable(False, False)
    progress_dialog.transient(parent_window)
    progress_dialog.grab_set()

    selected_theme = config.get("theme", "dark")
    if selected_theme == "dark":
        progress_dialog.configure(bg="#333333")
        label_fg = "#FFFFFF"
    else:
        progress_dialog.configure(bg="#FFFFFF")
        label_fg = "#000000"

    status_label = ttk.Label(progress_dialog, text="Fetching latest release information...", foreground=label_fg)
    status_label.pack(pady=20)

    progress_bar = ttk.Progressbar(progress_dialog, orient="horizontal", length=350, mode="indeterminate")
    progress_bar.pack(pady=10)
    progress_bar.start()

    def download_thread():
        try:
            status_label.config(text="Fetching latest release information...")
            api_url = "https://api.github.com/repos/Drevarr/GW2_EI_log_combiner/releases"
            response = requests.get(api_url)
            response.raise_for_status()
            all_releases = response.json()
            if not all_releases:
                progress_dialog.after(0, lambda: messagebox.showerror(
                    "Download Error",
                    "No releases found for GW2_EI_log_combiner",
                    parent=progress_dialog,
                ))
                progress_dialog.after(100, progress_dialog.destroy)
                return

            release_data = None
            zip_asset = None
            for release in all_releases:
                for asset in release.get("assets", []):
                    if asset["name"].endswith(".zip"):
                        release_data = release
                        zip_asset = asset
                        break
                if zip_asset:
                    break

            if not zip_asset:
                progress_dialog.after(0, lambda: messagebox.showerror(
                    "Download Error",
                    "No zip file found in any available releases",
                    parent=progress_dialog,
                ))
                progress_dialog.after(100, progress_dialog.destroy)
                return

            release_type = "pre-release" if release_data.get("prerelease", False) else "release"
            status_label.config(text=f"Found latest {release_type}: {release_data.get('tag_name', 'unknown')}")

            status_label.config(text=f"Downloading {zip_asset['name']}...")
            download_url = zip_asset["browser_download_url"]
            response = requests.get(download_url, stream=True)
            response.raise_for_status()

            progress_dialog.after(0, progress_bar.stop)

            def ask_directory():
                nonlocal progress_dialog
                downloads_dir = os.path.join(os.getcwd(), "prerequisites")
                os.makedirs(downloads_dir, exist_ok=True)
                combiner_dir = os.path.join(downloads_dir, "GW2_EI_log_combiner")
                os.makedirs(combiner_dir, exist_ok=True)
                initial_dir = config.get("top_stats_path", "") if os.path.exists(config.get("top_stats_path", "")) else combiner_dir
                use_default = messagebox.askyesno(
                    "Installation Directory",
                    f"Do you want to install GW2 EI Log Combiner to the default location?\n\n{combiner_dir}",
                    parent=progress_dialog,
                )
                if use_default:
                    install_dir = combiner_dir
                else:
                    install_dir = filedialog.askdirectory(
                        title="Select GW2 EI Log Combiner Installation Directory",
                        initialdir=initial_dir,
                        parent=progress_dialog,
                    )
                if not install_dir:
                    progress_dialog.destroy()
                    return

                progress_bar.config(mode="determinate", maximum=100, value=0)
                status_label.config(text="Extracting files...")

                try:
                    z = zipfile.ZipFile(io.BytesIO(response.content))
                    total_files = len(z.namelist())
                    os.makedirs(install_dir, exist_ok=True)
                    for i, file in enumerate(z.namelist()):
                        z.extract(file, install_dir)
                        progress = int((i + 1) / total_files * 100)
                        progress_bar.config(value=progress)
                        status_label.config(text=f"Extracting: {progress}% complete")
                        progress_dialog.update()

                    config["top_stats_path"] = install_dir
                    if "prerequisites" not in config:
                        config["prerequisites"] = {}
                    config["prerequisites"]["GW2_EI_log_combiner_version"] = release_data.get("tag_name", "unknown")
                    config["prerequisites"]["GW2_EI_log_combiner_downloaded"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    save_config(config)

                    if update_callback:
                        update_callback("top_stats_path", install_dir)

                    status_label.config(text="Installation complete!")
                    progress_dialog.after(1000, progress_dialog.destroy)

                    version = release_data.get("tag_name", "unknown")
                    messagebox.showinfo(
                        "Download Complete",
                        f"GW2 EI Log Combiner ({release_type} {version}) has been downloaded and installed to:\n{install_dir}\n\nThe application configuration has been automatically updated to use this path.",
                        parent=parent_window,
                    )
                except Exception as e:
                    messagebox.showerror(
                        "Extraction Error",
                        f"Failed to extract the zip file: {str(e)}",
                        parent=progress_dialog,
                    )
                    progress_dialog.destroy()

            progress_dialog.after(0, ask_directory)
        except Exception as e:
            progress_dialog.after(0, lambda: messagebox.showerror(
                "Download Error",
                f"Failed to download GW2 EI Log Combiner: {str(e)}",
                parent=progress_dialog,
            ))
            progress_dialog.after(100, progress_dialog.destroy)

    threading.Thread(target=download_thread, daemon=True).start()


def get_release_version():
    """Fetch the release version from a local file."""
    version_file = os.path.join(os.getcwd(), "version.txt")
    if os.path.exists(version_file):
        try:
            with open(version_file, "r") as f:
                return f.read().strip()
        except Exception:
            pass
    return "Unknown Version"


def fetch_latest_gw2eicli_version():
    """Return the tag name of the latest GW2EICLI release."""
    api_url = "https://api.github.com/repos/baaron4/GW2-Elite-Insights-Parser/releases/latest"
    response = requests.get(api_url, timeout=10)
    response.raise_for_status()
    return response.json().get("tag_name")


def fetch_latest_gw2_ei_log_combiner_version():
    """Return the tag name of the newest GW2 EI Log Combiner release (including prereleases)."""
    api_url = "https://api.github.com/repos/Drevarr/GW2_EI_log_combiner/releases"
    response = requests.get(api_url, timeout=10)
    response.raise_for_status()
    releases = response.json()
    for release in releases:
        for asset in release.get("assets", []):
            if asset.get("name", "").endswith(".zip"):
                return release.get("tag_name")
    return None


def _parse_version(v):
    """Parse a version string into a comparable tuple of integers."""
    parts = re.findall(r"\d+", v.lstrip("v"))
    return tuple(int(part) for part in parts)


def check_for_app_update():
    """Automatically update the app if a newer GitHub release exists."""
    import sys
    import tempfile

    try:
        if os.path.isdir(os.path.join(os.getcwd(), ".git")):
            return

        current_version = get_release_version()
        api_url = "https://api.github.com/repos/darkharasho/TopStatsAIO/releases/latest"
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()
        release_data = response.json()
        latest_version = release_data.get("tag_name")
        if not latest_version or _parse_version(latest_version) <= _parse_version(current_version):
            return

        download_url = None
        for asset in release_data.get("assets", []):
            name = asset.get("name", "")
            if name.endswith(".zip"):
                download_url = asset["browser_download_url"]
                break
        if not download_url:
            download_url = release_data.get("zipball_url")
        if not download_url:
            raise RuntimeError("No downloadable asset found for the latest release")

        response = requests.get(download_url, timeout=10)
        response.raise_for_status()

        temp_dir = tempfile.mkdtemp()
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            z.extractall(temp_dir)

        contents = os.listdir(temp_dir)
        if len(contents) == 1 and os.path.isdir(os.path.join(temp_dir, contents[0])):
            extract_root = os.path.join(temp_dir, contents[0])
        else:
            extract_root = temp_dir

        for item in os.listdir(extract_root):
            src_path = os.path.join(extract_root, item)
            dest_path = os.path.join(os.getcwd(), item)
            if os.path.isdir(src_path):
                shutil.copytree(src_path, dest_path, dirs_exist_ok=True)
            else:
                shutil.copy2(src_path, dest_path)

        python = sys.executable
        os.execl(python, python, *sys.argv)
    except Exception:
        pass
