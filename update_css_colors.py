import re

css_path = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\index.css'
with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add -soft versions if missing
new_vars = """
  --status-success-soft: rgba(22, 163, 74, 0.10);
  --status-warning-soft: rgba(217, 119, 6, 0.10);
  --status-danger-soft: rgba(220, 38, 38, 0.10);
  --status-info-soft: rgba(8, 145, 178, 0.10);
  --status-special: #7C3AED;
  --status-special-soft: rgba(124, 58, 237, 0.10);
  --signal-soft: rgba(240, 180, 41, 0.12);
  --bg-app: #F8FAFC;
  --bg-surface: #FFFFFF;
  --bg-surface-secondary: #FFFFFF;
  --bg-subtle: #F1F5F9;
  --bg-track: #E2E8F0;
  --accent-hover: #1D4ED8;
  --accent-soft: rgba(37, 99, 235, 0.10);
"""
if '--status-success-soft' not in content:
    content = content.replace('--status-success: #16A34A;', '--status-success: #16A34A;' + new_vars)

# Fix Badge Classes
content = re.sub(r'\.badge-active\s*\{.*?\}', '.badge-active   { background: var(--status-success-soft); color: var(--status-success); border: 1.5px solid rgba(22,163,74,0.25); }', content)
content = re.sub(r'\.badge-inactive\s*\{.*?\}', '.badge-inactive { background: var(--bg-subtle); color: var(--text-muted); border: 1.5px solid var(--border-default); }', content)
content = re.sub(r'\.badge-repair\s*\{.*?\}', '.badge-repair   { background: var(--status-warning-soft); color: var(--status-warning); border: 1.5px solid rgba(217,119,6,0.25); }', content)
content = re.sub(r'\.badge-disposed\s*\{.*?\}', '.badge-disposed { background: var(--status-danger-soft); color: var(--status-danger); border: 1.5px solid rgba(220,38,38,0.25); }', content)
content = re.sub(r'\.badge-onhire\s*\{.*?\}', '.badge-onhire   { background: var(--status-info-soft); color: var(--status-info); border: 1.5px solid rgba(8,145,178,0.25); }', content)
content = re.sub(r'\.badge-admin\s*\{.*?\}', '.badge-admin    { background: var(--status-danger-soft); color: var(--status-danger); border: 1.5px solid rgba(220,38,38,0.25); }', content)
content = re.sub(r'\.badge-mod\s*\{.*?\}', '.badge-mod      { background: var(--accent-soft); color: var(--accent); border: 1.5px solid rgba(37,99,235,0.25); }', content)
content = re.sub(r'\.badge-user\s*\{.*?\}', '.badge-user     { background: var(--bg-subtle); color: var(--text-secondary); border: 1.5px solid var(--border-subtle); }', content)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated index.css with semantic color vars and badge fixes.")
