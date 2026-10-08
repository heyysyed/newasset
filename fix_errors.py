import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    modified = False
    new_lines = []
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        # Check if line has `const { data, error } = await supabase`
        if 'const { data, error } = await supabase' in line or 'const { data, error } = await' in line:
            # Check if next few lines have `if (error)`
            has_check = False
            for j in range(1, 4):
                if i + j < len(lines) and 'if (error)' in lines[i+j]:
                    has_check = True
                    break
            
            if not has_check:
                # Add check
                indent = line[:len(line) - len(line.lstrip())]
                new_lines.append(indent + 'if (error) { console.error(error); throw error; }\n')
                modified = True
                
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Patched: {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))
