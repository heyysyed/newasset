const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/abdul.ahad/Desktop/ASSETS SITE/assetpro/src';
const excludeFiles = ['StickerPage.jsx', 'InventoryQRSticker.jsx'];

const mappings = [
    [/\\btext-(3xl|4xl)\\s+font-(bold|semibold|extrabold)\\b/g, 'text-page-title'],
    [/\\bfont-(bold|semibold|extrabold)\\s+text-(3xl|4xl)\\b/g, 'text-page-title'],
    [/\\btext-2xl\\s+font-(bold|semibold)\\b/g, 'text-page-title'],
    [/\\bfont-(bold|semibold)\\s+text-2xl\\b/g, 'text-page-title'],
    [/\\btext-(xl|lg)\\s+font-(bold|semibold)\\b/g, 'text-section-title'],
    [/\\bfont-(bold|semibold)\\s+text-(xl|lg)\\b/g, 'text-section-title'],
    [/\\btext-base\\s+font-(semibold|bold)\\b/g, 'text-card-title'],
    [/\\bfont-(semibold|bold)\\s+text-base\\b/g, 'text-card-title'],
    [/\\btext-(sm|xs)\\s+font-(semibold|bold)\\b/g, 'text-label'],
    [/\\bfont-(semibold|bold)\\s+text-(sm|xs)\\b/g, 'text-label'],
    [/\\btext-base\\b/g, 'text-body'],
    [/\\btext-sm\\b/g, 'text-small'],
    [/\\btext-xs\\b/g, 'text-caption'],
    [/\\bfont-medium\\b/g, 'text-body-medium'],
    [/\\btext-(gray|slate|zinc|neutral)-(900|800)\\b/g, 'text-[var(--text-primary)]'],
    [/\\btext-(gray|slate|zinc|neutral)-(700)\\b/g, 'text-[var(--text-secondary)]'],
    [/\\btext-(gray|slate|zinc|neutral)-(600|500)\\b/g, 'text-[var(--text-muted)]'],
    [/\\btext-(gray|slate|zinc|neutral)-400\\b/g, 'text-[var(--text-placeholder)]'],
    [/\\bbg-(gray|slate|zinc|neutral)-50\\b/g, 'bg-[var(--bg-app)]'],
    [/\\bbg-(gray|slate|zinc|neutral)-100\\b/g, 'bg-[var(--bg-subtle)]'],
    [/\\bborder-(gray|slate|zinc|neutral)-200\\b/g, 'border-[var(--border-default)]'],
    [/\\bborder-(gray|slate|zinc|neutral)-300\\b/g, 'border-[var(--border-strong)]'],
    [/\\btext-blue-600\\b/g, 'text-[var(--accent)]'],
    [/\\bbg-blue-600\\b/g, 'bg-[var(--accent)]'],
    [/\\btext-green-600\\b/g, 'text-[var(--status-success)]'],
    [/\\btext-red-600\\b/g, 'text-[var(--status-danger)]'],
    [/\\btext-amber-600\\b/g, 'text-[var(--status-warning)]'],
    [/\\btext-cyan-600\\b/g, 'text-[var(--status-info)]'],
    [/\\btext-purple-600\\b/g, 'text-[var(--status-special)]'],
    [/\\bfont-(bold|extrabold|black|semibold)\\b/g, '']
];

const inlineRemovals = [
    /fontWeight:\\s*(?:['"]?(?:bold|semibold|normal|[1-9]00)['"]?)?,?\\s*/g,
    /fontSize:\\s*(?:['"]?[0-9\\.]+px['"]?|[0-9\\.]+|['"]?[0-9\\.]+rem['"]?)?,?\\s*/g,
    /fontFamily:\\s*['"][^'"]+['"]?,?\\s*/g,
    /lineHeight:\\s*(?:['"]?[0-9\\.]+px['"]?|[0-9\\.]+|['"]?[0-9\\.]+rem['"]?)?,?\\s*/g,
    /letterSpacing:\\s*(?:['"]?[0-9\\.]+px['"]?|[0-9\\.]+|['"]?[0-9\\.]+rem['"]?)?,?\\s*/g
];

function processDirectory(dir) {
    let modifiedCount = 0;
    const files = fs.readdirSync(dir, { recursive: true });
    for (const file of files) {
        if (!file.endsWith('.jsx')) continue;
        const filepath = path.join(dir, file);
        if (excludeFiles.some(ex => filepath.includes(ex))) continue;

        let content = fs.readFileSync(filepath, 'utf8');
        let original = content;

        for (const [regex, replacement] of mappings) {
            content = content.replace(regex, replacement);
        }

        content = content.replace(/className="([^"]*)"/g, (m, p1) => 'className="' + p1.replace(/\\s+/g, ' ').trim() + '"');
        content = content.replace(/className='([^']*)'/g, (m, p1) => "className='" + p1.replace(/\\s+/g, ' ').trim() + "'");
        content = content.replace(/className=\\{([^]*)\\}/g, (m, p1) => 'className={' + p1.replace(/\\s+/g, ' ').trim() + '}');
        content = content.replace(/className=""/g, '');
        content = content.replace(/className={`}/g, '');

        for (const regex of inlineRemovals) {
            content = content.replace(regex, '');
        }

        content = content.replace(/style=\\{\\{\\s*\\}\\}/g, '');
        content = content.replace(/style=\\{\\{\\s*,\\s*/g, 'style={{ ');

        if (content !== original) {
            fs.writeFileSync(filepath, content, 'utf8');
            modifiedCount++;
        }
    }
    return modifiedCount;
}

const modified = processDirectory(srcDir);
console.log("Modified " + modified + " files for typography and color lockdown.");
