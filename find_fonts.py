import os
import glob
import re

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx', r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.css']
fonts_to_find = ['Oswald', 'Roboto', 'Arial', 'Helvetica', 'system-ui', 'Segoe UI']

found = []

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            for font in fonts_to_find:
                if re.search(r'\b' + font + r'\b', content, re.IGNORECASE):
                    found.append((filepath, font))
        except:
            pass

for f, font in found:
    print(f"Found {font} in {f}")
