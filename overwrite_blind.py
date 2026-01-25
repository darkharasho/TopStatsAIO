
import json
import sys

path = "TopStats_Full_Skin.json"

try:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    styles_idx = -1
    for i, tid in enumerate(data):
        if tid.get('title') == "$:/TopStats/Skin/Styles":
            styles_idx = i
            break
            
    if styles_idx == -1:
        print("Styles tiddler not found")
        sys.exit(1)

    text = data[styles_idx]['text']
    
    # 1. Padding Fix: Simple Replace
    # Target the unique color string
    color_str = "background: rgba(21, 25, 30, 0.4);"
    if color_str in text:
        # Check if already patched
        if "padding: 2rem 1rem; " + color_str in text: # naive check
             pass
        elif "padding: 2rem 1rem;" in text and text.index("padding: 2rem 1rem;") < text.index(color_str):
             pass # likely already there
        else:
             # Apply patch
             text = text.replace(color_str, "padding: 2rem 1rem; " + color_str)
             print("Applied padding fix.")
    
    # 2. Filter Fix: Simple regex replace for the end
    # We want to replace the LAST occurrence of the filter block
    # or just append if not found?
    # We'll search for the "Conditional Sidebar Padding" comment
    comment = "/* Conditional Sidebar Padding"
    if comment in text:
        # Find start of comment
        start_idx = text.rfind(comment)
        # Assume everything after is the old filter
        # We replace it with new logic
        new_logic = "/* Conditional Sidebar Padding (Remove when closed to fix hanging artifact) */\n{{{ [[$:/state/sidebar]get[text]trim[]match[no]then[.tc-sidebar-header { padding: 0 !important; }]] }}}"
        text = text[:start_idx] + new_logic + "\n\n"
        print("Applied filter fix.")
    
    data[styles_idx]['text'] = text

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
        
    print("Done.")

except Exception as e:
    print(f"Error: {e}")
