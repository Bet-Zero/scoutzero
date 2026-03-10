/**
 * FILE: src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js
 * PURPOSE: Guardrail tests ensuring production code uses getTeamTpeList() instead of
 *          directly reading .tradeExceptions from team objects.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-30: Phase 65 - Created for TPE read-path canonicalization
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Contracts Doc: docs/architect/contracts/PERSISTENCE_CONTRACTS.md
 *  - Phase 65 Return: docs/architect/return_packages/PHASE_65_TPE_READ_PATH_CANONICALIZATION_FORBID_DIRECT_TRADEEXCEPTIONS_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md
 *
 * DESIGN:
 * Phase 65 establishes `getTeamTpeList(team)` as the ONLY supported read accessor for TPEs.
 * Direct reads of `team.tradeExceptions` are forbidden in production code outside a tight allowlist.
 *
 * ALLOWLIST (files that may reference .tradeExceptions):
 * - normalizeTeamTpe.js: The canonical helper that handles both locations
 * - schemaAdapter.js: Building trade input structure (adapts external data)
 * - mutationPipeline.js: TPE persistence logic (reads legacy, writes canonical)
 * - tradeContext.js: Snapshot building (reads from both sources)
 *
 * These tests source-scan production directories to detect forbidden patterns.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '../../features/architect');

// ==============================================================================
// CONFIGURATION
// ==============================================================================

/**
 * Files that are ALLOWED to reference .tradeExceptions directly.
 * These are bridge/normalization modules that need to read legacy data.
 */
const ALLOWLISTED_FILES = [
  // Core normalization helper (the canonical accessor lives here)
  'utils/persistenceContracts/normalizeTeamTpe.js',
  // Schema adapter for building trade input structure
  'utils/schemaAdapter.js',
  // Mutation pipeline (TPE persistence, reads legacy during compute)
  'utils/mutationPipeline.js',
  // Trade context snapshot building (merges both sources during snapshot)
  'utils/tradeContext/tradeContext.js',
  // Persistence contract validation (references field in comments/tests)
  'utils/persistenceContracts/validatePersistableShape.js',
  // TPE lifecycle processing helper (operates on passed array, not team object)
  'utils/tpeLifecycle.js',
  // Exception history types/comments
  'utils/tradeContext/types.js',
  // buildRuleContext builds internal context objects (uses exceptions.tradeExceptions as internal key)
  'utils/buildRuleContext.ts',
];

/**
 * Directories to scan (relative to SRC_ROOT)
 */
const SCAN_DIRECTORIES = ['hooks', 'tradeMachine', 'utils', 'GMDashboard'];

/**
 * Patterns that indicate direct .tradeExceptions reads
 */
const FORBIDDEN_PATTERNS = [
  // Direct property access
  /\.tradeExceptions(?!\s*=)/g,
];

/**
 * Patterns to EXCLUDE (allowed contexts)
 */
const ALLOWED_CONTEXTS = [
  // Comments
  /\/\/.*\.tradeExceptions/,
  /\/\*[\s\S]*?\.tradeExceptions[\s\S]*?\*\//,
  // JSDoc
  /@property.*tradeExceptions/,
  // String literals (documentation, error messages)
  /'[^']*tradeExceptions[^']*'/,
  /"[^"]*tradeExceptions[^"]*"/,
  // Template literals
  /`[^`]*tradeExceptions[^`]*`/,
  // Object key definitions (not reads)
  /tradeExceptions\s*:/,
  // Allowlist entries in this test file
  /ALLOWLISTED_FILES/,
  // The assignment pattern (writing, not reading)
  /\.tradeExceptions\s*=/,
  // rules?.tradeExceptions (accessing validation rule results, not team data)
  /rules\?\.tradeExceptions/,
  /rules\.tradeExceptions/,
];

// ==============================================================================
// HELPERS
// ==============================================================================

/**
 * Recursively get all JS/JSX/TS/TSX files in a directory
 */
function getAllSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllSourceFiles(fullPath, files);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Check if a file is in the allowlist
 */
function isAllowlisted(filePath) {
  const relativePath = path.relative(SRC_ROOT, filePath);
  return ALLOWLISTED_FILES.some(
    (allowed) =>
      relativePath === allowed || relativePath.replace(/\\/g, '/') === allowed
  );
}

/**
 * Check if a match is in an allowed context (comment, string, etc.)
 */
function isAllowedContext(line) {
  return ALLOWED_CONTEXTS.some((pattern) => pattern.test(line));
}

/**
 * Scan a file for forbidden patterns
 */
function scanFileForForbiddenReads(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, lineIndex) => {
    // Skip if line is an allowed context
    if (isAllowedContext(line)) return;

    FORBIDDEN_PATTERNS.forEach((pattern) => {
      const matches = line.match(pattern);
      if (matches) {
        violations.push({
          file: path.relative(SRC_ROOT, filePath),
          line: lineIndex + 1,
          content: line.trim(),
          pattern: pattern.toString(),
        });
      }
    });
  });

  return violations;
}

function readAuthoritativeImplementationContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const localTsTargets = Array.from(
    stripped.matchAll(/from ['"](\.\/[^'"]+\.ts)['"]/g),
    (match) => match[1]
  );

  if (!content.includes('getTeamTpeList') && localTsTargets.length === 1) {
    const authoritativePath = path.resolve(
      path.dirname(filePath),
      localTsTargets[0]
    );

    if (fs.existsSync(authoritativePath)) {
      return fs.readFileSync(authoritativePath, 'utf-8');
    }
  }

  return content;
}

// ==============================================================================
// TEST CATEGORY 1: Source-Scan for Forbidden Direct Reads
// ==============================================================================

describe('Phase 65: Forbid Direct .tradeExceptions Reads in Production Code', () => {
  describe('Source-scan production directories', () => {
    // Collect all files to scan
    const filesToScan = [];
    SCAN_DIRECTORIES.forEach((dir) => {
      const fullDir = path.join(SRC_ROOT, dir);
      filesToScan.push(...getAllSourceFiles(fullDir));
    });

    it('should find files to scan', () => {
      expect(filesToScan.length).toBeGreaterThan(0);
    });

    it('should not find forbidden .tradeExceptions reads in non-allowlisted files', () => {
      const allViolations = [];

      filesToScan.forEach((filePath) => {
        // Skip allowlisted files
        if (isAllowlisted(filePath)) return;

        const violations = scanFileForForbiddenReads(filePath);
        if (violations.length > 0) {
          allViolations.push(...violations);
        }
      });

      if (allViolations.length > 0) {
        const violationReport = allViolations
          .map((v) => `  ${v.file}:${v.line} - ${v.content}`)
          .join('\n');

        expect.fail(
          `Found ${allViolations.length} forbidden direct .tradeExceptions read(s):\n\n` +
            `${violationReport}\n\n` +
            `These files should use getTeamTpeList(team) instead of .tradeExceptions.\n` +
            `Import: import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';\n\n` +
            `If this is a legitimate case, add the file to ALLOWLISTED_FILES in this test.`
        );
      }
    });
  });

  describe('Allowlist validation', () => {
    it('should have all allowlisted files exist', () => {
      const missingFiles = ALLOWLISTED_FILES.filter((file) => {
        const fullPath = path.join(SRC_ROOT, file);
        return !fs.existsSync(fullPath);
      });

      expect(missingFiles).toEqual([]);
    });

    it('should have a reasonably small allowlist (prevent drift)', () => {
      // Phase 65 allowlist should be 9 or fewer files
      expect(ALLOWLISTED_FILES.length).toBeLessThanOrEqual(9);
    });
  });
});

// ==============================================================================
// TEST CATEGORY 2: Verify Canonical Accessor Exists and Works
// ==============================================================================

describe('Phase 65: getTeamTpeList() Canonical Accessor', () => {
  it('should export getTeamTpeList from persistenceContracts', async () => {
    const { getTeamTpeList } = await import(
      '@/features/architect/utils/persistenceContracts'
    );
    expect(getTeamTpeList).toBeDefined();
    expect(typeof getTeamTpeList).toBe('function');
  });

  it('should return empty array for null/undefined team', async () => {
    const { getTeamTpeList } = await import(
      '@/features/architect/utils/persistenceContracts'
    );

    expect(getTeamTpeList(null)).toEqual([]);
    expect(getTeamTpeList(undefined)).toEqual([]);
    expect(getTeamTpeList({})).toEqual([]);
  });

  it('should prefer canonical exceptions.tpe over legacy tradeExceptions', async () => {
    const { getTeamTpeList } = await import(
      '@/features/architect/utils/persistenceContracts'
    );

    const team = {
      tradeExceptions: [{ id: 'legacy', amount: 1000000 }],
      exceptions: {
        tpe: [{ id: 'canonical', amount: 2000000 }],
      },
    };

    const result = getTeamTpeList(team);
    // Phase 68: getTeamTpeList now normalizes field aliases
    expect(result).toEqual([
      {
        id: 'canonical',
        amount: 2000000,
        totalAmount: 2000000,
        remaining: 2000000,
        remainingAmount: 2000000,
      },
    ]);
  });

  it('should fall back to legacy tradeExceptions when canonical is empty', async () => {
    const { getTeamTpeList } = await import(
      '@/features/architect/utils/persistenceContracts'
    );

    const team = {
      tradeExceptions: [{ id: 'legacy', amount: 1000000 }],
      exceptions: {
        tpe: [], // Empty canonical
      },
    };

    const result = getTeamTpeList(team);
    // Phase 68: getTeamTpeList now normalizes field aliases
    expect(result).toEqual([
      {
        id: 'legacy',
        amount: 1000000,
        totalAmount: 1000000,
        remaining: 1000000,
        remainingAmount: 1000000,
      },
    ]);
  });

  it('should fall back to legacy when exceptions.tpe is undefined', async () => {
    const { getTeamTpeList } = await import(
      '@/features/architect/utils/persistenceContracts'
    );

    const team = {
      tradeExceptions: [{ id: 'legacy', amount: 1000000 }],
    };

    const result = getTeamTpeList(team);
    // Phase 68: getTeamTpeList now normalizes field aliases
    expect(result).toEqual([
      {
        id: 'legacy',
        amount: 1000000,
        totalAmount: 1000000,
        remaining: 1000000,
        remainingAmount: 1000000,
      },
    ]);
  });
});

// ==============================================================================
// TEST CATEGORY 3: Verify seasonManager Normalization at Persistence
// ==============================================================================

describe('Phase 65: seasonManager TPE Normalization at Persistence', () => {
  it('should import normalizeTeamTpeSchema in seasonManager', async () => {
    // Read the file and check for the import
    const seasonManagerPath = path.join(SRC_ROOT, 'utils/seasonManager.js');
    const content = fs.readFileSync(seasonManagerPath, 'utf-8');

    expect(content).toContain('normalizeTeamTpeSchema');
    expect(content).toContain(
      "from '@/features/architect/utils/persistenceContracts'"
    );
  });

  it('should call normalizeTeamTpeSchema before batch.set in seasonManager', () => {
    const seasonManagerPath = path.join(SRC_ROOT, 'utils/seasonManager.js');
    const content = fs.readFileSync(seasonManagerPath, 'utf-8');

    // Check for the pattern: normalizeTeamTpeSchema followed by batch.set
    // The exact implementation uses: const normalizedTeam = normalizeTeamTpeSchema(updatedTeam); batch.set(snapshotRef, normalizedTeam);
    expect(content).toContain('normalizeTeamTpeSchema(updatedTeam)');
    expect(content).toContain('batch.set(snapshotRef, normalizedTeam)');
  });
});

// ==============================================================================
// TEST CATEGORY 4: Verify UI Components Use getTeamTpeList
// ==============================================================================

describe('Phase 65: UI Components Use Canonical Accessor', () => {
  const uiFiles = [
    'tradeMachine/TradeTeamCard.jsx',
    'tradeMachine/TradeExceptionDashboard.jsx',
    'tradeMachine/ValidationDetailsPanel.jsx',
    'GMDashboard/components/SeasonAdvanceModal.jsx',
  ];

  uiFiles.forEach((file) => {
    it(`should import getTeamTpeList in ${file}`, () => {
      const filePath = path.join(SRC_ROOT, file);
      if (!fs.existsSync(filePath)) {
        // Skip if file doesn't exist (could be .tsx variant)
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getTeamTpeList');
    });
  });
});

// ==============================================================================
// TEST CATEGORY 5: Verify Rules Use Canonical Accessor
// ==============================================================================

describe('Phase 65: Validation Rules Use Canonical Accessor', () => {
  const ruleFiles = [
    'utils/tradeMachine/rules/tradeExceptions.js',
    'utils/tradeMachine/rules/basicRules.js',
    'utils/tradeMachine/rules/validateSalaryMatching.js',
  ];

  ruleFiles.forEach((file) => {
    it(`should import getTeamTpeList in ${file}`, () => {
      const filePath = path.join(SRC_ROOT, file);
      if (!fs.existsSync(filePath)) return;

      const content = readAuthoritativeImplementationContent(filePath);
      expect(content).toContain('getTeamTpeList');
    });
  });
});
