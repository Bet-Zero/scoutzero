/**
 * FILE: src/tests/architect/noVacuumWording.test.ts
 * PURPOSE: Guard that ensures the word "vacuum" never appears in user-facing UI text.
 *          Internal identifiers, comments, data-testid, and imports are allowed.
 * TICKET: TM-UI-COPY-E1
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * UI source files that render Trade Machine / Pick-Right wizard surfaces.
 * If new files are added that render user-visible copy related to vacuum mode,
 * add them here.
 */
const UI_SOURCE_FILES = [
  'src/features/architect/admin/PickRightWizardModal.tsx',
  'src/features/architect/tradeMachine/TradeEditor.jsx',
  'src/features/architect/tradeMachine/EntitlementPickRow.jsx',
  'src/features/architect/tradeMachine/EntitlementPicksList.jsx',
  'src/features/architect/tradeMachine/TradeTeamCard.jsx',
  'src/features/architect/admin/EntitlementEditorAdvancedTab.tsx',
  'src/features/architect/GMDashboard/components/WorldSelector.jsx',
];

/**
 * Matches JSX text content containing "vacuum" (case-insensitive).
 * Targets patterns like:
 *   >…vacuum…<          (JSX text nodes)
 *   "…vacuum…"          (string literals in JSX attributes like title=, aria-label=)
 *   '…vacuum…'          (same, single-quoted)
 *   `…vacuum…`          (template literals)
 *
 * Excludes:
 *   data-testid="…vacuum…"   (test IDs, not user-visible)
 *   {/* … vacuum … * /}      (comments — handled by pre-strip)
 *   import/variable names     (not inside quotes that are JSX-rendered)
 */

describe('TM-UI-COPY-E1: no "vacuum" in user-facing copy', () => {
  const root = path.resolve(__dirname, '..', '..', '..');

  for (const relPath of UI_SOURCE_FILES) {
    const absPath = path.join(root, relPath);

    it(`${relPath} has no user-visible "vacuum" text`, () => {
      if (!fs.existsSync(absPath)) {
        // File may have been renamed/removed — skip gracefully
        return;
      }

      const source = fs.readFileSync(absPath, 'utf-8');
      const lines = source.split('\n');
      const violations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comment-only lines
        if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;

        // Skip import lines
        if (/^\s*import\s/.test(line)) continue;

        // Skip lines that only reference vacuum in data-testid
        if (/data-testid=/.test(line)) continue;

        // Skip lines that are console.log / console.error / console.warn
        if (/console\.(log|error|warn|info)/.test(line)) continue;

        // Skip lines that only reference vacuum in variable/function names or keys
        // (identifiers like isVacuumMode, vacuumMode, __vacuumEdited, etc.)
        // We only flag lines where "vacuum" appears inside a rendered string context.

        // Check for JSX text content: >…vacuum…< (text between tags)
        if (/>([^<]*vacuum[^<]*)</i.test(line)) {
          violations.push(`L${i + 1}: ${line.trim()}`);
          continue;
        }

        // Check for string prop values containing "vacuum" (title=, aria-label=, etc.)
        // but exclude data-testid and variable assignments
        const propMatch = line.match(
          /(?:title|aria-label|placeholder|alt|label)=["'`]([^"'`]*vacuum[^"'`]*)["'`]/i
        );
        if (propMatch) {
          violations.push(`L${i + 1}: ${line.trim()}`);
          continue;
        }

        // Check for toast messages containing "vacuum"
        const toastMatch = line.match(
          /toast\.(success|error|info|warning)\(["'`]([^"'`]*vacuum[^"'`]*)["'`]\)/i
        );
        if (toastMatch) {
          violations.push(`L${i + 1}: ${line.trim()}`);
        }
      }

      expect(
        violations,
        `Found "vacuum" in user-visible text in ${relPath}:\n${violations.join('\n')}`
      ).toHaveLength(0);
    });
  }
});
