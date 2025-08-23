#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DOCS_DIR = path.join(ROOT, 'docs');

// Enhanced dynamic file map generation
async function generateFileMap() {
  console.log('📁 Generating dynamic file map...');

  // Get actual directory structure
  const rootItems = await fs.readdir(ROOT, { withFileTypes: true });
  const importantFiles = [
    'AGENTS.md',
    'README.md',
    'DEVELOPER_GUIDE.md',
    'package.json',
    'vite.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'jsconfig.json',
    'index.html',
  ];

  let out = '# Project File Map\n\n```\n/ Project root\n';

  // Add important files first
  for (const file of importantFiles) {
    if (rootItems.some((item) => item.name === file)) {
      out += `├── ${file}\n`;
    }
  }

  // Add directories with basic structure
  const dirs = rootItems.filter(
    (item) => item.isDirectory() && !item.name.startsWith('.')
  );
  for (const dir of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
    out += `├── ${dir.name}/\n`;

    // Show first level of important directories
    if (['src', 'docs', 'scripts', 'tests'].includes(dir.name)) {
      try {
        const subItems = await fs.readdir(path.join(ROOT, dir.name), {
          withFileTypes: true,
        });
        const subDirs = subItems
          .filter((item) => item.isDirectory())
          .slice(0, 8); // Limit to prevent huge output
        const subFiles = subItems
          .filter((item) => !item.isDirectory())
          .slice(0, 5);

        for (const subDir of subDirs) {
          out += `│   ├── ${subDir.name}/\n`;
        }
        for (const subFile of subFiles) {
          out += `│   ├── ${subFile.name}\n`;
        }
        if (subItems.length > 13) {
          out += `│   └── ... (${subItems.length - 13} more items)\n`;
        }
      } catch (err) {
        // Skip if can't read directory
      }
    }
  }

  out += '```\n\n*Auto-generated from actual project structure*\n';
  await fs.writeFile(path.join(DOCS_DIR, 'FILE_MAP.md'), out, 'utf8');
}

// Generate Firestore schema documentation from code analysis
async function generateFirestoreSchema() {
  console.log('🔥 Analyzing Firestore usage...');

  const schemaPath = path.join(DOCS_DIR, 'FIRESTORE_SCHEMA.md');

  // Check if FIRESTORE_SCHEMA.md already exists and has substantial content
  try {
    const existing = await fs.readFile(schemaPath, 'utf8');
    if (existing.length > 500) {
      console.log(
        '📋 FIRESTORE_SCHEMA.md already exists with comprehensive content - skipping auto-generation'
      );
      return;
    }
  } catch (err) {
    // File doesn't exist, proceed with generation
  }

  const collections = new Map();
  const queries = [];

  // Scan for Firebase usage patterns
  async function scanFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Find collection references
      const collectionMatches = content.matchAll(
        /collection\(['"`]([^'"`]+)['"`]\)/g
      );
      for (const match of collectionMatches) {
        const collectionName = match[1];
        if (!collections.has(collectionName)) {
          collections.set(collectionName, {
            fields: new Set(),
            operations: new Set(),
          });
        }
        collections.get(collectionName).operations.add('read');
      }

      // Find field references in where clauses
      const whereMatches = content.matchAll(/\.where\(['"`]([^'"`]+)['"`]\)/g);
      for (const match of whereMatches) {
        const fieldName = match[1];
        queries.push({ field: fieldName, file: path.relative(ROOT, filePath) });
      }

      // Look for data structure patterns
      const structureMatches = content.matchAll(
        /(\w+):\s*['"`]?([^,}\n]+)['"`]?/g
      );
      for (const match of structureMatches) {
        if (
          ['id', 'name', 'team', 'position', 'salary', 'grade'].includes(
            match[1]
          )
        ) {
          if (collections.has('players')) {
            collections.get('players').fields.add(match[1]);
          }
        }
      }
    } catch (err) {
      // Skip files that can't be read
    }
  }

  // Scan key Firebase-related files
  const filesToScan = [
    path.join(SRC, 'hooks'),
    path.join(SRC, 'firebase'),
    path.join(SRC, 'utils'),
  ];

  for (const scanPath of filesToScan) {
    try {
      const items = await fs.readdir(scanPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isFile() && item.name.endsWith('.js')) {
          await scanFile(path.join(scanPath, item.name));
        }
      }
    } catch (err) {
      // Directory doesn't exist, skip
    }
  }

  // Only generate if we found meaningful Firebase usage or file doesn't exist
  if (collections.size === 0) {
    console.log(
      '📋 No Firebase collections detected in code - skipping FIRESTORE_SCHEMA.md generation'
    );
    return;
  }

  // Generate minimal documentation
  let schema = '# Firestore Schema\n\n*Auto-generated from code analysis*\n\n';

  schema += '## Collections Detected in Code\n\n';
  for (const [name, info] of collections) {
    schema += `### \`${name}\`\n`;
    if (info.fields.size > 0) {
      schema += 'Fields detected:\n';
      for (const field of Array.from(info.fields).sort()) {
        schema += `- \`${field}\`\n`;
      }
    }
    schema += `Operations: ${Array.from(info.operations).join(', ')}\n\n`;
  }

  if (queries.length > 0) {
    schema += '## Query Patterns\n\n';
    const fieldQueries = {};
    queries.forEach((q) => {
      if (!fieldQueries[q.field]) fieldQueries[q.field] = [];
      fieldQueries[q.field].push(q.file);
    });

    for (const [field, files] of Object.entries(fieldQueries)) {
      schema += `- \`${field}\` - queried in: ${[...new Set(files)].join(', ')}\n`;
    }
  }

  schema +=
    '\n---\n\n*Note: This is auto-generated. For comprehensive schema documentation, create a detailed FIRESTORE_SCHEMA.md file manually.*\n';

  await fs.writeFile(schemaPath, schema, 'utf8');
}

// Update key sections of DEVELOPER_GUIDE.md
async function updateDeveloperGuide() {
  console.log('📖 Updating DEVELOPER_GUIDE sections...');

  try {
    const guidePath = path.join(ROOT, 'DEVELOPER_GUIDE.md');
    let content = await fs.readFile(guidePath, 'utf8');

    // Get package.json scripts
    const packageJson = JSON.parse(
      await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')
    );
    const scripts = packageJson.scripts || {};

    // Generate scripts section
    let scriptsSection =
      '\n## Available Scripts\n\n*Auto-updated from package.json*\n\n';
    for (const [name, command] of Object.entries(scripts)) {
      scriptsSection += `- \`npm run ${name}\` - ${command}\n`;
    }
    scriptsSection += '\n';

    // Update or add scripts section
    const scriptsRegex = /## Available Scripts[\s\S]*?(?=\n## |\n# |$)/;
    if (scriptsRegex.test(content)) {
      content = content.replace(scriptsRegex, scriptsSection.trim());
    } else {
      // Add after project overview if scripts section doesn't exist
      content = content.replace(
        /(## Project Overview[\s\S]*?)(\n## )/g,
        `$1${scriptsSection}$2`
      );
    }

    await fs.writeFile(guidePath, content, 'utf8');
  } catch (err) {
    console.warn('Could not update DEVELOPER_GUIDE.md:', err.message);
  }
}

async function buildTree(dir, prefix = '') {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const lines = [];
  for (const item of items) {
    if (item.name.startsWith('.')) continue; // 🚫 Skip hidden files like .DS_Store

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
  const features = await fs.readdir(featuresDir, { withFileTypes: true });

  for (const feature of features) {
    if (!feature.isDirectory()) continue; // ✅ Only process actual folders

    const tree = await buildTree(path.join(featuresDir, feature.name));
    const md = `# ${capitalize(feature.name)} Component Hierarchy\n\n\`\`\`\n${tree}\n\`\`\`\n`;
    const file = path.join(DOCS_DIR, `${capitalize(feature.name)}Hierarchy.md`);
    await fs.writeFile(file, md, 'utf8');
  }
}

async function main() {
  await generateFileMap();
  await generateFirestoreSchema();
  await updateDeveloperGuide();
  await generateHierarchies();
  console.log('✅ Enhanced docs generated successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
