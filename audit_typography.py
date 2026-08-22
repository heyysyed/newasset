import os
import glob
import re
from collections import Counter

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx', r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.css']

weights = Counter()
sizes = Counter()
colors = Counter()

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find font weights
            found_weights = re.findall(r'fontWeight:\s*[\'"]?(\d{3}|bold|normal)[\'"]?', content)
            weights.update(found_weights)
            
            # Find font sizes
            found_sizes = re.findall(r'fontSize:\s*[\'"]?([\d\.]+(?:px|rem|em))[\'"]?', content)
            sizes.update(found_sizes)
            
            # Find hex colors (simple)
            found_colors = re.findall(r'color:\s*[\'"]?(#[0-9a-fA-F]{3,6})[\'"]?', content)
            colors.update(found_colors)
            
        except:
            pass

print("Top Weights:", weights.most_common(10))
print("Top Sizes:", sizes.most_common(10))
print("Top Colors:", colors.most_common(15))
