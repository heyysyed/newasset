import os
import glob

directory = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\assets\*.jsx'
for filepath in glob.glob(directory):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "from './AssetDetail'" in content:
        content = content.replace("from './AssetDetail'", "from '../../pages/AssetDetail'")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
