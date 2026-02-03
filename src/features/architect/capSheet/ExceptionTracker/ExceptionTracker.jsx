import React from 'react';
import { BadgeAlert, ShieldAlert } from 'lucide-react';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';

const ExceptionCard = ({
  label,
  amount,
  subtext,
  color = 'blue',
  statusLabel,
}) => {
  const colorStyles = {
    blue: 'bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10',
    green:
      'bg-green-500/5 border-green-500/20 text-green-400 hover:bg-green-500/10',
    orange:
      'bg-orange-500/5 border-orange-500/20 text-orange-400 hover:bg-orange-500/10',
    red: 'bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10',
    gray: 'bg-white/[0.02] border-white/5 text-zinc-500',
  };

  return (
    <div
      className={`relative rounded-md border px-3 py-2 flex flex-col justify-between transition-all group ${colorStyles[color]}`}
    >
      <div className="flex justify-between items-start mb-0.5">
        <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">
          {label}
        </span>
        {statusLabel && (
          <span className="text-[8px] uppercase tracking-wider font-bold opacity-50 border border-current px-1 rounded-sm">
            {statusLabel}
          </span>
        )}
      </div>
      <div className="text-sm font-bold tracking-tight text-white/90 tabular-nums">
        ${amount.toLocaleString()}
      </div>
      {subtext && (
        <div className="text-[9px] opacity-50 group-hover:opacity-80 transition-opacity">
          {subtext}
        </div>
      )}
    </div>
  );
};

const HardCapCard = ({ capData, hardCapped, reason }) => {
  // If explicitly hard capped or logical reason exists
  const isActive = !!hardCapped || !!reason;

  if (!isActive && !capData.firstApron) return null;

  const apronLevel = hardCapped === 2 ? 'Second Apron' : 'First Apron';
  const limitAmount =
    hardCapped === 2 ? capData.secondApron : capData.firstApron;

  // Custom description based on the specific trigger (passed as reason)
  const description =
    reason ||
    (hardCapped
      ? `Team is hard capped at the ${apronLevel} due to roster moves (MLE/BAE usage or Sign & Trade).`
      : `Team is not hard capped.`);

  if (!isActive)
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-white/5 bg-white/[0.02] text-white/40">
        <ShieldAlert size={14} />
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          No Hard Cap Active
        </span>
      </div>
    );

  return (
    <div className="flex flex-col gap-1 px-3 py-2 rounded-md border border-red-500/20 bg-red-500/5 text-red-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-red-500" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-red-100">
            Hard Capped
          </span>
        </div>
        <span className="text-xs font-bold tabular-nums text-red-100">
          ${limitAmount?.toLocaleString()}
        </span>
      </div>
      <div className="text-[9px] text-red-400/70 pl-6 leading-tight max-w-[200px]">
        {description}
      </div>
    </div>
  );
};

const CompactTradeExceptionRow = ({ tpe }) => {
  return (
    <div className="grid grid-cols-[80px_1fr_auto] gap-3 items-center py-2 px-3 border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-all group relative overflow-hidden">
      {/* "Spice" - left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex flex-col">
        <span className="text-xs font-bold text-white/90 tabular-nums group-hover:text-purple-200 transition-colors">
          ${(tpe.amount || 0).toLocaleString()}
        </span>
      </div>

      <div className="flex items-center text-[10px] text-white/40 group-hover:text-white/60 transition-colors truncate">
        {tpe.createdFrom && <span>from {tpe.createdFrom}</span>}
      </div>

      <div className="text-right whitespace-nowrap">
        <span className="text-[10px] text-white/30 font-medium group-hover:text-white/50 transition-colors">
          {tpe.expires}
        </span>
      </div>
    </div>
  );
};

const ExceptionTracker = ({ teamCapSheet, currentYear }) => {
  const {
    mle = {},
    tpMle = {},
    bae = {},
    dpe = {},
    tradeExceptions = [],
    hardCapped,
  } = teamCapSheet;

  // Use centralized cap settings provider for consistent cap/apron values
  // currentYear is the END year (e.g., 2025 for "2024-25" season)
  const capData = getCapSettingsForYear(currentYear);
  // No longer using daysUntil for display
  const getRemaining = (exception, defaultAmount = 0) => {
    const amount = exception?.amount ?? defaultAmount;
    const used = exception?.used || 0;
    return Math.max(0, amount - used);
  };

  // --- Logic for Availability & Hard Cap ---

  const mleUsedAmount = mle?.used || 0;
  const baeUsedAmount = bae?.used || 0;
  const tpMleUsedAmount = tpMle?.used || 0;

  let mleRemaining = getRemaining(mle, capData.fullMLE);
  let tpRemaining = getRemaining(tpMle, capData.taxpayerMLE);
  let baeRemaining = getRemaining(bae, capData.bae);
  let dpeRemaining = getRemaining(dpe, 0);

  let mleStatus = null;
  let tpStatus = null;
  let baeStatus = null;
  let dpeStatus = null;
  let hardCapReason = null;

  // 1. Check for Hard Cap triggers (NTPMLE or BAE used)
  const usedNTPMLE = mleUsedAmount > 0;
  const usedBAE = baeUsedAmount > 0;
  const usedTPMLE = tpMleUsedAmount > 0;

  // If NTPMLE or BAE used => Hard Capped at 1st Apron => TPMLE Unavailable
  // Also if already hardcapped at 1st apron by other means (sign&trade), logic holds.
  if (usedNTPMLE || usedBAE) {
    tpRemaining = 0;
    tpStatus = 'N/A';
    if (!hardCapReason)
      hardCapReason =
        'Hard capped at 1st Apron due to usage of Non-Taxpayer MLE or BAE.';
  } else if (usedTPMLE) {
    // If TPMLE used => Hard Capped at 2nd Apron (technically you just can't use NTPMLE/BAE)
    // Actually: Using TPMLE hard caps you at 2nd Apron? No, being ABOVE apron forces TPMLE.
    // BUT: Using TPMLE means you CANNOT use NTPMLE or BAE.
    mleRemaining = 0;
    baeRemaining = 0;
    mleStatus = 'N/A';
    baeStatus = 'N/A';
  } else if (hardCapped === 1) {
    // Explicitly hard capped at 1st apron (e.g. via S&T receiving player)
    // Can use NTPMLE/BAE consistent with hard cap, but usually TPMLE is not relevant here (since it's smaller).
    // Wait, if hard capped at 1st apron, you are allowed to use NTPMLE/BAE? Yes, that's usually why you are hard capped.
    // But if you were hard capped by S&T, you effectively have access to these tools until you hit the wall.
    // However, TPMLE is strictly for teams > 1st Apron < 2nd Apron? No, TPMLE is for taxpayers.
    // If you are hard capped at 1st Apron, you are by definition NOT a taxpayer in the TPMLE sense (which goes deeper).
    // Simplification: If hard capped 1st apron, disable TPMLE display to avoid confusion.
    tpRemaining = 0;
    tpStatus = 'N/A';
  } else if (hardCapped === 2) {
    // Hard capped at 2nd apron
    // Usually means you used TPMLE.
    mleRemaining = 0;
    baeRemaining = 0;
    mleStatus = 'N/A';
    baeStatus = 'N/A';
  }

  // DPE follows similar hard cap rules as NT-MLE
  if (usedTPMLE) {
    dpeRemaining = 0;
    dpeStatus = 'N/A';
  } else if (hardCapped === 2) {
    dpeRemaining = 0;
    dpeStatus = 'N/A';
  }

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-4">
      {/* Left Column: Exceptions & Hard Cap Info */}
      <div className="flex flex-col gap-3">
        {/* Hard Cap Section */}
        <HardCapCard
          capData={capData}
          hardCapped={hardCapped || (usedNTPMLE || usedBAE ? 1 : 0)}
          reason={hardCapReason}
        />

        {/* Exception Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <ExceptionCard
            label="NT-MLE"
            amount={mleRemaining}
            subtext="Non-Taxpayer"
            color={mleRemaining > 0 ? 'blue' : 'gray'}
            statusLabel={mleStatus}
          />
          <ExceptionCard
            label="TP-MLE"
            amount={tpRemaining}
            subtext="Taxpayer"
            color={tpRemaining > 0 ? 'green' : 'gray'}
            statusLabel={tpStatus}
          />
          <ExceptionCard
            label="BAE"
            amount={baeRemaining}
            subtext="Bi-Annual"
            color={baeRemaining > 0 ? 'orange' : 'gray'}
            statusLabel={baeStatus}
          />
          <ExceptionCard
            label="DPE"
            amount={dpeRemaining}
            subtext="Disabled Player"
            color={dpeRemaining > 0 ? 'orange' : 'gray'}
            statusLabel={dpeStatus}
          />
        </div>
      </div>

      {/* Right Column: Trade Exceptions Compact List */}
      <div className="bg-[#0f0f0f] border border-white/5 rounded-md p-3 flex flex-col h-full min-h-[140px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-white/50 tracking-widest uppercase flex items-center gap-1.5">
            <BadgeAlert size={12} className="text-purple-400" />
            Trade Exceptions
          </h3>
          <span className="bg-white/5 text-white/30 px-1.5 rounded text-[9px]">
            {tradeExceptions.length}
          </span>
        </div>

        <div className="flex-1 overflow-visible">
          {tradeExceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 py-4">
              <span className="text-[10px]">No Active TPEs</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {tradeExceptions.map((tpe, idx) => (
                <CompactTradeExceptionRow key={idx} tpe={tpe} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ExceptionTracker;
