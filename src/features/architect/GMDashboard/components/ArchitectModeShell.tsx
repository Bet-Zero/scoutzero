import type { ReactNode } from 'react';
import {
  BadgeDollarSign,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  FileClock,
  FlaskConical,
  Handshake,
  Home,
  MessageSquareText,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  ArchitectRoomDescriptor,
  ArchitectRoomId,
} from './architectRooms';
import type { ArchitectWorkspaceContext } from '../hooks/useArchitectWorkspaceContext';

interface ArchitectModeShellProps {
  context: ArchitectWorkspaceContext;
  activeRoom: ArchitectRoomId;
  rooms: ArchitectRoomDescriptor[];
  controls: ReactNode;
  contextTray: ReactNode;
  statusBanner?: ReactNode;
  children: ReactNode;
  onOpenRoom: (roomId: ArchitectRoomId) => void;
}

const ROOM_ICONS: Record<ArchitectRoomId, LucideIcon> = {
  hq: Home,
  roster: Users,
  cap: BadgeDollarSign,
  contracts: ClipboardList,
  trade: Handshake,
  fa: Briefcase,
  offseason: CalendarClock,
  history: FileClock,
  scenario: FlaskConical,
  advisor: MessageSquareText,
};

const worldStateLabel = (context: ArchitectWorkspaceContext) => {
  if (context.world.status === 'sandbox') return 'Sandbox state';
  if (context.world.status === 'loading') return 'Loading world';
  return 'Committed world';
};

export const ArchitectModeShell = ({
  context,
  activeRoom,
  rooms,
  controls,
  contextTray,
  statusBanner = null,
  children,
  onOpenRoom,
}: ArchitectModeShellProps) => {
  const activeRoomDescriptor =
    rooms.find((room) => room.id === activeRoom) ?? rooms[0];

  return (
    <div className="gm-dashboard min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col px-4 py-4 lg:px-6">
        <header className="relative overflow-hidden border border-white/10 bg-[#0c1017]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.18),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(59,130,246,0.14),transparent_34%)]" />
          <div className="relative grid gap-5 p-5 2xl:grid-cols-[minmax(420px,1fr)_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <span>Architect GM Office</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>{worldStateLabel(context)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="min-w-0 text-3xl font-semibold leading-tight text-white md:text-4xl">
                  {context.team.label}
                </h1>
                <span className="pb-1 text-sm text-white/45">
                  {activeRoomDescriptor.label}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/65">
                <span>{context.world.label}</span>
                <span>
                  Viewing{' '}
                  {context.seasons.selectedViewingSeasonLabel ?? 'season unavailable'}
                </span>
                <span>{context.worldDate.label}</span>
                <span className="text-white/45">{context.mode.shortLabel}</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3 2xl:items-end">
              <div className="flex flex-wrap items-center justify-start gap-3 2xl:justify-end">
                {controls}
              </div>
            </div>
          </div>
        </header>

        {statusBanner}

        <div className="mt-4 grid flex-1 gap-4 xl:grid-cols-[244px_minmax(0,1fr)_320px]">
          <aside
            className="border border-white/10 bg-[#0b0f15] p-3"
            aria-label="Architect rooms"
          >
            <div className="mb-3 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Rooms
              </p>
              <p className="mt-1 text-xs text-white/45">
                Stay in Architect while moving between offices.
              </p>
            </div>
            <nav className="space-y-1">
              {rooms.map((room) => {
                const Icon = ROOM_ICONS[room.id];
                const isActive = room.id === activeRoom;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onOpenRoom(room.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group grid w-full grid-cols-[24px_minmax(0,1fr)] gap-3 border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-emerald-300/40 bg-emerald-400/10 text-white'
                        : 'border-transparent text-white/62 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/85'
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 ${
                        isActive ? 'text-emerald-200' : 'text-white/35'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {room.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-white/35">
                        {room.deck}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0" data-testid="architect-active-room-panel">
            {children}
          </main>

          <aside className="min-w-0" aria-label="Architect memory tray">
            {contextTray}
          </aside>
        </div>
      </div>
    </div>
  );
};
