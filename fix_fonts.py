import os
import glob
import re

directories = [
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\ReportsPage.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\reports\*.jsx'
]

for directory in directories:
    for filepath in glob.glob(directory):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove fontFamily: '...' and fontFamily: "..."
        content = re.sub(r",?\s*fontFamily:\s*['\"].*?['\"]", "", content)
        content = re.sub(r"fontFamily:\s*['\"].*?['\"]\s*,?", "", content)
        
        # Remove className="font-display"
        content = re.sub(r"className=\"font-display\"\s*", "", content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
