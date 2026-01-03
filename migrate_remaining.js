import fs from 'fs';
import path from 'path';

const mappings = [
    { src: 'documentation/client/README.md', dest: 'docs/core/client.md' },
    { src: 'documentation/config/README.md', dest: 'docs/core/config.md' },
    { src: 'documentation/db/README.md', dest: 'docs/core/db.md' },
    { src: 'documentation/goryuctx/README.md', dest: 'docs/core/context.md' },
    { src: 'documentation/monitoring/README.md', dest: 'docs/monitoring/index.md' },
    { src: 'documentation/monitoring/UI_README.md', dest: 'docs/monitoring/ui.md' },
    { src: 'documentation/plugins/README.md', dest: 'docs/plugins/index.md' },
    { src: 'documentation/router/builder/README.md', dest: 'docs/router/builder.md' },
    { src: 'documentation/tutorial.md', dest: 'docs/guide/tutorial.md' },
    { src: 'documentation/route/README.md', dest: 'docs/router/route.md' } // Just in case it's different
];

mappings.forEach(map => {
    const srcPath = path.resolve('/Users/arthur/Documents/personal/goryudoc', map.src);
    const destPath = path.resolve('/Users/arthur/Documents/personal/goryudoc', map.dest);
    
    // Ensure dest dir exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(srcPath)) {
        const content = fs.readFileSync(srcPath, 'utf-8');
        fs.writeFileSync(destPath, content);
        console.log(`Migrated ${map.src} -> ${map.dest}`);
    } else {
        console.log(`WARNING: Source not found: ${map.src}`);
    }
});
