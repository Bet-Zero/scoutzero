import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEASON_MANAGER_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/seasonManager.ts'
);
// Stage 6B: types and shared helpers were extracted into
// seasonManager.helpers.ts. The audit-event invariants live across
// both files so concatenate them.
const SEASON_MANAGER_HELPERS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/seasonManager.helpers.ts'
);
const SEASON_MANAGER_TEAM_TRANSITION_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/seasonManager.teamTransition.ts'
);

describe('Season Advance CapAuditEventV1 Guardrails', () => {
  const source =
    fs.readFileSync(SEASON_MANAGER_PATH, 'utf-8') +
    (fs.existsSync(SEASON_MANAGER_HELPERS_PATH)
      ? fs.readFileSync(SEASON_MANAGER_HELPERS_PATH, 'utf-8')
      : '') +
    (fs.existsSync(SEASON_MANAGER_TEAM_TRANSITION_PATH)
      ? fs.readFileSync(SEASON_MANAGER_TEAM_TRANSITION_PATH, 'utf-8')
      : '');

  it('constructs an operation-level CapAuditEventV1 envelope with required fields', () => {
    expect(source).toContain("const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1'");
    expect(source).toContain("const SEASON_ADVANCE_MUTATION_TYPE = 'seasonAdvance'");

    const requiredFieldPatterns = [
      /schemaVersion:\s*CAP_AUDIT_EVENT_SCHEMA_VERSION/,
      /validatorVersion:\s*POST_STATE_CAP_VALIDATOR_VERSION/,
      /operationId/,
      /mutationType:\s*SEASON_ADVANCE_MUTATION_TYPE/,
      /occurredAt/,
      /worldId/,
      /teamCodes/,
      /playerIds:\s*\[\]/,
      /beforeTotalsByTeam/,
      /afterTotalsByTeam/,
      /valid:\s*postStateValidation\.valid/,
      /violations:\s*postStateValidation\.violations/,
      /warnings:\s*postStateValidation\.warnings/,
      /diffSummary/,
    ];

    for (const pattern of requiredFieldPatterns) {
      expect(source).toMatch(pattern);
    }
  });

  it('writes event to the world events subcollection constant path in writeBatch', () => {
    expect(source).toMatch(
      /ARCHITECT_WORLD_EVENTS_SUBCOLLECTION/
    );
    expect(source).toMatch(
      /doc\(\s*db,\s*ARCHITECT_WORLDS_COLLECTION,\s*worldId,\s*ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,\s*eventId\s*\)/
    );
    expect(source).toMatch(/batch\.set\(eventRef,\s*safeEvent\)/);
  });

  it('returns explicit committed-state truth tied to the committed metadata, event, and focus-team snapshot', () => {
    expect(source).toContain(
      'export type SeasonAdvanceCommittedState = {'
    );
    expect(source).toContain('committedState: SeasonAdvanceCommittedState;');
    expect(source).toContain(
      'const committedMetadata: SeasonAdvanceCommittedMetadata = {'
    );
    expect(source).toContain('currentSeason: toSeason,');
    expect(source).toContain('currentYear: toYear,');
    expect(source).toContain('lastModifiedTeams: teamCodes,');
    expect(source).toContain('focusTeamSnapshot = safeCloneForAudit(safeTeam)');
    expect(source).toContain('await batch.commit();');
    expect(source).toContain(
      'function buildSeasonAdvanceCommittedState('
    );
    expect(source).toContain('const committedState = buildSeasonAdvanceCommittedState({');
    expect(source).toContain('eventId,');
    expect(source).toContain('occurredAt,');
    expect(source).toContain('focusTeamCode: focusTeamCode ?? undefined,');
    expect(source).toContain(
      'focusTeamSnapshot: focusTeamCode ? focusTeamSnapshot : null,'
    );
    expect(source).toContain('committedState,');
  });
});
