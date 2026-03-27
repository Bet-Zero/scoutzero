/**
 * E2A TM Preview/Apply Disclosure Guardrails
 *
 * Proves that the E2/TM-1A-FINAL disclosure behavior is present, complete, and
 * consistent across all three user-facing surfaces. These tests block accidental
 * removal or under-disclosure of the apply-only gate set.
 *
 * What these tests guard:
 *   1. Machine-readable metadata: previewTier + applyOnlyGates in validation result
 *   2. Apply-area disclosure (TradeEditor) mentions the remaining apply-only gates
 *   3. Legend disclosure (TradeLegalChecker) mentions the remaining apply-only gates
 *   4. Section header (ValidationDetailsPanel) includes post-state qualifier
 *   5. No surface implies guaranteed apply success
 *   6. Type contract (ValidationResultLike) declares both metadata fields
 *   7. tradeContext getFullLegalityPreview routes through preview authority stages
 *
 * TM-1A-FINAL changes (why some old tests were removed):
 *   - validatePostStateCapLegality moved from apply-only to preview
 *   - TM-3D: getFullLegalityPreview now delegates to validateTradePreviewAuthority
 *   - applyOnlyGates no longer includes 'post-state-cap-schema'
 *   - TradeEditor/TradeLegalChecker disclosure no longer lists cap/roster as apply-only
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

  // ─── Metadata: previewTier ────────────────────────────────────────────────

  it('useTradeMachine emits previewTier: cba-validator in validation result', () => {
    expect(useTradeMachineSrc).toContain("previewTier: 'cba-validator'");
  });

  // ─── Metadata: applyOnlyGates (3 Firestore-dependent gates remain) ────────

  it('useTradeMachine applyOnlyGates includes duplicate-player-world-check', () => {
    expect(useTradeMachineSrc).toContain('duplicate-player-world-check');
  });

  it('useTradeMachine applyOnlyGates includes duplicate-entitlement-world-check', () => {
    expect(useTradeMachineSrc).toContain('duplicate-entitlement-world-check');
  });

  it('useTradeMachine applyOnlyGates includes entitlement-exclusivity-world-check', () => {
    expect(useTradeMachineSrc).toContain('entitlement-exclusivity-world-check');
  });

  // TM-1A-FINAL: post-state-cap-schema removed from applyOnlyGates — now in preview
  it('useTradeMachine applyOnlyGates does NOT include post-state-cap-schema (moved to preview)', () => {
    // The string may appear in a comment but must not appear in the applyOnlyGates array value
    expect(useTradeMachineSrc).not.toMatch(/'post-state-cap-schema'/);
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

  it('ValidationResultLike type declares previewTier field', () => {
    expect(presentationTypesSrc).toContain("previewTier?: 'cba-validator'");
  });

  it('ValidationResultLike type declares applyOnlyGates field', () => {
    expect(presentationTypesSrc).toContain('applyOnlyGates?: string[]');
  });
});
