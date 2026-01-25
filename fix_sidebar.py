
import json
import sys
import re

file_path = "/var/home/mstephens/Documents/GitHub/TopStatsAIO/TopStats_Full_Skin.json"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Find the Styles tiddler
    styles_tiddler = None
    for tid in data:
        if tid.get('title') == "$:/TopStats/Skin/Styles":
            styles_tiddler = tid
            break
    
    if not styles_tiddler:
        print("Error: Styles tiddler not found")
        sys.exit(1)

    text = styles_tiddler['text']
    print(f"Loaded styles text. Length: {len(text)}")
    print("First 100 chars of text: " + repr(text[:100]))

    # 1. Restore Static Padding
    # Search for .tc-sidebar-header followed by brace
    header_pattern = r"(\.tc-sidebar-header\s*\{)"
    match_header = re.search(header_pattern, text)
    
    if match_header:
        # Check if padding is already there in the next few chars
        snippet = text[match_header.end():match_header.end()+50]
        if "padding:" in snippet:
             print("Padding seems to be present already: " + repr(snippet))
        else:
             print("Inserting padding...")
             # Insert padding after the brace
             replacement = match_header.group(1) + "\n    padding: 2rem 1rem;"
             text = text[:match_header.end()] + "\n    padding: 2rem 1rem;" + text[match_header.end():]
             print("Padding inserted.")
    else:
        print("Error: Could not find .tc-sidebar-header block")

    # 2. Fix Conditional Logic
    # Remove any existing conditional blocks at the end
    # We look for anything resembling the filter syntax near the end
    
    # We will simply strip any existing filters involving $:/state/sidebar match[no] and append the correct one.
    
    # Regex to find the old filtered transclusions
    # They look like {{{ [[$:/state/sidebar]... }}}
    # We want to remove them.
    
    filter_pattern = r"\{\{\{\s*\[\[\$:/state/sidebar\].*?\}\}\}"
    
    # Find all matches
    matches = re.finditer(filter_pattern, text, re.DOTALL)
    count = 0
    for m in matches:
        print(f"Found existing filter: {m.group(0)}")
        count += 1
    
    if count > 0:
        text = re.sub(filter_pattern, "", text, flags=re.DOTALL)
        print(f"Removed {count} existing filters.")
    
    # Clean up trailing whitespace/newlines before appending
    text = text.rstrip()
    
    # Append the robust filter
    robust_filter = "\n\n/* Conditional Sidebar Padding (Remove when closed to fix hanging artifact) */\n{{{ [[$:/state/sidebar]get[text]trim[]match[no]then[.tc-sidebar-header { padding: 0 !important; }]] }}}"
    text += robust_filter
    print("Appended robust filter.")

    styles_tiddler['text'] = text

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    
    print("Successfully patched TopStats_Full_Skin.json")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
