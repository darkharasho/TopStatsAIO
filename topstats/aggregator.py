import os
import shutil
import tempfile
import subprocess
import threading
import tkinter as tk
from tkinter import Toplevel, ttk, messagebox

from .config import validate_config


def generate_aggregate(root, config, checked_items):
    if not validate_config(config):
        return
    if not checked_items:
        messagebox.showerror("No Files Selected", "Please select at least one file to generate the aggregate.")
        return

    temp_dir = tempfile.mkdtemp()
    progress_popup = Toplevel(root)
    progress_popup.title("Processing Files")
    progress_popup.geometry("600x450")
    progress_popup.resizable(False, False)

    # Set the custom icon for the popup window
    icon_path = os.path.join(os.getcwd(), "top-stats-aio.ico")
    if os.path.exists(icon_path):
        try:
            progress_popup.iconbitmap(icon_path)
        except Exception as e:
            print(f"Could not load icon for popup: {e}")

    # Set the title bar theme to match the config
    from .window_utils import set_native_title_bar_theme  # Import at the top if not already
    selected_theme = config.get("theme", "dark")
    set_native_title_bar_theme(progress_popup, selected_theme)

    terminal_frame = ttk.Frame(progress_popup, padding=10)
    terminal_frame.pack(fill="both", expand=True)
    terminal_output = tk.Text(
        terminal_frame,
        height=20,
        width=80,
        state="disabled",
        bg="#3a3a3a",
        fg="#ffffff",
        font=("Courier", 10),
        borderwidth=0,
    )
    terminal_output.pack(fill="both", expand=True)

    def update_terminal_output(message):
        terminal_output.config(state="normal")
        terminal_output.insert(tk.END, message + "\n")
        terminal_output.see(tk.END)
        terminal_output.config(state="disabled")

    # Bind styles to the progress popup so global themes remain untouched
    style = ttk.Style(progress_popup)
    style.configure(
        "AggAccent.TButton",
        background="#28a745",
        foreground="white",
        font=("Arial", 10, "bold"),
    )
    style.configure("Agg.TButton", font=("Arial", 10))
    style.map(
        "Agg.TButton",
        background=[("disabled", "#6c757d")],
        foreground=[("disabled", "#ffffff")],
    )

    button_frame = ttk.Frame(progress_popup, padding=10)
    button_frame.pack(side="bottom", fill="x")

    generated_agg_folder = os.path.join(os.getcwd(), "GeneratedAgg")

    def open_folder(path):
        if os.name == "nt":
            os.startfile(path)
        else:
            try:
                subprocess.run(["xdg-open", path])
            except Exception as e:
                update_terminal_output(f"Error opening folder: {e}")

    open_folder_button = ttk.Button(
        button_frame,
        text="Open Folder",
        state="disabled",
        style="Agg.TButton",
        command=lambda: open_folder(generated_agg_folder),
    )
    open_folder_button.pack(pady=5)

    def enable_open_folder_button():
        open_folder_button.config(state="normal", text="Open Folder", style="AggAccent.TButton")

    def disable_open_folder_button():
        open_folder_button.config(state="disabled", text="Processing...", style="Agg.TButton")

    def process_files():
        try:
            disable_open_folder_button()
            total_files = len(checked_items)
            update_terminal_output(f"Copying {total_files} selected files to temporary folder...")
            for i, full_path in enumerate(checked_items.keys(), start=1):
                try:
                    shutil.copy(full_path, temp_dir)
                    progress = int((i / total_files) * 50)
                    progress_bar = "[" + "#" * progress + "-" * (50 - progress) + "]"
                    update_terminal_output(f"{progress_bar} {i}/{total_files} - Copied: {os.path.basename(full_path)}")
                except Exception as e:
                    update_terminal_output(f"Error copying file {full_path}: {e}")
            update_terminal_output("\n" + "-" * 50 + "\n")
            parser_selection = config.get("parser_selection", "GW2_EI_log_combiner")
            if parser_selection == "GW2_EI_log_combiner":
                process_with_gw2_ei_log_combiner(config, temp_dir, update_terminal_output, enable_open_folder_button)
            elif parser_selection == "arcdps_top_stats_parser":
                process_with_arcdps_top_stats_parser(config, temp_dir, update_terminal_output, enable_open_folder_button)
            else:
                update_terminal_output(f"Unknown parser selection: {parser_selection}")
        except Exception as e:
            update_terminal_output(f"Unexpected error: {e}")

    threading.Thread(target=process_files).start()
    progress_popup.update_idletasks()
    progress_popup.geometry(f"{progress_popup.winfo_width()}x{progress_popup.winfo_height()}")


def process_with_arcdps_top_stats_parser(config, temp_dir, update_terminal_output, enable_open_folder_button):
    try:
        top_stats_folder = config.get("old_top_stats_path", "")
        ei_folder = config.get("elite_insights_path", "")
        target_folder = temp_dir

        if not os.path.exists(top_stats_folder):
            update_terminal_output(f"Error: (OLD) Top Stats Parser folder not found: {top_stats_folder}")
            return
        if not os.path.exists(ei_folder):
            update_terminal_output(f"Error: Elite Insights folder not found: {ei_folder}")
            return

        if os.name != "nt":
            bash_command = f'wine cmd /c "{top_stats_folder}\\\\TW5_parsing_arc_top_stats.bat" "{target_folder}" "{ei_folder}" "{top_stats_folder}"'
        else:
            bash_command = f'"{top_stats_folder}\\\\TW5_parsing_arc_top_stats.bat" "{target_folder}" "{ei_folder}" "{top_stats_folder}"'
        update_terminal_output(f"Running command: {bash_command}")

        kwargs = {
            "shell": True,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
        }
        if os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
            kwargs["text"] = True
        else:
            kwargs["text"] = False

        result = subprocess.run(bash_command, **kwargs)
        if kwargs["text"]:
            if result.stdout:
                update_terminal_output(result.stdout.strip())
            if result.stderr:
                update_terminal_output(f"Error: {result.stderr.strip()}")
        else:
            try:
                if result.stdout:
                    stdout_text = result.stdout.decode("utf-8", errors="replace").strip()
                    update_terminal_output(stdout_text)
                if result.stderr:
                    stderr_text = result.stderr.decode("utf-8", errors="replace").strip()
                    update_terminal_output(f"Error: {stderr_text}")
            except Exception as e:
                update_terminal_output(f"Warning: Output encoding issue: {str(e)}")
        if result.returncode != 0:
            update_terminal_output(f"Batch command failed with return code {result.returncode}")
            return

        # Ensure the GeneratedAgg folder exists and is cleared
        generated_agg_folder = os.path.join(os.getcwd(), "GeneratedAgg")
        os.makedirs(generated_agg_folder, exist_ok=True)

        # Clear the GeneratedAgg folder
        for file in os.listdir(generated_agg_folder):
            file_path = os.path.join(generated_agg_folder, file)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)  # Remove the file or symlink
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)  # Remove the directory
            except Exception as e:
                update_terminal_output(f"Error clearing file {file_path}: {e}")

        # Move all .tid files to the GeneratedAgg folder
        for file in os.listdir(temp_dir):
            if file.lower().endswith(".tid"):
                source_path = os.path.join(temp_dir, file)
                destination_path = os.path.join(generated_agg_folder, file)
                shutil.move(source_path, destination_path)
                update_terminal_output(f"Moved .tid file: {file} -> {destination_path}")

        # Notify the user and enable the "Open Folder" button
        update_terminal_output("\n**Process completed successfully!**")
        enable_open_folder_button()
    except Exception as e:
        update_terminal_output(f"Error processing with arcdps_top_stats_parser: {e}")


def process_with_gw2_ei_log_combiner(config, temp_dir, update_terminal_output, enable_open_folder_button):
    processing_complete = threading.Event()  # Event to signal when processing is complete

    def process_zevtc_files():
        try:
            # # Copy files with progress
            # total_files = len(checked_items)
            # update_terminal_output(f"Copying {total_files} selected files to temporary folder...")
            # for i, full_path in enumerate(checked_items.keys(), start=1):
            #     try:
            #         shutil.copy(full_path, temp_dir)
            #         progress = int((i / total_files) * 50)  # ASCII progress bar length
            #         progress_bar = "[" + "#" * progress + "-" * (50 - progress) + "]"
            #         update_terminal_output(f"{progress_bar} {i}/{total_files} - Copied: {os.path.basename(full_path)}")
            #     except Exception as e:
            #         update_terminal_output(f"Error copying file {full_path}: {e}")

            # # Add a separator after copying files
            # update_terminal_output("\n" + "-" * 50 + "\n")

            # Locate the Elite Insights executable
            ei_exec = None
            elite_insights_path = config.get("elite_insights_path", "")
            if os.path.exists(os.path.join(elite_insights_path, "GuildWars2EliteInsights.exe")):
                ei_exec = os.path.join(elite_insights_path, "GuildWars2EliteInsights.exe")
            elif os.path.exists(os.path.join(elite_insights_path, "GuildWars2EliteInsights-CLI.exe")):
                ei_exec = os.path.join(elite_insights_path, "GuildWars2EliteInsights-CLI.exe")
            else:
                update_terminal_output("No valid Guild Wars 2 Elite Insights executable found.")
                processing_complete.set()  # Signal completion
                return

            # Use the configuration template from the root of the project directory
            template_conf_file = os.path.join(os.getcwd(), "EliteInsightsConfigTemplate.conf")
            edited_conf_file = os.path.join(temp_dir, "EliteInsightConfig.conf")

            if not os.path.exists(template_conf_file):
                update_terminal_output(f"Configuration template file not found: {template_conf_file}")
                processing_complete.set()  # Signal completion
                return

            # Edit the .conf file to set OutLocation to the temporary folder
            edit_conf_file(template_conf_file, edited_conf_file, temp_dir, config)

            # Handle the top_stats_config.ini file
            gw2_ei_log_combiner_config = os.path.join(os.getcwd(), "top_stats_config.ini")
            edited_gw2_ei_log_combiner_config = os.path.join(temp_dir, "top_stats_config.ini")

            if not os.path.exists(gw2_ei_log_combiner_config):
                update_terminal_output(f"Error: Configuration template file not found: {gw2_ei_log_combiner_config}")
                return
            # Edit the top_stats_config.ini file
            try:
                edit_top_stats_config(
                    gw2_ei_log_combiner_config,
                    edited_gw2_ei_log_combiner_config,
                    config.get("guild_name", ""),
                    config.get("guild_id", ""),
                    config.get("api_key", ""),
                    config.get("db_update", False)
                )
                update_terminal_output("Edited top_stats_config.ini with the provided settings.")
            except Exception as e:
                update_terminal_output(f"Error editing top_stats_config.ini: {e}")
                return

            # Process .zevtc files using Elite Insights
            try:
                update_terminal_output("Processing .zevtc files with Elite Insights...")
                zevtc_files = [file for file in os.listdir(temp_dir) if file.lower().endswith(".zevtc")]
                for i, file in enumerate(zevtc_files, start=1):
                    file_path = os.path.join(temp_dir, file)
                    # Check if we're running on Linux and need to use Wine
                    if os.name != 'nt' and ei_exec.lower().endswith('.exe'):
                        command = ["wine", ei_exec, "-c", edited_conf_file, file_path]
                    else:
                        command = [ei_exec, "-c", edited_conf_file, file_path]
                    update_terminal_output(f"[{i}/{len(zevtc_files)}] Processing: {file}")
                    # Check platform to determine if we should use creationflags
                    kwargs = {
                        'stdout': subprocess.PIPE,
                        'stderr': subprocess.PIPE,
                    }

                    # Only add creationflags on Windows
                    if os.name == 'nt':
                        kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW  # Prevent new terminal window
                        kwargs['text'] = True
                    else:
                        # On Linux running Wine, don't use text=True to avoid encoding errors
                        kwargs['text'] = False

                    result = subprocess.run(command, **kwargs)

                    # Handle output based on whether we're in text or binary mode
                    if kwargs['text']:
                        if result.stdout:
                            update_terminal_output(result.stdout.strip())
                        if result.stderr and result.returncode != 0:
                            update_terminal_output(f"Error: {result.stderr.strip()}")
                    else:
                        # Handle binary output with error handling for encoding issues
                        try:
                            if result.stdout:
                                stdout_text = result.stdout.decode('utf-8', errors='replace').strip()
                                update_terminal_output(stdout_text)
                            if result.stderr and result.returncode != 0:
                                stderr_text = result.stderr.decode('utf-8', errors='replace').strip()
                                update_terminal_output(f"Error: {stderr_text}")
                        except Exception as e:
                            update_terminal_output(f"Warning: Output encoding issue: {str(e)}")

                    if result.returncode != 0:
                        update_terminal_output(f"Error processing file (return code: {result.returncode})")
            except Exception as e:
                update_terminal_output(f"Error processing files with Elite Insights: {e}")
                processing_complete.set()  # Signal completion
                return

            # Add a separator after processing with Elite Insights
            update_terminal_output("\n" + "-" * 50 + "\n")

            # Ensure the ProcessedLogs folder exists
            processed_folder = os.path.join(temp_dir, "ProcessedLogs")
            os.makedirs(processed_folder, exist_ok=True)

            # Ensure the folder is writable
            import stat
            os.chmod(processed_folder, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)

            # Move .json.gz files to the ProcessedLogs folder
            try:
                for file in os.listdir(temp_dir):
                    file_path = os.path.join(temp_dir, file)
                    if os.path.isfile(file_path) and file.lower().endswith(".json.gz"):
                        # Move the .json.gz file to the ProcessedLogs folder
                        destination_path = os.path.join(processed_folder, file)
                        shutil.move(file_path, destination_path)
                        update_terminal_output(f"Moved: {file} -> {destination_path}")
                update_terminal_output(f"All .json.gz files have been moved to: {processed_folder}")
            except Exception as e:
                update_terminal_output(f"Error moving .json.gz files: {e}")
                processing_complete.set()  # Signal completion
                return

            # --- Run GW2 EI Log Combiner on ProcessedLogs ---
            combiner_exe = config.get("top_stats_path", "")
            combiner_exe_path = os.path.join(combiner_exe, "TopStats.exe")
            processed_folder = os.path.join(temp_dir, "ProcessedLogs")
            combiner_config = os.path.join(temp_dir, "top_stats_config.ini")

            if os.path.exists(combiner_exe_path):
                cmd = [combiner_exe_path, "-i", processed_folder, "-c", combiner_config]
                update_terminal_output(f"Running GW2_EI_log_combiner: {' '.join(cmd)}")
                result = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
                if result.stdout:
                    update_terminal_output(result.stdout.strip())
                if result.stderr:
                    update_terminal_output(f"Error: {result.stderr.strip()}")
                if result.returncode != 0:
                    update_terminal_output(f"GW2_EI_log_combiner failed with return code {result.returncode}")
                    processing_complete.set()
                    return
            else:
                update_terminal_output("GW2_EI_log_combiner.exe not found, skipping log combining.")

            # Move the output .json file to the GeneratedAgg folder
            try:
                generated_agg_folder = os.path.join(os.getcwd(), "GeneratedAgg")
                os.makedirs(generated_agg_folder, exist_ok=True)  # Create the folder if it doesn't exist

                # Clear the GeneratedAgg folder
                if os.path.exists(generated_agg_folder):
                    for file in os.listdir(generated_agg_folder):
                        file_path = os.path.join(generated_agg_folder, file)
                        try:
                            if os.path.isfile(file_path) or os.path.islink(file_path):
                                os.unlink(file_path)  # Remove the file or symlink
                            elif os.path.isdir(file_path):
                                shutil.rmtree(file_path)  # Remove the directory
                        except Exception as e:
                            update_terminal_output(f"Error clearing file {file_path}: {e}")

                # Find the .json file in the processed folder
                for file in os.listdir(processed_folder):
                    if file.lower().endswith(".json"):
                        source_path = os.path.join(processed_folder, file)
                        destination_path = os.path.join(generated_agg_folder, file)
                        shutil.move(source_path, destination_path)
                        update_terminal_output(f"Moved output file to: {destination_path}")
                        break
                else:
                    update_terminal_output("No .json output file found in the processed folder.")
                    return  # Exit early if no .json file is found

                # Add a separator after moving .json.gz files
                update_terminal_output("\n" + "-" * 50 + "\n")

                # Move the output .json file to the GeneratedAgg folder
                generated_agg_folder = os.path.join(os.getcwd(), "GeneratedAgg")
                os.makedirs(generated_agg_folder, exist_ok=True)  # Create the folder if it doesn't exist

                # Delete the temporary folder
                try:
                    if os.path.exists(temp_dir):
                        shutil.rmtree(temp_dir)  # Remove the temporary folder
                        update_terminal_output(f"Temporary folder deleted: {temp_dir}")
                    else:
                        update_terminal_output(f"Temporary folder not found: {temp_dir}")
                except Exception as e:
                    update_terminal_output(f"Error deleting temporary folder: {e}")

                # Notify the user and enable the "Open Folder" button after the process is complete
                update_terminal_output("\n**Process completed successfully!**")
                enable_open_folder_button()  # Enable the button

            except Exception as e:
                update_terminal_output(f"Error running TopStats.exe or moving output file: {e}")

            # Signal that processing is complete
            processing_complete.set()
        except Exception as e:
            update_terminal_output(f"Unexpected error: {e}")
            processing_complete.set()
        
        

    # Start the processing in a separate thread
    threading.Thread(target=process_zevtc_files).start()

def edit_conf_file(template_path, output_path, temp_dir, config):
    try:
        with open(template_path, "r") as template_file:
            lines = template_file.readlines()
        with open(output_path, "w") as output_file:
            for line in lines:
                if line.startswith("OutLocation="):
                    output_file.write(f"OutLocation={temp_dir}\n")
                elif line.startswith("DPSReportUserToken="):
                    output_file.write(f"DPSReportUserToken={config.get('DPSReportUserToken', '')}\n")
                else:
                    output_file.write(line)
    except Exception as e:
        print(f"Error editing .conf file: {e}")


def edit_top_stats_config(template_path, output_path, guild_name, guild_id, api_key, db_update):
    """Edit the top_stats_config.ini file with the provided settings."""
    try:
        with open(template_path, "r") as template_file:
            lines = template_file.readlines()

        with open(output_path, "w") as output_file:
            for line in lines:
                if line.startswith("guild_name = "):
                    output_file.write(f"guild_name = {guild_name}\n")
                elif line.startswith("guild_id = "):
                    output_file.write(f"guild_id = {guild_id}\n")
                elif line.startswith("api_key = "):
                    output_file.write(f"api_key = {api_key}\n")
                elif line.startswith("db_update = "):
                    output_file.write(f"db_update = {'true' if db_update else 'false'}\n")
                else:
                    output_file.write(line)
    except Exception as e:
        print(f"Error editing top_stats_config.ini: {e}")
