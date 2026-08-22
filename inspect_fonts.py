import os
import glob
import re

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx', r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.css']
fonts_to_find = ['Oswald', 'Roboto', 'Arial', 'Helvetica', 'system-ui', 'Segoe UI']

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            lines = content.split('\n')
            for i, line in enumerate(lines):
                for font in fonts_to_find:
                    if re.search(r'\b' + font + r'\b', line, re.IGNORECASE):
                        print(f"{filepath}:{i+1}: {line.strip()}")
        except:
            pass
