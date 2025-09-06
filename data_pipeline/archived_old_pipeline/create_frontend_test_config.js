#!/usr/bin/env node
/**
 * Frontend Test Configuration Helper
 * Helps switch frontend to use test collections temporarily
 */

import fs from 'fs';
import path from 'path';

const CONFIG_PATH = './src/config/testConfig.js';

console.log('🔧 Frontend Test Configuration Helper');
console.log('=====================================');

// Create test configuration file
const testConfig = `// Test Configuration for New Data Architecture
// Switch between test and production collections

export const USE_TEST_COLLECTIONS = true; // Set to false for production

export const COLLECTION_NAMES = USE_TEST_COLLECTIONS ? {
  PLAYERS: 'test_players',
  CONTRACTS: 'test_contracts', 
  EVALUATIONS: 'test_evaluations',
  TEAM_CAPS: 'test_team_caps'
} : {
  PLAYERS: 'players',
  CONTRACTS: 'contracts',
  EVALUATIONS: 'evaluations', 
  TEAM_CAPS: 'team_caps'
};

console.log('📊 Using collections:', COLLECTION_NAMES);

export default { USE_TEST_COLLECTIONS, COLLECTION_NAMES };
`;

// Ensure config directory exists
const configDir = path.dirname(CONFIG_PATH);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Write test configuration
fs.writeFileSync(CONFIG_PATH, testConfig);

console.log('✅ Test configuration created at:', CONFIG_PATH);
console.log('📋 Next steps:');
console.log('   1. Import this config in your data hooks');
console.log('   2. Use COLLECTION_NAMES.PLAYERS instead of hardcoded "players"');
console.log('   3. Set USE_TEST_COLLECTIONS = false when ready for production');
console.log();
console.log('📝 Example usage in usePlayerData.js:');
console.log('   import { COLLECTION_NAMES } from "../config/testConfig.js";');
console.log('   const playersRef = collection(db, COLLECTION_NAMES.PLAYERS);');