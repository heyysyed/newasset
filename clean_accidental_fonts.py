import os
import re

files_to_fix = [
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\assets\AgeIntelligenceView.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\assets\AssetTransferTab.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\checklist\ChecklistDetailModal.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\inventory\GatePassTab.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\inventory\InventoryQRSticker.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\materials\IssueSlipTab.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\materials\TransfersTab.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\mobile\MobileAssetDetail.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\mobile\MobileExcelImport.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\mobile\MobileSiteDetail.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\AssetDetail.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\AssetForm.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\AssetList.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\MaintenancePage.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\StickerPage.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\index.css'
]

fonts_to_remove = ['Oswald', 'Arial', 'Helvetica', 'Segoe UI', 'Roboto', 'system-ui']

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # We want to catch things like: fontFamily: 'Oswald, sans-serif'
    # or fontFamily: "Segoe UI"
    for font in fonts_to_remove:
        # Regex to catch fontFamily: '...' where the string contains the font name
        # We replace the entire font family declaration with var(--font-sans)
        # e.g. fontFamily: "'Oswald', sans-serif" -> fontFamily: "var(--font-sans)"
        content = re.sub(r"fontFamily:\s*['\"].*?(?i:" + re.escape(font) + r").*?['\"]", "fontFamily: 'var(--font-sans)'", content)
        # also handle CSS format: font-family: 'Oswald', sans-serif;
        content = re.sub(r"font-family:\s*.*?(?i:" + re.escape(font) + r").*?;", "font-family: var(--font-sans);", content)

    # Next, clean up redundant fontFamily: 'var(--font-sans)' declarations since body inherits it
    content = re.sub(r",?\s*fontFamily:\s*['\"]var\(--font-sans\)['\"]", "", content)
    content = re.sub(r"fontFamily:\s*['\"]var\(--font-sans\)['\"]\s*,?", "", content)
    
    # Same for CSS redundant declarations
    content = re.sub(r"font-family:\s*var\(--font-sans\);\s*", "", content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Cleaned {filepath}")
