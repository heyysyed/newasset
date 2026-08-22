import re

css_path = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\index.css'
with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the typography tokens block at the top
new_root = """:root {
  /* Typography Tokens */
  --font-sans: "DM Sans", sans-serif;
  --font-mono: "DM Mono", monospace;

  /* Color System */
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #64748B;
  --text-placeholder: #94A3B8;
  --text-inverse: #FFFFFF;

  --bg-app: #F8FAFC;
  --bg-surface: #FFFFFF;
  --bg-subtle: #F1F5F9;
  --bg-track: #E2E8F0;

  --border-default: #E2E8F0;
  --border-subtle: #F1F5F9;
  --border-strong: #CBD5E1;

  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --accent-light: #60A5FA;
  --accent-soft: rgba(37,99,235,0.10);

  --status-success: #16A34A;
  --status-success-soft: rgba(22,163,74,0.10);

  --status-warning: #D97706;
  --status-warning-soft: rgba(217,119,6,0.10);

  --status-danger: #DC2626;
  --status-danger-soft: rgba(220,38,38,0.10);

  --status-info: #0891B2;
  --status-info-soft: rgba(8,145,178,0.10);

  --status-special: #7C3AED;
  --status-special-soft: rgba(124,58,237,0.10);

  --signal: #F0B429;
  --signal-soft: rgba(240,180,41,0.12);

  /* Legacy Color Aliases (Mapped to Authoritative) */
  --text-0: var(--text-primary);
  --text-1: var(--text-primary);
  --text-2: var(--text-muted);
  --text-3: var(--text-placeholder);
  
  --bg-0: var(--bg-app);
  --bg-1: var(--bg-surface);
  --bg-2: var(--bg-surface);
  --bg-3: var(--bg-subtle);
  --bg-4: var(--bg-track);
  
  --border: var(--border-default);
  --border-light: var(--border-subtle);
  
  --accent-glow: var(--accent-soft);
  
  --green: var(--status-success);
  --green-dim: var(--status-success-soft);
  --amber: var(--status-warning);
  --amber-dim: var(--status-warning-soft);
  --red: var(--status-danger);
  --red-dim: var(--status-danger-soft);
  --cyan: var(--status-info);
  --cyan-dim: var(--status-info-soft);
  --purple: var(--status-special);
  --purple-dim: var(--status-special-soft);
  --signal-dim: var(--signal-soft);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;
}

html, body, #root {
  font-family: var(--font-sans);
}

body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  background-color: var(--bg-app);
  color: var(--text-primary);
  margin: 0;
}

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  font-family: var(--font-sans);
}

.text-page-title { font-family: var(--font-sans); font-size: 24px; line-height: 1.25; font-weight: 600; color: var(--text-primary); }
.text-section-title { font-size: 18px; line-height: 1.3; font-weight: 600; color: var(--text-primary); }
.text-card-title { font-size: 15px; line-height: 1.35; font-weight: 600; color: var(--text-primary); }
.text-body { font-size: 14px; line-height: 1.5; font-weight: 400; color: var(--text-secondary); }
.text-body-medium { font-size: 14px; line-height: 1.5; font-weight: 500; color: var(--text-primary); }
.text-small { font-size: 13px; line-height: 1.45; font-weight: 400; color: var(--text-secondary); }
.text-label { font-size: 12px; line-height: 1.35; font-weight: 500; color: var(--text-secondary); }
.text-caption { font-size: 11px; line-height: 1.35; font-weight: 400; color: var(--text-muted); }
.text-badge { font-family: var(--font-sans); font-size: 12px; line-height: 1.2; font-weight: 500; }
.text-button { font-family: var(--font-sans); font-size: 14px; line-height: 1.2; font-weight: 500; }
.text-technical { font-family: var(--font-mono); font-size: 12px; line-height: 1.35; font-weight: 400; letter-spacing: 0; }
.text-table-header { font-size: 11px; font-weight: 500; color: var(--text-muted); font-family: var(--font-sans); }
.text-table-body { font-size: 13px; font-weight: 400; color: var(--text-primary); }

.kpi-value { font-size: 24px; font-weight: 600; font-family: var(--font-sans); }
.kpi-label { font-size: 11px; font-weight: 500; font-family: var(--font-sans); color: var(--text-muted); }
.kpi-meta { font-size: 12px; font-weight: 400; font-family: var(--font-sans); color: var(--text-secondary); }
"""

# Replace the entire :root block
content = re.sub(r':root\s*\{.*?\}(?=\s*(?:\n\n|\Z))', new_root, content, flags=re.DOTALL | re.MULTILINE)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.css tokens and resets.")
