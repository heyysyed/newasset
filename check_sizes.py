import re

with open(r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\pages\AssetDetail.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

sizes = re.findall(r"fontSize:\s*['\"]?([\d\.]+rem)['\"]?", content)
from collections import Counter
print(Counter(sizes))
