import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const NON_TRADE_STAGE_PATH =
  'src/features/architect/utils/nonTradeMutationValidationStage.ts';

function readStageSource() {
  return readFileSync(resolve(process.cwd(), NON_TRADE_STAGE_PATH), 'utf-8');
}

describe('non-trade mutation validation stage ownership guardrails', () => {
  it('keeps grouped adapters for signing, roster/contract, offer-sheet, and manual cap mutations', () => {
    const source = readStageSource();

    expect(source).toContain('validateSigningSideMutation');
    expect(source).toContain('validateRosterAndContractMutation');
    expect(source).toContain('validateOfferSheetResolutionMutation');
    expect(source).toContain('validateManualCapMutation');
  });

  it('keeps rule ownership in the underlying validators', () => {
    const source = readStageSource();

    expect(source).toContain('validateSigning(');
    expect(source).toContain('validateWaive(');
    expect(source).toContain('validateExtension(');
    expect(source).toContain('validateOptionDecision(');
    expect(source).toContain('validateOfferSheetResolution(');
    expect(source).toContain('validateRenounceRights(');
    expect(source).toContain('validateDeadCap(');
    expect(source).toContain('validateExceptions(');
  });
});
