import { ArrowRight } from 'lucide-react';
import type { UseArchitectComparisonViewModelResult } from '../hooks/useArchitectComparisonViewModel';
import type { ArchitectRoomDescriptor, ArchitectRoomId } from './architectRooms';
import type { ArchitectWarningItem } from './deriveArchitectWarnings';

interface ScenarioImpactPanelProps {
  comparison: UseArchitectComparisonViewModelResult;
  onOpenRoom: (roomId: ArchitectRoomId) => void;
}

interface RoomListProps {
  rooms: ArchitectRoomDescriptor[];
  warnings?: ArchitectWarningItem[];
  onOpenRoom: (roomId: ArchitectRoomId) => void;
}

const nextInspectionRooms = (
  warnings: ArchitectWarningItem[]
): ArchitectRoomId[] => {
  const warningIds = new Set(warnings.map((warning) => warning.id));
  const rooms: ArchitectRoomId[] = ['cap', 'roster', 'history', 'scenario'];

  if (
    warningIds.has('first-apron') ||
    warningIds.has('second-apron') ||
    warningIds.has('tax') ||
    warningIds.has('over-cap')
  ) {
    rooms.push('trade');
  }
  if (warningIds.has('roster-low')) {
    rooms.push('fa');
  }

  return Array.from(new Set(rooms));
};

export const ArchitectScenarioImpactPanel = ({
  comparison,
  onOpenRoom,
}: ScenarioImpactPanelProps) => (
  <div className="border border-white/10 bg-[#0b0f15]">
    <div className="border-b border-white/10 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Scenario Impact
      </p>
      <h3 className="mt-1 text-lg font-semibold text-white">
        Committed World Delta
      </h3>
    </div>
    <div className="px-4 py-4">
      {comparison.status === 'available' && comparison.viewModel ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-xs text-white/35">Teams</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {comparison.viewModel.changedTeams.teamCodes.length}
            </p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-xs text-white/35">Players</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {comparison.viewModel.changedPlayers.playerIds.length}
            </p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-xs text-white/35">Events</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {comparison.viewModel.committedEventCount}
            </p>
          </div>
        </div>
      ) : (
        <p className="border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/45">
          {comparison.status === 'sandbox'
            ? 'Scenario impact is available after selecting a committed world.'
            : comparison.status === 'loading'
            ? 'Loading scenario impact...'
            : comparison.error ?? 'Scenario impact unavailable.'}
        </p>
      )}
      <button
        type="button"
        onClick={() => onOpenRoom('scenario')}
        className="mt-3 inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06]"
      >
        Open Scenario Lab
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
);

export const ArchitectNextInspections = ({
  rooms,
  warnings = [],
  onOpenRoom,
}: RoomListProps) => {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));

  return (
    <div className="border border-white/10 bg-[#0b0f15] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Next Inspections
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {nextInspectionRooms(warnings).map((roomId) => {
          const room = roomMap.get(roomId);
          if (!room) return null;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onOpenRoom(room.id)}
              className="border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-white/70 hover:bg-white/[0.07] hover:text-white"
            >
              {room.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ArchitectRoomLauncher = ({
  rooms,
  onOpenRoom,
}: RoomListProps) => (
  <section className="border border-white/10 bg-[#0b0f15] px-4 py-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
      Room Launcher
    </p>
    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {rooms
        .filter((room) => room.id !== 'hq')
        .map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onOpenRoom(room.id)}
            className="border border-white/10 bg-white/[0.025] px-4 py-3 text-left hover:border-emerald-300/30 hover:bg-emerald-400/10"
          >
            <span className="block font-semibold text-white">{room.label}</span>
            <span className="mt-1 block text-sm text-white/40">
              {room.deck}
            </span>
          </button>
        ))}
    </div>
  </section>
);
