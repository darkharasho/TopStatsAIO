import os
import tkinter as tk
from tkinter import ttk, filedialog, Toplevel, messagebox

from .downloaders import download_gw2eicli, download_gw2_ei_log_combiner
from .config import save_config, get_default_time, apply_theme
from .window_utils import set_native_title_bar_theme

config_window_instance = None
elite_entry = None
top_stats_entry = None
old_top_stats_entry = None


def browse_folder(entry_widget):
    """Open a folder dialog and set the selected path in the entry widget."""
    current_path = entry_widget.get()
    initial_dir = current_path if os.path.exists(current_path) else ""
    folder = filedialog.askdirectory(title="Select Folder", initialdir=initial_dir)
    if folder:
        entry_widget.delete(0, tk.END)
        entry_widget.insert(0, folder)
    if config_window_instance:
        config_window_instance.lift()


def update_config_window_entries(field_name, value):
    """Update entry fields in the config window if it's open."""
    global config_window_instance, elite_entry, top_stats_entry, old_top_stats_entry
    if not config_window_instance or not tk.Toplevel.winfo_exists(config_window_instance):
        return
    if field_name == "elite_insights_path":
        config_window_instance.after(0, lambda: _update_entry_directly(elite_entry, value))
    elif field_name == "top_stats_path":
        config_window_instance.after(0, lambda: _update_entry_directly(top_stats_entry, value))
    elif field_name == "old_top_stats_path":
        config_window_instance.after(0, lambda: _update_entry_directly(old_top_stats_entry, value))


def _update_entry_directly(entry_widget, value):
    try:
        if entry_widget and isinstance(entry_widget, ttk.Entry):
            entry_widget.delete(0, tk.END)
            entry_widget.insert(0, value)
            entry_widget.focus_set()
            entry_widget.master.focus_set()
    except Exception:
        pass


def open_config_window(root, config, date_entry):
    """Open the configuration popup window."""
    global config_window_instance, elite_entry, top_stats_entry, old_top_stats_entry

    if config_window_instance and tk.Toplevel.winfo_exists(config_window_instance):
        config_window_instance.lift()
        return

    config_window_instance = Toplevel(root)
    config_window_instance.title("Configuration")
    config_window_instance.geometry("950x800")
    config_window_instance.resizable(False, False)

    selected_theme = config.get("theme", "dark")
    if selected_theme == "dark":
        config_window_instance.configure(bg="#333333")
    else:
        config_window_instance.configure(bg="#FFFFFF")

    config_window_instance.grid_rowconfigure(0, weight=1)
    config_window_instance.grid_columnconfigure(0, weight=1)

    content_frame = ttk.Frame(config_window_instance, padding=10)
    content_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)

    left_column = ttk.Frame(content_frame)
    left_column.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
    right_column = ttk.Frame(content_frame)
    right_column.grid(row=0, column=1, sticky="nsew")

    content_frame.columnconfigure(0, weight=6)
    content_frame.columnconfigure(1, weight=1)

    download_frame = ttk.LabelFrame(left_column, text="Download Prerequisites", padding=10)
    download_frame.pack(fill="x", pady=10)
    ttk.Button(
        download_frame,
        text="Download Latest GW2EICLI",
        command=lambda: download_gw2eicli(config_window_instance, config, update_config_window_entries),
    ).pack(fill="x", pady=5)
    ttk.Button(
        download_frame,
        text="Download Latest GW2 EI Log Combiner",
        command=lambda: download_gw2_ei_log_combiner(config_window_instance, config, update_config_window_entries),
    ).pack(fill="x", pady=5)

    folder_selector_frame = ttk.LabelFrame(left_column, text="Set Paths", padding=10)
    folder_selector_frame.pack(fill="x", pady=10)

    elite_frame = ttk.Frame(folder_selector_frame)
    elite_frame.pack(fill="x", pady=5)
    ttk.Button(elite_frame, text="Set Elite Insights Folder", command=lambda: browse_folder(elite_entry)).pack(side="left", padx=5)
    elite_entry = ttk.Entry(elite_frame, width=50)
    elite_entry.insert(0, config.get("elite_insights_path", ""))
    elite_entry.pack(side="left", padx=10)

    top_stats_frame = ttk.Frame(folder_selector_frame)
    top_stats_frame.pack(fill="x", pady=5)
    ttk.Button(top_stats_frame, text="Set Top Stats Parser Folder", command=lambda: browse_folder(top_stats_entry)).pack(side="left", padx=5)
    top_stats_entry = ttk.Entry(top_stats_frame, width=50)
    top_stats_entry.insert(0, config.get("top_stats_path", ""))
    top_stats_entry.pack(side="left", padx=10)

    old_top_stats_frame = ttk.Frame(folder_selector_frame)
    old_top_stats_frame.pack(fill="x", pady=5)
    ttk.Button(old_top_stats_frame, text="Set (OLD) Top Stats Parser Folder", command=lambda: browse_folder(old_top_stats_entry)).pack(side="left", padx=5)
    old_top_stats_entry = ttk.Entry(old_top_stats_frame, width=50)
    old_top_stats_entry.insert(0, config.get("old_top_stats_path", ""))
    old_top_stats_entry.pack(side="left", padx=10)

    config_frame = ttk.LabelFrame(left_column, text="Set Optional Configuration", padding=10)
    config_frame.pack(fill="x", pady=10)

    token_frame = ttk.Frame(config_frame)
    token_frame.pack(fill="x", pady=5)
    ttk.Label(token_frame, text="DPSReportUserToken:").pack(side="left", padx=5)
    token_entry = ttk.Entry(token_frame, width=50)
    token_entry.insert(0, config.get("DPSReportUserToken", ""))
    token_entry.pack(side="left", padx=10)

    time_frame = ttk.Frame(config_frame)
    time_frame.pack(fill="x", pady=5)
    ttk.Label(time_frame, text="Default Hour (0-23):").pack(side="left", padx=5)
    hour_entry = ttk.Entry(time_frame, width=5)
    hour_entry.insert(0, config.get("default_hour", 12))
    hour_entry.pack(side="left", padx=5)
    ttk.Label(time_frame, text="Default Minute (0-59):").pack(side="left", padx=5)
    minute_entry = ttk.Entry(time_frame, width=5)
    minute_entry.insert(0, config.get("default_minute", 0))
    minute_entry.pack(side="left", padx=5)

    guild_frame = ttk.LabelFrame(left_column, text="GW2 EI Log Combiner", padding=10)
    guild_frame.pack(fill="x", pady=10)
    ttk.Label(guild_frame, text="Guild Name:").grid(row=0, column=0, sticky="w", padx=5, pady=2)
    guild_name_entry = ttk.Entry(guild_frame, width=40)
    guild_name_entry.insert(0, config.get("guild_name", ""))
    guild_name_entry.grid(row=0, column=1, padx=5, pady=2)
    ttk.Label(guild_frame, text="Guild ID:").grid(row=1, column=0, sticky="w", padx=5, pady=2)
    guild_id_entry = ttk.Entry(guild_frame, width=40)
    guild_id_entry.insert(0, config.get("guild_id", ""))
    guild_id_entry.grid(row=1, column=1, padx=5, pady=2)
    ttk.Label(guild_frame, text="API Key:").grid(row=2, column=0, sticky="w", padx=5, pady=2)
    api_key_entry = ttk.Entry(guild_frame, width=40)
    api_key_entry.insert(0, config.get("api_key", ""))
    api_key_entry.grid(row=2, column=1, padx=5, pady=2)
    glicko_var = tk.BooleanVar(value=config.get("db_update", False))
    ttk.Checkbutton(guild_frame, text="Enable Glicko DB Update", variable=glicko_var).grid(row=3, column=0, columnspan=2, sticky="w", padx=5, pady=2)

    parser_selection_frame = ttk.LabelFrame(right_column, text="Parser Selection", padding=10)
    parser_selection_frame.pack(fill="x", pady=10)
    parser_selection = tk.StringVar(value=config.get("parser_selection", "GW2_EI_log_combiner"))
    ttk.Radiobutton(parser_selection_frame, text="arcdps_top_stats_parser", variable=parser_selection, value="arcdps_top_stats_parser").pack(anchor="w", padx=5)
    ttk.Radiobutton(parser_selection_frame, text="GW2_EI_log_combiner", variable=parser_selection, value="GW2_EI_log_combiner").pack(anchor="w", padx=5)

    theme_frame = ttk.LabelFrame(right_column, text="Theme Selection", padding=10)
    theme_frame.pack(fill="x", pady=10)
    theme_selection = tk.StringVar(value=config.get("theme", "dark"))
    ttk.Radiobutton(theme_frame, text="Dark Theme", variable=theme_selection, value="dark").pack(anchor="w", padx=5)
    ttk.Radiobutton(theme_frame, text="Light Theme", variable=theme_selection, value="light").pack(anchor="w", padx=5)

    save_frame = ttk.Frame(config_window_instance)
    save_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=10)

    def save_and_close_config():
        elite_path = elite_entry.get()
        top_stats_path = top_stats_entry.get()
        old_top_stats_path = old_top_stats_entry.get()
        token = token_entry.get()
        try:
            hour = int(hour_entry.get())
            if hour < 0 or hour > 23:
                raise ValueError
        except ValueError:
            messagebox.showerror("Invalid Hour", "Please enter a valid hour (0-23).")
            return
        try:
            minute = int(minute_entry.get())
            if minute < 0 or minute > 59:
                raise ValueError
        except ValueError:
            messagebox.showerror("Invalid Minute", "Please enter a valid minute (0-59).")
            return
        config["elite_insights_path"] = elite_path
        config["top_stats_path"] = top_stats_path
        config["old_top_stats_path"] = old_top_stats_path
        config["DPSReportUserToken"] = token
        config["default_hour"] = hour
        config["default_minute"] = minute
        config["parser_selection"] = parser_selection.get()
        config["theme"] = theme_selection.get()
        config["guild_name"] = guild_name_entry.get()
        config["guild_id"] = guild_id_entry.get()
        config["api_key"] = api_key_entry.get()
        config["db_update"] = glicko_var.get()
        save_config(config)
        new_default_time = get_default_time(config)
        date_entry.delete(0, tk.END)
        date_entry.insert(0, new_default_time)
        apply_theme(root, config)
        set_native_title_bar_theme(root, config["theme"])
        config_window_instance.destroy()

    ttk.Button(
        save_frame,
        text="Save",
        command=save_and_close_config,
    ).pack(side="right")
