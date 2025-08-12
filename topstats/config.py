import os
import json
from datetime import datetime
from tkinter import messagebox, ttk

from .window_utils import set_native_title_bar_theme

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


def apply_theme(window, config):
    """Apply the selected title bar theme using win32mica.

    Only minimal widget styling is performed so the Mica backdrop
    remains visible through the window background.
    """

    selected_theme = config.get("theme", "dark")

    style = ttk.Style(window)
    try:
        style.theme_use("clam")
    except Exception:
        pass

    if selected_theme == "dark":
        fg = "#FFFFFF"
        button_bg = "#2D2D2D"
        button_active = "#3A3A3A"
        entry_bg = "#1E1E1E"
        tree_bg = "#202020"
        tree_fg = fg
    else:
        fg = "#000000"
        button_bg = "#E0E0E0"
        button_active = "#F5F5F5"
        entry_bg = "#FFFFFF"
        tree_bg = "#FFFFFF"
        tree_fg = fg

    transparent = "systemTransparent"

    style.configure("TFrame", background=transparent)
    style.configure("TLabel", background=transparent, foreground=fg)
    style.configure(
        "TButton",
        background=button_bg,
        foreground=fg,
        borderwidth=1,
    )
    style.map("TButton", background=[("active", button_active)])
    style.configure(
        "TEntry",
        fieldbackground=entry_bg,
        foreground=fg,
        insertcolor=fg,
    )
    style.configure("TCheckbutton", background=transparent, foreground=fg)
    style.configure("TRadiobutton", background=transparent, foreground=fg)

    style.configure(
        "Treeview",
        background=tree_bg,
        fieldbackground=tree_bg,
        foreground=tree_fg,
    )
    style.configure("Treeview.Heading", background=tree_bg, foreground=tree_fg)

    set_native_title_bar_theme(window, selected_theme)


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
