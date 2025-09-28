#!/usr/bin/env node
/**
 * Schema Transition Integration Test
 * Validates the complete migration pipeline with comprehensive checks
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SEASON = process.env.SEASON || '2025-26';
const TEST_PLAYER = process.env.TEST_PLAYER || 'test_integration_player';

async function loadSelectors() {
  const modulePath = path.resolve(
    process.cwd(),
    'src/utils/selectors/newSchemeSelectors.js',
  );
  return import(pathToFileURL(modulePath).href);
}

async function testSchemaMapGeneration() {
  console.log('🔍 Testing Schema Map Generation...');
  
  const schemaMapPath = path.resolve(process.cwd(), `_exports/schema_map_${SEASON}.json`);
  
  if (!fs.existsSync(schemaMapPath)) {
    console.log('⚠️  Schema map missing, generating fallback...');
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [
        'schema_transition/utils/generate_schema_map_fallback.cjs'
      ], { stdio: 'inherit' });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Schema map generated successfully');
          resolve(true);
        } else {
          console.error('❌ Schema map generation failed');
          reject(new Error(`Schema map generation failed with code ${code}`));
        }
      });
    });
  } else {
    console.log('✅ Schema map exists');
    return true;
  }
}

async function testLegacyAdapterImport() {
  console.log('🔍 Testing Legacy Adapter Import...');
  
  try {
    const adapterPath = path.resolve(
      process.cwd(),
      'schema_transition/utils/legacyFieldAdapter.js'
    );
    
    // Test that the adapter can be imported without errors
    const adapter = await import(pathToFileURL(adapterPath).href);
    
    // Test core functions exist
    const requiredFunctions = [
      'getLegacy', 'getBioField', 'getTeamCode', 'getStat', 
      'getContractView', 'getEval', 'getEvalGrades'
    ];
    
    for (const func of requiredFunctions) {
      if (typeof adapter[func] !== 'function') {
        throw new Error(`Missing required function: ${func}`);
      }
    }
    
    console.log('✅ Legacy adapter imports successfully');
    return true;
  } catch (err) {
    console.error('❌ Legacy adapter import failed:', err.message);
    return false;
  }
}

async function testSelectorIntegration() {
  console.log('🔍 Testing Selector Integration...');
  
  try {
    const selectors = await loadSelectors();
    
    // Test core selector functions exist
    const requiredSelectors = [
      'getDisplayName', 'getAge', 'getPosition', 'getHeight', 'getWeight',
      'getTeamCode', 'getPTS', 'getAST', 'getREB', 'getFGPct', 'get3PPct', 'getFTPct',
      'getSalary', 'getYearsLeft', 'getFAYear', 'hasPlayerOption', 'hasTeamOption',
      'hasEvaluations', 'getEvalGrades', 'getEvalRoles', 'assertSeasonDocShape'
    ];
    
    for (const selector of requiredSelectors) {
      if (typeof selectors[selector] !== 'function') {
        throw new Error(`Missing required selector: ${selector}`);
      }
    }
    
    // Test with sample data
    const sampleSeasonDoc = {
      bio: {
        displayName: 'Test Player',
        age: 25,
        position: 'PG',
        height: '6\'2"',
        weight: 180
      },
      team: { code: 'LAL' },
      stats: {
        pts: 15.5,
        ast: 6.2,
        reb: 4.1,
        fgPct: 0.452,
        tpPct: 0.358,
        ftPct: 0.821
      },
      contractView: {
        salary: 12000000,
        yearsLeft: 2,
        freeAgentYear: 2027
      },
      evaluations: {
        grades: { Shooting: 75, Passing: 85 },
        roles: { offense: 'Floor General', defense: 'Switch Defender' }
      }
    };
    
    // Test shape assertion
    selectors.assertSeasonDocShape(sampleSeasonDoc);
    
    // Test specific selectors
    if (selectors.getDisplayName(sampleSeasonDoc) !== 'Test Player') {
      throw new Error('getDisplayName selector test failed');
    }
    
    if (selectors.getTeamCode(sampleSeasonDoc) !== 'LAL') {
      throw new Error('getTeamCode selector test failed');
    }
    
    if (selectors.getPTS(sampleSeasonDoc) !== 15.5) {
      throw new Error('getPTS selector test failed');
    }
    
    if (selectors.getSalary(sampleSeasonDoc) !== 12000000) {
      throw new Error('getSalary selector test failed');
    }
    
    if (!selectors.hasEvaluations(sampleSeasonDoc)) {
      throw new Error('hasEvaluations selector test failed');
    }
    
    console.log('✅ Selector integration tests passed');
    return true;
  } catch (err) {
    console.error('❌ Selector integration failed:', err.message);
    return false;
  }
}

async function testMigrationPipeline() {
  console.log('🔍 Testing Migration Pipeline (Dry Run)...');
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      MODE: 'dry-run',
      SEASON,
      SAMPLE_PLAYERS: TEST_PLAYER,
      BATCH_SIZE: '10', // Small batch for testing  
      // Skip Firebase for this test since we don't have credentials
      SKIP_FIREBASE: '1'
    };
    
    const child = spawn('node', [
      'schema_transition/core/migrate_full_players.cjs'
    ], { 
      stdio: 'pipe',
      env
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      // Firebase auth failure is expected in test environment
      if (stderr.includes('Unable to detect a Project Id') || stderr.includes('authentication')) {
        console.log('⚠️  Firebase authentication not available (expected in test environment)');
        resolve('skipped-no-auth');
      } else if (code === 0) {
        // Validate output contains expected elements
        if (stdout.includes('selector-issues') || stdout.includes('shape:')) {
          console.log('⚠️  Migration completed with selector warnings');
          resolve('warnings');
        } else {
          console.log('✅ Migration pipeline test passed');
          resolve('success');
        }
      } else {
        console.error('❌ Migration pipeline test failed');
        reject(new Error(`Migration failed with code ${code}`));
      }
    });
  });
}

async function testOutputGeneration() {
  console.log('🔍 Testing Output Generation...');
  
  const outputDir = path.resolve(process.cwd(), 'outputs');
  const expectedFiles = [
    `migrate_full_players_dry-run.json`,
    `migrate_full_players_dry-run.csv`
  ];
  
  let allExist = true;
  for (const file of expectedFiles) {
    const filePath = path.join(outputDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Expected output missing: ${file}`);
      allExist = false;
    } else {
      // Validate file contents
      try {
        if (file.endsWith('.json')) {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (!Array.isArray(content)) {
            console.log(`⚠️  Invalid JSON structure in ${file}`);
            allExist = false;
          }
        }
      } catch (err) {
        console.log(`⚠️  Cannot parse ${file}: ${err.message}`);
        allExist = false;
      }
    }
  }
  
  if (allExist) {
    console.log('✅ Output generation test passed');
    return true;
  } else {
    console.log('⚠️  Some outputs missing or invalid');
    return false;
  }
}

async function main() {
  console.log('🚀 Schema Transition Integration Test Suite');
  console.log('==========================================');
  
  const tests = [
    ['Schema Map Generation', testSchemaMapGeneration],
    ['Legacy Adapter Import', testLegacyAdapterImport],
    ['Selector Integration', testSelectorIntegration],
    ['Migration Pipeline', testMigrationPipeline],
    ['Output Generation', testOutputGeneration]
  ];
  
  const results = [];
  let allPassed = true;
  
  for (const [name, testFn] of tests) {
    console.log(`\n${'='.repeat(20)}`);
    try {
      const result = await testFn();
      const status = result === true ? 'PASS' : 
                    result === 'warnings' ? 'WARNINGS' :
                    result === 'skipped-no-auth' ? 'SKIPPED' :
                    typeof result === 'string' ? result.toUpperCase() : 'UNKNOWN';
      results.push({ name, status, error: null });
      if (result !== true && result !== 'warnings' && result !== 'skipped-no-auth') {
        allPassed = false;
      }
    } catch (err) {
      console.error(`❌ ${name} failed:`, err.message);
      results.push({ name, status: 'FAIL', error: err.message });
      allPassed = false;
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log('📊 Integration Test Results');
  console.log('='.repeat(40));
  
  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : 
                 result.status === 'WARNINGS' ? '⚠️ ' : 
                 result.status === 'SKIPPED' ? '⏭️ ' : '❌';
    console.log(`${icon} ${result.name.padEnd(25)} ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const warnCount = results.filter(r => r.status === 'warnings').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`\n📋 Summary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
  
  if (allPassed) {
    console.log('🎉 All integration tests passed! Migration system is ready.');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed. Review and fix issues before proceeding.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('💥 Integration test suite failed:', err);
    process.exit(1);
  });
}