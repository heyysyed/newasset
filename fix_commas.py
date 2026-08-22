import os
import glob
import re

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx']

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original = content
        
        # Fix {{ ,  -> {{
        content = re.sub(r"\{\{\s*,", "{{", content)
        content = re.sub(r"\{\s*,", "{", content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed commas in {filepath}")
