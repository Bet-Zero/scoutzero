import type { ArchitectPostActionReceipt } from '../postActionHandoff/types';
import type { ArchitectWorkspaceContext } from '../hooks/useArchitectWorkspaceContext';
import type { RequestedHistoryEventDetail } from '@/features/architect/history/TeamHistoryTab/types';
import type { ArchitectWarningItem } from './deriveArchitectWarnings';

interface ArchitectContextTrayProps {
  context: ArchitectWorkspaceContext;
  activeRoomLabel: string;
  focusedPlayerLabel: string | null;
  receipt: ArchitectPostActionReceipt | null;
  requestedHistoryEventDetail: RequestedHistoryEventDetail | null;
  warnings: ArchitectWarningItem[];
  onOpenCapOffice: () => void;
  onOpenRosterRoom: () => void;
  onOpenLeagueLog: () => void;
}

const formatMoney = (value: number) =>
  `${value < 0 ? '-' : ''}$${(Math.abs(value) / 1_000_000).toFixed(1)}M`;

const formatReceiptDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso.slice(0, 10) || null;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const warningToneClass: Record<ArchitectWarningItem['tone'], string> = {
  danger: 'border-rose-300/30 bg-rose-500/10 text-rose-100',
  warning: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  muted: 'border-white/10 bg-white/[0.04] text-white/65',
};

export const ArchitectContextTray = ({
  context,
  activeRoomLabel,
  focusedPlayerLabel,
  receipt,
  requestedHistoryEventDetail,
  warnings,
  onOpenCapOffice,
  onOpenRosterRoom,
  onOpenLeagueLog,
}: ArchitectContextTrayProps) => {
  const selectedEventId =
    requestedHistoryEventDetail?.requestedSelectedEntryId ??
    receipt?.eventId ??
    null;
  const receiptDate = formatReceiptDate(receipt?.occurredAt ?? null);

  return (
    <div className="sticky top-4 border border-white/10 bg-[#0b0f15]">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
          Memory Tray
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Architect Context
        </h2>
      </div>

      <div className="space-y-4 px-4 py-4 text-sm">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Franchise
          </p>
          <dl className="mt-2 space-y-2 text-white/70">
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">Team</dt>
              <dd className="text-right text-white">{context.team.label}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">World</dt>
              <dd className="text-right">{context.world.label}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">Season</dt>
              <dd className="text-right">
                {context.seasons.selectedViewingSeasonLabel ?? 'Unavailable'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">Date</dt>
              <dd className="text-right">{context.worldDate.label}</dd>
            </div>
          </dl>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Situation
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenCapOffice}
              className="border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06]"
            >
              <span className="block text-xs text-white/35">Cap</span>
              <span className="block truncate text-sm text-white/80">
                {context.cap.status === 'available'
                  ? formatMoney(context.cap.capSpace)
                  : context.cap.status}
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenRosterRoom}
              className="border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06]"
            >
              <span className="block text-xs text-white/35">Roster</span>
              <span className="block text-sm text-white/80">
                {context.roster.status === 'available'
                  ? `${context.roster.count} players`
                  : context.roster.status}
              </span>
            </button>
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Current Focus
          </p>
          <div className="mt-2 space-y-2 text-white/70">
            <p>
              Room:{' '}
              <span className="font-semibold text-white">{activeRoomLabel}</span>
            </p>
            <p>
              Player:{' '}
              <span className="text-white/85">
                {focusedPlayerLabel ?? 'No player focus'}
              </span>
            </p>
            <button
              type="button"
              onClick={onOpenLeagueLog}
              className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-white/70 hover:bg-white/[0.06]"
            >
              <span className="block text-xs text-white/35">Move/Event</span>
              <span className="block truncate">
                {selectedEventId ?? 'No event selected'}
              </span>
            </button>
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Latest Decision
          </p>
          {receipt ? (
            <div className="mt-2 border border-emerald-300/25 bg-emerald-400/10 px-3 py-2">
              <p className="font-semibold text-white">{receipt.headline}</p>
              <p className="mt-1 text-xs text-white/45">
                {receipt.changedTeamCodes.length
                  ? receipt.changedTeamCodes.join(', ')
                  : 'Committed world action'}
                {receiptDate ? ` - ${receiptDate}` : ''}
              </p>
            </div>
          ) : (
            <p className="mt-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-white/40">
              No post-action receipt in this session.
            </p>
          )}
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Warnings ({warnings.length})
          </p>
          <div className="mt-2 space-y-2">
            {warnings.length > 0 ? (
              warnings.slice(0, 3).map((warning) => (
                <div
                  key={warning.id}
                  className={`border px-3 py-2 ${warningToneClass[warning.tone]}`}
                >
                  <p className="text-xs font-semibold">{warning.title}</p>
                  <p className="mt-0.5 text-xs opacity-75">{warning.detail}</p>
                </div>
              ))
            ) : (
              <p className="border border-white/10 bg-white/[0.03] px-3 py-2 text-white/40">
                No active context warnings.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
