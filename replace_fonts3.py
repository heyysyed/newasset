import os
import re

dir_path = 'src'
font_sans = 'var(--font-sans)'
font_mono = 'var(--font-mono)'

for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            def replacer(match):
                prefix = match.group(1)
                quote = match.group(2)
                val = match.group(3)
                
                if 'DM Mono' in val or 'monospace' in val:
                    if 'DM Sans' not in val:
                        return prefix + quote + font_mono + quote
                if 'DM Sans' in val or 'Oswald' in val:
                    return prefix + quote + font_sans + quote
                return match.group(0)

            # Note the simple ['"] to match single or double quote
            new_content = re.sub(r'(fontFamily:\s*)([\'"])(.*?)\2', replacer, content)

            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print("Updated " + filepath)
