/**
 * FILE: src/tests/architect/routeEntryWrapperBatch.e129.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E129 route/public-entry wrapper cleanup batch.
 * OWNERSHIP: Feature: architect
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LeagueView } from '@/features/architect/shared/LeagueView';

const srcRoot = path.resolve(__dirname, '../..');
const architectRoot = path.join(srcRoot, 'features/architect');

const deletedBatchPaths = [
  'GMDashboard/index.jsx',
  'LeagueView.jsx',
  'shared/LeagueView/LeagueView.jsx',
] as const;

describe('E129 route/public-entry wrapper deletion batch guardrails', () => {
  it('tracks the exact 3-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(3);
  });

  it('confirms every deleted route/public-entry wrapper path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(architectRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  it('keeps GmDashboardView on the direct GMDashboard authority import', () => {
    const source = fs.readFileSync(
      path.join(srcRoot, 'pages/GmDashboardView.tsx'),
      'utf-8'
    );

    expect(source).toContain(
      "import GMDashboard from '@/features/architect/GMDashboard/GMDashboard';"
    );
    expect(source).not.toContain(
      "import GMDashboard from '@/features/architect/GMDashboard';"
    );
  });

  it('keeps GmLeagueView on the retained shared/LeagueView folder entry', () => {
    const source = fs.readFileSync(
      path.join(srcRoot, 'pages/GmLeagueView.tsx'),
      'utf-8'
    );

    expect(source).toContain(
      "import LeagueView from '@/features/architect/shared/LeagueView';"
    );
    expect(source).not.toContain(
      "import LeagueView from '@/features/architect/LeagueView';"
    );
  });

  it('keeps the shared/LeagueView folder entry aligned with the TS authority', async () => {
    const authorityModule = await import(
      '../../features/architect/shared/LeagueView/LeagueView'
    );
    const indexSource = fs.readFileSync(
      path.join(architectRoot, 'shared/LeagueView/index.ts'),
      'utf-8'
    );

    expect(indexSource).toContain("export { default } from './LeagueView';");
    expect(Object.keys(authorityModule)).toEqual(['default']);
    expect(authorityModule.default).toBe(LeagueView);
  });
});
