import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '..', '..');

const failures = [];

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readFile(relativePath) {
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function addFailure(message) {
  failures.push(message);
}

function checkPatterns(relativePath, rules) {
  const text = readFile(relativePath);

  for (const rule of rules) {
    const matches = [...text.matchAll(rule.regex)];
    for (const match of matches) {
      addFailure(`${relativePath}: ${rule.message} (${match[0]})`);
    }
  }
}

function walkMarkdownFiles(relativeDir) {
  const found = [];
  const root = repoPath(relativeDir);

  if (!fs.existsSync(root)) {
    return found;
  }

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        found.push(
          path.relative(repoRoot, entryPath).replaceAll(path.sep, '/')
        );
      }
    }
  }

  visit(root);
  return found;
}

const routerRules = [
  {
    regex: /(?:^|[\s`(])\/return_packages\//gm,
    message:
      'main routing docs must not point to the legacy root return_packages path',
  },
  {
    regex: /(?:^|[\s`(])docs\/audits\//gm,
    message: 'main routing docs must not point to docs/audits/',
  },
  {
    regex:
      /(?:^|[\s`(])docs\/(?:architect|team-scrape|tradeMachine|scouting)\/return_packages\//gm,
    message:
      'main routing docs must not point to feature-root return_packages paths',
  },
  {
    regex:
      /(?:^|[\s`(])docs\/(?:architect|team-scrape|tradeMachine|scouting)\/return-packages\//gm,
    message:
      'main routing docs must not point to deprecated feature-root return-packages paths',
  },
  {
    regex: /(?:^|[\s`(])docs\/return-packages\//gm,
    message:
      'main routing docs must not point to deprecated docs/return-packages paths',
  },
];

for (const routerFile of ['README.md', 'docs/INDEX.md']) {
  checkPatterns(routerFile, routerRules);
}

const claudeIgnoreLines = readFile('.claudeignore')
  .split(/\r?\n/)
  .map((line) => line.trim());

if (claudeIgnoreLines.includes('plans/')) {
  addFailure(
    '.claudeignore: active plans must stay visible; remove the catch-all plans/ ignore'
  );
}

if (!claudeIgnoreLines.some((line) => /^plans\/\\?_archive\/$/.test(line))) {
  addFailure('.claudeignore: expected an ignore rule for plans/_archive/');
}

const forbiddenDirs = [
  'docs/return-packages',
  'docs/reference/architect/return_packages',
  'docs/reference/architect/return-packages',
  'docs/team-scrape/return_packages',
  'docs/team-scrape/return-packages',
  'docs/tradeMachine/return_packages',
  'docs/tradeMachine/return-packages',
  'docs/scouting/return_packages',
  'docs/scouting/return-packages',
];

for (const relativeDir of forbiddenDirs) {
  if (fs.existsSync(repoPath(relativeDir))) {
    addFailure(`${relativeDir}: forbidden return-package surface exists`);
  }
}

for (const featureRoot of [
  'docs/reference/architect',
  'docs/team-scrape',
  'docs/tradeMachine',
  'docs/scouting',
]) {
  for (const markdownFile of walkMarkdownFiles(featureRoot)) {
    if (path.basename(markdownFile).includes('RETURN_PACKAGE')) {
      addFailure(
        `${markdownFile}: execution evidence must not live under active feature-doc roots`
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Workspace guardrails failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Workspace guardrails passed.');
