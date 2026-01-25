
import json
import sys

file_path = "/var/home/mstephens/Documents/GitHub/TopStatsAIO/TopStats_Full_Skin.json"

try:
    print("Reading file...", flush=True)
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Find the Styles tiddler
    styles_tiddler = None
    for tid in data:
        if tid.get('title') == "$:/TopStats/Skin/Styles":
            styles_tiddler = tid
            break
    
    if not styles_tiddler:
        print("Error: Styles tiddler not found", flush=True)
        sys.exit(1)

    text = styles_tiddler['text']
    
    # 1. Restore Static Padding
    # Exact string from view_file Step 464
    target = ".tc-sidebar-header {\n    background: rgba(21, 25, 30, 0.4);"
    replacement = ".tc-sidebar-header {\n    padding: 2rem 1rem;\n    background: rgba(21, 25, 30, 0.4);"
    
    if target in text:
        text = text.replace(target, replacement)
        print("Restored static padding (Exact match success).", flush=True)
    elif "padding: 2rem 1rem;" in text:
        print("Static padding already present.", flush=True)
    else:
        print("Warning: Could not match exact header string. Dumping context:", flush=True)
        start_idx = text.find(".tc-sidebar-header {")
        if start_idx != -1:
            print(repr(text[start_idx:start_idx+60]), flush=True)
        else:
            print("Could not find .tc-sidebar-header block at all.", flush=True)

    # 2. Fix Conditional Logic
    # We strip the end of the file and append the clean filter.
    # We look for the comment "/* --- LAYERING & HIDING FIX --- */" which is near the end.
    
    marker = "/* --- LAYERING & HIDING FIX --- */"
    marker_idx = text.find(marker)
    
    if marker_idx != -1:
        # Keep everything up to the marker + some context?
        # The marker is followed by rules.
        # Let's simple find the *last* occurrence of `}}}` and see if it looks like a filter.
        # Or better: Just replace everything after the marker with the known good block?
        
        # The known good block from Step 464:
        # .tc-sidebar-scrollable {\n    z-index: 2000 !important;\n    pointer-events: none !important;\n}\n\n.tc-sidebar-scrollable > * {\n    pointer-events: auto !important;\n}\n\n/* Conditional Sidebar Padding ... */ ...
        
        # Let's reconstruct the tail starting from the marker.
        layout_fix_block = """/* --- LAYERING & HIDING FIX --- */
.tc-sidebar-scrollable {
    z-index: 2000 !important;
    pointer-events: none !important;
}

.tc-sidebar-scrollable > * {
    pointer-events: auto !important;
}

/* Conditional Sidebar Padding (Remove when closed to fix hanging artifact) */
{{{ [[$:/state/sidebar]get[text]trim[]match[no]then[.tc-sidebar-header { padding: 0 !important; }]] }}}"""
        
        # We cut the text at the marker and append the new block.
        text = text[:marker_idx] + layout_fix_block + "\n\n"
        print("Replaced tail logic (Filter fix applied).", flush=True)
        
    else:
        print("Error: Could not find LAYERING & HIDING FIX marker.", flush=True)

    styles_tiddler['text'] = text

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    
    print("Successfully patched TopStats_Full_Skin.json", flush=True)

except Exception as e:
    print(f"Error: {e}", flush=True)
    sys.exit(1)
