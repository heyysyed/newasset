import os
import glob
import re

filepath = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\AssetDetail.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

original_content = content

# Remove redundant fontFamily: "var(--font-sans)" since it's inherited globally anyway
content = re.sub(r",?\s*fontFamily:\s*['\"]var\(--font-sans\)['\"]", "", content)
content = re.sub(r"fontFamily:\s*['\"]var\(--font-sans\)['\"]\s*,?", "", content)

if content != original_content:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Cleaned up redundant font families in {filepath}")
