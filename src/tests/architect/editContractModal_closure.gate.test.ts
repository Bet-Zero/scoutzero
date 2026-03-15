/**
 * FILE: src/tests/architect/editContractModal_closure.gate.test.ts
 * PURPOSE: Closure permanence gates for EditContractModal (E1 fixes).
 * OWNERSHIP: Feature: architect/edit-contract (E2)
 *
 * HISTORY:
 *  - 2026-03-01: Created for TM_EDIT_CONTRACT_E2 — permanent regression gates
 *
 * GATES:
 *  1. Buyout Amount UI + Forwarding (EditContractModal)
 *  2. Success-Gated Modal Close (no unconditional onClose)
 *  3. Cancel Confirm Returns { success:false } (useArchitectActions)
 *  4. World Success Authoritative Re-sync
 *  5. World Compute Honors Buyout Fields (mutationPipeline)
 *  6. Callback Compatibility Contract { success, message }
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// === FILE PATH CONSTANTS ===

const EDIT_CONTRACT_MODAL_PATH = path.resolve(
  __dirname,
  '../../shared/components/EditContractModal.jsx'
);

const USE_ARCHITECT_ACTIONS_PATH = path.resolve(
  __dirname,
  '../../features/architect/GMDashboard/hooks/useArchitectActions.ts'
);

const MUTATION_PIPELINE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/mutationPipeline.ts'
);

const FREE_AGENT_POOL_PATH = path.resolve(
  __dirname,
  '../../features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx'
);

const TRADE_EDITOR_PATH = path.resolve(
  __dirname,
  '../../features/architect/tradeMachine/TradeEditor.tsx'
);

// === HELPER FUNCTIONS ===

/**
 * Read file contents with error handling
 */
const readFileContent = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Gate file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
};

// === GATE 1: Buyout Amount UI + Forwarding ===

describe('Gate 1: Buyout Amount UI + Forwarding (E1)', () => {
  const content = readFileContent(EDIT_CONTRACT_MODAL_PATH);

  it('has buyoutAmountInput state declaration', () => {
    // Pattern: useState hook for buyout amount input
    const hasBuyoutAmountState =
      /\[\s*buyoutAmountInput\s*,\s*setBuyoutAmountInput\s*\]\s*=\s*useState/.test(
        content
      );
    expect(hasBuyoutAmountState).toBe(true);
  });

  it('conditionally renders buyout amount input for buyout action', () => {
    // Pattern: selectedAction === 'buyout' conditional (or buyout action check)
    const hasBuyoutConditional = /selectedAction\s*===\s*['"]buyout['"]/.test(
      content
    );
    expect(hasBuyoutConditional).toBe(true);
  });

  it('forwards buyoutAmount in buyout case payload', () => {
    // Pattern: buyoutAmount: parsedBuyoutAmount (not hardcoded 0)
    const forwardsBuyoutAmount = /buyoutAmount\s*:\s*parsedBuyoutAmount/.test(
      content
    );
    expect(forwardsBuyoutAmount).toBe(true);
  });

  it('buyout case includes buyout: true flag', () => {
    // Pattern: buyout: true in the buyout case
    const hasBuyoutTrueFlag =
      /case\s*['"]buyout['"][\s\S]{0,200}buyout\s*:\s*true/.test(content);
    expect(hasBuyoutTrueFlag).toBe(true);
  });
});

// === GATE 2: Success-Gated Modal Close ===

describe('Gate 2: Success-Gated Modal Close (E1)', () => {
  const content = readFileContent(EDIT_CONTRACT_MODAL_PATH);

  it('handleConfirm is an async function', () => {
    // Pattern: const handleConfirm = async
    const isAsyncHandler = /const\s+handleConfirm\s*=\s*async/.test(content);
    expect(isAsyncHandler).toBe(true);
  });

  it('normalizes action result before close decision', () => {
    // Pattern: normalizeActionResult(actionResult) or normalizedResult usage
    const normalizesResult = /normalizeActionResult\s*\(/.test(content);
    expect(normalizesResult).toBe(true);
  });

  it('only calls onClose when normalizedResult.success is true', () => {
    // Pattern: if (normalizedResult.success) { onClose(); }
    const successGatedClose =
      /normalizedResult\.success[\s\S]{0,50}onClose\s*\(\s*\)/.test(content);
    expect(successGatedClose).toBe(true);
  });

  it('sets saveError on failure path', () => {
    // Pattern: setSaveError( on failure
    const setsSaveError = /setSaveError\s*\(/.test(content);
    expect(setsSaveError).toBe(true);
  });

  it('has saveError state declaration', () => {
    // Pattern: useState for saveError
    const hasSaveErrorState =
      /\[\s*saveError\s*,\s*setSaveError\s*\]\s*=\s*useState/.test(content);
    expect(hasSaveErrorState).toBe(true);
  });

  it('does NOT have unconditional onClose after switch statement', () => {
    // Anti-pattern: onClose() directly after switch block without success check
    // We check that onClose is only called within success conditional
    // The pattern should be: success check -> onClose, not: switch -> onClose unconditionally
    const hasUnconditionalClose =
      /\}\s*\n\s*onClose\s*\(\s*\)\s*;?\s*\n\s*\}\s*catch/.test(content);
    expect(hasUnconditionalClose).toBe(false);
  });
});

// === GATE 3: Cancel Confirm Returns { success:false } ===

describe('Gate 3: Cancel Confirm Returns { success:false } (E1)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('handleWaiveContract returns Promise<MutationActionResult>', () => {
    // Pattern: function signature includes Promise<MutationActionResult>
    const returnsPromise =
      /handleWaiveContract[\s\S]{0,200}Promise<MutationActionResult>/.test(
        content
      );
    expect(returnsPromise).toBe(true);
  });

  it('waive cancel returns { success: false, message }', () => {
    // Pattern: window.confirm returns { success: false, message: 'Action canceled...' }
    const waiveCancelReturn =
      /handleWaiveContract[\s\S]{0,800}window\.confirm[\s\S]{0,200}return\s*\{\s*success\s*:\s*false/.test(
        content
      );
    expect(waiveCancelReturn).toBe(true);
  });

  it('renounce cancel returns { success: false, message }', () => {
    // Pattern: confirmAndRenounceRights has cancel return with success: false
    const renounceCancelReturn =
      /confirmAndRenounceRights[\s\S]{0,800}window\.confirm[\s\S]{0,200}return\s*\{\s*success\s*:\s*false/.test(
        content
      );
    expect(renounceCancelReturn).toBe(true);
  });
});

// === GATE 4: World Success Authoritative Re-sync ===

describe('Gate 4: World Success Authoritative Re-sync (E1)', () => {
  const content = readFileContent(USE_ARCHITECT_ACTIONS_PATH);

  it('has syncTeamFromMutationResult function or equivalent sync call', () => {
    // Pattern: syncTeamFromMutationResult defined or called
    const hasSyncFunction = /syncTeamFromMutationResult/.test(content);
    expect(hasSyncFunction).toBe(true);
  });

  it('sync is called after successful mutation', () => {
    // Pattern: success path contains sync call (changedTeams handling)
    const syncOnSuccess =
      /changedTeams[\s\S]{0,500}(syncTeamFromMutationResult|setTeamCapSheet)/.test(
        content
      );
    expect(syncOnSuccess).toBe(true);
  });
});

// === GATE 5: World Compute Honors Buyout Fields ===

describe('Gate 5: World Compute Honors Buyout Fields (E1)', () => {
  const content = readFileContent(MUTATION_PIPELINE_PATH);

  it('computeWaiveResult reads payload.buyoutAmount', () => {
    // Pattern: payload.buyoutAmount in computeWaiveResult
    const readsBuyoutAmount =
      /computeWaiveResult[\s\S]{0,1500}payload\.buyoutAmount/.test(content);
    expect(readsBuyoutAmount).toBe(true);
  });

  it('boundedBuyoutAmount is clamped with Math.min', () => {
    // Pattern: boundedBuyoutAmount = buyout ? Math.min(remainingSalary, ...)
    const clampsBuyout =
      /boundedBuyoutAmount\s*=\s*buyout\s*\?\s*Math\.min/.test(content);
    expect(clampsBuyout).toBe(true);
  });

  it('deadCapAmount uses conditional buyout calculation', () => {
    // Pattern: deadCapAmount = buyout ? Math.max(0, remainingSalary - boundedBuyoutAmount)
    const conditionalDeadCap = /deadCapAmount\s*=\s*buyout\s*\?/.test(content);
    expect(conditionalDeadCap).toBe(true);
  });

  it('dead cap subtracts boundedBuyoutAmount when buyout is true', () => {
    // Pattern: remainingSalary - boundedBuyoutAmount in dead cap calculation
    const subtractsBuyout = /remainingSalary\s*-\s*boundedBuyoutAmount/.test(
      content
    );
    expect(subtractsBuyout).toBe(true);
  });
});

// === GATE 6: Callback Compatibility Contract { success, message } ===

describe('Gate 6: Callback Compatibility Contract - FreeAgentPool (E1)', () => {
  const content = readFileContent(FREE_AGENT_POOL_PATH);

  it('handleSaveFromModal returns { success: true } on success path', () => {
    // Pattern: return { success: true }
    const returnsSuccessTrue = /return\s*\{\s*success\s*:\s*true\s*\}/.test(
      content
    );
    expect(returnsSuccessTrue).toBe(true);
  });

  it('checks result?.success === false for failure handling', () => {
    // Pattern: result?.success === false
    const checksSuccessFalse = /result\?\.success\s*===\s*false/.test(content);
    expect(checksSuccessFalse).toBe(true);
  });
});

describe('Gate 6: Callback Compatibility Contract - TradeEditor (E1)', () => {
  const content = readFileContent(TRADE_EDITOR_PATH);

  it('handleTradeMachineSignAndTrade returns { success: true } on success', () => {
    // Pattern: return { success: true }
    const returnsSuccessTrue = /return\s*\{\s*success\s*:\s*true\s*\}/.test(
      content
    );
    expect(returnsSuccessTrue).toBe(true);
  });

  it('returns { success: false, message } on failure paths', () => {
    // Pattern: return { success: false, message: ... }
    const returnsSuccessFalse =
      /return\s*\{\s*success\s*:\s*false\s*,\s*message\s*:/.test(content);
    expect(returnsSuccessFalse).toBe(true);
  });
});
