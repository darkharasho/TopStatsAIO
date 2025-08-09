import os
import time
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from datetime import datetime
import shutil
import subprocess
import threading
import ctypes as ct

from .config import load_config, save_config, get_default_time, apply_theme
from .config_ui import open_config_window
from .aggregator import generate_aggregate
from .downloaders import (
    get_release_version,
    fetch_latest_gw2eicli_version,
    fetch_latest_gw2_ei_log_combiner_version,
)
from .window_utils import set_native_title_bar_theme

config = load_config()

prereqs = config.get("prerequisites", {})
try:
    latest_ei_version = fetch_latest_gw2eicli_version()
    ei_update_available = prereqs.get("GW2EICLI_version") != latest_ei_version
except Exception:
    ei_update_available = False

try:
    latest_combiner_version = fetch_latest_gw2_ei_log_combiner_version()
    combiner_update_available = (
        prereqs.get("GW2_EI_log_combiner_version") != latest_combiner_version
    )
except Exception:
    combiner_update_available = False

update_status = {
    "GW2EICLI": ei_update_available,
    "GW2_EI_log_combiner": combiner_update_available,
}

checked_items = {}
root_path = config.get("last_path", "")
last_selected = None

# Choose root folder
def choose_root_folder():
    """Select a folder and populate the file tree."""
    initial_dir = config.get("last_path", "") if os.path.exists(config.get("last_path", "")) else ""
    folder = filedialog.askdirectory(title="Select Root Folder", initialdir=initial_dir)
    if folder:
        # Clear the tree and populate it with the selected folder
        for i in tree.get_children():
            tree.delete(i)
        checked_items.clear()
        populate_tree('', folder)
        config["last_path"] = folder
        save_config(config)
        selected_tree.delete(*selected_tree.get_children())
        global root_path
        root_path = folder
        selected_path_label.config(text=f"Current Folder: {root_path}")

# Choose Elite Insights folder
def choose_elite_insights_path():
    initial_dir = config.get("elite_insights_path", "") if os.path.exists(config.get("elite_insights_path", "")) else ""
    path = filedialog.askdirectory(title="Select Elite Insights Folder", initialdir=initial_dir)
    if path:
        config["elite_insights_path"] = path
        save_config(config)

# Choose Top Stats Parser folder
def choose_top_stats_path():
    initial_dir = config.get("top_stats_path", "") if os.path.exists(config.get("top_stats_path", "")) else ""
    path = filedialog.askdirectory(title="Select Top Stats Parser Folder", initialdir=initial_dir)
    if path:
        config["top_stats_path"] = path
        save_config(config)

# Select all files modified after a certain date
def select_files_after_date():
    try:
        date_str = date_entry.get()
        cutoff = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        for item in tree.get_children(""):
            select_if_modified_after(item, cutoff)
        update_selected_list()
    except ValueError:
        print("Invalid date format. Use YYYY-MM-DD HH:MM")

def select_if_modified_after(item, cutoff):
    tags = tree.item(item, "tags")
    if not tags or tags[0] == "folder":  # Skip folders or items without valid tags
        for child in tree.get_children(item):
            select_if_modified_after(child, cutoff)
        return

    full_path = tags[0]  # Retrieve the full path from the tags

    if full_path and os.path.isfile(full_path) and full_path.lower().endswith(".zevtc"):
        try:
            mod_time = datetime.fromtimestamp(os.path.getmtime(full_path))
            if mod_time > cutoff:
                # Only update if the file is not already selected
                if full_path not in checked_items:
                    checked_items[full_path] = True
                    tree.item(item, text="✅ " + os.path.basename(full_path), tags=(full_path,))  # Update tags
        except Exception as e:
            print(f"Error checking file: {e}")

    # Recursively process child items
    for child in tree.get_children(item):
        select_if_modified_after(child, cutoff)

# Unselect all

def unselect_all():
    for path in list(checked_items.keys()):
        del checked_items[path]
    for item in tree.get_children(""):
        clear_tree_checkboxes(item)
    update_selected_list()

def clear_tree_checkboxes(item):
    values = tree.item(item, "values")
    if values and values[0].lower().endswith(".zevtc"):
        tree.item(item, text=os.path.basename(values[0]))
    for child in tree.get_children(item):
        clear_tree_checkboxes(child)

# Check for Wine on Linux systems
if os.name != 'nt':
    try:
        wine_check = subprocess.run(['which', 'wine'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if wine_check.returncode != 0:
            print("ERROR: Wine is not installed. This application requires Wine to run Windows executables on Linux.")
            print("Please install Wine using your distribution's package manager.")
            print("For example: 'sudo apt install wine' on Ubuntu/Debian or 'sudo dnf install wine' on Fedora")
            exit(1)
    except Exception as e:
        print(f"Error checking for Wine: {e}")
        print("This application requires Wine to run Windows executables on Linux.")
        print("Please install Wine using your distribution's package manager.")
        exit(1)

# App window
root = tk.Tk()
root.title("GW2 arcdps File Selector")
root.configure(bg="#313131")  # Default dark theme background

# Load the Forest theme from the "themes" directory
themes_dir = os.path.join(os.getcwd(), "themes")
forest_dark_path = os.path.join(themes_dir, "forest-dark.tcl")
forest_light_path = os.path.join(themes_dir, "forest-light.tcl")

# Check if the theme files exist
if (os.path.exists(forest_dark_path)):
    root.tk.call("source", forest_dark_path)
if (os.path.exists(forest_light_path)):
    root.tk.call("source", forest_light_path)

apply_theme(root, config)

# Set the application icon
icon_path = os.path.join(os.getcwd(), "top-stats-aio.ico")
if os.path.exists(icon_path):
    try:
        root.iconbitmap(icon_path)
    except Exception as e:
        print(f"Could not load icon: {e}")
        # This error is non-critical, so we'll continue running the app

# Make the window resizable
root.rowconfigure(1, weight=1)  # Allow the main content area to expand
root.columnconfigure(0, weight=1)  # Allow horizontal expansion

# Add "Select Folder" button at the top of the main window
select_folder_frame = ttk.Frame(root, padding=10)
select_folder_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=5)

select_folder_button = ttk.Button(select_folder_frame, text="Select Folder", command=choose_root_folder)
select_folder_button.pack(side="left", padx=5)

selected_path_label = ttk.Label(select_folder_frame, text=f"Current Folder: {config.get('last_path', '')}")
selected_path_label.pack(side="left", padx=10)

# Main layout section
main_frame = ttk.LabelFrame(root, text="File Selection", padding=10)
main_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
main_frame.rowconfigure(0, weight=1)
main_frame.columnconfigure(0, weight=1)
# Set a default starting size for the main window
root.geometry("1200x900")  # Width x Height

# Allow the window to be resizable
root.resizable(True, True)
main_frame.grid_propagate(False)

# Treeview container frame
tree_frame = ttk.Frame(main_frame)
tree_frame.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)

# Treeview with checkboxes for file selection
tree = ttk.Treeview(tree_frame, columns=("modified",), selectmode="extended")
tree.heading("#0", text="File/Folder")  # Main column for file/folder names
tree.heading("modified", text="Created")  # Change the column header to "Created"
tree.column("#0", width=400)  # Adjust width for file/folder names
tree.column("modified", width=150, anchor="center")  # Adjust width and alignment for last modified date
tree.grid(row=0, column=0, sticky="nsew")

tree_frame.rowconfigure(0, weight=1)
tree_frame.columnconfigure(0, weight=1)

# Scrollbar for tree
tree_scroll = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
tree.configure(yscrollcommand=tree_scroll.set)
tree_scroll.grid(row=0, column=1, sticky="ns")

# Create a frame for filter and description
filter_section_frame = ttk.Frame(root)
filter_section_frame.grid(row=2, column=0, sticky="ew", padx=10, pady=5)
filter_section_frame.columnconfigure(1, weight=1)  # Make description frame expandable

# Filter by date section
filter_frame = ttk.LabelFrame(filter_section_frame, text="Filter by Date", padding=10)
filter_frame.grid(row=0, column=0, sticky="ns", padx=(0, 5))

date_label = ttk.Label(filter_frame, text="Select logs after (YYYY-MM-DD HH:MM):")
date_label.pack(side="left", padx=5)

# Use ttk.Entry with the Forest theme
date_entry = ttk.Entry(filter_frame, width=20)
date_entry.pack(side="left", padx=5)
date_entry.insert(0, get_default_time(config))  # Use the dynamically calculated default time

select_after_button = ttk.Button(filter_frame, text="Select Recent Logs", command=select_files_after_date)
select_after_button.pack(side="left", padx=5)

# Description section - now alongside date filter
description_frame = ttk.LabelFrame(filter_section_frame, text="Optional Description", padding=10)
description_frame.grid(row=0, column=1, sticky="ew", padx=(5, 0))
description_frame.columnconfigure(0, weight=1)  # Make the entry field expandable

# Use ttk.Entry with the Forest theme - expandable
description_entry = ttk.Entry(description_frame)
description_entry.grid(row=0, column=0, padx=5, sticky="ew")

# Add a small note about version requirement
version_note = ttk.Label(description_frame, text="(Requires v0.9.9.26a+)", font=("Arial", 7), foreground="#888888")
version_note.grid(row=0, column=1, padx=2, sticky="e")

# Selected files section
selected_frame = ttk.LabelFrame(main_frame, text="Selected Files", padding=10)
selected_frame.grid(row=0, column=1, sticky="ns", padx=5, pady=5)

# Use ttk.Treeview for the selected files list
selected_tree = ttk.Treeview(
    selected_frame,
    columns=("File", "Remove"),
    show="headings",
    height=20,
    selectmode="extended"
)
selected_tree.heading("File", text="File")
selected_tree.column("File", anchor="w", width=260)
selected_tree.heading("Remove", text="")
selected_tree.column("Remove", anchor="center", width=40, stretch=False)
selected_tree.pack(fill="both", expand=True, pady=5)  # <-- fill both and expand

# Frame for count label and unselect button
count_frame = ttk.Frame(selected_frame)
count_frame.pack(fill="x", pady=(5, 0), side="bottom")  # <-- pack at the bottom

count_label = ttk.Label(count_frame, text="0 file(s) selected")
count_label.pack(side="left", anchor="w")

unselect_button = ttk.Button(count_frame, text="Unselect All", command=unselect_all)
unselect_button.pack(side="right", anchor="e")

# Track selected files using checkboxes
tree.tag_configure("selected", background="#ccffcc")

def update_selected_list():
    selected_tree.delete(*selected_tree.get_children())
    count = 0
    for path in sorted(checked_items.keys()):
        display_name = os.path.relpath(path, root_path) if root_path else os.path.basename(path)
        selected_tree.insert("", tk.END, iid=path, values=(display_name, "❌"))
        count += 1
    count_label.config(text=f"{count} file(s) selected")
    for item in tree.get_children(""):
        apply_tree_highlight(item)

def apply_tree_highlight(item):
    tags = tree.item(item, "tags")
    if not tags or tags[0] == "folder":  # Skip folders
        for child in tree.get_children(item):
            apply_tree_highlight(child)
        return

    full_path = tags[0]  # Retrieve the full path from the tags
    if full_path in checked_items:
        tree.item(item, text="✅ " + os.path.basename(full_path), tags=(full_path,))
    else:
        tree.item(item, text=os.path.basename(full_path), tags=(full_path,))
    for child in tree.get_children(item):
        apply_tree_highlight(child)

def on_tree_click(event):
    global last_selected
    item_id = tree.identify_row(event.y)  # Get the item ID of the clicked row

    if not item_id:
        return

    # Check if the clicked item is a folder
    tags = tree.item(item_id, "tags")
    if tags and tags[0] == "folder":
        # Toggle folder expand/collapse
        if tree.item(item_id, "open"):
            tree.item(item_id, open=False)  # Collapse the folder
        else:
            tree.item(item_id, open=True)  # Expand the folder
        return  # Exit early to avoid interfering with other functionality

    # Handle Shift+Click for multi-selection/unselection
    if event.state & 0x0001:  # Check if the Shift key is pressed
        if last_selected:
            # Get all items in the tree (recursively)
            def get_all_items(parent=""):
                items = []
                for child in tree.get_children(parent):
                    items.append(child)
                    items.extend(get_all_items(child))
                return items

            all_items = get_all_items()
            if last_selected in all_items and item_id in all_items:
                start_index = all_items.index(last_selected)
                end_index = all_items.index(item_id)

                # Determine the range of items
                range_end = max(start_index, end_index)
                range_start = min(start_index, range_end)

                # Check if the clicked item is selected or not
                full_path = tree.item(item_id, "tags")[0]
                is_deselecting = full_path in checked_items

                # Toggle selection/unselection for all items in the range
                for i in range(range_start, range_end + 1):
                    current_item = all_items[i]
                    full_path = tree.item(current_item, "tags")[0]
                    if full_path.lower().endswith(".zevtc"):
                        if is_deselecting:
                            # Deselect the file
                            if full_path in checked_items:
                                del checked_items[full_path]
                                tree.item(current_item, text=os.path.basename(full_path), tags=(full_path,))
                        else:
                            # Select the file
                            if full_path not in checked_items:
                                checked_items[full_path] = True
                                tree.item(current_item, text="✅ " + os.path.basename(full_path), tags=(full_path,))
                update_selected_list()
                return

    # Handle single clicks on files
    full_path = tree.item(item_id, "tags")[0]
    if full_path.lower().endswith(".zevtc"):
        # Toggle selection for the clicked item
        if full_path in checked_items:
            # Deselect the file
            del checked_items[full_path]
            tree.item(item_id, text=os.path.basename(full_path), tags=(full_path,))  # Reset tags
        else:
            # Select the file
            checked_items[full_path] = True
            tree.item(item_id, text="✅ " + os.path.basename(full_path), tags=(full_path,))  # Update tags

    # Update the last selected item
    last_selected = item_id

    # Update the selected listbox and count
    update_selected_list()

def on_listbox_double_click(event):
    selection = selected_tree.selection()
    if selection:
        selected_name = selected_tree.item(selection[0], "values")[0]
        full_path = os.path.join(root_path, selected_name)
        if full_path in checked_items:
            del checked_items[full_path]
            for item in tree.get_children(""):
                reset_tree_checkboxes(item, full_path)
            update_selected_list()

def reset_tree_checkboxes(item, full_path):
    values = tree.item(item, "values")
    if values and os.path.normpath(values[0]) == full_path:
        tree.item(item, text=os.path.basename(full_path))
        return True
    for child in tree.get_children(item):
        if reset_tree_checkboxes(child, full_path):
            return True
    return False

def populate_tree(parent, path):
    try:
        entries = os.listdir(path)
        files = []
        folders = []

        # Separate files and folders
        for entry in entries:
            full_path = os.path.join(path, entry)
            full_path = os.path.normpath(full_path)  # Normalize the full path
            if os.path.isdir(full_path):
                folders.append(entry)
            elif entry.lower().endswith(".zevtc"):
                create_time = os.path.getctime(full_path)  # Get the creation time
                files.append((entry, create_time, full_path))

        # Sort files by creation time (newest first)
        files.sort(key=lambda x: x[1], reverse=True)

        # Add folders first (alphabetically sorted)
        for folder in sorted(folders, key=lambda x: x.lower()):
            full_path = os.path.join(path, folder)
            node = tree.insert(parent, "end", text=folder, values=(""))  # No date for folders
            tree.item(node, tags=("folder",))  # Set a placeholder tag for folders
            populate_tree(node, full_path)

        # Add files after folders
        for file, create_time, full_path in files:
            create_time_str = datetime.fromtimestamp(create_time).strftime("%Y-%m-%d %H:%M:%S")
            node = tree.insert(parent, "end", text=file, values=(create_time_str,))  # Display the creation date
            tree.item(node, tags=(full_path,))  # Store the full path in the tags

    except Exception as e:
        print(f"Error reading directory {path}: {e}")

def on_selected_tree_click(event):
    region = selected_tree.identify("region", event.x, event.y)
    if region != "cell":
        return
    col = selected_tree.identify_column(event.x)
    if col != "#2":  # "Remove" column is the second column
        return
    row_id = selected_tree.identify_row(event.y)
    if not row_id:
        return
    full_path = row_id  # Now the iid is the full path
    if full_path in checked_items:
        del checked_items[full_path]
        for tree_item in tree.get_children(""):
            reset_tree_checkboxes(tree_item, full_path)
        update_selected_list()

if os.path.exists(root_path):
    populate_tree('', root_path)

tree.bind("<Button-1>", on_tree_click)
selected_tree.bind("<Double-Button-1>", on_listbox_double_click)
selected_tree.bind("<Button-1>", on_selected_tree_click)

# Add "Generate Aggregate" and "Select Recent Logs" buttons at the bottom
generate_button = ttk.Button(root, text="Generate Aggregate", command=lambda: generate_aggregate(root, config, checked_items), style="Accent.TButton")
generate_button.grid(row=3, column=0, sticky="e", padx=10, pady=10)

# Add "Config" button at the bottom-left
config_button = ttk.Button(
    root,
    text="Config",
    command=lambda: open_config_window(root, config, date_entry, update_status),
)
config_button.grid(row=3, column=0, sticky="w", padx=10, pady=10)

style = ttk.Style()
style.configure("UpdateDot.TLabel", foreground="red")
config_button_dot = ttk.Label(
    root,
    text="●",
    style="UpdateDot.TLabel",
    padding=0,
)
if ei_update_available or combiner_update_available:
    config_button_dot.place(in_=config_button, relx=1, x=-12, y=0)

# Fetch the release version
release_version = get_release_version()
release_label = ttk.Label(root, text=f"Release: {release_version}", font=("Arial", 8), foreground="#888888")
release_label.grid(row=4, column=0, sticky="e", padx=10, pady=5)

set_native_title_bar_theme(root, config.get("theme", "dark"))

root.mainloop()
