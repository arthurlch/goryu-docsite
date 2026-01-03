import fs from 'fs';
import path from 'path';

const sourceDir = path.resolve('/Users/arthur/Documents/personal/goryudoc/documentation/middleware');
const targetDir = path.resolve('/Users/arthur/Documents/personal/goryudoc/docs/middleware');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const middlewares = fs.readdirSync(sourceDir);

const middlewareList = [];

middlewares.forEach(mw => {
    const mwPath = path.join(sourceDir, mw);
    if (fs.statSync(mwPath).isDirectory()) {
        const readmePath = path.join(mwPath, 'README.md');
        if (fs.existsSync(readmePath)) {
            const content = fs.readFileSync(readmePath, 'utf-8');
            const targetPath = path.join(targetDir, `${mw}.md`);
            fs.writeFileSync(targetPath, content);
            console.log(`Migrated ${mw}`);
            middlewareList.push(mw);
        }
    }
});

// Create index.md for middleware
const indexContent = `# Middleware

Goryu comes with a rich set of built-in middlewares.

## Available Middleware

${middlewareList.map(mw => `- [${mw}](/middleware/${mw})`).join('\n')}
`;

fs.writeFileSync(path.join(targetDir, 'index.md'), indexContent);

// Update config.mts sidebar
const configPath = path.resolve('/Users/arthur/Documents/personal/goryudoc/docs/.vitepress/config.mts');
let configContent = fs.readFileSync(configPath, 'utf-8');

const sidebarItems = middlewareList.map(mw => `            { text: '${mw.charAt(0).toUpperCase() + mw.slice(1)}', link: '/middleware/${mw}' },`).join('\n');

const newSidebarSection = `      '/middleware/': [
        {
          text: 'Middleware',
          items: [
            { text: 'Overview', link: '/middleware/' },
${sidebarItems}
          ]
        }
      ],`;

// Replace the middleware sidebar section
// This is a naive replace, assuming the structure matches what I wrote earlier.
// If it fails, I'll update manually.
// Actually, let's just rewrite the regex to be safe or just update the file directly with the tool again.
// Using the script to generate the list and print it might be safer than regex replacing in the script if I'm not careful.
// But I can just print the list and use `replace_file_content` tool.

console.log("Middleware List for Sidebar:");
console.log(JSON.stringify(middlewareList));
