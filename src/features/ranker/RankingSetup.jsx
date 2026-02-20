import React, { useState, useRef, useEffect } from 'react';
import { InformationCircleIcon, ChevronDownIcon } from '@heroicons/react/20/solid';

const getPlayerName = (player) =>
  player.bio?.displayName || player.display_name || player.name || '—';

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const HelperIcon = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const hide = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setVisible(false);
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

const PlayerTile = ({ player, topSelected, bottomSelected, onToggleTop, onToggleBottom }) => {
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
          title="Mark as elite tier"
          className={`px-1.5 h-5 rounded text-[10px] font-bold tracking-wide transition-all ${
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
          title="Mark as bottom tier"
          className={`px-1.5 h-5 rounded text-[10px] font-bold tracking-wide transition-all ${
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

const StyledSelect = ({ value, onChange, options, placeholder }) => (
  <div className="relative">
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full appearance-none bg-white/[0.05] text-white text-sm px-3 py-2.5 pr-8 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
    >
      <option value="" className="bg-[#1a1a1a] text-white/50">
        {placeholder}
      </option>
      {options.map((p) => (
        <option key={p.id} value={p.id} className="bg-[#1a1a1a] text-white">
          {getPlayerName(p)}
        </option>
      ))}
    </select>
    <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
  </div>
);

// ─── Section Card ─────────────────────────────────────────────────────────────

const SectionCard = ({ children, className = '', ...rest }) => (
  <div className={`p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] ${className}`} {...rest}>
    {children}
  </div>
);

const SectionHeader = ({ label, hint, right }) => (
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

export const RankingSetup = ({
  playerPool = [],
  onComplete,
  existingSetupData = null,
}) => {
  const [topTier, setTopTier] = useState(existingSetupData?.topTier || []);
  const [bottomTier, setBottomTier] = useState(existingSetupData?.bottomTier || []);
  const [anchor, setAnchor] = useState(existingSetupData?.anchor || null);
  const [firstPlace, setFirstPlace] = useState(existingSetupData?.firstPlace || null);
  const [lastPlace, setLastPlace] = useState(existingSetupData?.lastPlace || null);

  const tierCountEstimate = Math.max(1, Math.round(playerPool.length * 0.25));

  const handleToggleTop = (id) => {
    // Moving from bottom → top: remove from bottom first
    if (bottomTier.includes(id)) setBottomTier((prev) => prev.filter((p) => p !== id));
    setTopTier((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, tierCountEstimate)
    );
  };

  const handleToggleBottom = (id) => {
    // Moving from top → bottom: remove from top first
    if (topTier.includes(id)) setTopTier((prev) => prev.filter((p) => p !== id));
    setBottomTier((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, tierCountEstimate)
    );
  };

  const handleReady = () => {
    onComplete({ topTier, bottomTier, anchor, firstPlace, lastPlace });
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
          you fill in, the fewer head-to-head comparisons you'll need to make.
        </p>
      </div>

      {existingSetupData && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200/80 text-sm">
          Previous setup loaded. Adjust anything or proceed as-is.
        </div>
      )}

      {/* ── Tier Tagging ─────────────────────────────────────────────────── */}
      <SectionCard className="mb-4" data-testid="tier-tagging">
        <SectionHeader
          label="Tier Tagging"
          hint={`Tag players you're confident belong in the top or bottom 25% (~${tierCountEstimate}) of this pool. Tap ↑ for elite, ↓ for bottom. You can always change your mind.`}
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
          onChange={setAnchor}
          options={playerPool}
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
              onChange={setFirstPlace}
              options={playerPool}
              placeholder="None"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/30 mb-1.5">
              Last Place
            </p>
            <StyledSelect
              value={lastPlace}
              onChange={setLastPlace}
              options={playerPool}
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
          {existingSetupData ? 'Update & Continue →' : 'Start Ranking →'}
        </button>
        <p className="text-white/25 text-xs text-center">
          {existingSetupData
            ? 'Changes apply immediately to your session.'
            : 'All sections are optional — skip everything and dive straight in.'}
        </p>
      </div>

    </div>
  );
};

export default RankingSetup;
