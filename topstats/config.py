import os
import json
from datetime import datetime
from tkinter import messagebox, ttk

import sv_ttk

CONFIG_FILE = "config.json"


def load_config():
    """Load configuration from disk or return defaults."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "last_path": "",
        "elite_insights_path": "",
        "top_stats_path": "",
        "default_time": "",
        "default_hour": 12,
        "default_minute": 0,
        "theme": "dark",
    }


def save_config(config):
    """Persist configuration to disk."""
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)


def get_default_time(config):
    """Calculate the default time based on stored hour/minute."""
    today = datetime.now()
    default_hour = config.get("default_hour", 12)
    default_minute = config.get("default_minute", 0)
    return today.replace(
        hour=default_hour, minute=default_minute, second=0, microsecond=0
    ).strftime("%Y-%m-%d %H:%M")


def apply_theme(root, config):
    """Apply the selected theme to the given root window."""
    selected_theme = config.get("theme", "dark")
    # Explicitly bind the theme to the provided window to avoid default-root issues
    sv_ttk.set_theme(selected_theme, root)

    # Ensure the theme background is applied to the window
    root.update_idletasks()
    bg = root.tk.call("ttk::style", "lookup", ".", "-background")
    root.configure(bg=bg)


def validate_config(config):
    """Validate required configuration fields."""
    missing_fields = []

    if not config.get("elite_insights_path"):
        missing_fields.append("Elite Insights Path")
    elif not os.path.exists(config["elite_insights_path"]):
        missing_fields.append("Elite Insights Path (Invalid Path)")

    if not config.get("top_stats_path"):
        missing_fields.append("Top Stats Parser Path")
    elif not os.path.exists(config["top_stats_path"]):
        missing_fields.append("Top Stats Parser Path (Invalid Path)")

    if missing_fields:
        messagebox.showerror(
            "Configuration Error",
            "The following configuration fields are missing or invalid:\n\n- "
            + "\n- ".join(missing_fields),
        )
        return False

    return True
