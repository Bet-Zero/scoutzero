import React from 'react';
import { PlayerName } from './ProfilePlayerName';
import { PlayerPosition } from './ProfilePlayerPosition';
import { TeamLogo } from '@/shared/components/TeamLogo';
import { PlayerHeadshot } from '@/shared/components/PlayerHeadshot';
import { getCurrentSeasonYear } from '@/shared/utils/contracts/contractUtils';
import { formatContractSummary } from '@/shared/utils/formatting/basicFormatting';
import type { ProfilePlayer } from '@/features/profile/profileUiTypes';

export const formatProfileHeight = (inches: number | null | undefined) => {
  if (!inches || inches === 0) return 'N/A';
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}-${remainingInches}`;
};

const MAX_PLAUSIBLE_YEARS_PRO = 30;

const parsePositiveYear = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN;

  return Number.isInteger(parsed) && parsed > 1900 ? parsed : null;
};

const parseNonNegativeInteger = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN;

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const formatProfileYearsPro = (
  player: ProfilePlayer,
  currentSeasonYear = getCurrentSeasonYear()
): string => {
  const display = player.bio?.display as
    | { yearsPro?: number | string | null }
    | null
    | undefined;
  const sourceYearsPro = parseNonNegativeInteger(display?.yearsPro);
  const draft =
    player.bio && 'draft' in player.bio
      ? (player.bio.draft as { year?: string | number | null } | null | undefined)
      : null;
  const draftYear = parsePositiveYear(draft?.year);

  if (draftYear) {
    const derivedYearsPro = Math.max(0, currentSeasonYear - draftYear);

    if (
      sourceYearsPro === null ||
      Math.abs(sourceYearsPro - derivedYearsPro) > 1
    ) {
      return String(derivedYearsPro);
    }
  }

  if (
    sourceYearsPro !== null &&
    sourceYearsPro <= MAX_PLAUSIBLE_YEARS_PRO
  ) {
    return String(sourceYearsPro);
  }

  return 'N/A';
};

export const PlayerHeader = ({
  player,
  selectedPlayer,
}: {
  player: ProfilePlayer;
  selectedPlayer: string | null;
}) => {
  const thisYear = getCurrentSeasonYear();

  // Get contract data from contracts subcollection (v2 structure only)
  const contractData =
    player.primaryContract ||
    (player.contracts ? Object.values(player.contracts)[0] : null);
  const contractRecord =
    contractData && typeof contractData === 'object'
      ? (contractData as Record<string, unknown>)
      : null;
  const totalYears =
    contractData?.yearsRemaining ??
    player.currentContractView?.yearsRemaining ??
    contractData?.salariesByYear?.length ??
    (typeof contractRecord?.contractLength === 'number'
      ? contractRecord.contractLength
      : undefined);
  const currentYearSalaryObj = contractData?.salariesByYear?.find(
    (s) => s.year === thisYear || String(s.season ?? '').startsWith(String(thisYear))
  );
  const rawCurrentSalary =
    player.currentContractView?.currentSalary ??
    (typeof contractRecord?.currentSalary === 'number'
      ? contractRecord.currentSalary
      : undefined) ??
    currentYearSalaryObj?.salary ??
    null;
  const currentSalary =
    typeof rawCurrentSalary === 'number' ? rawCurrentSalary : null;
  const contractSummary = formatContractSummary(currentSalary, totalYears);
  const ageDisplay =
    Number.isFinite(player.age) && player.age > 0 ? player.age : 'N/A';
  const yearsProDisplay = formatProfileYearsPro(player, thisYear);

  // Get free agency info from bio.display or contract subcollection (v2 structure only)
  const freeAgency = contractData?.freeAgency || {};
  const freeAgentType =
    player.bio?.display?.freeAgentType ?? freeAgency.freeAgentType;
  const freeAgentYear =
    player.bio?.display?.freeAgentYear ?? freeAgency.freeAgentYear;
  const freeAgencyDisplay =
    freeAgentYear && freeAgentType
      ? `${freeAgentYear} (${freeAgentType})`
      : freeAgentYear || 'N/A';

  return (
    <div className="flex h-auto w-full max-w-[750px] flex-col items-center gap-4 px-4 sm:h-[220px] sm:flex-row sm:px-0">
      <div className="flex w-[300px] justify-between">
        <div className="flex flex-col justify-center">
          <PlayerName
            name={player.bio?.displayName || player.name || 'Unknown'}
          />
          <div className="flex items-center gap-4 mt-4">
            <TeamLogo teamAbbr={player.bio?.display?.team} />
            <div className="h-[2.5rem] w-[2px] bg-white/40" />
            <PlayerPosition
              position={player.bio?.position}
              className="text-5xl"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center">
        <PlayerHeadshot playerId={selectedPlayer || player.id} />
      </div>
      <div className="w-[230px] h-[190px] bg-[#1f1f1f] rounded-2xl shadow-lg text-white text-[13px] font-thin px-4 py-3 flex flex-col relative top-[0.11rem] justify-center">
        <div className="space-y-[2px]">
          <p>
            <span className="font-bold">HT</span>:{' '}
            {formatProfileHeight(
              typeof player.bio?.height === 'number' ? player.bio.height : null
            )}
          </p>
          <p>
            <span className="font-bold">WT</span>: {player.bio?.weight || 'N/A'}
          </p>
          <p>
            <span className="font-bold">AGE</span>:{' '}
            {ageDisplay}
          </p>
          <p>
            <span className="font-bold">YEARS PRO</span>:{' '}
            {yearsProDisplay}
          </p>
          {(() => {
            const draft =
              player.bio && 'draft' in player.bio
                ? (player.bio.draft as
                    | {
                        year?: string | number | null;
                        round?: string | number | null;
                        pick?: string | number | null;
                      }
                    | null
                    | undefined)
                : null;
            return draft?.pick ? (
            <p>
              <span className="font-bold">DRAFTED</span>:{' '}
              {draft.year} Rd {draft.round} Pick {draft.pick}
            </p>
            ) : null;
          })()}
        </div>
        <div className="h-6" />
        <div className="space-y-[2px]">
          <p>
            <span className="font-bold">TEAM</span>:{' '}
            {player.bio?.display?.team || 'N/A'}
          </p>
          <p>
            <span className="font-bold">CONTRACT</span>: {contractSummary}
          </p>
          <p>
            <span className="font-bold">FREE AGENT</span>: {freeAgencyDisplay}
          </p>
        </div>
      </div>
    </div>
  );
};
