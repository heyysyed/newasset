import os
import glob

directory = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx'
for filepath in glob.glob(directory, recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "—" in content:
        content = content.replace("—", "-")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
