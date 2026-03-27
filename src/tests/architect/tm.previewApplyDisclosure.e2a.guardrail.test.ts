/**
 * E2A TM Preview/Apply Disclosure Guardrails
 *
 * Proves that the E2/TM-1A-FINAL disclosure behavior is present, complete, and
 * consistent across all three user-facing surfaces. These tests block accidental
 * removal or under-disclosure of the remaining apply-only gate set.
 *
 * What these tests guard:
 *   1. Hook/UI naming exposes one primary previewAuthority and one detail-only snapshot payload
 *   2. Apply-area disclosure (TradeEditor) mentions the remaining apply-only gates
 *   3. Legend disclosure (TradeLegalChecker) mentions the remaining apply-only gates
 *   4. Section header (ValidationDetailsPanel) includes post-state qualifier
 *   5. No surface implies guaranteed apply success
 *   6. Type contracts declare PreviewAuthorityLike + SnapshotValidationDetailsLike
 *   7. tradeContext getFullLegalityPreview routes through preview authority stages
 *
 * TM-3D follow-up changes:
 *   - previewAuthority is now the only top-level legality surface in the UI
 *   - snapshotValidationDetails is detail-only and no longer carries previewTier/applyOnlyGates
 *   - TradeEditor/TradeSummary/TradePreview no longer key off snapshot detail legality
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('E2A TM preview/apply disclosure guardrails', () => {
  const tmRoot = path.resolve(
    __dirname,
    '../../features/architect/tradeMachine'
  );
  const hooksRoot = path.resolve(__dirname, '../../features/architect/hooks');
  const utilsRoot = path.resolve(__dirname, '../../features/architect/utils');

  const useTradeMachineSrc = fs.readFileSync(
    path.join(hooksRoot, 'useTradeMachine.ts'),
    'utf-8'
  );
  const tradeEditorSrc = fs.readFileSync(
    path.join(tmRoot, 'TradeEditor.tsx'),
    'utf-8'
  );
  const tradeLegalCheckerSrc = fs.readFileSync(
    path.join(tmRoot, 'TradeLegalChecker.tsx'),
    'utf-8'
  );
  const validationDetailsPanelSrc = fs.readFileSync(
    path.join(tmRoot, 'ValidationDetailsPanel.tsx'),
    'utf-8'
  );
  const presentationTypesSrc = fs.readFileSync(
    path.join(tmRoot, 'validationPresentationTypes.ts'),
    'utf-8'
  );
  const tradeContextSrc = fs.readFileSync(
    path.join(utilsRoot, 'tradeContext/tradeContext.ts'),
    'utf-8'
  );

  // ─── Hook contract: one primary authority + one detail payload ───────────

  it('useTradeMachine exposes previewAuthority and snapshotValidationDetails', () => {
    expect(useTradeMachineSrc).toContain('previewAuthority');
    expect(useTradeMachineSrc).toContain('snapshotValidationDetails');
  });

  it('useTradeMachine no longer exposes the old dual-truth fields', () => {
    expect(useTradeMachineSrc).not.toContain('fullLegalityResult');
    expect(useTradeMachineSrc).not.toContain('authoritativeLegal');
    expect(useTradeMachineSrc).not.toContain('previewTier');
    expect(useTradeMachineSrc).not.toContain('applyOnlyGates');
  });

  // ─── tradeContext: preview now routes through shared authority stages ─────

  it('tradeContext getFullLegalityPreview delegates to validateTradePreviewAuthority', () => {
    expect(tradeContextSrc).toContain('validateTradePreviewAuthority');
  });

  it('tradeContext getFullLegalityPreview does not call validatePostStateCapLegality directly', () => {
    expect(tradeContextSrc).not.toMatch(/validatePostStateCapLegality\s*\(/);
  });

  // ─── TradeEditor: Apply-area disclosure ───────────────────────────────────

  it('TradeEditor disclosure mentions apply time', () => {
    expect(tradeEditorSrc).toContain('apply time');
  });

  it('TradeEditor gates apply with previewAuthority rather than snapshot detail legality', () => {
    expect(tradeEditorSrc).toContain('currentPreviewAuthority?.legal === true');
    expect(tradeEditorSrc).not.toContain('result?.legal');
    expect(tradeEditorSrc).not.toContain('fullLegalityResult');
  });

  it('TradeEditor disclosure mentions exclusivity', () => {
    expect(tradeEditorSrc).toContain('exclusivity');
  });

  it('TradeEditor disclosure does not claim guaranteed apply success', () => {
    // No surface should imply the trade is guaranteed to apply
    expect(tradeEditorSrc).not.toMatch(/guaranteed.*apply/i);
    expect(tradeEditorSrc).not.toMatch(/apply.*guaranteed/i);
  });

  // ─── TradeLegalChecker: Legend disclosure ─────────────────────────────────

  it('TradeLegalChecker legend mentions apply time', () => {
    expect(tradeLegalCheckerSrc).toContain('apply time');
  });

  it('TradeLegalChecker legend clarifies preview covers CBA validator and post-state cap', () => {
    expect(tradeLegalCheckerSrc).toContain('Preview covers CBA validator');
  });

  it('TradeLegalChecker legend does not claim guaranteed apply success', () => {
    expect(tradeLegalCheckerSrc).not.toMatch(/guaranteed.*apply/i);
    expect(tradeLegalCheckerSrc).not.toMatch(/apply.*guaranteed/i);
  });

  // ─── ValidationDetailsPanel: Section header ───────────────────────────────

  it('ValidationDetailsPanel section header includes preview-only qualifier', () => {
    expect(validationDetailsPanelSrc).toContain('preview only');
  });

  it('ValidationDetailsPanel section header includes post-state qualifier', () => {
    expect(validationDetailsPanelSrc).toContain('post-state');
  });

  it('ValidationDetailsPanel does not claim post-state checks only run at apply time', () => {
    expect(validationDetailsPanelSrc).not.toContain(
      'world-state + post-state checks run at apply time'
    );
  });

  // ─── Type contract ────────────────────────────────────────────────────────

  it('validation presentation types declare PreviewAuthorityLike', () => {
    expect(presentationTypesSrc).toContain('export interface PreviewAuthorityLike');
    expect(presentationTypesSrc).toContain('omittedStages?: string[]');
  });

  it('validation presentation types declare SnapshotValidationDetailsLike', () => {
    expect(presentationTypesSrc).toContain(
      'export interface SnapshotValidationDetailsLike'
    );
    expect(presentationTypesSrc).toContain('summaryByTeamIndex?:');
  });
});
