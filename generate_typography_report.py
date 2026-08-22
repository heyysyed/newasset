import os
import glob
import re

directories = [
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\**\*.jsx',
    r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\**\*.jsx'
]

results = {}

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        filename = os.path.basename(filepath)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract inline fontSizes: fontSize: '0.8rem' or fontSize: 12
        sizes = re.findall(r"fontSize:\s*['\"]?([\d\.]+(?:rem|px|em|vw|%)?)['\"]?", content)
        
        # Extract Tailwind classes like text-sm, text-lg
        tw_sizes = re.findall(r"text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)", content)
        tw_sizes = [f"text-{s}" for s in tw_sizes]
        
        all_sizes = set(sizes + tw_sizes)
        if all_sizes:
            results[filename] = sorted(list(all_sizes))

markdown = "# AssetPro Typography Report\n\nThis document outlines the font sizes detected in each page and component across the site.\n\n"
markdown += "*Note: The global font family has been standardized to ar(--font-sans) (DM Sans) and ar(--font-mono) (DM Mono).* \n\n"

for name in sorted(results.keys()):
    sizes_str = ", ".join(results[name])
    markdown += f"### {name}\n- **Sizes used:** {sizes_str}\n\n"

with open(r'C:\Users\abdul.ahad\.gemini\antigravity-ide\brain\094acd62-6f9d-45d0-8870-6c57831c527c\typography_report.md', 'w', encoding='utf-8') as f:
    f.write(markdown)

print("Report generated successfully.")
