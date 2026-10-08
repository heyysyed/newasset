import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace key={i} with key={'skel-'+i} where skeleton is nearby
    # We will just do a simple replacement for key={i} to key={`item-${i}`} on map loops.
    # A safe bet is looking for `.map((_, i) => <Cell key={i}` -> `key={`cell-${i}`}`
    # and `.map(i => <div key={i} className="skeleton"` -> `key={`skel-${i}`}`
    
    original_content = content
    
    # Replace Cell keys
    content = re.sub(r'<Cell\s+key=\{i\}', r'<Cell key={`cell-${i}`}', content)
    
    # Replace skeleton keys
    content = re.sub(r'key=\{i\}(\s+className="skeleton)', r'key={`skel-${i}`}\1', content)
    content = re.sub(r'key=\{i\}(\s+style={{[^}]*borderRadius)', r'key={`skel2-${i}`}\1', content)
    
    # Other common safe replaces
    content = re.sub(r'<div\s+key=\{i\}\s+className="h-', r'<div key={`skel3-${i}`} className="h-', content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched keys in: {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))
