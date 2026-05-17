/**
 * Wave 21 Step 1: Free agent computation extracted from useArchitectState.ts
 * (Effect 7, lines 915–1035).
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { resolvePlayerDisplayName } from '@/features/architect/constants/playerNameCorrections';
import type { ArchitectPlayer, FreeAgent } from './useArchitectState.types';

export function computeFreeAgents(
  worldAwarePlayers: ArchitectPlayer[],
  currentYear: number,
  worldId: string | null,
  worldRosterIndex: Set<string> | null
): FreeAgent[] {
  return worldAwarePlayers
    .filter((p) => {
      if ((!p.name || p.name === 'Unknown') && !p.id && !p.player_id)
        return false;

      const playerId = p.id || p.player_id || p.bio?.playerId || null;
      if (worldId) {
        if (!playerId) return false;
        return !worldRosterIndex?.has(playerId);
      }

      if (
        !p.contract ||
        !p.contract.salariesByYear ||
        p.contract.salariesByYear.length === 0
      ) {
        return true;
      }

      const sortedYears = [...p.contract.salariesByYear].sort((a, b) => {
        const ya = toEndYear(a.season);
        const yb = toEndYear(b.season);
        return (ya || 0) - (yb || 0);
      });

      const lastYearEntry = sortedYears[sortedYears.length - 1];
      if (!lastYearEntry) return true;

      const endYear = toEndYear(lastYearEntry.season);
      if (!endYear) return true;

      const isExpired = endYear < currentYear;
      const isExpiring = endYear === currentYear;

      const optionVal = lastYearEntry.option || lastYearEntry.optionType;
      const isPlayerOption =
        optionVal === 'Player Option' ||
        optionVal === 'Player' ||
        optionVal === 'PO';
      const isTeamOption =
        optionVal === 'Team Option' ||
        optionVal === 'Team' ||
        optionVal === 'TO';

      const hasOptionNextYear =
        endYear === currentYear + 1 && (isPlayerOption || isTeamOption);

      if (!isExpired && !isExpiring && !hasOptionNextYear) return false;

      return true;
    })
    .map((p): FreeAgent => {
      let faType: FreeAgent['freeAgentType'] = 'UFA';
      let previousSalary = 0;
      let birdRights = 'None';

      if (
        p.contract &&
        p.contract.salariesByYear &&
        p.contract.salariesByYear.length > 0
      ) {
        const sortedYears = [...p.contract.salariesByYear].sort((a, b) => {
          const ya = toEndYear(a.season);
          const yb = toEndYear(b.season);
          return (ya || 0) - (yb || 0);
        });
        const lastYearEntry = sortedYears[sortedYears.length - 1];
        previousSalary = lastYearEntry.salary || 0;
        birdRights = p.contract.birdRights?.status || 'None';

        const optionVal = lastYearEntry.option || lastYearEntry.optionType;
        if (
          optionVal === 'Player Option' ||
          optionVal === 'Player' ||
          optionVal === 'PO'
        )
          faType = 'PO';
        else if (
          optionVal === 'Team Option' ||
          optionVal === 'Team' ||
          optionVal === 'TO'
        )
          faType = 'TO';
        else if (p.contract.birdRights?.status === 'Restricted')
          faType = 'RFA';
      }

      const fixedName = resolvePlayerDisplayName(p.name, p.id || p.player_id);

      return {
        ...p,
        name: fixedName,
        previousSalary,
        birdRights,
        freeAgentType: faType,
        teamCode: p.teamCode,
        teamName: p.teamName,
      };
    });
}
