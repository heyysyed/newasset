import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "import * as XLSX from 'xlsx'" not in content:
        return
        
    # Remove the static import
    content = content.replace("import * as XLSX from 'xlsx'\n", "")
    content = content.replace("import * as XLSX from 'xlsx';\n", "")
    content = content.replace("import * as XLSX from 'xlsx'", "")
    
    # We need to find functions that use XLSX. Since it's usually inside an export function 
    # we can just find 'XLSX.' and inject the import before it if it's not already there.
    # A simpler way is to just replace 'XLSX.' with '(await import('xlsx')).' but that imports it multiple times.
    # Actually, we can just replace `XLSX.utils` with `(await import('xlsx')).utils` etc.
    # Let's do a simple regex replace: XLSX\. -> (await import('xlsx')).
    
    content = re.sub(r'\bXLSX\.', "(await import('xlsx')).", content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched XLSX in: {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))
