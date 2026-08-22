import os
import glob
import re

directory = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx'

for filepath in glob.glob(directory, recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Replace DM Sans and Oswald with var(--font-sans)
    content = re.sub(r"['\"]DM Sans['\"],\s*sans-serif", "var(--font-sans)", content)
    content = re.sub(r"['\"]Oswald['\"],\s*sans-serif", "var(--font-sans)", content)
    content = re.sub(r"['\"]Inter['\"],\s*sans-serif", "var(--font-sans)", content)
    
    # Replace DM Mono with var(--font-mono)
    content = re.sub(r"['\"]DM Mono['\"],\s*monospace", "var(--font-mono)", content)
    
    # If font-family in CSS or inline style is strictly just 'Oswald', replace it too
    content = re.sub(r"fontFamily:\s*['\"]Oswald['\"]", "fontFamily: 'var(--font-sans)'", content)
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
