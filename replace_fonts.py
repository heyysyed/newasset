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

            # Replace 'DM Sans', sans-serif or "DM Sans", sans-serif or just 'DM Sans'
            # We want to replace the whole string value in fontFamily: '...' or fontFamily: "..."
            
            # Simple regex: find fontFamily: <quote>value<quote> and replace value
            def replacer(match):
                prefix = match.group(1) # fontFamily: 
                quote = match.group(2)  # ' or "
                val = match.group(3)    # the font string itself
                
                # if mono
                if 'DM Mono' in val or 'monospace' in val and 'DM Sans' not in val:
                    return prefix + quote + 'var(--font-mono)' + quote
                elif 'DM Sans' in val or 'Oswald' in val:
                    return prefix + quote + 'var(--font-sans)' + quote
                return match.group(0)

            # This matches fontFamily: 'anything', or fontFamily: "anything", or fontFamily: nything
            new_content = re.sub(r'(fontFamily:\s*)([\''"])(.*?)\2', replacer, content)

            # Also replace raw strings outside fontFamily just in case (like in variables) if needed, but fontFamily is safer.

            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
