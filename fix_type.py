
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

    tid = data[styles_idx]
    
    # 1. FIX TYPE
    print(f"Old Type: {tid.get('type')}")
    tid['type'] = "text/vnd.tiddlywiki"
    print(f"New Type: {tid.get('type')}")
    
    # 2. Verify Content matches requirements
    text = tid['text']
    
    # Ensure static padding exists
    if "padding: 2rem 1rem;" not in text:
        # Insert it
        header_loc = text.find(".tc-sidebar-header {")
        if header_loc != -1:
             brace_loc = text.find("{", header_loc)
             text = text[:brace_loc+1] + "\n    padding: 2rem 1rem;" + text[brace_loc+1:]
             print("Inserted missing padding.")
    else:
        print("Padding verified present.")

    # Ensure Filter is cleaner
    # (Optional: The previous scripts should have fixed it, but let's be sure)
    
    tid['text'] = text
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
        
    print("Updated Type and Verified Content.")

except Exception as e:
    print(f"Error: {e}")
