import React, { useState, useRef, useEffect } from 'react';
import { InformationCircleIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import type { RankerPlayer } from '@/features/ranker/utils/rankingEngine';
import type { RankerSetupData } from './utils/rankerLocalDraft';
import { getPlayerName } from './utils/playerDisplay';

type RankerDisplayPlayer = RankerPlayer;

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const HelperIcon = ({ text }: { text: string }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const hide = (e: MouseEvent | TouchEvent) => {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', hide);
    document.addEventListener('touchstart', hide);
    return () => {
      document.removeEventListener('mousedown', hide);
      document.removeEventListener('touchstart', hide);
    };
  }, [visible]);

  return (
    <div className="relative inline-block ml-1.5" ref={ref}>
      <InformationCircleIcon
        className="w-3.5 h-3.5 text-white/30 hover:text-white/60 cursor-pointer transition-colors"
        onClick={() => setVisible((v) => !v)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 rounded-xl bg-[#1c1c1c] border border-white/15 p-3 text-xs text-white/70 z-30 shadow-2xl leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1c1c1c]" />
        </div>
      )}
    </div>
  );
};

// ─── Player Tile ──────────────────────────────────────────────────────────────

type PlayerTileProps = {
  player: RankerDisplayPlayer;
  topSelected: boolean;
  bottomSelected: boolean;
  // Reason the TOP / BOT button can't be pressed, or null when it can
  topBlockedReason: string | null;
  bottomBlockedReason: string | null;
  onToggleTop: () => void;
  onToggleBottom: () => void;
};

const PlayerTile = ({
  player,
  topSelected,
  bottomSelected,
  topBlockedReason,
  bottomBlockedReason,
  onToggleTop,
  onToggleBottom,
}: PlayerTileProps) => {
  const name = getPlayerName(player);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-100 ${
        topSelected
          ? 'bg-emerald-950/50 border-emerald-500/35'
          : bottomSelected
          ? 'bg-red-950/50 border-red-500/35'
          : 'bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06]'
      }`}
    >
      <span
        className={`flex-1 text-sm font-medium truncate min-w-0 ${
          topSelected ? 'text-emerald-200' : bottomSelected ? 'text-red-200' : 'text-white/75'
        }`}
      >
        {name}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleTop}
          disabled={Boolean(topBlockedReason)}
          title={topBlockedReason ?? 'Mark as top tier'}
          className={`px-1.5 h-5 rounded text-[10px] font-bold tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/25 ${
            topSelected
              ? 'bg-emerald-500 text-white'
              : 'bg-transparent text-white/25 hover:bg-emerald-500/20 hover:text-emerald-400'
          }`}
        >
          TOP
        </button>
        <button
          type="button"
          onClick={onToggleBottom}
          disabled={Boolean(bottomBlockedReason)}
          title={bottomBlockedReason ?? 'Mark as bottom tier'}
          className={`px-1.5 h-5 rounded text-[10px] font-bold tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/25 ${
            bottomSelected
              ? 'bg-red-500 text-white'
              : 'bg-transparent text-white/25 hover:bg-red-500/20 hover:text-red-400'
          }`}
        >
          BOT
        </button>
      </div>
    </div>
  );
};

// ─── Styled Select ────────────────────────────────────────────────────────────

type StyledSelectProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  options: RankerDisplayPlayer[];
  placeholder: string;
};

const StyledSelect = ({
  value,
  onChange,
  options,
  placeholder,
}: StyledSelectProps) => (
  <div className="relative">
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full appearance-none bg-white/[0.05] text-white text-sm px-3 py-2.5 pr-8 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
    >
      <option value="" className="bg-[#1a1a1a] text-white/50">
        {placeholder}
      </option>
      {options.map((p: RankerDisplayPlayer) => (
        <option key={p.id} value={p.id} className="bg-[#1a1a1a] text-white">
          {getPlayerName(p)}
        </option>
      ))}
    </select>
    <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
  </div>
);

// ─── Section Card ─────────────────────────────────────────────────────────────

type SectionCardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

const SectionCard = ({ children, className = '', ...rest }: SectionCardProps) => (
  <div className={`p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] ${className}`} {...rest}>
    {children}
  </div>
);

type SectionHeaderProps = {
  label: string;
  hint?: string;
  right?: React.ReactNode;
};

const SectionHeader = ({ label, hint, right = null }: SectionHeaderProps) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center">
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/40">
        {label}
      </span>
      {hint && <HelperIcon text={hint} />}
    </div>
    {right && <div>{right}</div>}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const TOP_N_CHOICES = [10, 20, 50, 100];

export const RankingSetup = ({
  playerPool = [],
  onComplete,
}: {
  playerPool?: RankerDisplayPlayer[];
  onComplete: (data: RankerSetupData) => void;
}) => {
  // null ranks everyone; a number finds and orders only the best N
  const [topN, setTopN] = useState<number | null>(null);
  const topNChoices = TOP_N_CHOICES.filter((n) => n < playerPool.length);
  const [topTier, setTopTier] = useState<string[]>([]);
  const [bottomTier, setBottomTier] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [firstPlace, setFirstPlace] = useState<string | null>(null);
  const [lastPlace, setLastPlace] = useState<string | null>(null);

  const tierCountEstimate = Math.max(1, Math.round(playerPool.length * 0.25));

  // Players picked as anchor / #1 / last can't also be tier-tagged, and each
  // of those roles needs a different player.
  const roleOf = (id: string): string | null => {
    if (id === anchor) return 'the anchor';
    if (id === firstPlace) return 'locked in at #1';
    if (id === lastPlace) return 'locked in at last place';
    return null;
  };

  const getBlockedReason = (
    id: string,
    tier: string[],
    label: 'Top' | 'Bottom'
  ): string | null => {
    if (tier.includes(id)) return null;
    const role = roleOf(id);
    if (role) return `This player is ${role}`;
    if (tier.length >= tierCountEstimate) {
      return `${label} tier is full (max ${tierCountEstimate})`;
    }
    return null;
  };

  const handleToggleTop = (id: string) => {
    if (getBlockedReason(id, topTier, 'Top')) return;
    setBottomTier((prev) => prev.filter((p) => p !== id));
    setTopTier((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleToggleBottom = (id: string) => {
    if (getBlockedReason(id, bottomTier, 'Bottom')) return;
    setTopTier((prev) => prev.filter((p) => p !== id));
    setBottomTier((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // Giving a player a role removes any tier tag they had
  const assignRole =
    (setRole: (id: string | null) => void) => (id: string | null) => {
      setRole(id);
      if (!id) return;
      setTopTier((prev) => prev.filter((p) => p !== id));
      setBottomTier((prev) => prev.filter((p) => p !== id));
    };

  const optionsExcluding = (...ids: Array<string | null>) =>
    playerPool.filter((p) => !ids.includes(p.id));

  const handleReady = () => {
    const listSize =
      topN !== null && topN >= 1 && topN < playerPool.length ? topN : null;
    onComplete({ topTier, bottomTier, anchor, firstPlace, lastPlace, topN: listSize });
  };

  const topCount = topTier.length;
  const bottomCount = bottomTier.length;

  return (
    <div className="text-white max-w-2xl mx-auto px-4 py-6 sm:py-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          Pre-Ranking Setup
        </h2>
        <p className="text-white/45 text-sm leading-relaxed">
          Give the engine a few hints before you start. Every section is optional — the more
          you fill in, the fewer head-to-head comparisons you&apos;ll need to make.
        </p>
      </div>

      {/* ── List Length ──────────────────────────────────────────────────── */}
      <SectionCard className="mb-4" data-testid="list-length">
        <SectionHeader
          label="List Length"
          hint="Making a Top 10 or Top 20 out of a bigger pool? Only the best N get ranked. Anyone with N players known to be better is cut and never shown again, and players below the cut aren't ranked against each other."
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => setTopN(null)}
            aria-pressed={topN === null}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              topN === null
                ? 'border-white/60 bg-white/10 text-white'
                : 'border-white/[0.1] text-white/50 hover:text-white'
            }`}
          >
            Rank everyone
          </button>
          {topNChoices.map((n) => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              aria-pressed={topN === n}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                topN === n
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-white/[0.1] text-white/50 hover:text-white'
              }`}
            >
              Top {n}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-white/50">
            Top
            <input
              type="number"
              min={1}
              max={Math.max(1, playerPool.length - 1)}
              value={topN ?? ''}
              placeholder="N"
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                setTopN(Number.isFinite(value) && value >= 1 ? value : null);
              }}
              aria-label="Top N list length"
              className="w-16 bg-white/[0.05] text-white px-2 py-1.5 rounded-lg border border-white/[0.1]"
            />
          </label>
        </div>
        {topN !== null && topN >= playerPool.length && (
          <p className="text-white/40 text-xs mt-2">
            The pool only has {playerPool.length} players, so everyone will be ranked.
          </p>
        )}
      </SectionCard>

      {/* ── Tier Tagging ─────────────────────────────────────────────────── */}
      <SectionCard className="mb-4" data-testid="tier-tagging">
        <SectionHeader
          label="Tier Tagging"
          hint={`Tag players you think belong in the top or bottom 25% (~${tierCountEstimate}) of this pool. Tap TOP or BOT. Tags don't need to be perfect: the engine checks each cutoff and moves anyone who was tagged wrong.`}
          right={
            <div className="flex gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                  topCount > 0
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/[0.06] text-white/25'
                }`}
              >
                ↑ {topCount}/{tierCountEstimate}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                  bottomCount > 0
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-white/[0.06] text-white/25'
                }`}
              >
                ↓ {bottomCount}/{tierCountEstimate}
              </span>
            </div>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {playerPool.map((p) => (
            <PlayerTile
              key={p.id}
              player={p}
              topSelected={topTier.includes(p.id)}
              bottomSelected={bottomTier.includes(p.id)}
              topBlockedReason={getBlockedReason(p.id, topTier, 'Top')}
              bottomBlockedReason={getBlockedReason(p.id, bottomTier, 'Bottom')}
              onToggleTop={() => handleToggleTop(p.id)}
              onToggleBottom={() => handleToggleBottom(p.id)}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Anchor Player ─────────────────────────────────────────────────── */}
      <SectionCard className="mb-4" data-testid="anchor">
        <SectionHeader
          label="Anchor Player"
          hint="Pick a player you'd expect to finish around the middle of the pool. The engine uses this to divide players into upper and lower sub-groups, reducing total comparisons."
        />
        <StyledSelect
          value={anchor}
          onChange={assignRole(setAnchor)}
          options={optionsExcluding(firstPlace, lastPlace)}
          placeholder="No anchor selected"
        />
      </SectionCard>

      {/* ── Position Lock-Ins ─────────────────────────────────────────────── */}
      <SectionCard className="mb-8" data-testid="locks">
        <SectionHeader
          label="Position Lock-Ins"
          hint="Already know who's #1 or who's last? Lock them in to skip all their comparisons automatically."
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/30 mb-1.5">
              #1 Overall
            </p>
            <StyledSelect
              value={firstPlace}
              onChange={assignRole(setFirstPlace)}
              options={optionsExcluding(anchor, lastPlace)}
              placeholder="None"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/30 mb-1.5">
              Last Place
            </p>
            <StyledSelect
              value={lastPlace}
              onChange={assignRole(setLastPlace)}
              options={optionsExcluding(anchor, firstPlace)}
              placeholder="None"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleReady}
          className="w-full sm:w-auto px-10 py-3.5 rounded-xl bg-white text-black font-bold text-sm tracking-tight hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl"
        >
          Start Ranking →
        </button>
        <p className="text-white/25 text-xs text-center">
          All sections are optional — skip everything and dive straight in.
        </p>
      </div>

    </div>
  );
};

