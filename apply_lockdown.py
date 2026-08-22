import os
import re

src_dir = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src'
exclude_files = ['StickerPage.jsx', 'InventoryQRSticker.jsx']

tailwind_mappings = [
    (r'\btext-(?:3xl|4xl)\s+font-(?:bold|semibold|extrabold)\b', 'text-page-title'),
    (r'\bfont-(?:bold|semibold|extrabold)\s+text-(?:3xl|4xl)\b', 'text-page-title'),
    (r'\btext-2xl\s+font-(?:bold|semibold)\b', 'text-page-title'),
    (r'\bfont-(?:bold|semibold)\s+text-2xl\b', 'text-page-title'),
    (r'\btext-(?:xl|lg)\s+font-(?:bold|semibold)\b', 'text-section-title'),
    (r'\bfont-(?:bold|semibold)\s+text-(?:xl|lg)\b', 'text-section-title'),
    (r'\btext-base\s+font-(?:semibold|bold)\b', 'text-card-title'),
    (r'\bfont-(?:semibold|bold)\s+text-base\b', 'text-card-title'),
    (r'\btext-(?:sm|xs)\s+font-(?:semibold|bold)\b', 'text-label'),
    (r'\bfont-(?:semibold|bold)\s+text-(?:sm|xs)\b', 'text-label'),
    (r'\btext-base\b', 'text-body'),
    (r'\btext-sm\b', 'text-small'),
    (r'\btext-xs\b', 'text-caption'),
    (r'\bfont-medium\b', 'text-body-medium'),
    (r'\btext-(?:gray|slate|zinc|neutral)-(?:900|800)\b', 'text-[var(--text-primary)]'),
    (r'\btext-(?:gray|slate|zinc|neutral)-700\b', 'text-[var(--text-secondary)]'),
    (r'\btext-(?:gray|slate|zinc|neutral)-(?:600|500)\b', 'text-[var(--text-muted)]'),
    (r'\btext-(?:gray|slate|zinc|neutral)-400\b', 'text-[var(--text-placeholder)]'),
    (r'\bbg-(?:gray|slate|zinc|neutral)-50\b', 'bg-[var(--bg-app)]'),
    (r'\bbg-(?:gray|slate|zinc|neutral)-100\b', 'bg-[var(--bg-subtle)]'),
    (r'\bborder-(?:gray|slate|zinc|neutral)-200\b', 'border-[var(--border-default)]'),
    (r'\bborder-(?:gray|slate|zinc|neutral)-300\b', 'border-[var(--border-strong)]'),
    (r'\btext-blue-600\b', 'text-[var(--accent)]'),
    (r'\bbg-blue-600\b', 'bg-[var(--accent)]'),
    (r'\btext-green-600\b', 'text-[var(--status-success)]'),
    (r'\btext-red-600\b', 'text-[var(--status-danger)]'),
    (r'\btext-amber-600\b', 'text-[var(--status-warning)]'),
    (r'\btext-cyan-600\b', 'text-[var(--status-info)]'),
    (r'\btext-purple-600\b', 'text-[var(--status-special)]'),
    (r'\bfont-(?:bold|extrabold|black)\b', ''),
]

inline_style_removals = [
    r'fontWeight:\s*(?:[\'"]?(?:bold|semibold|normal|[1-9]00)[\'"]?)?,?\s*',
    r'fontSize:\s*(?:[\'"]?[0-9\.]+px[\'"]?|[0-9\.]+|[\'"]?[0-9\.]+rem[\'"]?)?,?\s*',
    r'fontFamily:\s*[\'"][^\'"]+[\'"]?,?\s*',
    r'lineHeight:\s*(?:[\'"]?[0-9\.]+px[\'"]?|[0-9\.]+|[\'"]?[0-9\.]+rem[\'"]?)?,?\s*',
    r'letterSpacing:\s*(?:[\'"]?[0-9\.]+px[\'"]?|[0-9\.]+|[\'"]?[0-9\.]+rem[\'"]?)?,?\s*'
]

modified_count = 0

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            if any(excl in filepath for excl in exclude_files):
                continue
                
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                original_content = content
                
                for pattern, replacement in tailwind_mappings:
                    content = re.sub(pattern, replacement, content)
                    
                # Clean up double spaces from replacements
                content = re.sub(r'className="([^"]*)"', lambda m: 'className="' + ' '.join(m.group(1).split()) + '"', content)
                content = re.sub(r"className='([^']*)'", lambda m: "className='" + ' '.join(m.group(1).split()) + "'", content)
                content = re.sub(r'className=\{([^]*)\}', lambda m: 'className={' + ' '.join(m.group(1).split()) + '}', content)
                
                for pattern in inline_style_removals:
                    content = re.sub(pattern, '', content)
                    
                content = re.sub(r'style=\{\{\s*\}\}', '', content)
                content = re.sub(r'style=\{\{\s*,\s*', 'style={{ ', content)
                
                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    modified_count += 1
                    
            except Exception as e:
                pass

print(f"Modified {modified_count} files for typography and color lockdown.")
