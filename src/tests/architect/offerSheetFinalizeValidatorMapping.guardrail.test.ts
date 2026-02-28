import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MUTATION_PIPELINE_PATH =
  'src/features/architect/utils/mutationPipeline.js';

function readMutationPipelineSource() {
  return readFileSync(resolve(process.cwd(), MUTATION_PIPELINE_PATH), 'utf-8');
}

describe('offer sheet finalize validator mapping guardrails', () => {
  it('maps finalizeMatched/Declined mutation types to validateOfferSheetResolution', () => {
    const source = readMutationPipelineSource();
    const validateMutationStart = source.indexOf('function validateMutation({');
    const validateMutationEnd = source.indexOf(
      '\n    default:',
      validateMutationStart
    );
    const validateMutationBlock = source.slice(
      validateMutationStart,
      validateMutationEnd
    );

    expect(validateMutationBlock).toContain("case 'finalizeMatchedOfferSheet'");
    expect(validateMutationBlock).toContain("case 'finalizeDeclinedOfferSheet'");
    expect(validateMutationBlock).toContain('validateOfferSheetResolution');
    expect(validateMutationBlock).toContain("action: 'finalize'");
    expect(validateMutationBlock).toContain('offer_sheet_not_found');
  });
});
