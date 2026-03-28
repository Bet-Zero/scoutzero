import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MUTATION_PIPELINE_PATH =
  'src/features/architect/utils/mutationPipeline.ts';
const NON_TRADE_STAGE_PATH =
  'src/features/architect/utils/nonTradeMutationValidationStage.ts';

function readMutationPipelineSource() {
  return readFileSync(resolve(process.cwd(), MUTATION_PIPELINE_PATH), 'utf-8');
}

function readNonTradeStageSource() {
  return readFileSync(resolve(process.cwd(), NON_TRADE_STAGE_PATH), 'utf-8');
}

describe('offer sheet finalize validator mapping guardrails', () => {
  it('keeps validateMutation delegated to the extracted non-trade stage surface', () => {
    const source = readMutationPipelineSource();

    expect(source).toContain('validateNonTradeMutationStage');
  });

  it('maps finalizeMatched/Declined mutation types to validateOfferSheetResolution in the extracted stage', () => {
    const source = readNonTradeStageSource();

    expect(source).toContain("case 'finalizeMatchedOfferSheet'");
    expect(source).toContain("case 'finalizeDeclinedOfferSheet'");
    expect(source).toContain('validateOfferSheetResolution');
    expect(source).toContain("action: 'finalize'");
    expect(source).toContain('offer_sheet_not_found');
  });
});
