import sys

def check_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple stack-based brace matching (ignoring strings and comments for a moment, just a rough check)
    stack = []
    lines = content.split('\n')
    for line_num, line in enumerate(lines, 1):
        # Extremely rudimentary, doesn't handle strings properly, but will give a hint
        # Let's do a better parser
        pass
        
    print("Done")

if __name__ == "__main__":
    check_balance('src/pages/AssetDetail.jsx')
