/**
 * E2A TM Preview/Apply Disclosure Guardrails
 *
 * Proves that the E2 fallback disclosure behavior is present, complete, and
 * consistent across all three user-facing surfaces. These tests block accidental
 * removal or under-disclosure of the apply-only gate set.
 *
 * What these tests guard:
 *   1. Machine-readable metadata: previewTier + applyOnlyGates in validation result
 *   2. Apply-area disclosure (TradeEditor) mentions the full blocker set
 *   3. Legend disclosure (TradeLegalChecker) mentions the full blocker set
 *   4. Section header (ValidationDetailsPanel) includes post-state qualifier
 *   5. No surface implies guaranteed apply success
 *   6. Type contract (ValidationResultLike) declares both metadata fields
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

  // ─── Metadata: previewTier ────────────────────────────────────────────────

  it('useTradeMachine emits previewTier: cba-validator in validation result', () => {
    expect(useTradeMachineSrc).toContain("previewTier: 'cba-validator'");
  });

  // ─── Metadata: applyOnlyGates ─────────────────────────────────────────────

  it('useTradeMachine applyOnlyGates includes duplicate-player-world-check', () => {
    expect(useTradeMachineSrc).toContain('duplicate-player-world-check');
  });

  it('useTradeMachine applyOnlyGates includes duplicate-entitlement-world-check', () => {
    expect(useTradeMachineSrc).toContain('duplicate-entitlement-world-check');
  });

  it('useTradeMachine applyOnlyGates includes entitlement-exclusivity-world-check', () => {
    expect(useTradeMachineSrc).toContain('entitlement-exclusivity-world-check');
  });

  it('useTradeMachine applyOnlyGates includes post-state-cap-schema', () => {
    expect(useTradeMachineSrc).toContain('post-state-cap-schema');
  });

  // ─── TradeEditor: Apply-area disclosure ───────────────────────────────────

  it('TradeEditor disclosure mentions apply time', () => {
    expect(tradeEditorSrc).toContain('apply time');
  });

  it('TradeEditor disclosure mentions post-state checks', () => {
    expect(tradeEditorSrc).toContain('post-state');
  });

  it('TradeEditor disclosure mentions exclusivity', () => {
    expect(tradeEditorSrc).toContain('exclusivity');
  });

  it('TradeEditor disclosure mentions cap/roster integrity', () => {
    expect(tradeEditorSrc).toContain('cap/roster');
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

  it('TradeLegalChecker legend mentions post-state cap/roster integrity', () => {
    expect(tradeLegalCheckerSrc).toContain('post-state cap/roster');
  });

  it('TradeLegalChecker legend clarifies preview covers CBA validator rules only', () => {
    expect(tradeLegalCheckerSrc).toContain(
      'Preview covers CBA validator rules only'
    );
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

  // ─── Type contract ────────────────────────────────────────────────────────

  it('ValidationResultLike type declares previewTier field', () => {
    expect(presentationTypesSrc).toContain("previewTier?: 'cba-validator'");
  });

  it('ValidationResultLike type declares applyOnlyGates field', () => {
    expect(presentationTypesSrc).toContain('applyOnlyGates?: string[]');
  });
});
