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
 *   7. tradeContext getTradePreviewAuthority routes through preview authority stages
 *   8. getFullLegalityPreview remains a compatibility alias only
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
  const tradeEditorDisclosureText = Array.from(
    tradeEditorSrc.matchAll(
      /['"]([^'"]*Final roster and draft-asset checks run[^'"]*)['"]/g
    ),
    (match) => match[1]
  ).join('\n');
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

  it('tradeContext getTradePreviewAuthority delegates to validateTradePreviewAuthority', () => {
    expect(tradeContextSrc).toContain('export function getTradePreviewAuthority');
    expect(tradeContextSrc).toContain('validateTradePreviewAuthority');
  });

  it('tradeContext preview authority file does not call validatePostStateCapLegality directly', () => {
    expect(tradeContextSrc).not.toMatch(/validatePostStateCapLegality\s*\(/);
  });

  it('tradeContext keeps getFullLegalityPreview as a compatibility alias', () => {
    expect(tradeContextSrc).toContain('export function getFullLegalityPreview');
    expect(tradeContextSrc).toContain('return getTradePreviewAuthority(params);');
  });

  // ─── TradeEditor: Apply-area disclosure ───────────────────────────────────

  it('TradeEditor disclosure says final checks run when the move is applied', () => {
    expect(tradeEditorSrc).toContain(
      'Final roster and draft-asset checks run when you apply it'
    );
  });

  it('TradeEditor gates apply with previewAuthority rather than snapshot detail legality', () => {
    expect(tradeEditorSrc).toContain('currentPreviewAuthority?.legal === true');
    expect(tradeEditorSrc).not.toContain('result?.legal');
    expect(tradeEditorSrc).not.toContain('fullLegalityResult');
  });

  it('TradeEditor disclosure does not expose implementation gate names', () => {
    expect(tradeEditorDisclosureText).not.toMatch(/exclusivity/i);
  });

  it('TradeEditor disclosure does not claim guaranteed apply success', () => {
    // No surface should imply the trade is guaranteed to apply
    expect(tradeEditorSrc).not.toMatch(/guaranteed.*apply/i);
    expect(tradeEditorSrc).not.toMatch(/apply.*guaranteed/i);
  });

  // ─── TradeLegalChecker: Legend disclosure ─────────────────────────────────

  it('TradeLegalChecker legend says final checks run when the trade is applied', () => {
    expect(tradeLegalCheckerSrc).toContain(
      'Final roster and draft-asset checks run when you apply the trade'
    );
  });

  it('TradeLegalChecker keeps the final-check disclosure concise', () => {
    expect(tradeLegalCheckerSrc).not.toContain('Preview covers CBA validator');
  });

  it('TradeLegalChecker legend does not claim guaranteed apply success', () => {
    expect(tradeLegalCheckerSrc).not.toMatch(/guaranteed.*apply/i);
    expect(tradeLegalCheckerSrc).not.toMatch(/apply.*guaranteed/i);
  });

  // ─── ValidationDetailsPanel: Section header ───────────────────────────────

  it('ValidationDetailsPanel identifies the visible rule results', () => {
    expect(validationDetailsPanelSrc).toContain(
      'CBA rule results for each team'
    );
  });

  it('ValidationDetailsPanel preserves the final-check disclosure', () => {
    expect(validationDetailsPanelSrc).toContain(
      'draft-asset checks run when the trade is applied'
    );
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
