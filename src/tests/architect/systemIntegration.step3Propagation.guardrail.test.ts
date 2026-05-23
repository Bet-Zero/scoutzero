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
  const mutationPipelineSource =
    readArchitectFile('utils/mutationPipeline.ts') +
    readArchitectFile('utils/mutationPipeline.types.ts') +
    readArchitectFile('utils/mutationPipeline.types.record.ts') +
    readArchitectFile('utils/mutationPipeline.types.currentState.ts') +
    readArchitectFile('utils/mutationPipeline.types.result.ts') +
    readArchitectFile('utils/mutationPipeline.types.ingress.ts');
  // Stage 6B: seasonManager was split — helpers and type definitions
  // (including the committed-state artifact and buildSeasonAdvanceCommittedState)
  // moved to seasonManager.helpers.ts.
  const seasonManagerSource =
    readArchitectFile('utils/seasonManager.ts') +
    readArchitectFile('utils/seasonManager.helpers.ts');
  // Stage 6B: useArchitectActions was further split into more
  // co-located sub-modules. Include every useArchitectActions.* file so
  // the Step 3 propagation invariants remain findable wherever the
  // canonical types/helpers ended up living.
  const actionsHookSource =
    readArchitectFile('GMDashboard/hooks/useArchitectActions.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.types.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.types.normalizers.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.helpers.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.helpers.signing.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.helpers.offerSheet.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.tradeActions.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.offerSheetActions.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.offerSheetExecutors.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.persistenceHelpers.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.signingExecution.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.contractActions.ts');
  // Wave 11 Step 2: type definitions extracted to useArchitectState.types.ts.
  // Stage 6B: state hook further split into worldLoader / worldTracker /
  // freeAgents / helpers sub-modules. The resync seam invariants live
  // across the full set.
  const stateHookSource =
    readArchitectFile('GMDashboard/hooks/useArchitectState.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectState.types.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectState.worldLoader.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectState.worldTracker.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectState.freeAgents.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectState.helpers.ts');
  const offseasonSectionSource = readArchitectFile(
    'GMDashboard/sections/OffseasonSection.tsx'
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
      'export function findCommittedTeamSnapshot('
    );
    expect(mutationPipelineSource).toContain(
      'committed team artifact instead of the compute-time team update shape.'
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

  it('publishes an explicit season-advance aftermath to broader reload plan', () => {
    expect(seasonManagerSource).toContain(
      'Commit-time season-advance artifact returned to the dashboard layer.'
    );
    expect(seasonManagerSource).toContain(
      'function buildSeasonAdvanceCommittedState('
    );
    expect(offseasonSectionSource).toContain(
      'type CommittedWorldAdvanceReconciliationPlan = {'
    );
    expect(offseasonSectionSource).toContain(
      'function buildCommittedWorldAdvanceReloadRequest('
    );
    expect(offseasonSectionSource).toContain(
      'function buildCommittedWorldAdvanceReconciliationPlan('
    );
    expect(offseasonSectionSource).toContain(
      'immediateAftermath: WorldAdvanceAftermath;'
    );
    expect(offseasonSectionSource).toContain(
      'followUpReloadRequest: WorldAdvanceReloadRequest;'
    );
    expect(offseasonSectionSource).toContain(
      'await onReloadWorldData('
    );
  });

  it('makes committed-world versus local-validated propagation explicit in the action layer', () => {
    expect(actionsHookSource).toContain(
      "type DashboardMutationPropagationMode = 'world-committed' | 'local-validated';"
    );
    expect(actionsHookSource).toContain(
      'type WorldCommittedTeamPropagation = {'
    );
    expect(actionsHookSource).toContain(
      'type LocalValidatedTeamPropagation = {'
    );
    expect(actionsHookSource).toContain(
      "propagationMode: 'world-committed';"
    );
    expect(actionsHookSource).toContain(
      "propagationMode: 'local-validated';"
    );
    expect(actionsHookSource).toContain(
      "if (resolvedState.propagationMode === 'local-validated')"
    );
    expect(actionsHookSource).toContain(
      'setTeamCapSheetSafe(resolvedState.localValidatedTeam);'
    );
    expect(actionsHookSource).toContain(
      '...committedWorldTeam,'
    );
  });

  it('keeps metadata patching and stale-drop ownership on the state resync seam', () => {
    expect(stateHookSource).toContain(
      'Owns committed-world resync, metadata patching, and stale-drop once handed a committed team snapshot.'
    );
    expect(stateHookSource).toContain(
      'export type ReloadActiveWorldTeamDataStaleDropReason ='
    );
    expect(stateHookSource).toContain(
      "'active-world-changed'"
    );
    expect(stateHookSource).toContain(
      "'superseded-by-newer-request'"
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
      'reason: ReloadActiveWorldTeamDataStaleDropReason;'
    );
    expect(stateHookSource).toContain(
      'type ActiveWorldLoadRequest = {'
    );
    expect(stateHookSource).toContain(
      'const resolveWorldLoadFreshness = useCallback('
    );
    expect(stateHookSource).toContain(
      'const resolveWorldLoadStaleDrop = useCallback('
    );
    expect(stateHookSource).toContain(
      'const startWorldAsOfDateMutationRequest = useCallback('
    );
    expect(stateHookSource).toContain(
      'applyWorldMetadataPatch(options.committedWorldMetadata);'
    );
    expect(stateHookSource).toContain(
      'committedWorldTeam: {'
    );
  });
});
