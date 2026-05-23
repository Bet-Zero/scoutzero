import type { ReactNode } from 'react';
import type { UseArchitectComparisonViewModelResult } from '../hooks/useArchitectComparisonViewModel';
import type { ArchitectWorkspaceContext } from '../hooks/useArchitectWorkspaceContext';
import type { ArchitectRoomDescriptor, ArchitectRoomId } from './architectRooms';
import type { ArchitectWarningItem } from './deriveArchitectWarnings';
import {
  ArchitectNextInspections,
  ArchitectRoomLauncher,
  ArchitectScenarioImpactPanel,
} from './ArchitectHQPanels';

interface ArchitectHQProps {
  context: ArchitectWorkspaceContext;
  rooms: ArchitectRoomDescriptor[];
  warnings: ArchitectWarningItem[];
  comparison: UseArchitectComparisonViewModelResult;
  decisionTrail: ReactNode;
  onOpenRoom: (roomId: ArchitectRoomId) => void;
}

const formatMoney = (value: number) =>
  `${value < 0 ? '-' : ''}$${(Math.abs(value) / 1_000_000).toFixed(1)}M`;

const warningClass: Record<ArchitectWarningItem['tone'], string> = {
  danger: 'border-rose-300/30 bg-rose-500/10 text-rose-100',
  warning: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  muted: 'border-white/10 bg-white/[0.04] text-white/65',
};

const exceptionLine = (context: ArchitectWorkspaceContext) => {
  if (context.exceptions.status === 'loading') return 'Loading exceptions';
  if (context.exceptions.status === 'unavailable') return context.exceptions.reason;
  const active: string[] = [];
  if (context.exceptions.hasAvailableMle) active.push('MLE');
  if (context.exceptions.hasAvailableBae) active.push('BAE');
  if (context.exceptions.hasAvailableRoom) active.push('Room');
  if (context.exceptions.tpeCount > 0) {
    active.push(`${context.exceptions.tpeCount} TPE`);
  }
  return active.length ? active.join(' / ') : 'No active exceptions detected';
};

export const ArchitectHQ = ({
  context,
  rooms,
  warnings,
  comparison,
  decisionTrail,
  onOpenRoom,
}: ArchitectHQProps) => {
  const situationItems = [
    {
      label: 'Cap posture',
      value:
        context.cap.status === 'available'
          ? `${formatMoney(context.cap.capSpace)} cap space`
          : context.cap.status,
    },
    {
      label: 'Tax posture',
      value:
        context.cap.status === 'available'
          ? `${formatMoney(context.cap.taxSpace)} tax space`
          : context.cap.status,
    },
    {
      label: 'Apron posture',
      value:
        context.cap.status === 'available'
          ? context.cap.isAboveSecondApron
            ? 'Above second apron'
            : context.cap.isAtOrAboveFirstApron
            ? 'At or above first apron'
            : 'Below first apron'
          : context.cap.status,
    },
    {
      label: 'Roster count',
      value:
        context.roster.status === 'available'
          ? `${context.roster.count} players`
          : context.roster.status,
    },
    {
      label: 'Exceptions / TPE',
      value: exceptionLine(context),
    },
    {
      label: 'World state',
      value: context.world.status === 'sandbox' ? 'Sandbox' : 'Committed world',
    },
  ];

  return (
    <div className="space-y-4">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="border border-white/10 bg-[#0b0f15]">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Current Situation
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Franchise Operating Picture
            </h2>
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-3">
            {situationItems.map((item) => (
              <div key={item.label} className="bg-[#0b0f15] px-4 py-4">
                <p className="text-xs text-white/35">{item.label}</p>
                <p className="mt-1 min-h-10 text-base font-semibold leading-snug text-white/85">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-[#0b0f15]">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Active Problems
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Warnings and Deferrals
            </h2>
          </div>
          <div className="space-y-2 px-4 py-4">
            {warnings.length > 0 ? (
              warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={`border px-3 py-2 ${warningClass[warning.tone]}`}
                >
                  <p className="font-semibold">{warning.title}</p>
                  <p className="mt-1 text-sm opacity-75">{warning.detail}</p>
                </div>
              ))
            ) : (
              <p className="border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/45">
                No active cap, roster, or season warnings in the current context.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        {decisionTrail}

        <div className="space-y-4">
          <ArchitectScenarioImpactPanel
            comparison={comparison}
            onOpenRoom={onOpenRoom}
          />
          <ArchitectNextInspections
            rooms={rooms}
            warnings={warnings}
            onOpenRoom={onOpenRoom}
          />
        </div>
      </section>

      <ArchitectRoomLauncher rooms={rooms} onOpenRoom={onOpenRoom} />
    </div>
  );
};
