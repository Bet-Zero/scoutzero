#!/usr/bin/env tsx
/**
 * validate-project-schema.ts
 * 
 * Validates the ScoutZero repository structure against project.schema.json
 * 
 * Checks:
 * - Required directories exist
 * - Player contract files match naming conventions
 * - Filename ↔ playerId consistency
 * - Sample artifacts validate against Zod schemas (if present)
 * 
 * Usage:
 *   npm run validate:project
 *   tsx scripts/validate-project-schema.ts
 * 
 * Exit Codes:
 *   0 - All validations pass
 *   1 - One or more validations fail
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

interface ProjectSchema {
  version: string;
  directories: {
    required: string[];
    optional?: string[];
  };
  patterns: {
    [key: string]: {
      description: string;
      regex: string;
      examples: string[];
    };
  };
  artifacts: {
    [key: string]: {
      description: string;
      pathTemplate: string;
      namingRules?: string[];
      schema?: string;
    };
  };
  validation: {
    [key: string]: {
      description: string;
      pattern?: string;
      applies?: string[];
      rule?: string;
    };
  };
}

let errorCount = 0;
let warningCount = 0;

function error(message: string): void {
  console.error(`❌ ERROR: ${message}`);
  errorCount++;
}

function warn(message: string): void {
  console.warn(`⚠️  WARNING: ${message}`);
  warningCount++;
}

function success(message: string): void {
  console.log(`✅ ${message}`);
}

function info(message: string): void {
  console.log(`ℹ️  ${message}`);
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filepath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filepath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function validateDirectories(schema: ProjectSchema): Promise<void> {
  info('Validating required directories...');
  
  for (const dir of schema.directories.required) {
    const dirPath = path.join(repoRoot, dir);
    const exists = await isDirectory(dirPath);
    
    if (!exists) {
      error(`Required directory missing: ${dir}`);
    } else {
      success(`Required directory exists: ${dir}`);
    }
  }
}

async function validatePatterns(schema: ProjectSchema): Promise<void> {
  info('\nValidating naming patterns...');
  
  // Validate playerId pattern
  const playerIdPattern = new RegExp(schema.patterns.playerId.regex);
  const playerIdExamples = schema.patterns.playerId.examples;
  
  for (const example of playerIdExamples) {
    if (!playerIdPattern.test(example)) {
      error(`playerId example "${example}" does not match pattern ${schema.patterns.playerId.regex}`);
    } else {
      success(`playerId pattern validated: ${example}`);
    }
  }
  
  // Validate teamCode pattern
  const teamCodePattern = new RegExp(schema.patterns.teamCode.regex);
  const teamCodeExamples = schema.patterns.teamCode.examples;
  
  for (const example of teamCodeExamples) {
    if (!teamCodePattern.test(example)) {
      error(`teamCode example "${example}" does not match pattern ${schema.patterns.teamCode.regex}`);
    } else {
      success(`teamCode pattern validated: ${example}`);
    }
  }
}

async function findJsonFiles(dir: string, pattern?: RegExp): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subFiles = await findJsonFiles(fullPath, pattern);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        if (!pattern || pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Directory might not exist, that's okay for optional paths
  }
  
  return files;
}

async function validatePlayerContractFiles(schema: ProjectSchema): Promise<void> {
  info('\nValidating player contract files...');
  
  const outputDir = path.join(repoRoot, 'player-scrape/contracts/output');
  const fixturesDir = path.join(repoRoot, 'player-scrape/contracts/fixtures');
  
  const playerIdPattern = new RegExp(schema.patterns.playerId.regex);
  
  // Check output directory
  if (await isDirectory(outputDir)) {
    const jsonFiles = await findJsonFiles(outputDir);
    
    if (jsonFiles.length === 0) {
      info('No player contract files in output directory (this is okay for a fresh repo)');
    } else {
      for (const file of jsonFiles) {
        const filename = path.basename(file, '.json');
        
        // Validate filename matches playerId pattern
        if (!playerIdPattern.test(filename)) {
          error(`Invalid playerId format in filename: ${path.relative(repoRoot, file)} (expected snake_case)`);
          continue;
        }
        
        // Read and validate content
        try {
          const content = JSON.parse(await fs.readFile(file, 'utf8'));
          
          // Check playerId field exists
          if (!content.playerId) {
            error(`Missing playerId field in ${path.relative(repoRoot, file)}`);
            continue;
          }
          
          // Check filename matches playerId
          if (filename !== content.playerId) {
            error(`Filename mismatch: ${filename}.json has playerId "${content.playerId}"`);
          } else {
            success(`Filename matches playerId: ${filename}`);
          }
          
          // Check teamCode format if present
          if (content.teamCode) {
            const teamCodePattern = new RegExp(schema.patterns.teamCode.regex);
            if (!teamCodePattern.test(content.teamCode)) {
              error(`Invalid teamCode "${content.teamCode}" in ${filename}.json (expected 3 uppercase letters)`);
            }
          }
          
        } catch (err) {
          error(`Failed to parse JSON in ${path.relative(repoRoot, file)}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }
  
  // Check fixtures directory
  if (await isDirectory(fixturesDir)) {
    const fixtureFiles = await findJsonFiles(fixturesDir);
    
    for (const file of fixtureFiles) {
      const filename = path.basename(file);
      const basename = filename.replace(/\.(expected|snapshot)\.json$/, '');
      
      // Validate filename matches playerId pattern
      if (!playerIdPattern.test(basename)) {
        error(`Invalid playerId format in fixture filename: ${filename}`);
        continue;
      }
      
      // Validate fixture type
      if (!filename.match(/\.(expected|snapshot)\.json$/)) {
        warn(`Fixture file ${filename} does not match expected naming pattern (*.expected.json or *.snapshot.json)`);
      } else {
        success(`Fixture file validated: ${filename}`);
      }
      
      // Read and validate content
      try {
        const content = JSON.parse(await fs.readFile(file, 'utf8'));
        
        if (content.playerId && content.playerId !== basename) {
          error(`Fixture filename mismatch: ${basename} has playerId "${content.playerId}"`);
        }
      } catch (err) {
        error(`Failed to parse fixture JSON ${filename}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

async function validateZodSchemas(schema: ProjectSchema): Promise<void> {
  info('\nValidating Zod schemas (optional)...');
  
  // Check if schema file exists
  const schemaPath = path.join(repoRoot, 'player-scrape/shared/schema/player_scrape_schema.ts');
  
  if (await fileExists(schemaPath)) {
    success('Zod schema file exists: player_scrape_schema.ts');
    
    // Try to validate a sample fixture if available
    const fixturesDir = path.join(repoRoot, 'player-scrape/contracts/fixtures');
    
    if (await isDirectory(fixturesDir)) {
      const fixtures = await findJsonFiles(fixturesDir, /\.expected\.json$/);
      
      if (fixtures.length > 0) {
        info(`Found ${fixtures.length} fixture(s) for potential schema validation`);
        
        // We'll skip actual Zod validation here to avoid import complexity
        // The regression tests already handle this
        info('Zod validation is performed by regression tests (npm run regress)');
      }
    }
  } else {
    warn('Zod schema file not found (this may be expected if schemas are in development)');
  }
}

async function validateSnapshotFiles(schema: ProjectSchema): Promise<void> {
  info('\nValidating HTML snapshot files...');
  
  const snapshotsDir = path.join(repoRoot, 'player-scrape/contracts/snapshots');
  
  if (await isDirectory(snapshotsDir)) {
    const playerIdPattern = new RegExp(schema.patterns.playerId.regex);
    
    try {
      const files = await fs.readdir(snapshotsDir);
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      
      if (htmlFiles.length === 0) {
        info('No HTML snapshots found (this is okay)');
      } else {
        for (const file of htmlFiles) {
          const basename = path.basename(file, '.html');
          
          if (!playerIdPattern.test(basename)) {
            error(`Invalid playerId format in snapshot: ${file}`);
          } else {
            success(`Snapshot file validated: ${file}`);
          }
        }
      }
    } catch (err) {
      warn(`Could not read snapshots directory: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    info('Snapshots directory not found (creating it is recommended)');
  }
}

async function main(): Promise<void> {
  console.log('🔍 ScoutZero Project Schema Validator\n');
  console.log(`Repository: ${repoRoot}\n`);
  
  // Load schema
  const schemaPath = path.join(repoRoot, 'project.schema.json');
  
  if (!(await fileExists(schemaPath))) {
    error('project.schema.json not found in repository root');
    process.exit(1);
  }
  
  const schemaContent = await fs.readFile(schemaPath, 'utf8');
  const schema: ProjectSchema = JSON.parse(schemaContent);
  
  info(`Loaded schema version: ${schema.version}\n`);
  
  // Run validations
  await validateDirectories(schema);
  await validatePatterns(schema);
  await validatePlayerContractFiles(schema);
  await validateSnapshotFiles(schema);
  await validateZodSchemas(schema);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));
  
  if (errorCount === 0 && warningCount === 0) {
    console.log('✅ All validations passed!');
    process.exit(0);
  } else {
    if (errorCount > 0) {
      console.log(`❌ ${errorCount} error(s) found`);
    }
    if (warningCount > 0) {
      console.log(`⚠️  ${warningCount} warning(s) found`);
    }
    
    if (errorCount > 0) {
      console.log('\n💡 Fix the errors above to meet project schema requirements.');
      process.exit(1);
    } else {
      console.log('\n✅ No critical errors (warnings can be addressed incrementally)');
      process.exit(0);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error running validator:', err);
  process.exit(1);
});
