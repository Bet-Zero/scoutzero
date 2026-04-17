/**
 * FILE: src/tests/architect/internalWrapperBatch.e125.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E125 internal wrapper and barrel deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * @vitest-environment jsdom
 *
 * HISTORY:
 *  - 2026-03-20: E125 - Added deleted-path checks plus extensionless/authority parity for retired internal wrappers.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const architectRoot = path.resolve(__dirname, '../../features/architect');

const deletedBatchPaths = [
  'CapSheet.jsx',
  'CapSheetFull.jsx',
  'CapSummaryTiles.jsx',
  'DraftPickTracker.jsx',
  'ExceptionHistoryTracker.jsx',
  'ExceptionTracker.jsx',
  'FreeAgentPool.jsx',
  'OffseasonTab.jsx',
  'RosterVisual.jsx',
  'TeamHistoryTab.jsx',
  'ValidationWarnings.jsx',
  'WaiveStretchTracker.jsx',
  'GMDashboard/components/index.js',
] as const;

const moduleParityCases = [
  {
    label: 'CapSheet',
    extensionlessSpecifier: '@/features/architect/capSheet/CapSheet',
    authoritySpecifier: '../../features/architect/capSheet/CapSheet/CapSheet.tsx',
  },
  {
    label: 'CapSheetFull',
    extensionlessSpecifier: '@/features/architect/capSheet/CapSheetFull',
    authoritySpecifier:
      '../../features/architect/capSheet/CapSheetFull/CapSheetFull.tsx',
  },
  {
    label: 'CapSummaryTiles',
    extensionlessSpecifier:
      '@/features/architect/capSheet/CapSheet/CapSummaryTiles',
    authoritySpecifier:
      '../../features/architect/capSheet/CapSheet/CapSummaryTiles.tsx',
  },
  {
    label: 'FreeAgentPool',
    extensionlessSpecifier: '@/features/architect/freeAgency/FreeAgentPool',
    authoritySpecifier:
      '../../features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx',
  },
  {
    label: 'OffseasonTab',
    extensionlessSpecifier: '@/features/architect/offseason/OffseasonTab',
    authoritySpecifier:
      '../../features/architect/offseason/OffseasonTab/OffseasonTab.tsx',
  },
  {
    label: 'RosterVisual',
    extensionlessSpecifier: '@/features/architect/shared/RosterVisual',
    authoritySpecifier:
      '../../features/architect/shared/RosterVisual/RosterVisual.tsx',
  },
  {
    label: 'TeamHistoryTab',
    extensionlessSpecifier: '@/features/architect/history/TeamHistoryTab',
    authoritySpecifier:
      '../../features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx',
  },
  {
    label: 'ValidationWarnings',
    extensionlessSpecifier: '@/features/architect/shared/ValidationWarnings',
    authoritySpecifier:
      '../../features/architect/shared/ValidationWarnings/ValidationWarnings.tsx',
  },
  {
    label: 'ExceptionTracker',
    extensionlessSpecifier: '@/features/architect/capSheet/ExceptionTracker',
    authoritySpecifier:
      '../../features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx',
  },
  {
    label: 'ExceptionHistoryTracker',
    extensionlessSpecifier:
      '@/features/architect/capSheet/ExceptionHistoryTracker',
    authoritySpecifier:
      '../../features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.tsx',
  },
  {
    label: 'DraftPickTracker',
    extensionlessSpecifier: '@/features/architect/offseason/DraftPickTracker',
    authoritySpecifier:
      '../../features/architect/offseason/DraftPickTracker/DraftPickTracker.tsx',
  },
  {
    label: 'WaiveStretchTracker',
    extensionlessSpecifier: '@/features/architect/offseason/WaiveStretchTracker',
    authoritySpecifier:
      '../../features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.tsx',
  },
] as const;

describe('E125 internal wrapper deletion batch guardrails', () => {
  it('tracks the exact 13-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(13);
  });

  it('confirms every deleted-batch wrapper and barrel path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(architectRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  for (const moduleCase of moduleParityCases) {
    it(`keeps ${moduleCase.label} extensionless imports aligned with the TS authority`, async () => {
      const extensionlessModule = await import(moduleCase.extensionlessSpecifier);
      const authorityModule = await import(moduleCase.authoritySpecifier);

      expect(Object.keys(extensionlessModule)).toEqual(
        expect.arrayContaining(['default'])
      );
      expect(Object.keys(authorityModule)).toEqual(
        expect.arrayContaining(['default'])
      );
      expect(extensionlessModule.default).toBe(authorityModule.default);
    });
  }

  it('keeps GMDashboard OffseasonSection aligned with direct component imports after barrel retirement', async () => {
    const offseasonSectionSource = fs.readFileSync(
      path.join(architectRoot, 'GMDashboard/sections/OffseasonSection.tsx'),
      'utf-8'
    );

    expect(offseasonSectionSource).toContain(
      "from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';"
    );
    expect(offseasonSectionSource).toContain(
      "from '@/features/architect/GMDashboard/components/DraftPositionsInput';"
    );
    expect(offseasonSectionSource).not.toContain(
      "from '@/features/architect/GMDashboard/components';"
    );
  });
});
