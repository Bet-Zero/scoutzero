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

    it('defines a named preview access helper instead of an inline gate boolean', () => {
      expect(source).toContain('type DevPreviewAccessState = {');
      expect(source).toContain('function getDevPreviewAccessState(): DevPreviewAccessState {');
      expect(source).toContain('const previewAccess = getDevPreviewAccessState();');
    });

    it('keeps preview access behind both DEV and hz.dev.offseasonPreview intent', () => {
      expect(source).toContain('const isDevEnvironment = Boolean(import.meta.env.DEV);');
      expect(source).toContain('const hasPreviewIntent =');
      expect(source).toContain(
        "window.localStorage?.getItem(DEV_OFFSEASON_PREVIEW_FLAG) === 'true'"
      );
      expect(source).toContain(
        'canRenderPreview: isDevEnvironment && hasPreviewIntent,'
      );
    });

    it('routes preview rendering through the explicit preview access contract', () => {
      expect(source).toContain('previewAccess={previewAccess}');
      expect(source).toContain('if (!previewAccess.canRenderPreview) {');
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
      expect(source).toContain('function DevPreviewOffseasonSurface({');
      expect(source).toContain('function WorldBackedOffseasonSurface({');
    });

    it('passes world-derived season truth into the world-backed controls', () => {
      expect(source).toContain(
        'nextAdvanceDraftYear={nextAdvanceDraftYear ?? viewingYear}'
      );
      expect(source).toContain(
        'getDraftYearForSeasonAdvance(worldSeason)'
      );
      expect(source).toContain(
        'const canAdvanceWorldSeason = Boolean('
      );
      expect(source).toContain(
        'authoritativeWorldSeason={worldSeason}'
      );
      expect(source).toContain(
        'canAdvanceSeason={canAdvanceWorldSeason}'
      );
    });

    it('applies world-backed aftermath from the normalized callback payload', () => {
      expect(source).toContain('function getCommittedWorldAdvanceAftermath(');
      expect(source).toContain('function applyCommittedWorldAdvanceAftermath(');
      expect(source).toContain(
        'const committedWorldAdvanceAftermath ='
      );
      expect(source).toContain(
        'getCommittedWorldAdvanceAftermath(result);'
      );
      expect(source).toContain(
        'applyCommittedWorldAdvanceAftermath(committedWorldAdvanceAftermath, {'
      );
      expect(source).toContain('await onReloadWorldData();');
      expect(source).not.toContain('setOffseasonSummary({');
    });

    it('keeps preview aftermath out of wrapper-level dashboard state application', () => {
      expect(source).not.toContain('onPreviewAdvanceComplete');
      expect(source).not.toContain('setLastCapSheet');
      expect(source).not.toContain('updatedCapSheet');
      expect(source).not.toContain('nextYear');
      expect(source).not.toContain('summary,');
    });

    it('does not synthesize unsupported world summary defaults in the wrapper', () => {
      expect(source).not.toContain('resetMLE: true');
      expect(source).not.toContain('expiredTPEs: []');
      expect(source).not.toContain('waivedDeadCap: []');
    });

    it('does NOT render OffseasonTab unconditionally', () => {
      // Count occurrences of <OffseasonTab — should only appear inside the preview access gate
      const unconditionalPattern = /^\s*<OffseasonTab/gm;
      const matches = source.match(unconditionalPattern) || [];
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

    it('keeps preview aftermath on local preview-only wording', () => {
      expect(source).toContain('This preview stays local to this DEV surface.');
      expect(source).toContain('No world state,');
      expect(source).toContain(
        'dashboard year, or shared offseason summary was updated.'
      );
      expect(source).toContain('data-testid="offseason-preview-aftermath"');
      expect(source).toContain('data-testid="offseason-preview-aftermath-copy"');
    });

    it('directs users to World Season Advance for persistence', () => {
      expect(source).toContain('Use World');
      expect(source).toContain('Season Advance to persist real changes.');
    });

    it('labels the advance button as preview', () => {
      expect(source).toContain('Preview Advance to');
    });

    it('keeps reset and edit controls inside the preview surface', () => {
      expect(source).toContain('Reset Preview');
      expect(source).toContain('Edit Decisions');
      expect(source).toContain('setPreviewAftermath(null);');
      expect(source).toContain('setOptionsConfirmed(false);');
    });

    it('keeps OffseasonTab on the preview-only runner', () => {
      expect(source).toContain(
        "import { runOffseason } from '@/features/architect/utils/runOffseason';"
      );
      expect(source).not.toContain('advanceSeasonInWorld');
      expect(source).not.toContain('seasonManager');
      expect(source).not.toContain('onPreviewAdvanceComplete');
      expect(source).not.toContain('offseasonRun');
    });
  });

  describe('SeasonAdvanceModal — world authority seam', () => {
    const source = fs.readFileSync(seasonAdvanceModalPath, 'utf-8');

    it('keeps SeasonAdvanceModal on the world-backed advance authority', () => {
      expect(source).toContain('advanceSeasonInWorld');
      expect(source).not.toContain('runOffseason');
    });

    it('publishes the world authority prop names', () => {
      expect(source).toContain('authoritativeWorldSeason: string;');
      expect(source).toMatch(
        /onWorldAdvanceComplete\?:\s*\|\s*\(\(result: SeasonAdvanceResult\) => void \| Promise<void>\)\s*\|\s*null;/
      );
      expect(source).toContain('export type SeasonAdvanceSuccessResult = {');
      expect(source).toContain('worldAdvanceAftermath: WorldAdvanceAftermath;');
      expect(source).toContain('export type SeasonAdvanceFailureResult = {');
      expect(source).toContain('error: string;');
      expect(source).toContain('committedTeamCapSheet: SeasonAdvanceModalTeamCapSheet | null;');
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
      expect(source).toContain('getCommittedTeamCapSheet');
      expect(source).toContain('buildWorldAdvanceAftermath');
      expect(source).toContain('buildSeasonAdvanceSuccessResult');
      expect(source).toContain('getSeasonAdvanceFailureMessage');
      expect(source).toContain(
        'const modalResult = buildSeasonAdvanceSuccessResult({'
      );
      expect(source).toContain('handleAdvanceFailure(advanceResult);');
      expect(source).toContain('focusTeamCode: teamCode ?? undefined,');
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
