import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const architectRoot = path.resolve(__dirname, '../../features/architect');

const readArchitectFile = (relativePath: string) =>
  fs.readFileSync(path.join(architectRoot, relativePath), 'utf-8');

describe('Architect System Integration Step 3 propagation guardrails', () => {
  const mutationPipelineSource = readArchitectFile('utils/mutationPipeline.ts');
  const actionsHookSource = readArchitectFile(
    'GMDashboard/hooks/useArchitectActions.ts'
  );
  const stateHookSource = readArchitectFile(
    'GMDashboard/hooks/useArchitectState.ts'
  );

  it('publishes the general committed-mutation propagation order from the mutation authority surface', () => {
    expect(mutationPipelineSource).toContain(
      'Returns changedTeams as the preferred direct post-commit team snapshot when available.'
    );
    expect(mutationPipelineSource).toContain(
      'Post-commit propagation order for general world mutations:'
    );
    expect(mutationPipelineSource).toContain(
      'export function findUpdatedTeamSnapshot('
    );
    expect(mutationPipelineSource).toContain(
      'This helper intentionally works for both compute-time `teamUpdates` and committed'
    );
  });

  it('keeps the action layer on an explicit committed-world reload plan', () => {
    expect(actionsHookSource).toContain(
      'Decides changedTeams reuse vs committed-snapshot reload fallback after commit.'
    );
    expect(actionsHookSource).toContain('type CommittedWorldReloadPlan = {');
    expect(actionsHookSource).toContain(
      'const buildCommittedWorldReloadPlan = useCallback('
    );
    expect(actionsHookSource).toContain(
      'committedWorldMetadata: extractCommittedWorldMetadataPatch(result),'
    );
    expect(actionsHookSource).toContain(
      'const applyCommittedWorldReloadPlan = useCallback('
    );
    expect(actionsHookSource).toContain(
      'committedWorldMetadata: plan.committedWorldMetadata,'
    );
    expect(actionsHookSource).toContain(
      'syncTeamFromMutationResult'
    );
  });

  it('keeps metadata patching and stale-drop ownership on the state resync seam', () => {
    expect(stateHookSource).toContain(
      'Owns committed-world resync, metadata patching, and stale-drop once handed a committed team snapshot.'
    );
    expect(stateHookSource).toContain(
      'export interface ReloadActiveWorldMetadataPatch {'
    );
    expect(stateHookSource).toContain(
      'export interface ReloadActiveWorldTeam {'
    );
    expect(stateHookSource).toContain(
      'State-owned committed-world resync request.'
    );
    expect(stateHookSource).toContain(
      'applyWorldMetadataPatch(options.committedWorldMetadata);'
    );
    expect(stateHookSource).toContain(
      'committedWorldTeam: {'
    );
  });
});
