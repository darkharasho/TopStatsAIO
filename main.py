import os
import time
import tkinter as tk
from tkinter import ttk, filedialog
from datetime import datetime
import json
import shutil
import tempfile
from tkinter import Toplevel, Label, ttk, messagebox
import subprocess
import threading
import gzip
import requests
import zipfile
import io
import re

CONFIG_FILE = "config.json"

# Load saved config or default values
def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    # Default configuration
    return {
        "last_path": "",
        "elite_insights_path": "",
        "top_stats_path": "",
        "default_time": "",  # Not needed anymore
        "default_hour": 12,  # Default to 12:00 PM
        "default_minute": 0,
        "theme": "dark"  # Default theme is dark
    }

# Save config to file
def save_config():
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

config = load_config()

# Calculate the default time dynamically
def get_default_time():
    today = datetime.now()
    default_hour = config.get("default_hour", 12)
    default_minute = config.get("default_minute", 0)
    return today.replace(hour=default_hour, minute=default_minute, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M")

def apply_theme():
    """Apply the selected theme to the app."""
    selected_theme = config.get("theme", "dark")
    if selected_theme == "dark":
        ttk.Style().theme_use("forest-dark")
        root.configure(bg="#333333")  # Dark background
    elif selected_theme == "light":
        ttk.Style().theme_use("forest-light")
        root.configure(bg="#FFFFFF")  # Light background

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
        save_config()
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
        save_config()

# Choose Top Stats Parser folder
def choose_top_stats_path():
    initial_dir = config.get("top_stats_path", "") if os.path.exists(config.get("top_stats_path", "")) else ""
    path = filedialog.askdirectory(title="Select Top Stats Parser Folder", initialdir=initial_dir)
    if path:
        config["top_stats_path"] = path
        save_config()

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
root.configure(bg="#333333")  # Match the Forest theme's dark background color

# Load the Forest theme from the "themes" directory
themes_dir = os.path.join(os.getcwd(), "themes")
forest_dark_path = os.path.join(themes_dir, "forest-dark.tcl")
forest_light_path = os.path.join(themes_dir, "forest-light.tcl")

# Check if the theme files exist
if (os.path.exists(forest_dark_path)):
    root.tk.call("source", forest_dark_path)
if (os.path.exists(forest_light_path)):
    root.tk.call("source", forest_light_path)

# Apply the selected theme
selected_theme = config.get("theme", "dark")
if selected_theme == "dark":
    ttk.Style().theme_use("forest-dark")
    root.configure(bg="#333333")  # Dark background
elif selected_theme == "light":
    ttk.Style().theme_use("forest-light")
    root.configure(bg="#FFFFFF")  # Light background

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
date_entry.insert(0, get_default_time())  # Use the dynamically calculated default time

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
selected_tree = ttk.Treeview(selected_frame, columns=("File"), show="headings", height=20)
selected_tree.heading("File", text="File")
selected_tree.column("File", anchor="w", width=300)
selected_tree.pack(fill="y", expand=True, pady=5)

# Frame for count label and unselect button
count_frame = ttk.Frame(selected_frame)
count_frame.pack(fill="x", pady=(5, 0))

count_label = ttk.Label(count_frame, text="0 file(s) selected")
count_label.pack(side="left", anchor="w")

unselect_button = ttk.Button(count_frame, text="Unselect All", command=unselect_all)
unselect_button.pack(side="right", anchor="e")

# Track selected files using checkboxes
tree.tag_configure("selected", background="#ccffcc")
checked_items = {}
root_path = config.get("last_path", "")

if root_path:
    print(f"Current Folder: {root_path}")  # Log the current folder instead

last_selected = None

def update_selected_list():
    selected_tree.delete(*selected_tree.get_children())
    count = 0
    for path in sorted(checked_items.keys()):
        display_name = os.path.relpath(path, root_path) if root_path else os.path.basename(path)
        selected_tree.insert("", tk.END, values=(display_name,))
        count += 1

    count_label.config(text=f"{count} file(s) selected")

    for item in tree.get_children(""):  # Apply highlights to all items
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

if os.path.exists(root_path):
    populate_tree('', root_path)

tree.bind("<Button-1>", on_tree_click)
selected_tree.bind("<Double-Button-1>", on_listbox_double_click)

def generate_aggregate():
    if not validate_config():
        return  # Exit if the configuration is invalid

    if not checked_items:
        # Show an error popup if no files are selected
        messagebox.showerror("No Files Selected", "Please select at least one file to generate the aggregate.")
        return

    # Create a temporary folder
    temp_dir = tempfile.mkdtemp()
    print(f"Temporary folder created: {temp_dir}")

    # Create a popup window for progress
    progress_popup = Toplevel(root)
    progress_popup.title("Processing Files")
    progress_popup.geometry("600x450")
    progress_popup.resizable(False, False)

    # Create a styled frame for the terminal output
    terminal_frame = ttk.Frame(progress_popup, padding=10)
    terminal_frame.pack(fill="both", expand=True)

    # Use a tk.Text widget for terminal-like output
    terminal_output = tk.Text(terminal_frame, height=20, width=80, state="disabled", bg="#3a3a3a", fg="#ffffff", font=("Courier", 10), borderwidth=0)
    terminal_output.pack(fill="both", expand=True)

    def update_terminal_output(message):
        terminal_output.config(state="normal")
        terminal_output.insert(tk.END, message + "\n")
        terminal_output.see(tk.END)  # Scroll to the bottom
        terminal_output.config(state="disabled")

# Define a custom style for the button
    style = ttk.Style()
    style.configure("Accent.TButton", background="#28a745", foreground="white", font=("Arial", 10, "bold"))
    style.configure("TButton", font=("Arial", 10))  # Default style for buttons
    style.map(
        "TButton",
        background=[("disabled", "#6c757d")],  # Gray background when disabled
        foreground=[("disabled", "#ffffff")],  # White text when disabled
    )

    # Create a frame for the button at the bottom of the popup
    button_frame = ttk.Frame(progress_popup, padding=10)
    button_frame.pack(side="bottom", fill="x")

    # Add the "Open Folder" button (initially disabled)
    generated_agg_folder = os.path.join(os.getcwd(), "GeneratedAgg")
    # Define a function to open a folder that works on both Windows and Linux
    def open_folder(path):
        if os.name == 'nt':
            os.startfile(path)
        else:
            # On Linux, use xdg-open or similar
            try:
                subprocess.run(['xdg-open', path])
            except Exception as e:
                update_terminal_output(f"Error opening folder: {e}")
                
    open_folder_button = ttk.Button(
        button_frame,
        text="Open Folder",
        state="disabled",
        style="TButton",  # Default style
        command=lambda: open_folder(generated_agg_folder),
    )
    open_folder_button.pack(pady=5)

    def enable_open_folder_button():
        """Enable the 'Open Folder' button and update its text and style."""
        open_folder_button.config(state="normal", text="Open Folder", style="Accent.TButton")  # Enable the button and apply the green style

    def disable_open_folder_button():
        """Disable the 'Open Folder' button and update its text to 'Processing...'."""
        open_folder_button.config(state="disabled", text="Processing...", style="TButton")  # Disable the button and update the text

    def process_files():
        try:
            # Disable the "Open Folder" button and set it to "Processing..."
            disable_open_folder_button()

            # Copy selected files to the temporary folder
            total_files = len(checked_items)
            update_terminal_output(f"Copying {total_files} selected files to temporary folder...")
            for i, full_path in enumerate(checked_items.keys(), start=1):
                try:
                    shutil.copy(full_path, temp_dir)
                    progress = int((i / total_files) * 50)  # ASCII progress bar length
                    progress_bar = "[" + "#" * progress + "-" * (50 - progress) + "]"
                    # Append the progress bar as a new line
                    update_terminal_output(f"{progress_bar} {i}/{total_files} - Copied: {os.path.basename(full_path)}")
                except Exception as e:
                    update_terminal_output(f"Error copying file {full_path}: {e}")

            # Add a separator after copying files
            update_terminal_output("\n" + "-" * 50 + "\n")

            # Check the parser selection
            parser_selection = config.get("parser_selection", "GW2_EI_log_combiner")

            if parser_selection == "GW2_EI_log_combiner":
                # Existing behavior for GW2_EI_log_combiner
                process_with_gw2_ei_log_combiner(temp_dir, update_terminal_output, enable_open_folder_button)
            elif parser_selection == "arcdps_top_stats_parser":
                # New behavior for arcdps_top_stats_parser
                process_with_arcdps_top_stats_parser(temp_dir, update_terminal_output, enable_open_folder_button)
            else:
                update_terminal_output(f"Unknown parser selection: {parser_selection}")
        except Exception as e:
            update_terminal_output(f"Unexpected error: {e}")

    # Run the file processing in a separate thread
    threading.Thread(target=process_files).start()

    progress_popup.update_idletasks()  # Force the window to update its layout
    progress_popup.geometry(f"{progress_popup.winfo_width()}x{progress_popup.winfo_height()}")

def process_with_arcdps_top_stats_parser(temp_dir, update_terminal_output, enable_open_folder_button):
    """Process files using arcdps_top_stats_parser."""
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

        # Construct the batch command with Wine if on Linux
        if os.name != 'nt':
            bash_command = f'wine cmd /c "{top_stats_folder}\\TW5_parsing_arc_top_stats.bat" "{target_folder}" "{ei_folder}" "{top_stats_folder}"'
        else:
            bash_command = f'"{top_stats_folder}\\TW5_parsing_arc_top_stats.bat" "{target_folder}" "{ei_folder}" "{top_stats_folder}"'
        update_terminal_output(f"Running command: {bash_command}")

        # Run the batch command and pipe the output to the terminal
        # Check platform to determine if we should use creationflags
        kwargs = {
            'shell': True,
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
            
        result = subprocess.run(bash_command, **kwargs)

        # Handle output based on whether we're in text or binary mode
        if kwargs['text']:
            if result.stdout:
                update_terminal_output(result.stdout.strip())
            if result.stderr:
                update_terminal_output(f"Error: {result.stderr.strip()}")
        else:
            # Handle binary output with error handling for encoding issues
            try:
                if result.stdout:
                    stdout_text = result.stdout.decode('utf-8', errors='replace').strip()
                    update_terminal_output(stdout_text)
                if result.stderr:
                    stderr_text = result.stderr.decode('utf-8', errors='replace').strip()
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

def process_with_gw2_ei_log_combiner(temp_dir, update_terminal_output, enable_open_folder_button):
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
            edit_conf_file(template_conf_file, edited_conf_file, temp_dir)

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

            # Signal that processing is complete
            processing_complete.set()
        except Exception as e:
            update_terminal_output(f"Unexpected error: {e}")
            processing_complete.set()

    # Start the processing in a separate thread
    threading.Thread(target=process_zevtc_files).start()

    # Wait for processing to complete before running the TopStats.exe executable
    def wait_and_run_script():
        processing_complete.wait()  # Wait for the event to be set

        # Run the TopStats.exe executable
        try:
            top_stats_exe = os.path.join(config.get("top_stats_path", ""), "TopStats.exe")
            processed_folder_path = os.path.abspath(os.path.join(temp_dir, "ProcessedLogs"))
            top_stats_config_path = os.path.join(temp_dir, "top_stats_config.ini")  # Path to the edited config file

            if not os.path.exists(top_stats_exe):
                update_terminal_output(f"Error: TopStats.exe not found at {top_stats_exe}")
                return

            if not os.path.exists(top_stats_config_path):
                update_terminal_output(f"Error: top_stats_config.ini not found at {top_stats_config_path}")
                return

            # Add the -c flag with the path to the top_stats_config.ini file
            # Check if we're running on Linux and need to use Wine
            command = []
            if os.name != 'nt' and top_stats_exe.lower().endswith('.exe'):
                command = ["wine", top_stats_exe, "-i", processed_folder_path, "-c", top_stats_config_path]
            else:
                command = [top_stats_exe, "-i", processed_folder_path, "-c", top_stats_config_path]
            
            # Add optional description if provided
            description = description_entry.get().strip()
            if description:
                command.extend(["-d", description])
                
            update_terminal_output(f"Running TopStats.exe: {' '.join(command)}")

            # Run the command and wait for it to complete
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
                update_terminal_output(f"Error running TopStats.exe (return code: {result.returncode})")
                return
            update_terminal_output("TopStats.exe completed successfully.")
        except Exception as e:
            update_terminal_output(f"Error running TopStats.exe: {e}")

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
            for file in os.listdir(processed_folder_path):
                if file.lower().endswith(".json"):
                    source_path = os.path.join(processed_folder_path, file)
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

    # Start the script execution in a separate thread
    threading.Thread(target=wait_and_run_script).start()

def edit_conf_file(template_path, output_path, temp_dir):
    """Edit the Elite Insights configuration file."""
    try:
        with open(template_path, "r") as template_file:
            lines = template_file.readlines()

        # Modify the OutLocation and DPSReportUserToken lines
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

config_window_instance = None  # Global variable to track the config window
elite_entry = None  # Global variable for Elite Insights path entry
top_stats_entry = None  # Global variable for Top Stats Parser path entry
old_top_stats_entry = None  # Global variable for old Top Stats Parser path entry

def open_config_window():
    """Open the configuration popup window."""
    global config_window_instance, elite_entry, top_stats_entry, old_top_stats_entry

    if config_window_instance and tk.Toplevel.winfo_exists(config_window_instance):
        # If the window is already open, bring it to the front
        config_window_instance.lift()
        return

    # Create the configuration window
    config_window_instance = Toplevel(root)
    config_window_instance.title("Configuration")
    config_window_instance.geometry("950x800")  # Increased height to accommodate Glicko checkbox
    config_window_instance.resizable(False, False)
    config_window_instance.configure(bg="#333333")  # Match the Forest theme's dark background color

    # Set the background color based on the selected theme
    selected_theme = config.get("theme", "dark")
    if selected_theme == "dark":
        config_window_instance.configure(bg="#333333")  # Dark background
    elif selected_theme == "light":
        config_window_instance.configure(bg="#FFFFFF")  # Light background

    # Configure the main window grid
    config_window_instance.grid_rowconfigure(0, weight=1)
    config_window_instance.grid_columnconfigure(0, weight=1)
    
    # Create a frame for the two-column layout
    content_frame = ttk.Frame(config_window_instance, padding=10)
    content_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)

    # Create two columns
    left_column = ttk.Frame(content_frame)
    left_column.grid(row=0, column=0, sticky="nsew", padx=(0, 10))  # Add padding between columns

    right_column = ttk.Frame(content_frame)
    right_column.grid(row=0, column=1, sticky="nsew")

    # Configure column weights
    content_frame.columnconfigure(0, weight=6)
    content_frame.columnconfigure(1, weight=1)

    # Add settings to the left column
    # Download prerequisites frame
    download_frame = ttk.LabelFrame(left_column, text="Download Prerequisites", padding=10)
    download_frame.pack(fill="x", pady=10)

    gw2eicli_button = ttk.Button(download_frame, text="Download Latest GW2EICLI",
                                 command=lambda: download_gw2eicli(config_window_instance))
    gw2eicli_button.pack(fill="x", pady=5)

    combiner_button = ttk.Button(download_frame, text="Download Latest GW2 EI Log Combiner",
                                 command=lambda: download_gw2_ei_log_combiner(config_window_instance))
    combiner_button.pack(fill="x", pady=5)

    # Set up Paths frame
    folder_selector_frame = ttk.LabelFrame(left_column, text="Set Paths", padding=10)
    folder_selector_frame.pack(fill="x", pady=10)

    # Elite Insights Folder
    elite_frame = ttk.Frame(folder_selector_frame)
    elite_frame.pack(fill="x", pady=5)

    elite_button = ttk.Button(elite_frame, text="Set Elite Insights Folder", command=lambda: browse_folder(elite_entry))
    elite_button.pack(side="left", padx=5)

    global elite_entry, top_stats_entry, old_top_stats_entry
    
    elite_entry = ttk.Entry(elite_frame, width=50)
    elite_entry.insert(0, config.get("elite_insights_path", ""))
    elite_entry.pack(side="left", padx=10)

    # Top Stats Parser Folder
    top_stats_frame = ttk.Frame(folder_selector_frame)
    top_stats_frame.pack(fill="x", pady=5)

    top_stats_button = ttk.Button(top_stats_frame, text="Set Top Stats Parser Folder", command=lambda: browse_folder(top_stats_entry))
    top_stats_button.pack(side="left", padx=5)

    top_stats_entry = ttk.Entry(top_stats_frame, width=50)
    top_stats_entry.insert(0, config.get("top_stats_path", ""))
    top_stats_entry.pack(side="left", padx=10)

    # (OLD) Top Stats Parser Folder
    old_top_stats_frame = ttk.Frame(folder_selector_frame)
    old_top_stats_frame.pack(fill="x", pady=5)

    old_top_stats_button = ttk.Button(old_top_stats_frame, text="Set (OLD) Top Stats Parser Folder", command=lambda: browse_folder(old_top_stats_entry))
    old_top_stats_button.pack(side="left", padx=5)

    old_top_stats_entry = ttk.Entry(old_top_stats_frame, width=50)
    old_top_stats_entry.insert(0, config.get("old_top_stats_path", ""))
    old_top_stats_entry.pack(side="left", padx=10)

    # Set up Configs Frame
    config_frame = ttk.LabelFrame(left_column, text="Set Optional Configuration", padding=10)
    config_frame.pack(fill="x", pady=10)

    # DPSReportUserToken
    token_frame = ttk.Frame(config_frame)
    token_frame.pack(fill="x", pady=5)

    token_label = ttk.Label(token_frame, text="DPSReportUserToken:")
    token_label.pack(side="left", padx=5)

    token_entry = ttk.Entry(token_frame, width=50)
    token_entry.insert(0, config.get("DPSReportUserToken", ""))
    token_entry.pack(side="left", padx=10)

    # Default Hour and Minute
    time_frame = ttk.Frame(config_frame)
    time_frame.pack(fill="x", pady=5)

    hour_label = ttk.Label(time_frame, text="Default Hour (0-23):")
    hour_label.pack(side="left", padx=5)

    hour_entry = ttk.Entry(time_frame, width=5)
    hour_entry.insert(0, config.get("default_hour", 12))
    hour_entry.pack(side="left", padx=5)

    minute_label = ttk.Label(time_frame, text="Default Minute (0-59):")
    minute_label.pack(side="left", padx=5)

    minute_entry = ttk.Entry(time_frame, width=5)
    minute_entry.insert(0, config.get("default_minute", 0))
    minute_entry.pack(side="left", padx=5)

    # Add a new frame for GW2 EI Log Combiner Settings
    combiner_settings_frame = ttk.LabelFrame(left_column, text="GW2 EI Log Combiner Settings", padding=10)
    combiner_settings_frame.pack(fill="x", padx=(5, 15), pady=10)  # Reduce left padding and add right padding

    # Guild Name
    guild_name_frame = ttk.Frame(combiner_settings_frame)
    guild_name_frame.pack(fill="x", pady=5)

    guild_name_label = ttk.Label(guild_name_frame, text="Guild Name:")
    guild_name_label.pack(side="left", padx=5)

    guild_name_entry = ttk.Entry(guild_name_frame, width=50)
    guild_name_entry.insert(0, config.get("guild_name", ""))  # Load saved value or default to empty
    guild_name_entry.pack(side="left", padx=10)

    # Guild ID
    guild_id_frame = ttk.Frame(combiner_settings_frame)
    guild_id_frame.pack(fill="x", pady=5)

    guild_id_label = ttk.Label(guild_id_frame, text="Guild ID:")
    guild_id_label.pack(side="left", padx=5)

    guild_id_entry = ttk.Entry(guild_id_frame, width=50)
    guild_id_entry.insert(0, config.get("guild_id", ""))  # Load saved value or default to empty
    guild_id_entry.pack(side="left", padx=10)

    # API Key
    api_key_frame = ttk.Frame(combiner_settings_frame)
    api_key_frame.pack(fill="x", pady=5)

    api_key_label = ttk.Label(api_key_frame, text="API Key:")
    api_key_label.pack(side="left", padx=5)

    api_key_entry = ttk.Entry(api_key_frame, width=50, show="*")  # Mask the API key for privacy
    api_key_entry.insert(0, config.get("api_key", ""))  # Load saved value or default to empty
    api_key_entry.pack(side="left", padx=10)

    # Enable Glicko Database Features
    glicko_frame = ttk.Frame(combiner_settings_frame)
    glicko_frame.pack(fill="x", pady=5)

    glicko_var = tk.BooleanVar(value=config.get("db_update", False))
    glicko_checkbox = ttk.Checkbutton(glicko_frame, text="Enable Glicko Database Features (db_update)", variable=glicko_var)
    glicko_checkbox.pack(side="left", padx=5)

    # Add info label for Glicko feature
    style = ttk.Style()
    style.configure("Info.TLabel", font=("Arial", 8), foreground="SystemGrayText")
    glicko_info_label = ttk.Label(glicko_frame, text="(Enables persistent player rankings across raids - Requires v1.1.0 or newer)", style="Info.TLabel")
    glicko_info_label.pack(side="left", padx=10)

    # Add settings to the right column
    # Parser Selection
    parser_selection_frame = ttk.LabelFrame(right_column, text="Parser Selection", padding=10)
    parser_selection_frame.pack(fill="x", pady=10)

    parser_selection = tk.StringVar(value=config.get("parser_selection", "GW2_EI_log_combiner"))

    arcdps_radio = ttk.Radiobutton(parser_selection_frame, text="arcdps_top_stats_parser", variable=parser_selection, value="arcdps_top_stats_parser")
    arcdps_radio.pack(anchor="w", padx=5)

    gw2_ei_radio = ttk.Radiobutton(parser_selection_frame, text="GW2_EI_log_combiner", variable=parser_selection, value="GW2_EI_log_combiner")
    gw2_ei_radio.pack(anchor="w", padx=5)

    # Theme Selection
    theme_frame = ttk.LabelFrame(right_column, text="Theme Selection", padding=10)
    theme_frame.pack(fill="x", pady=10)

    theme_selection = tk.StringVar(value=config.get("theme", "dark"))

    dark_theme_radio = ttk.Radiobutton(theme_frame, text="Dark Theme", variable=theme_selection, value="dark")
    dark_theme_radio.pack(anchor="w", padx=5)

    light_theme_radio = ttk.Radiobutton(theme_frame, text="Light Theme", variable=theme_selection, value="light")
    light_theme_radio.pack(anchor="w", padx=5)

    # Create a frame for the save button AFTER all content is created
    save_frame = ttk.Frame(config_window_instance)
    save_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=10)
    
    # Add the save button at the bottom, spanning both columns
    save_button = ttk.Button(save_frame, text="Save", command=lambda: save_and_close_config(
        config_window_instance, 
        elite_entry, 
        top_stats_entry, 
        old_top_stats_entry, 
        token_entry, 
        hour_entry, 
        minute_entry, 
        parser_selection, 
        theme_selection,
        guild_id_entry,
        guild_name_entry,
        api_key_entry,
        glicko_var))
    save_button.pack(side="right")
    

def browse_folder(entry_widget):
    """Open a folder dialog and set the selected path in the entry widget."""
    current_path = entry_widget.get()
    initial_dir = current_path if os.path.exists(current_path) else ""
    folder = filedialog.askdirectory(title="Select Folder", initialdir=initial_dir)
    if folder:
        entry_widget.delete(0, tk.END)
        entry_widget.insert(0, folder)

    # Bring the configuration window back to the top
    if config_window_instance:
        config_window_instance.lift()

def save_and_close_config(config_window, elite_entry, top_stats_entry, old_top_stats_entry, token_entry, hour_entry, minute_entry, parser_selection, theme_selection, guild_id_entry, guild_name_entry, api_key_entry, glicko_var):
    """Save the changes and close the configuration popup."""
    elite_path = elite_entry.get()
    top_stats_path = top_stats_entry.get()
    old_top_stats_path = old_top_stats_entry.get()
    token = token_entry.get()

    # Validate Elite Insights Path
    if not elite_path or not os.path.exists(elite_path):
        messagebox.showerror("Invalid Path", "Please provide a valid Elite Insights Path.")
        return

    # Validate Top Stats Parser Path
    if not top_stats_path or not os.path.exists(top_stats_path):
        messagebox.showerror("Invalid Path", "Please provide a valid Top Stats Parser Path.")
        return

    # Validate Hour and Minute
    try:
        hour = int(hour_entry.get())
        if hour < 0 or hour > 23:
            raise ValueError("Hour must be between 0 and 23.")
    except ValueError:
        messagebox.showerror("Invalid Hour", "Please enter a valid hour (0-23).")
        return

    try:
        minute = int(minute_entry.get())
        if minute < 0 or minute > 59:
            raise ValueError("Minute must be between 0 and 59.")
    except ValueError:
        messagebox.showerror("Invalid Minute", "Please enter a valid minute (0-59).")
        return

    # Save the configuration
    config["elite_insights_path"] = elite_path
    config["top_stats_path"] = top_stats_path
    config["old_top_stats_path"] = old_top_stats_path  # Save the (OLD) Top Stats Parser path
    config["DPSReportUserToken"] = token  # Save the token even if it's empty
    config["default_hour"] = hour
    config["default_minute"] = minute
    config["parser_selection"] = parser_selection.get()  # Save the parser selection
    config["theme"] = theme_selection.get()  # Save the selected theme

    # Save the new GW2 EI Log Combiner settings
    config["guild_name"] = guild_name_entry.get()
    config["guild_id"] = guild_id_entry.get()
    config["api_key"] = api_key_entry.get()
    config["db_update"] = glicko_var.get()  # Save the Glicko database feature setting

    # Save the configuration to the config.json file
    save_config()

    # Update the default time in the main window
    new_default_time = get_default_time()
    date_entry.delete(0, tk.END)
    date_entry.insert(0, new_default_time)

    # Apply the new theme immediately
    apply_theme()

    config_window.destroy()  # Close the configuration popup

def download_gw2eicli(parent_window):
    """Download the latest GW2EICLI release from GitHub."""
    # Create a progress dialog
    progress_dialog = Toplevel(parent_window)
    progress_dialog.title("Downloading GW2EICLI")
    progress_dialog.geometry("400x200")
    progress_dialog.resizable(False, False)
    progress_dialog.transient(parent_window)
    progress_dialog.grab_set()  # Make the dialog modal

    # Apply the current theme to the progress dialog
    selected_theme = config.get("theme", "dark")
    if selected_theme == "dark":
        progress_dialog.configure(bg="#333333")  # Dark background
        label_fg = "#FFFFFF"  # White text
    elif selected_theme == "light":
        progress_dialog.configure(bg="#FFFFFF")  # Light background
        label_fg = "#000000"  # Black text

    # Add status label
    status_label = ttk.Label(progress_dialog, text="Fetching latest release information...", foreground=label_fg)
    status_label.pack(pady=20)

    # Add progress bar
    progress_bar = ttk.Progressbar(progress_dialog, orient="horizontal", length=350, mode="indeterminate")
    progress_bar.pack(pady=10)
    progress_bar.start()

    def download_thread():
        try:
            # Step 1: Get the latest release information
            status_label.config(text="Fetching latest release information...")
            api_url = "https://api.github.com/repos/baaron4/GW2-Elite-Insights-Parser/releases/latest"
            response = requests.get(api_url)
            response.raise_for_status()
            release_data = response.json()

            # Step 2: Find the GW2EICLI.zip asset
            zip_asset = None
            for asset in release_data.get("assets", []):
                if asset["name"] == "GW2EICLI.zip":
                    zip_asset = asset
                    break

            if not zip_asset:
                progress_dialog.after(0, lambda: messagebox.showerror(
                    "Download Error",
                    "GW2EICLI.zip not found in the latest release",
                    parent=progress_dialog
                ))
                progress_dialog.after(100, progress_dialog.destroy)
                return

            # Step 3: Download the zip file
            status_label.config(text="Downloading GW2EICLI.zip...")
            download_url = zip_asset["browser_download_url"]
            response = requests.get(download_url, stream=True)
            response.raise_for_status()

            # Step 4: Ask user for installation directory
            progress_dialog.after(0, progress_bar.stop)

            def ask_directory():
                nonlocal progress_dialog

                # Create a dedicated downloads directory if it doesn't exist
                downloads_dir = os.path.join(os.getcwd(), "prerequisites")
                os.makedirs(downloads_dir, exist_ok=True)

                # Create a tool-specific directory
                gw2eicli_dir = os.path.join(downloads_dir, "GW2EICLI")
                os.makedirs(gw2eicli_dir, exist_ok=True)

                # Default to the dedicated directory, but allow user to choose
                initial_dir = config.get("elite_insights_path", "") if os.path.exists(config.get("elite_insights_path", "")) else gw2eicli_dir

                # Ask if user wants to use the default directory
                use_default = messagebox.askyesno(
                    "Installation Directory",
                    f"Do you want to install GW2EICLI to the default location?\n\n{gw2eicli_dir}",
                    parent=progress_dialog
                )

                if use_default:
                    install_dir = gw2eicli_dir
                else:
                    install_dir = filedialog.askdirectory(
                        title="Select GW2EICLI Installation Directory",
                        initialdir=initial_dir,
                        parent=progress_dialog
                    )

                if not install_dir:
                    progress_dialog.destroy()
                    return

                progress_bar.config(mode="determinate", maximum=100, value=0)
                status_label.config(text="Extracting files...")

                # Step 5: Extract the zip file
                try:
                    z = zipfile.ZipFile(io.BytesIO(response.content))
                    total_files = len(z.namelist())

                    # Create the directory if it doesn't exist
                    os.makedirs(install_dir, exist_ok=True)

                    # Extract all files
                    for i, file in enumerate(z.namelist()):
                        z.extract(file, install_dir)
                        progress = int((i + 1) / total_files * 100)
                        progress_bar.config(value=progress)
                        status_label.config(text=f"Extracting: {progress}% complete")
                        progress_dialog.update()

                    # Step 6: Update the configuration with the new path
                    config["elite_insights_path"] = install_dir

                    # Save version information
                    if "prerequisites" not in config:
                        config["prerequisites"] = {}

                    config["prerequisites"]["GW2EICLI_version"] = release_data.get("tag_name", "unknown")
                    config["prerequisites"]["GW2EICLI_downloaded"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    save_config()
                    
                    # Update the UI if the config window is open
                    update_config_window_entries("elite_insights_path", install_dir)

                    status_label.config(text="Installation complete!")
                    progress_dialog.after(1000, progress_dialog.destroy)

                    # Show success message
                    messagebox.showinfo(
                        "Download Complete",
                        f"GW2EICLI has been downloaded and installed to:\n{install_dir}\n\nThe application configuration has been automatically updated to use this path.",
                        parent=parent_window
                    )
                except Exception as e:
                    messagebox.showerror(
                        "Extraction Error",
                        f"Failed to extract the zip file: {str(e)}",
                        parent=progress_dialog
                    )
                    progress_dialog.destroy()

            progress_dialog.after(0, ask_directory)

        except Exception as e:
            progress_dialog.after(0, lambda: messagebox.showerror(
                "Download Error",
                f"Failed to download GW2EICLI: {str(e)}",
                parent=progress_dialog
            ))
            progress_dialog.after(100, progress_dialog.destroy)

    # Start the download thread
    threading.Thread(target=download_thread, daemon=True).start()

def download_gw2_ei_log_combiner(parent_window):
    """Download the latest GW2 EI Log Combiner release from GitHub."""
    # Create a progress dialog
    progress_dialog = Toplevel(parent_window)
    progress_dialog.title("Downloading GW2 EI Log Combiner")
    progress_dialog.geometry("400x200")
    progress_dialog.resizable(False, False)
    progress_dialog.transient(parent_window)
    progress_dialog.grab_set()  # Make the dialog modal

    # Apply the current theme to the progress dialog
    selected_theme = config.get("theme", "dark")
    if selected_theme == "dark":
        progress_dialog.configure(bg="#333333")  # Dark background
        label_fg = "#FFFFFF"  # White text
    elif selected_theme == "light":
        progress_dialog.configure(bg="#FFFFFF")  # Light background
        label_fg = "#000000"  # Black text

    # Add status label
    status_label = ttk.Label(progress_dialog, text="Fetching latest release information...", foreground=label_fg)
    status_label.pack(pady=20)

    # Add progress bar
    progress_bar = ttk.Progressbar(progress_dialog, orient="horizontal", length=350, mode="indeterminate")
    progress_bar.pack(pady=10)
    progress_bar.start()

    def download_thread():
        try:
            # Step 1: Get all releases (including pre-releases) to find the most recent
            status_label.config(text="Fetching latest release information...")
            api_url = "https://api.github.com/repos/Drevarr/GW2_EI_log_combiner/releases"
            response = requests.get(api_url)
            response.raise_for_status()
            all_releases = response.json()

            if not all_releases:
                progress_dialog.after(0, lambda: messagebox.showerror(
                    "Download Error",
                    "No releases found for GW2_EI_log_combiner",
                    parent=progress_dialog
                ))
                progress_dialog.after(100, progress_dialog.destroy)
                return

            # Step 2: Find the most recent release (stable or pre-release) with a zip asset
            release_data = None
            zip_asset = None
            
            for release in all_releases:
                # Check if this release has a zip asset
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
                    parent=progress_dialog
                ))
                progress_dialog.after(100, progress_dialog.destroy)
                return
            
            # Display which type of release we're downloading
            release_type = "pre-release" if release_data.get("prerelease", False) else "release"
            status_label.config(text=f"Found latest {release_type}: {release_data.get('tag_name', 'unknown')}")

            # Step 3: Download the zip file
            status_label.config(text=f"Downloading {zip_asset['name']}...")
            download_url = zip_asset["browser_download_url"]
            response = requests.get(download_url, stream=True)
            response.raise_for_status()

            # Step 4: Ask user for installation directory
            progress_dialog.after(0, progress_bar.stop)

            def ask_directory():
                nonlocal progress_dialog

                # Create a dedicated downloads directory if it doesn't exist
                downloads_dir = os.path.join(os.getcwd(), "prerequisites")
                os.makedirs(downloads_dir, exist_ok=True)

                # Create a tool-specific directory
                combiner_dir = os.path.join(downloads_dir, "GW2_EI_log_combiner")
                os.makedirs(combiner_dir, exist_ok=True)

                # Default to the dedicated directory, but allow user to choose
                initial_dir = config.get("top_stats_path", "") if os.path.exists(config.get("top_stats_path", "")) else combiner_dir
                use_default = messagebox.askyesno(
                    "Installation Directory",
                    f"Do you want to install GW2 EI Log Combiner to the default location?\n\n{combiner_dir}",
                    parent=progress_dialog
                )

                if use_default:
                    install_dir = combiner_dir
                else:
                    install_dir = filedialog.askdirectory(
                        title="Select GW2 EI Log Combiner Installation Directory",
                        initialdir=initial_dir,
                        parent=progress_dialog
                    )

                if not install_dir:
                    progress_dialog.destroy()
                    return

                progress_bar.config(mode="determinate", maximum=100, value=0)
                status_label.config(text="Extracting files...")

                # Step 5: Extract the zip file
                try:
                    z = zipfile.ZipFile(io.BytesIO(response.content))
                    total_files = len(z.namelist())

                    # Create the directory if it doesn't exist
                    os.makedirs(install_dir, exist_ok=True)

                    # Extract all files
                    for i, file in enumerate(z.namelist()):
                        z.extract(file, install_dir)
                        progress = int((i + 1) / total_files * 100)
                        progress_bar.config(value=progress)
                        status_label.config(text=f"Extracting: {progress}% complete")
                        progress_dialog.update()

                    # Step 6: Update the configuration with the new path
                    config["top_stats_path"] = install_dir

                    # Save version information
                    if "prerequisites" not in config:
                        config["prerequisites"] = {}

                    config["prerequisites"]["GW2_EI_log_combiner_version"] = release_data.get("tag_name", "unknown")
                    config["prerequisites"]["GW2_EI_log_combiner_downloaded"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    save_config()
                    
                    # Update the UI if the config window is open
                    update_config_window_entries("top_stats_path", install_dir)

                    status_label.config(text="Installation complete!")
                    progress_dialog.after(1000, progress_dialog.destroy)

                    # Show success message
                    release_type = "pre-release" if release_data.get("prerelease", False) else "release"
                    version = release_data.get("tag_name", "unknown")
                    messagebox.showinfo(
                        "Download Complete",
                        f"GW2 EI Log Combiner ({release_type} {version}) has been downloaded and installed to:\n{install_dir}\n\nThe application configuration has been automatically updated to use this path.",
                        parent=parent_window
                    )
                except Exception as e:
                    messagebox.showerror(
                        "Extraction Error",
                        f"Failed to extract the zip file: {str(e)}",
                        parent=progress_dialog
                    )
                    progress_dialog.destroy()

            progress_dialog.after(0, ask_directory)

        except Exception as e:
            progress_dialog.after(0, lambda: messagebox.showerror(
                "Download Error",
                f"Failed to download GW2 EI Log Combiner: {str(e)}",
                parent=progress_dialog
            ))
            progress_dialog.after(100, progress_dialog.destroy)

    # Start the download thread
    threading.Thread(target=download_thread, daemon=True).start()

def update_config_window_entries(field_name, value):
    """Update entry fields in the config window if it's open."""
    global config_window_instance, elite_entry, top_stats_entry, old_top_stats_entry
    
    # If the config window is not open, return
    if not config_window_instance or not tk.Toplevel.winfo_exists(config_window_instance):
        return
    
    print(f"Updating {field_name} to {value}")
        
    # Use the global entry references directly - these are much more reliable than traversing the widget tree
    if field_name == "elite_insights_path":
        config_window_instance.after(0, lambda: _update_entry_directly(elite_entry, value))
    elif field_name == "top_stats_path":
        config_window_instance.after(0, lambda: _update_entry_directly(top_stats_entry, value))
    elif field_name == "old_top_stats_path":
        config_window_instance.after(0, lambda: _update_entry_directly(old_top_stats_entry, value))
    
def _update_entry_directly(entry_variable, value):
    """Helper function to update an entry widget directly by reference."""
    try:
        if entry_variable and isinstance(entry_variable, ttk.Entry):
            # Clear the entry field
            entry_variable.delete(0, tk.END)
            # Insert the new value
            entry_variable.insert(0, value)
            # Force focus to update the widget
            entry_variable.focus_set()
            # Then remove focus to "commit" the change
            entry_variable.master.focus_set()
            print(f"Updated entry to: {value}")
    except Exception as e:
        print(f"Error directly updating entry: {e}")

def validate_config():
    """Validate the required configuration values."""
    missing_fields = []

    # Check Elite Insights Path
    if not config.get("elite_insights_path"):
        missing_fields.append("Elite Insights Path")
    elif not os.path.exists(config["elite_insights_path"]):
        missing_fields.append("Elite Insights Path (Invalid Path)")

    # Check Top Stats Parser Path
    if not config.get("top_stats_path"):
        missing_fields.append("Top Stats Parser Path")
    elif not os.path.exists(config["top_stats_path"]):
        missing_fields.append("Top Stats Parser Path (Invalid Path)")

    # Show error message if any fields are missing or invalid
    if missing_fields:
        messagebox.showerror(
            "Configuration Error",
            f"The following configuration fields are missing or invalid:\n\n- " + "\n- ".join(missing_fields)
        )
        return False

    return True

# Add "Generate Aggregate" and "Select Recent Logs" buttons at the bottom
generate_button = ttk.Button(root, text="Generate Aggregate", command=generate_aggregate, style="Accent.TButton")
generate_button.grid(row=3, column=0, sticky="e", padx=10, pady=10)  # Align to the right

# Add "Config" button at the bottom-left
config_button = ttk.Button(root, text="Config", command=open_config_window)
config_button.grid(row=3, column=0, sticky="w", padx=10, pady=10)

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

# Fetch the release version
release_version = get_release_version()

# Add a subtle label for the release version
release_label = ttk.Label(root, text=f"Release: {release_version}", font=("Arial", 8), foreground="#888888")
release_label.grid(row=4, column=0, sticky="e", padx=10, pady=5)  # Align to the bottom-right

root.mainloop()
