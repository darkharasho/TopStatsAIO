
import json
import os

json_path = "TopStats_Full_Skin.json"
css_path = "style.css"

print("--- Checking TopStats_Full_Skin.json ---")
try:
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    styles_tid = None
    for tid in data:
        if tid.get('title') == "$:/TopStats/Skin/Styles":
            styles_tid = tid
            break
    
    if styles_tid:
        text = styles_tid['text']
        t_type = styles_tid.get('type', 'undefined')
        print(f"Tiddler Type: {t_type}")
        print(f"Content Length: {len(text)}")
        
        # Check for sidebar header rule
        idx = text.find(".tc-sidebar-header {")
        if idx != -1:
            snippet = text[idx:idx+200]
            print(f"CSS Snippet around header:\n{snippet}")
        else:
            print("CSS Rule .tc-sidebar-header NOT FOUND")
            
        # Check for filter
        if "{{{" in text:
            f_idx = text.find("{{{")
            print(f"Filter Snippet:\n{text[f_idx:f_idx+200]}")
        else:
            print("Dynamic Filter NOT FOUND")
            
    else:
        print("Styles tiddler not found in JSON.")

except Exception as e:
    print(f"JSON Error: {e}")

print("\n--- Checking style.css ---")
try:
    if os.path.exists(css_path):
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
        
        if ".tc-sidebar-header" in css_content:
            print("Found .tc-sidebar-header in style.css!")
            # Find it
            idx = css_content.find(".tc-sidebar-header")
            print(f"style.css snippet:\n{css_content[idx:idx+200]}")
        else:
            print("No .tc-sidebar-header in style.css")
    else:
        print("style.css not found.")
except Exception as e:
    print(f"CSS Error: {e}")
