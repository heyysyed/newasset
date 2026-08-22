import os
import glob
import re

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx']
excludes = ['InventoryQRSticker.jsx', 'StickerPage.jsx', 'AssetList.jsx']

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        if any(excl in filepath for excl in excludes):
            continue
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            original_content = content
            
            # Remove font-oswald classes
            content = re.sub(r'\bfont-oswald\b\s*', '', content)

            if content != original_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                
        except Exception as e:
            pass
