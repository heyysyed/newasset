import os
import glob
import re

directories = [r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\**\*.jsx']
excludes = ['InventoryQRSticker.jsx', 'StickerPage.jsx']

color_map = {
    # Red
    r'#ef4444': 'var(--status-danger)',
    r'rgba\(239,\s*68,\s*68,\s*0\.[0-9]+\)': 'var(--status-danger-soft)',
    r'#dc2626': 'var(--status-danger)',
    
    # Amber/Yellow
    r'#f59e0b': 'var(--status-warning)',
    r'rgba\(245,\s*158,\s*11,\s*0\.[0-9]+\)': 'var(--status-warning-soft)',
    r'#d97706': 'var(--status-warning)',
    
    # Blue/Indigo (Mod/User)
    r'#818cf8': 'var(--status-special)',
    r'rgba\(129,\s*140,\s*248,\s*0\.[0-9]+\)': 'var(--status-special-soft)',
    r'#60a5fa': 'var(--status-info)',
    r'rgba\(96,\s*165,\s*250,\s*0\.[0-9]+\)': 'var(--status-info-soft)',
    
    # Cyan
    r'rgba\(34,\s*211,\s*238,\s*0\.[0-9]+\)': 'var(--status-info-soft)',
    r'#22d3ee': 'var(--status-info)',
    
    # Green
    r'#16a34a': 'var(--status-success)',
    r'rgba\(22,\s*163,\s*74,\s*0\.[0-9]+\)': 'var(--status-success-soft)',
    
    # Purple
    r'#8b5cf6': 'var(--status-special)',
    
    # Primary Accent
    r'#2563eb': 'var(--accent)',
    r'rgba\(79,\s*126,\s*255,\s*0\.[0-9]+\)': 'var(--accent-soft)',
}

def replace_color(match):
    full_str = match.group(0)
    for pattern, replacement in color_map.items():
        if re.search(pattern, full_str):
            return re.sub(pattern, replacement, full_str)
    return full_str

for pattern in directories:
    for filepath in glob.glob(pattern, recursive=True):
        if any(excl in filepath for excl in excludes):
            continue
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            original_content = content
            
            # 1. Replace StatCard color="#" with tone=""
            content = re.sub(r'<StatCard([^>]*?)color=[\'"]#2563eb[\'"]([^>]*?)>', r'<StatCard\1tone="primary"\2>', content)
            content = re.sub(r'<StatCard([^>]*?)color=[\'"]#d97706[\'"]([^>]*?)>', r'<StatCard\1tone="warning"\2>', content)
            content = re.sub(r'<StatCard([^>]*?)color=[\'"]#8b5cf6[\'"]([^>]*?)>', r'<StatCard\1tone="special"\2>', content)
            content = re.sub(r'<StatCard([^>]*?)color=[\'"]#16a34a[\'"]([^>]*?)>', r'<StatCard\1tone="success"\2>', content)
            content = re.sub(r'<StatCard([^>]*?)color=[\'"]#dc2626[\'"]([^>]*?)>', r'<StatCard\1tone="danger"\2>', content)
            
            # 2. Replace hardcoded hexes/rgba in style={{...}} blocks and object literals
            for old_pat, new_val in color_map.items():
                # For quotes around the color: '#ef4444'
                content = re.sub(r"'" + old_pat + r"'", f"'{new_val}'", content)
                content = re.sub(r'"' + old_pat + r'"', f"'{new_val}'", content)
                # Unquoted in string interpolations or raw
                content = re.sub(old_pat, new_val, content)
            
            # 3. Replace text-gray-500, etc.
            content = re.sub(r'\btext-gray-500\b', 'text-[var(--text-muted)]', content)
            content = re.sub(r'\btext-gray-400\b', 'text-[var(--text-placeholder)]', content)
            content = re.sub(r'\btext-gray-600\b', 'text-[var(--text-secondary)]', content)
            content = re.sub(r'\btext-slate-500\b', 'text-[var(--text-muted)]', content)
            content = re.sub(r'\bbg-gray-50\b', 'bg-[var(--bg-subtle)]', content)
            content = re.sub(r'\bbg-slate-50\b', 'bg-[var(--bg-subtle)]', content)
            
            if content != original_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                
        except Exception as e:
            pass

print("Remediation script finished.")
