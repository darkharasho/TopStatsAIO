
import json

path = "TopStats_Full_Skin.json"
with open(path, 'r') as f:
    data = json.load(f)

for tid in data:
    if tid['title'] == "$:/TopStats/Skin/Styles":
        text = tid['text']
        # Find header location
        idx = text.find(".tc-sidebar-header {")
        if idx != -1:
            snippet = text[idx:idx+60]
            print(f"Snippet: {repr(snippet)}")
        else:
            print("Header NOT FOUND")
        
        # Find filter location
        idx2 = text.find("$:/state/sidebar]")
        if idx2 != -1:
            snippet2 = text[idx2-20:idx2+100]
            print(f"Filter Snippet: {repr(snippet2)}")
        else:
             print("Filter NOT FOUND")
