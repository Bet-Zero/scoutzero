/**
 * FILE: src/shared/components/EditContractModal.PlayerCardHeader.tsx
 * PURPOSE: Full-width player identity banner for the Edit Contract modal —
 *          headshot, name, team, and vitals rendered as a compact horizontal
 *          card header so the contract/action columns below keep their height.
 * OWNERSHIP: Feature: architect/contracts
 */
import React from 'react';
import { PlayerHeadshot } from '@/shared/components/PlayerHeadshot';
import { TeamLogo } from '@/shared/components/TeamLogo';
import type { PlayerLike } from './EditContractModal.types';

/**
 * Normalize a height value to feet-inches (e.g. 81 → "6'9\"").
 * Accepts inches as a number or numeric string, or an already-formatted
 * string like "6-9" / "6'9\"".
 */
const formatHeight = (raw: number | string | null | undefined) => {
  if (raw == null || raw === '') return null;

  const inches = Number(raw);
  if (Number.isFinite(inches) && inches > 0) {
    return `${Math.floor(inches / 12)}'${inches % 12}"`;
  }

  const str = String(raw).trim();
  const match = str.match(/^(\d+)\s*[-'’]\s*(\d+)/);
  if (match) return `${match[1]}'${match[2]}"`;
  return str || null;
};

const toFiniteNumber = (value: unknown): number | null => {
  const num = typeof value === 'string' ? Number(value) : value;
  return typeof num === 'number' && Number.isFinite(num) ? num : null;
};

type BioStat = { label: string; value: string };

type ContractCardHeaderProps = {
  player: PlayerLike;
  teamCode?: string | null;
};

export const ContractCardHeader = ({
  player,
  teamCode,
}: ContractCardHeaderProps) => {
  const bio = player.bio;
  const headshotId =
    player.id ??
    player.player_id ??
    player.playerId ??
    bio?.playerId ??
    null;

  const name =
    bio?.displayName || player.name || player.displayName || 'Unknown Player';
  const position = bio?.position || null;
  // The cap-sheet team is authoritative; bio.display.team is often empty on
  // architect roster players.
  const team = teamCode || bio?.display?.team || bio?.display?.teamId || null;

  const height = formatHeight(bio?.height);
  const weight = toFiniteNumber(bio?.weight);
  const age = toFiniteNumber(bio?.age);
  const experience =
    toFiniteNumber(player.yearsOfService) ?? toFiniteNumber(bio?.experience);

  const stats: BioStat[] = [];
  if (height) stats.push({ label: 'HT', value: height });
  if (weight != null) stats.push({ label: 'WT', value: String(weight) });
  if (age != null) stats.push({ label: 'AGE', value: String(age) });
  if (experience != null) {
    stats.push({
      label: 'EXP',
      value: experience === 0 ? 'R' : String(experience),
    });
  }

  return (
    <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-[#161616] px-8 py-4">
      {/* Oversized team-logo watermark bleeding off the right edge */}
      {team && (
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08]">
          <TeamLogo teamAbbr={team} className="h-40 w-40" />
        </div>
      )}
      {/* Left-to-right sheen for depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/[0.05] via-transparent to-transparent" />

      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-3">
        <PlayerHeadshot
          playerId={headshotId == null ? null : String(headshotId)}
          size={72}
          className="shrink-0 border-white/20 shadow-lg shadow-black/50 ring-1 ring-white/10"
        />

        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[30px] uppercase leading-none text-white"
            style={{ fontFamily: "'AntonLocal', sans-serif" }}
            title={name}
          >
            {name}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {team && <TeamLogo teamAbbr={team} className="h-5 w-5" />}
            {position && (
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
                {position}
              </span>
            )}
            {team && (
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/35">
                {team}
              </span>
            )}
          </div>
        </div>

        {stats.length > 0 && (
          <div className="flex items-stretch divide-x divide-white/10 overflow-hidden rounded-lg border border-white/[0.08] bg-black/25">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="px-3.5 py-1.5 text-center"
              >
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  {stat.label}
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-white/90">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
