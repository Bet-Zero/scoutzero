/**
 * FILE: src/tests/architect/offseason.devGate.guardrail.test.ts
 * PURPOSE: Guardrail ensuring single-team OffseasonTab is DEV+localStorage gated
 *          and does not display misleading persistence success language.
 * OWNERSHIP: Test suite — OFFSEASON_E1
 *
 * HISTORY:
 *  - 2026-03-03: OFFSEASON_E1 — Created guardrail for DEV-gated single-team offseason preview.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const offseasonSectionPath = path.resolve(
  process.cwd(),
  'src/features/architect/GMDashboard/sections/OffseasonSection.tsx'
);

const offseasonTabPath = path.resolve(
  process.cwd(),
  'src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx'
);

const optionManagerPath = path.resolve(
  process.cwd(),
  'src/features/architect/offseason/OffseasonTab/OptionManager.tsx'
);

const seasonAdvanceModalPath = path.resolve(
  process.cwd(),
  'src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx'
);

const offseasonTabShimPath = path.resolve(
  process.cwd(),
  'src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx'
);

const optionManagerShimPath = path.resolve(
  process.cwd(),
  'src/features/architect/offseason/OffseasonTab/OptionManager.jsx'
);

describe('OFFSEASON_E1: Single-team offseason DEV-gate guardrails', () => {
  describe('OffseasonSection — DEV + localStorage gate', () => {
    const source = fs.readFileSync(offseasonSectionPath, 'utf-8');

    it('gates OffseasonTab behind import.meta.env.DEV', () => {
      expect(source).toContain('import.meta.env.DEV');
    });

    it('gates OffseasonTab behind hz.dev.offseasonPreview localStorage flag', () => {
      expect(source).toContain(
        "window.localStorage?.getItem(DEV_OFFSEASON_PREVIEW_FLAG) === 'true'"
      );
    });

    it('routes preview rendering through the explicit DEV preview surface gate', () => {
      expect(source).toContain('showDevPreview={showDevPreview}');
      expect(source).toContain('if (!showDevPreview) {');
    });

    it('exports the DEV flag constant for test discoverability', () => {
      expect(source).toContain(
        "export const DEV_OFFSEASON_PREVIEW_FLAG = 'hz.dev.offseasonPreview'"
      );
    });

    it('includes preview-only warning banner', () => {
      expect(source).toContain(
        'Preview only — does not persist. Changes will be lost on refresh.'
      );
    });

    it('publishes separate world-backed and preview-only surfaces', () => {
      expect(source).toContain('data-testid="offseason-world-surface"');
      expect(source).toContain('data-testid="offseason-preview-surface"');
    });

    it('passes world-derived year props into the world-backed controls', () => {
      expect(source).toContain(
        'defaultDraftYear={worldDraftYear ?? viewingYear}'
      );
      expect(source).toContain(
        'authoritativeSeasonEndYear={worldSeasonEndYear ?? viewingYear}'
      );
    });

    it('applies world-backed aftermath from the normalized callback payload', () => {
      expect(source).toContain('function getWorldAdvanceAftermath(');
      expect(source).toContain(
        'const worldAdvanceAftermath = getWorldAdvanceAftermath(result);'
      );
      expect(source).toContain('if (!worldAdvanceAftermath) {');
      expect(source).toContain(
        'setCurrentYear(worldAdvanceAftermath.nextViewingYear);'
      );
      expect(source).toContain(
        'setWorldSeason(worldAdvanceAftermath.nextWorldSeason);'
      );
      expect(source).toContain(
        'setOffseasonSummary(worldAdvanceAftermath.offseasonSummary);'
      );
      expect(source).not.toContain('setOffseasonSummary({');
    });

    it('does not synthesize unsupported world summary defaults in the wrapper', () => {
      expect(source).not.toContain('resetMLE: true');
      expect(source).not.toContain('expiredTPEs: []');
      expect(source).not.toContain('waivedDeadCap: []');
    });

    it('does NOT render OffseasonTab unconditionally', () => {
      // Count occurrences of <OffseasonTab — should only appear inside showDevPreview gate
      const unconditionalPattern = /^\s*<OffseasonTab/gm;
      const matches = source.match(unconditionalPattern) || [];
      // Exactly one occurrence (inside the gated block)
      expect(matches.length).toBe(1);
    });
  });

  describe('OffseasonTab — no misleading persistence language', () => {
    const source = fs.readFileSync(offseasonTabPath, 'utf-8');

    it('does NOT claim "Offseason Complete"', () => {
      expect(source).not.toContain('Offseason Complete');
    });

    it('uses preview-only completion language', () => {
      expect(source).toContain('Preview computed — not saved');
    });

    it('directs users to World Season Advance for persistence', () => {
      expect(source).toContain('Use World Season Advance to persist');
    });

    it('labels the advance button as preview', () => {
      expect(source).toContain('Preview Advance to');
    });

    it('keeps OffseasonTab on the preview-only runner', () => {
      expect(source).toContain(
        "import { runOffseason } from '@/features/architect/utils/runOffseason';"
      );
      expect(source).not.toContain('advanceSeasonInWorld');
      expect(source).not.toContain('seasonManager');
    });
  });

  describe('SeasonAdvanceModal — world authority seam', () => {
    const source = fs.readFileSync(seasonAdvanceModalPath, 'utf-8');

    it('keeps SeasonAdvanceModal on the world-backed advance authority', () => {
      expect(source).toContain('advanceSeasonInWorld');
      expect(source).not.toContain('runOffseason');
    });

    it('publishes the world authority prop names', () => {
      expect(source).toContain('authoritativeSeasonEndYear: number;');
      expect(source).toContain(
        'onWorldAdvanceComplete?: ((result: SeasonAdvanceResult) => void) | null;'
      );
      expect(source).toContain('export type SeasonAdvanceSuccessResult = {');
      expect(source).toContain('worldAdvanceAftermath: WorldAdvanceAftermath;');
      expect(source).toContain('export type SeasonAdvanceFailureResult = {');
      expect(source).toContain('error: string;');
      expect(source).toContain(
        'function buildWorldAdvanceAftermath({'
      );
    });

    it('keeps wizard flow and option staging on explicit modal-local helpers', () => {
      expect(source).toContain('buildPreAdvanceWizardSteps');
      expect(source).toContain('getWizardNavigationState');
      expect(source).toContain('reconcileStagedOptionDecisions');
      expect(source).toContain('stagedOptionDecisions');
      expect(source).toContain('buildAdvanceOptionDecisions');
      expect(source).toContain('season-advance-progress');
    });

    it('keeps result normalization on explicit modal-local helpers', () => {
      expect(source).toContain('buildDashboardOffseasonSummary');
      expect(source).toContain('buildWorldAdvanceAftermath');
      expect(source).toContain('buildSeasonAdvanceSuccessResult');
      expect(source).toContain('getSeasonAdvanceFailureMessage');
      expect(source).toContain(
        'const modalResult = buildSeasonAdvanceSuccessResult({'
      );
      expect(source).toContain('handleAdvanceFailure(advanceResult);');
    });
  });

  describe('Offseason preview authorities after shim retirement', () => {
    const offseasonTabSource = fs.readFileSync(offseasonTabPath, 'utf-8');
    const optionManagerSource = fs.readFileSync(optionManagerPath, 'utf-8');

    it('deletes the explicit JSX shim files', () => {
      expect(fs.existsSync(offseasonTabShimPath)).toBe(false);
      expect(fs.existsSync(optionManagerShimPath)).toBe(false);
    });

    it('keeps OffseasonTab.tsx on a default-export authority surface', () => {
      expect(offseasonTabSource).toContain('export default OffseasonTab;');
    });

    it('keeps OptionManager.tsx on a default-export authority surface', () => {
      expect(optionManagerSource).toContain('export default OptionManager;');
    });
  });
});
