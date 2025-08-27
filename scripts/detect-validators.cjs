const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');

const DOCS_DIR = 'atlas-docs';
fs.mkdirSync(DOCS_DIR, { recursive: true });

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

const cfg = JSON.parse(fs.readFileSync('scripts/atlas.config.json', 'utf8'));

const patterns =
  /(trade.*validator|validator.*trade|TradeValidator)\.(js|ts|jsx|tsx)$/i;
let files = [];
cfg.roots.forEach((rt) => {
  files.push(...glob.sync(path.join(rt, '**/*.{js,ts,jsx,tsx}')));
});

const candidates = new Set();

// 1) Name-based hits
for (const f of files) if (patterns.test(f)) candidates.add(f);

// 2) Content-based hits
for (const f of files) {
  try {
    const src = fs.readFileSync(f, 'utf8');
    if (/export\s+function\s+validateTrade\s*\(/.test(src)) candidates.add(f);
    if (/export\s+default\s+function\s+validateTrade\s*\(/.test(src))
      candidates.add(f);
    if (/export\s+\{\s*validateTrade\s*\}/.test(src)) candidates.add(f);
    if (/module\.exports\s*=\s*validateTrade/.test(src)) candidates.add(f);
  } catch {}
}

// Ranking by dependents (if available)
let depJson = {};
try {
  depJson = JSON.parse(fs.readFileSync(`${DOCS_DIR}/all-deps.json`, 'utf8'));
} catch {}
const dependentCount = {};
(depJson.modules || []).forEach((m) => {
  (m.dependencies || []).forEach((d) => {
    dependentCount[d.resolved] = (dependentCount[d.resolved] || 0) + 1;
  });
});

const ranked = [...candidates]
  .map((f) => ({
    file: f,
    score: dependentCount[path.resolve(f)] || 0,
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

let md = '# Candidate Validators\n\n';
if (ranked.length === 0) {
  md +=
    'No obvious trade validator entry files found. You can still use the global maps in this folder.\n';
  fs.writeFileSync(`${DOCS_DIR}/CANDIDATES.md`, md);
  console.log(`✓ wrote ${DOCS_DIR}/CANDIDATES.md`);
  process.exit(0);
}

for (const { file, score } of ranked) {
  const base = path.basename(file).replace(/\W+/g, '_');
  md += `- \`${file}\` (dependents: ${score})\n`;

  // Try SVG with madge; fallback to DOT via dependency-cruiser (no Graphviz)
  try {
    run(
      `npx madge ${file} --extensions js,ts,jsx,tsx --image ${DOCS_DIR}/candidate-${base}.svg`
    );
  } catch {
    run(
      `npx depcruise ${file} --no-config -T dot > ${DOCS_DIR}/candidate-${base}.dot`
    );
  }

  // Always emit a text report too (handy to read)
  run(
    `npx depcruise ${file} --no-config -T text > ${DOCS_DIR}/candidate-${base}.txt`
  );
}

fs.writeFileSync(`${DOCS_DIR}/CANDIDATES.md`, md);
console.log(`✓ wrote ${DOCS_DIR}/CANDIDATES.md`);
