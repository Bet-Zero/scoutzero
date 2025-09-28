#!/usr/bin/env node
// Build comprehensive schema trees from exported Firestore data
// Input: _exports/current_export.json
// Output: _exports/current_export_schema_tree.json and _exports/current_export_schema_paths.json

const fs = require('fs');
const path = require('path');

const SRC = './_exports/current_export.json';
const OUT_DIR = './_exports';

function walkFields(node, prefix = '', out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    node.forEach((v, i) =>
      walkFields(v, `${prefix}${prefix ? '.' : ''}${i}`, out)
    );
    return out;
  }
  if (typeof node === 'object') {
    Object.entries(node).forEach(([k, v]) => {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object') walkFields(v, p, out);
      else out.push(p);
    });
    return out;
  }
  out.push(prefix);
  return out;
}

function insertPath(tree, pathStr) {
  const parts = pathStr.split('.');
  let cur = tree;
  for (const part of parts) {
    if (!(part in cur)) cur[part] = {};
    cur = cur[part];
  }
}

function buildTreeFromPaths(paths) {
  const root = {};
  for (const p of paths) insertPath(root, p);
  return root;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}. Run export_current.js first.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  // Analyze all data structures
  const allPaths = [];
  const trees = {};

  // Process players
  if (raw.players) {
    for (const [playerId, playerData] of Object.entries(raw.players)) {
      const playerPaths = walkFields(playerData, `players.${playerId}`);
      allPaths.push(...playerPaths);
    }
    trees.players = buildTreeFromPaths(
      allPaths
        .filter((p) => p.startsWith('players.'))
        .map((p) => p.replace(/^players\.[^.]+\./, ''))
    );
  }

  // Process teams
  if (raw.teams) {
    for (const [teamId, teamData] of Object.entries(raw.teams)) {
      const teamPaths = walkFields(teamData, `teams.${teamId}`);
      allPaths.push(...teamPaths);
    }
    trees.teams = buildTreeFromPaths(
      allPaths
        .filter((p) => p.startsWith('teams.'))
        .map((p) => p.replace(/^teams\.[^.]+\./, ''))
    );
  }

  // Write outputs
  const treePath = path.join(OUT_DIR, 'current_export_schema_tree.json');
  const pathsPath = path.join(OUT_DIR, 'current_export_schema_paths.json');

  fs.writeFileSync(treePath, JSON.stringify(trees, null, 2));
  fs.writeFileSync(
    pathsPath,
    JSON.stringify([...new Set(allPaths)].sort(), null, 2)
  );

  console.log(`Built schema trees: ${treePath}`);
  console.log(`Built field paths: ${pathsPath}`);
  console.log(`Total unique paths: ${new Set(allPaths).size}`);
}

main();
