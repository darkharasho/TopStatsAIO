
import json
import sys

path = "TopStats_Full_Skin.json"

try:
    print(f"Reading {path}...", flush=True)
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    styles_idx = -1
    for i, tid in enumerate(data):
        if tid.get('title') == "$:/TopStats/Skin/Styles":
            styles_idx = i
            break
            
    if styles_idx == -1:
        print("Styles tiddler not found", flush=True)
        sys.exit(1)

    text = data[styles_idx]['text']
    
    # 1. Insert Padding
    # Find ".tc-sidebar-header"
    header_loc = text.find(".tc-sidebar-header")
    if header_loc == -1:
        print("Could not find .tc-sidebar-header text marker", flush=True)
    else:
        # Find the opening brace after this marker
        brace_loc = text.find("{", header_loc)
        if brace_loc != -1:
            # Check if padding is already there in the next 100 chars
            snippet = text[brace_loc:brace_loc+100]
            if "padding:" in snippet:
                print(f"Padding already appears present in snippet: {repr(snippet)}", flush=True)
            else:
                # Insert it!
                print("Inserting padding...", flush=True)
                # We insert "\n    padding: 2rem 1rem;" after the brace
                insertion = "\n    padding: 2rem 1rem;"
                text = text[:brace_loc+1] + insertion + text[brace_loc+1:]
                print("Padding inserted.", flush=True)
        else:
            print("Could not find opening brace for header", flush=True)

    # 2. Fix Filter (Tail replacement)
    # Search for the "LAYOUT FIX" comment to anchor the end
    marker = "/* --- LAYERING & HIDING FIX --- */"
    marker_idx = text.find(marker)
    
    if marker_idx != -1:
        # Construct the correct tail
        new_tail = """/* --- LAYERING & HIDING FIX --- */
.tc-sidebar-scrollable {
    z-index: 2000 !important;
    pointer-events: none !important;
}

.tc-sidebar-scrollable > * {
    pointer-events: auto !important;
}

/* Conditional Sidebar Padding (Remove when closed to fix hanging artifact) */
{{{ [[$:/state/sidebar]get[text]trim[]match[no]then[.tc-sidebar-header { padding: 0 !important; }]] }}}"""
        
        # Replace from marker to end (minus the trailing quota/brackets of the JSON structure, which are NOT in 'text')
        # Wait, 'text' is just the value string. So yes, replaces to end of string.
        # But we need to be careful if there are trailing newlines.
        
        text = text[:marker_idx] + new_tail + "\n\n"
        print("Tail logic replaced.", flush=True)
    else:
        print("Could not find Layout Fix marker for tail replacement", flush=True)

    data[styles_idx]['text'] = text

    print("Writing file...", flush=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    print("Done.", flush=True)

except Exception as e:
    print(f"Error: {e}", flush=True)
    sys.exit(1)
