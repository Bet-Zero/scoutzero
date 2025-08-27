const { execSync } = require('child_process');
const fs = require('fs');

const DOCS_DIR = 'atlas-docs';
const cfg = JSON.parse(fs.readFileSync('scripts/atlas.config.json', 'utf8'));
fs.mkdirSync(DOCS_DIR, { recursive: true });

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

let merged = { modules: [] };

cfg.roots.forEach((rt) => {
  const safe = rt.replace(/\W+/g, '_') || 'project';

  // Try SVG with madge (needs Graphviz). Fall back to DOT via dependency-cruiser (no Graphviz needed).
  try {
    run(
      `npx madge ${rt} --extensions js,ts,jsx,tsx --exclude ${JSON.stringify(
        cfg.exclude
      )} --image ${DOCS_DIR}/all-graph-${safe}.svg`
    );
  } catch {
    run(
      `npx depcruise ${rt} --no-config --exclude ${JSON.stringify(
        cfg.exclude
      )} -T dot > ${DOCS_DIR}/all-graph-${safe}.dot`
    );
  }

  // Dependency-cruiser text + json (no config)
  run(
    `npx depcruise ${rt} --no-config --exclude ${JSON.stringify(
      cfg.exclude
    )} -T text > ${DOCS_DIR}/all-deps-${safe}.txt`
  );
  run(
    `npx depcruise ${rt} --no-config --exclude ${JSON.stringify(
      cfg.exclude
    )} -T json > ${DOCS_DIR}/all-deps-${safe}.json`
  );

  const part = JSON.parse(
    fs.readFileSync(`${DOCS_DIR}/all-deps-${safe}.json`, 'utf8')
  );
  merged.modules.push(...(part.modules || []));
});

// De-duplicate merged modules by source
const bySrc = new Map();
for (const m of merged.modules) bySrc.set(m.source, m);
merged.modules = [...bySrc.values()];

fs.writeFileSync(`${DOCS_DIR}/all-deps.json`, JSON.stringify(merged, null, 2));
console.log('✓ wrote ' + DOCS_DIR + '/all-deps.json');

// Also write a combined text file
let allTxt = '';
cfg.roots.forEach((rt) => {
  const safe = rt.replace(/\W+/g, '_') || 'project';
  allTxt += fs.readFileSync(`${DOCS_DIR}/all-deps-${safe}.txt`, 'utf8') + '\n';
});
fs.writeFileSync(`${DOCS_DIR}/all-deps.txt`, allTxt);
console.log('✓ wrote ' + DOCS_DIR + '/all-deps.txt');

// Combined graph (SVG if possible; else DOT via depcruise)
try {
  run(
    `npx madge ${cfg.roots.join(' ')} --extensions js,ts,jsx,tsx --exclude ${JSON.stringify(
      cfg.exclude
    )} --image ${DOCS_DIR}/all-graph.svg`
  );
} catch {
  run(
    `npx depcruise ${cfg.roots.join(' ')} --no-config --exclude ${JSON.stringify(
      cfg.exclude
    )} -T dot > ${DOCS_DIR}/all-graph.dot`
  );
  console.warn('Graphviz not installed; wrote DOT via dependency-cruiser.');
}
