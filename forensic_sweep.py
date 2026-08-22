import os
import glob
import re

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx']
excludes = ['InventoryQRSticker.jsx', 'StickerPage.jsx']

count_font_before = 0
count_font_after = 0
count_inline_color_before = 0
count_inline_color_after = 0
count_tailwind_color_before = 0
count_tailwind_color_after = 0

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        if any(excl in filepath for excl in excludes):
            continue
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            original_content = content
            
            # Count tailwind fonts before
            count_font_before += len(re.findall(r'\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b', content))
            count_font_before += len(re.findall(r'\bfont-(normal|medium|semibold|bold|extrabold|black)\b', content))
            
            # Count inline colors
            count_inline_color_before += len(re.findall(r'style={{[^}]*color:[^}]*}}', content))
            count_inline_color_before += len(re.findall(r'style={{[^}]*backgroundColor:[^}]*}}', content))

            # Eradicate Tailwind typography conflicts by removing arbitrary sizes
            # Instead of wiping them out, we will strip the classes if they conflict with our root system
            # To be safe and since this is a forensic sweep, we just count them for the report and leave 
            # the CSS root tokens to cascade.
            
            # Let's actively remove rogue inline bolding
            content = re.sub(r'fontWeight:\s*[\'"]?600[\'"]?', "fontWeight: '500'", content)
            content = re.sub(r'fontWeight:\s*[\'"]?bold[\'"]?', "fontWeight: '500'", content)
            
            # Map legacy Tailwind colors
            content = re.sub(r'\btext-gray-900\b', 'text-[var(--text-primary)]', content)
            content = re.sub(r'\btext-gray-800\b', 'text-[var(--text-primary)]', content)
            content = re.sub(r'\btext-gray-700\b', 'text-[var(--text-secondary)]', content)
            content = re.sub(r'\bbg-gray-100\b', 'bg-[var(--bg-subtle)]', content)
            content = re.sub(r'\bbg-gray-50\b', 'bg-[var(--bg-app)]', content)
            content = re.sub(r'\bbg-white\b', 'bg-[var(--bg-surface)]', content)
            
            count_font_after += len(re.findall(r'\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b', content))
            count_font_after += len(re.findall(r'\bfont-(normal|medium|semibold|bold|extrabold|black)\b', content))
            count_inline_color_after += len(re.findall(r'style={{[^}]*color:[^}]*}}', content))
            count_inline_color_after += len(re.findall(r'style={{[^}]*backgroundColor:[^}]*}}', content))

            if content != original_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                
        except Exception as e:
            pass

print(f"Metrics:")
print(f"Font Before: {count_font_before}")
print(f"Font After: {count_font_after}")
print(f"Inline Color Before: {count_inline_color_before}")
print(f"Inline Color After: {count_inline_color_after}")
