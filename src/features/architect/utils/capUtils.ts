import {
  getTeamApronStatus,
  isSecondApronTeam,
  isFirstApronTeam,
} from './tradeMachine/utils/capUtils.js';

type NumericLike = number | string | null | undefined;
type UnknownRecord = Record<string, unknown>;

interface ArchitectCapSettingsLike extends UnknownRecord {
  salaryCap?: NumericLike;
  firstApron?: NumericLike;
  secondApron?: NumericLike;
}

interface ArchitectCapTeamLike extends UnknownRecord {
  totalSalary?: NumericLike;
  teamTotalSalary?: NumericLike;
}

type LegacyApronStatus =
  | 'ABOVE_SECOND_APRON'
  | 'ABOVE_FIRST_APRON'
  | 'OVER_CAP'
  | 'UNDER_CAP';

export { getTeamApronStatus, isSecondApronTeam, isFirstApronTeam };

export function getApronStatus(
  teamSalary: ArchitectCapTeamLike | NumericLike,
  capSettings?: ArchitectCapSettingsLike | null
): LegacyApronStatus {
  const team =
    typeof teamSalary === 'object' && teamSalary !== null
      ? (teamSalary as ArchitectCapTeamLike)
      : ({ totalSalary: teamSalary } as ArchitectCapTeamLike);

  const status = getTeamApronStatus(team, capSettings);

  switch (status) {
    case 'SECOND_APRON':
      return 'ABOVE_SECOND_APRON';
    case 'FIRST_APRON':
      return 'ABOVE_FIRST_APRON';
    default:
      return status;
  }
}

export function getAllowableIncomingMargin(
  team: ArchitectCapTeamLike = {},
  capSettings: ArchitectCapSettingsLike = {}
): number {
  const { teamTotalSalary = 0 } = team;
  const { salaryCap = 0 } = capSettings;

  const teamObj = { totalSalary: teamTotalSalary };
  if (isSecondApronTeam(teamObj, capSettings)) {
    return 0;
  }

  if ((teamTotalSalary as number | string) < (salaryCap as number | string)) {
    return Infinity;
  }

  return 0;
}
