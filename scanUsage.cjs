#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);

// Configuration
const FEATURES_DIR = path.join(process.cwd(), 'src/features');
const OUTPUT_FILE = 'import-hierarchy.txt';
const IGNORE_FILES = ['index.js', 'index.ts', 'index.cjs', 'index.mjs'];
const IGNORE_EXTENSIONS = ['.test.', '.spec.', '.mock.', '.stories.'];

// Data structures
const importMap = new Map(); // file -> its imports
const reverseImportMap = new Map(); // file -> files that import it
const filePaths = new Set(); // all relevant files
const rootFiles = new Set(); // files that aren't imported by anything

async function scanFeatures() {
  try {
    // First pass: find all files and their imports
    await buildImportMap();

    // Second pass: identify root files (not imported by others)
    identifyRootFiles();

    // Third pass: build hierarchy
    const hierarchy = buildHierarchy();

    // Display and save
    displayHierarchy(hierarchy);
    await saveHierarchy(hierarchy);

    console.log(`\nImport hierarchy saved to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Error scanning features:', err);
    process.exit(1);
  }
}

async function buildImportMap() {
  const features = await readdir(FEATURES_DIR);

  for (const feature of features) {
    const featurePath = path.join(FEATURES_DIR, feature);
    const stats = await stat(featurePath);

    if (stats.isDirectory()) {
      await processDirectory(featurePath);
    }
  }
}

async function processDirectory(dirPath) {
  const items = await readdir(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stats = await stat(fullPath);

    if (shouldIgnoreFile(item)) continue;

    if (stats.isDirectory()) {
      await processDirectory(fullPath);
    } else {
      await processFile(fullPath);
    }
  }
}

async function processFile(filePath) {
  const relativePath = path.relative(FEATURES_DIR, filePath);
  filePaths.add(relativePath);

  const imports = await getImports(filePath);
  importMap.set(relativePath, imports);

  // Initialize reverse import map entry
  if (!reverseImportMap.has(relativePath)) {
    reverseImportMap.set(relativePath, new Set());
  }

  // Update reverse imports
  for (const imp of imports) {
    const importedPath = resolveImportPath(filePath, imp);
    if (importedPath && filePaths.has(importedPath)) {
      if (!reverseImportMap.has(importedPath)) {
        reverseImportMap.set(importedPath, new Set());
      }
      reverseImportMap.get(importedPath).add(relativePath);
    }
  }
}

async function getImports(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const importMatches = content.matchAll(
      /from\s+['"](\.\.?\/[^'"]+)['"]|require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g
    );

    const imports = new Set();
    for (const match of importMatches) {
      const importPath = match[1] || match[2];
      if (importPath) {
        imports.add(importPath);
      }
    }
    return Array.from(imports);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

function resolveImportPath(importerPath, importPath) {
  try {
    const resolved = path.resolve(path.dirname(importerPath), importPath);
    const relative = path.relative(FEATURES_DIR, resolved);
    return relative.startsWith('..') ? null : relative;
  } catch {
    return null;
  }
}

function identifyRootFiles() {
  for (const file of filePaths) {
    if (!reverseImportMap.get(file)?.size) {
      rootFiles.add(file);
    }
  }
}

function buildHierarchy() {
  const hierarchy = {};

  for (const rootFile of rootFiles) {
    hierarchy[rootFile] = buildFileHierarchy(rootFile);
  }

  return hierarchy;
}

function buildFileHierarchy(file) {
  const children = {};
  const imports = importMap.get(file) || [];

  for (const imp of imports) {
    const importedPath = resolveImportPath(path.join(FEATURES_DIR, file), imp);

    if (importedPath && filePaths.has(importedPath)) {
      children[importedPath] = buildFileHierarchy(importedPath);
    }
  }

  return children;
}

function displayHierarchy(hierarchy) {
  console.log('\nImport Hierarchy:\n');
  for (const [root, children] of Object.entries(hierarchy)) {
    printNode(root, children, '');
  }
}

function printNode(file, children, indent) {
  console.log(`${indent}${path.basename(file)}`);
  const newIndent = indent + '  ';
  for (const [childFile, grandChildren] of Object.entries(children)) {
    printNode(childFile, grandChildren, newIndent);
  }
}

async function saveHierarchy(hierarchy) {
  let output = 'Import Hierarchy:\n\n';

  function buildOutput(file, children, indent) {
    output += `${indent}${path.basename(file)}\n`;
    const newIndent = indent + '  ';
    for (const [childFile, grandChildren] of Object.entries(children)) {
      buildOutput(childFile, grandChildren, newIndent);
    }
  }

  for (const [root, children] of Object.entries(hierarchy)) {
    buildOutput(root, children, '');
  }

  await writeFile(OUTPUT_FILE, output, 'utf8');
}

function shouldIgnoreFile(filename) {
  return (
    IGNORE_FILES.includes(filename) ||
    IGNORE_EXTENSIONS.some((ext) => filename.includes(ext))
  );
}

scanFeatures();
