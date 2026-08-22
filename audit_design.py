import os
import glob
import re
from collections import Counter

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx', r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.css']

rogue_colors = Counter()
rogue_radii = Counter()
rogue_spacings = Counter()

color_pattern = re.compile(r'color:\s*[\'"]?(#333|#444|#555|#666|#777|#888|#999)[\'"]?', re.IGNORECASE)
radius_pattern = re.compile(r'borderRadius:\s*[\'"]?([0-9]+px)[\'"]?')
padding_pattern = re.compile(r'padding:\s*[\'"]?([0-9]+px)[\'"]?')

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            for match in color_pattern.findall(content):
                rogue_colors[match.lower()] += 1
            for match in radius_pattern.findall(content):
                rogue_radii[match] += 1
            for match in padding_pattern.findall(content):
                rogue_spacings[match] += 1
                
        except:
            pass

print("Rogue Colors:", rogue_colors.most_common())
print("Radii:", rogue_radii.most_common(10))
print("Paddings:", rogue_spacings.most_common(10))
