import { TeamLogo } from '@/shared/components/TeamLogo';
import type { LeagueViewTeamSummary } from './leagueViewModel';

type LeagueConferenceTableProps = {
  title: string;
  teams: LeagueViewTeamSummary[];
  totalsLabel: string;
  teamHandoffBoundaryLabel: string;
  onManageTeam: (teamSlug: string) => void;
};

const formatBook = (value: number | null) =>
  value == null ? 'Needs input' : `$${value.toLocaleString()}`;

export const LeagueConferenceTable = ({
  title,
  teams,
  totalsLabel,
  teamHandoffBoundaryLabel,
  onManageTeam,
}: LeagueConferenceTableProps) => (
  <table className="min-w-full rounded border border-white/10 bg-[#1a1a1a] text-sm">
    <thead>
      <tr>
        <th
          colSpan={4}
          className="bg-neutral-800 px-2 py-1 text-left text-lg font-semibold"
        >
          {title}
        </th>
      </tr>
      <tr className="bg-[#111]">
        <th className="p-2 text-left">Team</th>
        <th className="p-2 text-left">{totalsLabel}</th>
        <th className="p-2 text-left">Source</th>
        <th className="p-2" />
      </tr>
    </thead>
    <tbody>
      {teams.map((team) => {
        const isLoaded = team.sourceState === 'loaded';

        return (
          <tr
            key={team.id}
            data-testid={`league-view-team-row-${team.id}`}
            className={isLoaded ? 'odd:bg-[#171717]' : 'bg-amber-950/30'}
          >
            <td className="flex items-center gap-2 p-2">
              <TeamLogo teamId={team.id} className="h-6 w-6" />
              {team.teamName}
            </td>
            <td className="p-2">
              <div className="grid gap-0.5 text-xs">
                <span>Team: {formatBook(team.teamSalary)}</span>
                <span>Apron: {formatBook(team.apronTeamSalary)}</span>
                <span>Tax: {formatBook(team.taxSalary)}</span>
              </div>
            </td>
            <td className="p-2">
              <span
                title={team.failureReason}
                className={
                  isLoaded
                    ? 'text-emerald-300'
                    : 'font-medium text-amber-200'
                }
              >
                {team.sourceLabel}
              </span>
            </td>
            <td className="p-2 text-right">
              <button
                onClick={() => onManageTeam(team.id)}
                aria-label={`Manage ${team.teamName}. ${teamHandoffBoundaryLabel}`}
                title={teamHandoffBoundaryLabel}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                type="button"
              >
                Manage Team
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);
