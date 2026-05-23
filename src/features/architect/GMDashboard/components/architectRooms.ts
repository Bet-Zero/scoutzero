import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState';

export type ArchitectRoomId =
  | 'hq'
  | 'roster'
  | 'cap'
  | 'contracts'
  | 'trade'
  | 'fa'
  | 'offseason'
  | 'history'
  | 'scenario'
  | 'advisor';

export interface ArchitectRoomDescriptor {
  id: ArchitectRoomId;
  label: string;
  shortLabel: string;
  deck: string;
  legacyTab: ActiveTab | null;
}

export const ARCHITECT_ROOMS: ArchitectRoomDescriptor[] = [
  {
    id: 'hq',
    label: 'HQ / Overview',
    shortLabel: 'HQ',
    deck: 'Franchise command center',
    legacyTab: null,
  },
  {
    id: 'roster',
    label: 'Roster Room',
    shortLabel: 'Roster',
    deck: 'Lineup, depth, and player continuity',
    legacyTab: 'roster',
  },
  {
    id: 'cap',
    label: 'Cap Office',
    shortLabel: 'Cap',
    deck: 'Current-year cap posture and exceptions',
    legacyTab: 'cap',
  },
  {
    id: 'contracts',
    label: 'Contract Office',
    shortLabel: 'Contracts',
    deck: 'Multi-year cap table and contract actions',
    legacyTab: 'capfull',
  },
  {
    id: 'trade',
    label: 'Trade Desk',
    shortLabel: 'Trades',
    deck: 'Trade construction and apply flow',
    legacyTab: 'trade',
  },
  {
    id: 'fa',
    label: 'Free Agency Board',
    shortLabel: 'Free Agency',
    deck: 'Free agent pool, offers, and signings',
    legacyTab: 'fa',
  },
  {
    id: 'offseason',
    label: 'Offseason Control',
    shortLabel: 'Offseason',
    deck: 'Season advance and offseason fallout',
    legacyTab: 'offseason',
  },
  {
    id: 'history',
    label: 'League Log',
    shortLabel: 'Log',
    deck: 'Committed world events and team history',
    legacyTab: 'history',
  },
  {
    id: 'scenario',
    label: 'Scenario Lab',
    shortLabel: 'Scenario',
    deck: 'Committed-world impact and comparison',
    legacyTab: 'compare',
  },
  {
    id: 'advisor',
    label: 'Advisor',
    shortLabel: 'Advisor',
    deck: 'Front office guidance from current context',
    legacyTab: 'guide',
  },
];

export const ROOM_BY_ID = ARCHITECT_ROOMS.reduce<
  Record<ArchitectRoomId, ArchitectRoomDescriptor>
>((acc, room) => {
  acc[room.id] = room;
  return acc;
}, {} as Record<ArchitectRoomId, ArchitectRoomDescriptor>);

export const ROOM_BY_LEGACY_TAB = ARCHITECT_ROOMS.reduce<
  Partial<Record<ActiveTab, ArchitectRoomId>>
>((acc, room) => {
  if (room.legacyTab) {
    acc[room.legacyTab] = room.id;
  }
  return acc;
}, {});
