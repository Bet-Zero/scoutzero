/**
 * FILE: tests/architect/worldsOnlyRegression.test.js
 * PURPOSE: Regression test to ensure Architect operates in worlds-only mode.
 *          Verifies no teamPlans imports/references in Architect feature code.
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2025-12-25: Created during worlds-only cleanup pass
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '../../src');

/**
 * Recursively find all .js, .jsx, .ts, .tsx files in a directory
 */
function findSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules, __mocks__, and fixtures directories
      if (!['node_modules', '__mocks__', 'fixtures'].includes(entry.name)) {
        findSourceFiles(fullPath, files);
      }
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

describe('Architect worlds-only regression', () => {
  const architectDir = path.join(srcRoot, 'features/architect');

  it('should not import teamPlans save/load functions in Architect', () => {
    const sourceFiles = findSourceFiles(architectDir);
    const violations = [];
    
    // Functions that should no longer be imported
    const forbiddenImports = [
      'saveUserTeamPlan',
      'loadUserTeamPlan',
      'listUserTeamPlans',
      'saveNamedTeamPlan',
      'loadNamedTeamPlan',
    ];
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const fn of forbiddenImports) {
        if (content.includes(fn)) {
          const relativePath = path.relative(srcRoot, file);
          violations.push(`${relativePath}: imports or references "${fn}"`);
        }
      }
    }
    
    expect(violations, `Found teamPlans references:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('should not have SavePlanModal component in Architect', () => {
    const savePlanModalPath = path.join(architectDir, 'shared/SavePlanModal');
    const savePlanModalFile = path.join(architectDir, 'SavePlanModal.jsx');
    
    expect(
      fs.existsSync(savePlanModalPath),
      'SavePlanModal folder should not exist'
    ).toBe(false);
    
    expect(
      fs.existsSync(savePlanModalFile),
      'SavePlanModal.jsx re-export should not exist'
    ).toBe(false);
  });

  it('should not reference teamPlans Firestore collection in Architect', () => {
    const sourceFiles = findSourceFiles(architectDir);
    const violations = [];
    
    // Pattern to detect direct Firestore teamPlans collection usage
    const teamPlansPattern = /['"`]teamPlans['"`]/;
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      if (teamPlansPattern.test(content)) {
        const relativePath = path.relative(srcRoot, file);
        violations.push(`${relativePath}: references "teamPlans" collection`);
      }
    }
    
    expect(violations, `Found teamPlans collection references:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('should not have plan mode toggles in useArchitectModals', () => {
    const modalsFile = path.join(architectDir, 'GMDashboard/hooks/useArchitectModals.ts');
    
    if (fs.existsSync(modalsFile)) {
      const content = fs.readFileSync(modalsFile, 'utf8');
      
      // Check for removed plan modal state
      expect(content).not.toContain('showSaveModal');
      expect(content).not.toContain('newPlanName');
      expect(content).not.toContain('openSaveModal');
      expect(content).not.toContain('closeSaveModal');
      expect(content).not.toContain('setNewPlanName');
    }
  });
});
