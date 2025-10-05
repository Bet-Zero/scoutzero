const fs = require('fs');

// Load the JSON file
const data = JSON.parse(fs.readFileSync('mapping_phase1_final.json', 'utf8'));

// Grab the pairs with type and transform
const pairs = data.mappings.map(
  (m) => `${m.from} -> ${m.to} (type: ${m.type}, transform: ${m.transform})`
);

// Print them nicely
console.log(pairs.join('\n'));
