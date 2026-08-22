import os

filepath = r'c:\Users\abdul.ahad\Desktop\ASSETS SITE\assetpro\src\components\StatCard.jsx'

if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if tone is already there
    if 'tone' not in content:
        content = content.replace('color,', 'tone="primary",')
        content = content.replace('color=', 'tone=')
        
        # Add tone map
        tone_map = """
  const getToneColor = (t) => {
    switch(t) {
      case 'success': return 'var(--status-success)';
      case 'warning': return 'var(--status-warning)';
      case 'danger': return 'var(--status-danger)';
      case 'special': return 'var(--status-special)';
      case 'info': return 'var(--status-info)';
      case 'primary': default: return 'var(--accent)';
    }
  };
  const activeColor = getToneColor(tone);
"""
        content = content.replace('const StatCard = ({', 'const StatCard = ({') # just anchoring
        # Actually a safer way is to regex it
        import re
        content = re.sub(r'const StatCard\s*=\s*\(\{\s*(.*?)\s*\}\)\s*=>\s*\{', r'const StatCard = ({\1}) => {\n' + tone_map, content)
        
        # Replace instances of color usage with ctiveColor
        content = re.sub(r'color\s*:\s*tone', 'color: activeColor', content) # if we swapped color to tone above
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
