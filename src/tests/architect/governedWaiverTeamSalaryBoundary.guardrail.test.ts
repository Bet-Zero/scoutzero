import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('governed waiver Team Salary shared boundary', () => {
  it('owns the temporal projection inside computeTeamCapTotals', () => {
    const source = read(
      'src/features/architect/utils/capTotals/computeTeamCapTotals.ts'
    );

    expect(source).toContain('projectGovernedWaiverTeamSalary');
    expect(source).toContain(
      'projectGovernedWaiverTeamSalary(teamCapSheet, options.asOfDate)'
    );
  });

  it('forwards one governed date from every named Team Salary surface', () => {
    const fullCapTable = read(
      'src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx'
    );
    const compactCapSheet = read(
      'src/features/architect/capSheet/CapSheet/CapSheet.tsx'
    );
    const workspace = read(
      'src/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext.ts'
    );
    const tradeHelper = read(
      'src/features/architect/hooks/useTradeMachine.helpers.ts'
    );
    const tradeTiles = read(
      'src/features/architect/tradeMachine/CapImpactTiles.tsx'
    );
    const leagueView = read(
      'src/features/architect/shared/LeagueView/leagueViewModel.ts'
    );

    expect(fullCapTable).toContain('{ asOfDate: waiverAsOfDate }');
    expect(fullCapTable).toContain('deadCap: rawDeadMoney');
    expect(fullCapTable).not.toContain(
      'deadCap: rawDeadMoney.map((entry) =>\n                projectGovernedWaiverDeadCapEntry'
    );
    expect(compactCapSheet).toContain('{ asOfDate }');
    expect(workspace).toContain('asOfDate: worldAsOfDate');
    expect(tradeHelper).toContain('createCanonicalTeamTotalsSnapshot');
    expect(tradeHelper).toContain('asOfDate,');
    expect(tradeTiles).toMatch(
      /createCanonicalTeamTotalsSnapshot\([\s\S]*?yearKey\),\s*\{\s*asOfDate,\s*\}\s*\)/
    );
    expect(leagueView).toContain('{ asOfDate: season.asOfDate }');
  });
});
