import re

css_path = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\index.css'

with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Typography to EXACT 2A.9.2 specifications
content = re.sub(r'--text-display:.*?;', r'--text-display: 700 36px/1.1 var(--font-sans);', content)
content = re.sub(r'--text-page-title:.*?;', r'--text-page-title: 600 24px/1.2 var(--font-sans);', content)
content = re.sub(r'--text-section-title:.*?;', r'--text-section-title: 600 18px/1.3 var(--font-sans);', content)
content = re.sub(r'--text-card-title:.*?;', r'--text-card-title: 600 15px/1.35 var(--font-sans);', content)
content = re.sub(r'--text-body:.*?;', r'--text-body: 400 14px/1.5 var(--font-sans);', content)
content = re.sub(r'--text-body-semibold:.*?;', r'--text-body-semibold: 600 14px/1.5 var(--font-sans);', content)
content = re.sub(r'--text-small:.*?;', r'--text-small: 400 13px/1.45 var(--font-sans);', content)
content = re.sub(r'--text-label:.*?;', r'--text-label: 600 12px/1.35 var(--font-sans);', content)
content = re.sub(r'--text-caption:.*?;', r'--text-caption: 400 11px/1.4 var(--font-sans);', content)
content = re.sub(r'--text-badge:.*?;', r'--text-badge: 600 11px/1.2 var(--font-sans);', content)
content = re.sub(r'--text-table-header:.*?;', r'--text-table-header: 600 11px/1.25 var(--font-sans);', content)
content = re.sub(r'--text-table-body:.*?;', r'--text-table-body: 400 13px/1.4 var(--font-sans);', content)
content = re.sub(r'--text-button:.*?;', r'--text-button: 600 13px/1.25 var(--font-sans);', content)
content = re.sub(r'--text-technical:.*?;', r'--text-technical: 500 12px/1.35 var(--font-mono);', content)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.css with strict Phase 2A.9.2 precise pixel metrics")
