const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/abdul.ahad/Desktop/ASSETS SITE/assetpro/src';
const excludeFiles = ['StickerPage.jsx', 'InventoryQRSticker.jsx'];

function processDirectory(dir) {
    let modifiedCount = 0;
    const files = fs.readdirSync(dir, { recursive: true });
    
    for (const file of files) {
        if (!file.endsWith('.jsx') && !file.endsWith('.tsx')) continue;
        
        const filepath = path.join(dir, file);
        if (excludeFiles.some(ex => filepath.includes(ex))) continue;

        let content = fs.readFileSync(filepath, 'utf8');
        let original = content;

        // Size tokens
        const replacements = {
            'text-4xl': 'text-page-title',
            'text-3xl': 'text-page-title',
            'text-2xl': 'text-page-title',
            'text-xl': 'text-section-title',
            'text-lg': 'text-section-title',
        };

        for (const [key, val] of Object.entries(replacements)) {
            const r = new RegExp('\\b' + key + '\\b', 'g');
            content = content.replace(r, val);
        }

        const exactTokens = [
            [/\btext-base\b/g, 'text-body'],
            [/\btext-sm\b/g, 'text-small'],
            [/\btext-xs\b/g, 'text-caption'],
            [/\bfont-medium\b/g, 'text-body-medium'],
            [/\bfont-semibold\b/g, ''],
            [/\bfont-bold\b/g, ''],
            [/\bfont-extrabold\b/g, ''],
            [/\bfont-black\b/g, ''],
            [/\btext-gray-900\b/g, 'text-[var(--text-primary)]'],
            [/\btext-gray-800\b/g, 'text-[var(--text-primary)]'],
            [/\btext-gray-700\b/g, 'text-[var(--text-secondary)]'],
            [/\btext-gray-600\b/g, 'text-[var(--text-muted)]'],
            [/\btext-gray-500\b/g, 'text-[var(--text-muted)]'],
            [/\btext-gray-400\b/g, 'text-[var(--text-placeholder)]'],
            [/\bbg-gray-50\b/g, 'bg-[var(--bg-app)]'],
            [/\bbg-gray-100\b/g, 'bg-[var(--bg-subtle)]'],
            [/\bborder-gray-200\b/g, 'border-[var(--border-default)]'],
            [/\bborder-gray-300\b/g, 'border-[var(--border-strong)]'],
            [/\btext-slate-900\b/g, 'text-[var(--text-primary)]'],
            [/\btext-slate-800\b/g, 'text-[var(--text-primary)]'],
            [/\btext-slate-700\b/g, 'text-[var(--text-secondary)]'],
            [/\btext-slate-600\b/g, 'text-[var(--text-muted)]'],
            [/\btext-slate-500\b/g, 'text-[var(--text-muted)]'],
            [/\btext-slate-400\b/g, 'text-[var(--text-placeholder)]'],
            [/\bbg-slate-50\b/g, 'bg-[var(--bg-app)]'],
            [/\bbg-slate-100\b/g, 'bg-[var(--bg-subtle)]'],
            [/\bborder-slate-200\b/g, 'border-[var(--border-default)]'],
            [/\bborder-slate-300\b/g, 'border-[var(--border-strong)]'],
            [/\btext-blue-600\b/g, 'text-[var(--accent)]'],
            [/\bbg-blue-600\b/g, 'bg-[var(--accent)]'],
            [/\btext-green-600\b/g, 'text-[var(--status-success)]'],
            [/\btext-red-600\b/g, 'text-[var(--status-danger)]'],
            [/\btext-amber-600\b/g, 'text-[var(--status-warning)]'],
            [/\btext-cyan-600\b/g, 'text-[var(--status-info)]'],
            [/\btext-purple-600\b/g, 'text-[var(--status-special)]'],
        ];

        for (const [r, val] of exactTokens) {
            content = content.replace(r, val);
        }

        // Inline styles
        const inlineRemovals = [
            /fontWeight:\s*(?:['"]?(?:bold|semibold|normal|[1-9]00)['"]?)?,?\s*/g,
            /fontSize:\s*(?:['"]?[0-9\.]+px['"]?|[0-9\.]+|['"]?[0-9\.]+rem['"]?)?,?\s*/g,
            /fontFamily:\s*['"][^'"]+['"]?,?\s*/g,
            /lineHeight:\s*(?:['"]?[0-9\.]+px['"]?|[0-9\.]+|['"]?[0-9\.]+rem['"]?)?,?\s*/g,
        ];
        
        for (const regex of inlineRemovals) {
            content = content.replace(regex, '');
        }

        // Clean up empty classes
        content = content.replace(/className="([^"]*)"/g, (m, p1) => {
            let c = p1.replace(/\s+/g, ' ').trim();
            return c ? 'className="' + c + '"' : '';
        });
        
        // Clean up empty style objects
        content = content.replace(/style=\{\{\s*\}\}/g, '');
        content = content.replace(/style=\{\{\s*,\s*/g, 'style={{ ');

        if (content !== original) {
            fs.writeFileSync(filepath, content, 'utf8');
            modifiedCount++;
        }
    }
    return modifiedCount;
}

const modified = processDirectory(srcDir);
console.log("Modified " + modified + " files");
