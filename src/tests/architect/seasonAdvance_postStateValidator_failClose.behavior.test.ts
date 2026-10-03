import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../features/architect/utils/seasonManager.prepare.ts'
  ),
  'utf8'
);

describe('Season Advance post-state validator fail-close', () => {
  it('reconciles final state before returning any publishable transition', () => {
    const validationIndex = source.indexOf(
      'const postStateValidation = validatePostStateCapLegality({'
    );
    const failureIndex = source.indexOf('if (!postStateValidation.valid) {');
    const successIndex = source.lastIndexOf('success: true');

    expect(validationIndex).toBeGreaterThan(-1);
    expect(failureIndex).toBeGreaterThan(validationIndex);
    expect(successIndex).toBeGreaterThan(failureIndex);
    expect(source.slice(failureIndex, successIndex)).toContain(
      "error: 'Post-state cap validation failed for season advance'"
    );
    expect(source.slice(failureIndex, successIndex)).toContain(
      'violations: postStateValidation.violations'
    );
  });
});
