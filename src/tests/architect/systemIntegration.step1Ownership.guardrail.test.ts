import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const architectRoot = path.resolve(__dirname, '../../features/architect');
const sharedRoot = path.resolve(__dirname, '../../shared');

const readArchitectFile = (relativePath: string) =>
  fs.readFileSync(path.join(architectRoot, relativePath), 'utf-8');
const readSharedFile = (relativePath: string) =>
  fs.readFileSync(path.join(sharedRoot, relativePath), 'utf-8');

describe('Architect System Integration Step 1 ownership guardrails', () => {
  const featureReadmeSource = readArchitectFile('ARCHITECT_FEATURE_README.md');
  const dashboardSource = readArchitectFile('GMDashboard/GMDashboard.tsx');
  const stateHookSource = readArchitectFile(
    'GMDashboard/hooks/useArchitectState.ts'
  );
  const actionsHookSource = readArchitectFile(
    'GMDashboard/hooks/useArchitectActions.ts'
  );
  const worldManagerSource = readArchitectFile('utils/worldManager.ts');
  const teamLoaderSource = readArchitectFile('utils/teamLoader.ts');
  const worldTeamDataSource = readArchitectFile('utils/worldTeamData.ts');
  const firebaseHelpersSource = readArchitectFile(
    'utils/firebaseTeamPlanHelpers.ts'
  );
  // Wave 4 Step 4c: read-phase helpers extracted to mutationPipeline.read.ts
  const mutationPipelineSource =
    readArchitectFile('utils/mutationPipeline.ts') +
    readArchitectFile('utils/mutationPipeline.read.ts');
  const seasonManagerSource = readArchitectFile('utils/seasonManager.ts');
  const persistenceEnforcementSource = readArchitectFile(
    'utils/persistenceContracts/enforcement.ts'
  );
  const seasonAdvanceModalSource = readArchitectFile(
    'GMDashboard/components/SeasonAdvanceModal.tsx'
  );
  const contractUtilsSource = readArchitectFile('utils/contractUtils.ts');
  const capSheetSource = readArchitectFile('capSheet/CapSheet/CapSheet.tsx');
  const capSheetFullSource = readArchitectFile(
    'capSheet/CapSheetFull/CapSheetFull.tsx'
  );
  const leagueViewSource = readArchitectFile(
    'shared/LeagueView/leagueViewModel.ts'
  );
  const tradeTeamCardSource = readArchitectFile('tradeMachine/TradeTeamCard.tsx');
  const playerRulesProfilesSource = readArchitectFile(
    'hooks/usePlayerRulesProfiles.ts'
  );
  const editContractModalSource = readSharedFile(
    'components/EditContractModal.tsx'
  );

  it('documents the top-level ownership map in the Architect feature README', () => {
    expect(featureReadmeSource).toContain('## Architect Ownership Map');
    expect(featureReadmeSource).toContain('## Quick Answers');
    expect(featureReadmeSource).toContain('## Architect Read Stack Contract');
    expect(featureReadmeSource).toContain(
      '**World-aware read authority:** `teamLoader.ts` owns the explicit `world -> parent world -> base` fallback contract'
    );
    expect(featureReadmeSource).toContain(
      '**Dashboard read adapter:** `worldTeamData.ts` adapts the lower read layers into dashboard-friendly team loads.'
    );
    expect(featureReadmeSource).toContain(
      '**Sibling write-authority contract:** `mutationPipeline.ts` and `seasonManager.ts` are sibling committed-write authorities with different scopes; they share lower-level persistence hygiene but neither one is the other\'s orchestration owner.'
    );
    expect(featureReadmeSource).toContain(
      'If a caller needs dashboard team data, use `loadWorldTeamData(...)`.'
    );
    expect(featureReadmeSource).toContain(
      'Use `computeTeamCapTotals.ts` for canonical team totals and `contractUtils.ts` for shared contract shaping/year lookups instead of rebuilding those calculations in downstream surfaces.'
    );
  });

  it('marks shell and dashboard adapters as non-authoritative', () => {
    expect(dashboardSource).toContain('Composition shell only.');
    expect(dashboardSource).toContain(
      'Must not become a world-read or committed-write authority.'
    );
    expect(stateHookSource).toContain('Dashboard-state adapter.');
    expect(stateHookSource).toContain(
      'Does not own world/base fallback resolution or committed writes.'
    );
    expect(actionsHookSource).toContain(
      'Dashboard action orchestration adapter.'
    );
    expect(actionsHookSource).toContain(
      'Does not replace mutationPipeline.ts or seasonManager.ts as committed authorities.'
    );
  });

  it('marks the world/base/dashboard read stack as three distinct layers', () => {
    expect(firebaseHelpersSource).toContain(
      'ARCHITECT READ-STACK LAYER: base hydration authority.'
    );
    expect(firebaseHelpersSource).toContain(
      'Layer 1 of the Architect read stack.'
    );
    expect(teamLoaderSource).toContain(
      'ARCHITECT READ-STACK LAYER: world-aware fallback-chain authority.'
    );
    expect(teamLoaderSource).toContain('Layer 2 of the Architect read stack.');
    expect(worldTeamDataSource).toContain(
      'ARCHITECT READ-STACK LAYER: dashboard-facing adapter.'
    );
    expect(worldTeamDataSource).toContain(
      'Layer 3 of the Architect read stack.'
    );
  });

  it('marks the major committed authorities explicitly', () => {
    expect(worldManagerSource).toContain(
      'World metadata and lifecycle authority.'
    );
    expect(mutationPipelineSource).toContain(
      'Canonical committed-write authority for general world mutations.'
    );
    expect(mutationPipelineSource).toContain(
      'Sibling committed-write authority to seasonManager.ts for point-in-time world mutations.'
    );
    expect(mutationPipelineSource).toContain(
      'Season advancement remains a separate committed authority in seasonManager.ts.'
    );
    expect(seasonManagerSource).toContain('Season-transition authority.');
    expect(seasonManagerSource).toContain(
      'Sibling committed-write authority to mutationPipeline.ts with a different scope.'
    );
    expect(seasonManagerSource).toContain(
      'Architect-wide committed season transition entrypoint.'
    );
  });

  it('keeps mutation/apply and season-transition authority as sibling committed-write seams', () => {
    expect(persistenceEnforcementSource).toContain(
      'Shared by committed-write authorities such as mutationPipeline.ts and seasonManager.ts.'
    );
    expect(mutationPipelineSource).toContain(
      'This is the public entrypoint for general / point-in-time Architect world mutations.'
    );
    expect(mutationPipelineSource).toContain(
      'It is not the single entrypoint for every committed-write operation in Architect;'
    );
    expect(mutationPipelineSource).toContain(
      'season/world transitions remain in seasonManager.ts.'
    );
    expect(mutationPipelineSource).not.toContain(
      'This is the SINGLE public entrypoint for all world mutations.'
    );
    expect(mutationPipelineSource).toMatch(
      /import\s*\{[\s\S]*FORBIDDEN_TRANSIENT_KEYS[\s\S]*sanitizeTransientFieldsForPersistence[\s\S]*\}\s*from\s*['"]@\/features\/architect\/utils\/persistenceContracts\/enforcement['"]/
    );
    expect(seasonManagerSource).toMatch(
      /import\s*\{[^}]*sanitizeTransientFieldsForPersistence[^}]*\}\s*from\s*['"]@\/features\/architect\/utils\/persistenceContracts\/enforcement['"]/
    );
    expect(seasonManagerSource).not.toMatch(
      /import\s*\{[^}]*sanitizeTransientFieldsForPersistence[^}]*\}\s*from\s*['"]@\/features\/architect\/utils\/mutationPipeline['"]/
    );
  });

  it('keeps dashboard adapters routed to the correct committed-write authority', () => {
    expect(actionsHookSource).toContain(
      'Routes committed mutation writes through mutationPipeline.ts.'
    );
    expect(actionsHookSource).toContain('applyWorldMutation');
    expect(actionsHookSource).toContain('computeWorldMutation');
    expect(seasonAdvanceModalSource).toContain(
      'Dashboard adapter only: committed season/world advancement stays in seasonManager.ts.'
    );
    expect(seasonAdvanceModalSource).toContain('advanceSeasonInWorld(');
  });

  it('keeps cap/contract SSOT expectations explicit across key Architect consumers', () => {
    expect(contractUtilsSource).toContain(
      'Shared contract SSOT for contract generation, year slicing, and cap-hit lookups.'
    );
    expect(contractUtilsSource).toContain(
      'Downstream surfaces must not re-merge contract rows or reconstruct per-year cap hits locally.'
    );
    expect(capSheetSource).toContain('computeTeamCapTotals');
    expect(capSheetSource).toContain('getContractYearSlice');
    expect(capSheetSource).toContain('getPlayerCapHitForYear');
    expect(capSheetFullSource).toContain('computeTeamCapTotals');
    expect(capSheetFullSource).toContain('getContractYearSlice');
    expect(capSheetFullSource).toContain('getPlayerCapSheetAmountsForYear');
    expect(leagueViewSource).toContain('computeTeamCapTotals');
    expect(tradeTeamCardSource).toContain('computeTeamCapTotals');
    expect(playerRulesProfilesSource).toContain('getContractYearSlice');
    expect(editContractModalSource).toContain('generateExtensionContract');
    expect(editContractModalSource).toContain('getContractYearsForDisplay');
  });
});
