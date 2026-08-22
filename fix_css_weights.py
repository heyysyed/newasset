import re

css_path = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\index.css'
with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace font-weight 600 with 500 for badges and buttons and standard UI elements that shouldn't be headings
content = re.sub(r'\.badge\s*\{([^}]*)font-weight:\s*600;([^}]*)\}', r'.badge {\1font-weight: 500;\2}', content)
content = re.sub(r'\.toggle-opt\.active\s*\{([^}]*)font-weight:\s*600;([^}]*)\}', r'.toggle-opt.active {\1font-weight: 500;\2}', content)
content = re.sub(r'\.tab-badge\s*\{([^}]*)font-weight:\s*600;([^}]*)\}', r'.tab-badge {\1font-weight: 500;\2}', content)
content = re.sub(r'font-weight:\s*600\s*!important;', r'font-weight: 500 !important;', content)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)
