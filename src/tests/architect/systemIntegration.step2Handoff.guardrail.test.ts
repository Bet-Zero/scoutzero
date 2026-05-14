import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const architectRoot = path.resolve(__dirname, '../../features/architect');

const readArchitectFile = (relativePath: string) =>
  fs.readFileSync(path.join(architectRoot, relativePath), 'utf-8');

describe('Architect System Integration Step 2 handoff guardrails', () => {
  const dashboardSource = readArchitectFile('GMDashboard/GMDashboard.tsx');
  const capSheetSectionSource = readArchitectFile(
    'GMDashboard/sections/CapSheetSection.tsx'
  );
  const tradeSectionSource = readArchitectFile(
    'GMDashboard/sections/TradeSection.tsx'
  );
  const freeAgencySectionSource = readArchitectFile(
    'GMDashboard/sections/FreeAgencySection.tsx'
  );
  const offseasonSectionSource = readArchitectFile(
    'GMDashboard/sections/OffseasonSection.tsx'
  );
  const actionsHookSource =
    readArchitectFile('GMDashboard/hooks/useArchitectActions.ts') +
    readArchitectFile('GMDashboard/hooks/useArchitectActions.types.ts');
  const freeAgentPoolTypesSource = readArchitectFile(
    'freeAgency/FreeAgentPool/types.ts'
  );
  const freeAgentPoolSource = readArchitectFile(
    'freeAgency/FreeAgentPool/FreeAgentPool.tsx'
  );

  it('keeps the dashboard shell on named section handoff surfaces for the major wrappers', () => {
    expect(dashboardSource).toContain('SECTION HANDOFF SURFACES');
    expect(dashboardSource).toContain(
      'const capSheetSectionSurface: CapSheetSectionProps = {'
    );
    expect(dashboardSource).toContain(
      'const tradeSectionSurface: TradeSectionProps = {'
    );
    expect(dashboardSource).toContain(
      'const freeAgencySectionSurface: FreeAgencySectionProps = {'
    );
    expect(dashboardSource).toContain(
      'const offseasonSectionSurface: OffseasonSectionProps = {'
    );
    expect(dashboardSource).toContain(
      "<CapSheetSection {...capSheetSectionSurface} />"
    );
    expect(dashboardSource).toContain("<TradeSection {...tradeSectionSurface} />");
    expect(dashboardSource).toContain(
      "<FreeAgencySection {...freeAgencySectionSurface} />"
    );
    expect(dashboardSource).toContain(
      "<OffseasonSection {...offseasonSectionSurface} />"
    );
  });

  it('keeps the major section wrappers explicit about local ownership vs forwarded truth', () => {
    expect(capSheetSectionSource).toContain(
      'Owns selectedYear and shell-level current-vs-selected season framing only.'
    );
    expect(tradeSectionSource).toContain('Wrapper-level handoff surface only.');
    expect(tradeSectionSource).toContain(
      'Does not own committed apply/reload authority; onApplyTrade stays upstream.'
    );
    expect(tradeSectionSource).toContain(
      'trade payload normalization plus world-vs-base branching.'
    );
    expect(tradeSectionSource).toContain(
      'SECTION HANDOFF / FORWARDED TRADE SURFACE'
    );
    expect(freeAgencySectionSource).toContain(
      'Renders offer-sheet lifecycle lists from the published section-availability contract.'
    );
    expect(freeAgencySectionSource).toContain(
      'Does not own Free Agency mutation routing, world-only gating rules, or lifecycle persistence locally.'
    );
    expect(offseasonSectionSource).toContain(
      'Wrapper-level handoff surface for world-backed season advancement.'
    );
    expect(offseasonSectionSource).toContain(
      'DEV preview clearly separate from the committed world-advance path.'
    );
  });

  it('keeps Trade apply on explicit action-layer normalize/commit/base-apply seams', () => {
    expect(actionsHookSource).toContain('type TradeExecutionHandoff = {');
    expect(actionsHookSource).toContain(
      'const runAuthoritativeWorldMutationWithDashboardSync = useCallback('
    );
    expect(actionsHookSource).toContain(
      'const buildTradeExecutionHandoff = useCallback('
    );
    expect(actionsHookSource).toContain(
      'const commitTradeExecutionHandoff = useCallback('
    );
    expect(actionsHookSource).toContain(
      'const applyTradeExecutionHandoffToBaseState = useCallback('
    );
    expect(actionsHookSource).toContain(
      'TradeSection/TradeEditor hand off a staged draft only.'
    );
  });

  it('documents the Free Agency actionOwner contract as separate modal and lifecycle slices', () => {
    expect(actionsHookSource).toContain('export interface FreeAgentPoolActionOwner');
    expect(actionsHookSource).toContain(
      '`dualPathSigning`: standard signing/resigning, available in base or world mode'
    );
    expect(actionsHookSource).toContain(
      '`freeAgentModalAvailability`: visual/modal gating truth for FreeAgentPool'
    );
    expect(actionsHookSource).toContain(
      '`offerSheetSectionAvailability`: list gating + lifecycle availability truth for FreeAgencySection'
    );
    expect(actionsHookSource).toContain(
      'VISUAL/MODAL CONTRACT: FreeAgentPool reads this as upstream truth'
    );
    expect(actionsHookSource).toContain(
      'SECTION/LIFECYCLE CONTRACT: FreeAgencySection renders disabled messaging'
    );
  });

  it('keeps FreeAgentPool on the modal/rendering action slice and out of lifecycle routing', () => {
    expect(freeAgentPoolTypesSource).toContain(
      'actionOwner: FreeAgentPoolActionOwner;'
    );
    expect(freeAgencySectionSource).toContain(
      'const freeAgentPoolActionOwner = {'
    );
    expect(freeAgencySectionSource).toContain(
      'const offerSheetLifecycleDisabledReason ='
    );
    expect(freeAgencySectionSource).toContain(
      'dualPathSigning: actionOwner.dualPathSigning,'
    );
    expect(freeAgencySectionSource).toContain(
      'freeAgentModalAvailability: actionOwner.freeAgentModalAvailability,'
    );
    expect(freeAgencySectionSource).toContain(
      'actionOwner={freeAgentPoolActionOwner}'
    );
    expect(freeAgentPoolSource).toContain(
      'Does not own offer-sheet lifecycle routing or world-only disabled messaging.'
    );
    expect(freeAgentPoolSource).toContain(
      'Lifecycle routing stays out of'
    );
  });

  it('keeps wrapper-owned world-only and preview-only gating on explicit Offseason availability surfaces', () => {
    expect(offseasonSectionSource).toContain(
      'type OffseasonWorldAdvanceAvailability = {'
    );
    expect(offseasonSectionSource).toContain(
      'type OffseasonPreviewOnlySurfaceAvailability = {'
    );
    expect(offseasonSectionSource).toContain(
      'function getOffseasonWorldAdvanceAvailability('
    );
    expect(offseasonSectionSource).toContain(
      'const offseasonWorldAdvanceAvailability ='
    );
    expect(offseasonSectionSource).toContain(
      'availability={offseasonWorldAdvanceAvailability}'
    );
    expect(offseasonSectionSource).toContain(
      'previewOnlyAvailability={'
    );
    expect(offseasonSectionSource).toContain(
      'OFFSEASON_DEV_PREVIEW_ONLY_SURFACE_AVAILABILITY'
    );
  });
});
