#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DOCS_DIR = path.join(ROOT, 'docs');

async function generateFileMap() {
  const entries = [
    'AGENTS.md',
    'README.md',
    'DEVELOPER_GUIDE.md',
    'package.json',
    'vite.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'jsconfig.json',
    'index.html',
    'data/',
    'public/',
    'src/'
  ];
  let out = '/ Project root\n';
  for (const entry of entries) {
    out += `├── ${entry}\n`;
  }
  await fs.writeFile(path.join(DOCS_DIR, 'FILE_MAP.md'), out, 'utf8');
}

async function buildTree(dir, prefix = '') {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const lines = [];
  for (const item of items) {
    if (item.name.startsWith('.')) continue;
    const filePath = path.join(dir, item.name);
    const line = prefix + item.name + (item.isDirectory() ? '/' : '');
    lines.push(line);
    if (item.isDirectory()) {
      const sub = await buildTree(filePath, prefix + '  ');
      lines.push(sub);
    }
  }
  return lines.join('\n');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function generateHierarchies() {
  const featuresDir = path.join(SRC, 'features');
  const features = await fs.readdir(featuresDir);
  for (const feature of features) {
    const tree = await buildTree(path.join(featuresDir, feature));
    const md = `# ${capitalize(feature)} Component Hierarchy\n\n\`\`\`\n${tree}\n\`\`\`\n`;
    const file = path.join(DOCS_DIR, `${capitalize(feature)}Hierarchy.md`);
    await fs.writeFile(file, md, 'utf8');
  }
}

async function main() {
  await generateFileMap();
  await generateHierarchies();
  console.log('Docs generated');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
