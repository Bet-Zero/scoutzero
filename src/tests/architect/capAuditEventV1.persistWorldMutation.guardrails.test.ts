import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MUTATION_PIPELINE_PATH =
  'src/features/architect/utils/mutationPipeline.js';

function readMutationPipelineSource() {
  return readFileSync(resolve(process.cwd(), MUTATION_PIPELINE_PATH), 'utf-8');
}

describe('CapAuditEventV1 persistWorldMutation guardrails', () => {
  it('includes required CapAuditEventV1 fields in event payload construction', () => {
    const source = readMutationPipelineSource();

    const requiredFieldSnippets = [
      'schemaVersion:',
      'validatorVersion:',
      'operationId:',
      'beforeTotalsByTeam:',
      'afterTotalsByTeam:',
      'valid:',
      'violations:',
      'warnings:',
    ];

    for (const snippet of requiredFieldSnippets) {
      expect(source).toContain(snippet);
    }
  });
});
