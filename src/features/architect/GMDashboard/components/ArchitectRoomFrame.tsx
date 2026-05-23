import type { ReactNode } from 'react';
import type { ArchitectRoomDescriptor } from './architectRooms';

interface ArchitectRoomFrameProps {
  room: ArchitectRoomDescriptor;
  kicker?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const ArchitectRoomFrame = ({
  room,
  kicker,
  actions = null,
  children,
}: ArchitectRoomFrameProps) => (
  <section className="min-w-0 border border-white/10 bg-[#0b0f15]">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
          {kicker ?? 'Architect room'}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{room.label}</h2>
        <p className="mt-1 text-sm text-white/45">{room.deck}</p>
      </div>
      {actions}
    </div>
    <div className="min-w-0 p-4">{children}</div>
  </section>
);
