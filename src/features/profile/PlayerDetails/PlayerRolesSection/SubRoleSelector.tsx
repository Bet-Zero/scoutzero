/**
 * FILE: src/features/profile/PlayerDetails/PlayerRolesSection/SubRoleSelector.tsx
 * PURPOSE: Sub-role selection UI with modal picker for offense/defense subroles.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Phase 4 - Added modal a11y basics and focus management
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-4/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NotebookText } from 'lucide-react';
import {
  SubRoleMasterList,
  type SubRoleGroup,
  type SubRoleType,
} from '@/constants/SubRoleMasterList';
import { isPositiveSubRole } from '@/shared/utils/roles';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import type { PlayerSubRoles } from '@/features/roster/utils/enrichPlayerData';

const OFFENSIVE_GROUPS: SubRoleGroup[] = [
  'Playmaking',
  'Scoring',
  'Shooting',
  'Finishing',
  'Off-Ball',
  'Rebounding',
  'Intangibles',
];

const DEFENSIVE_GROUPS: SubRoleGroup[] = [
  'Perimeter',
  'Interior',
  'Rebounding',
  'Team Defense',
  'Intangibles',
];

type RoleBadgeProps = {
  role: string;
  side: SubRoleType;
  onEdit: (role: string) => void;
};

const RoleBadge = ({ role, onEdit, side }: RoleBadgeProps) => (
  <div
    className={`flex items-center h-6 gap-1 ${
      side === 'offense' ? 'pl-3' : 'pl-[22px]'
    }`}
  >
    <span
      className={
        isPositiveSubRole(role)
          ? 'text-green-500 text-[11px]'
          : 'text-red-500 text-[11px]'
      }
    >
      {isPositiveSubRole(role) ? '✓' : '✗'}
    </span>
    <span className="text-white text-[11px] truncate">{role}</span>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEdit(role);
      }}
      className="text-black hover:text-white"
      title={`Edit ${role} blurb`}
    >
      <NotebookText size={14} strokeWidth={1.25} />
    </button>
  </div>
);

const SelectedRoleList = ({
  roles,
  side,
  onEdit,
}: {
  roles: string[];
  side: SubRoleType;
  onEdit: (role: string) => void;
}) => (
  <>
    {roles.length > 0 ? (
      roles.map((role) => (
        <RoleBadge key={role} role={role} side={side} onEdit={onEdit} />
      ))
    ) : (
      <div className="h-full flex items-center justify-center text-neutral-500 italic text-[11px]">
        Click to add
      </div>
    )}
  </>
);

const RoleGroup = ({
  group,
  type,
  selected,
  onToggle,
}: {
  group: SubRoleGroup;
  type: SubRoleType;
  selected: string[];
  onToggle: (roleName: string) => void;
}) => {
  const groupRoles = SubRoleMasterList.filter(
    (r) => r.type === type && r.group === group
  );
  if (groupRoles.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-sm font-semibold mb-1 pl-3">{group}</div>
      {groupRoles.map((role) => (
        <div
          key={role.name}
          className={`flex items-center px-3 py-1 mb-1 rounded cursor-pointer text-[11px] ${
            selected.includes(role.name) ? 'bg-gray-700' : 'bg-neutral-800'
          }`}
          onClick={() => onToggle(role.name)}
        >
          <span
            className={`${role.isPositive ? 'text-green-500' : 'text-red-500'} mr-2`}
          >
            {role.isPositive ? '✓' : '✗'}
          </span>
          {role.name}
        </div>
      ))}
    </div>
  );
};

const RoleColumn = ({
  groups,
  type,
  selected,
  onToggle,
  className,
}: {
  groups: SubRoleGroup[];
  type: SubRoleType;
  selected: string[];
  onToggle: (roleName: string) => void;
  className: string;
}) => (
  <div className={className}>
    {groups.map((group) => (
      <RoleGroup
        key={`${type}-${group}`}
        group={group}
        type={type}
        selected={selected}
        onToggle={onToggle}
      />
    ))}
  </div>
);

const SubRoleModal = ({
  selection,
  onToggle,
  onClose,
  modalRef,
}: {
  selection: PlayerSubRoles;
  onToggle: (roleName: string) => void;
  onClose: () => void;
  modalRef: React.RefObject<HTMLDivElement>;
}) => (
  <div className="fixed inset-0 z-50 flex justify-center items-center">
    <div className="absolute inset-0 bg-black bg-opacity-70" />
    <div
      ref={modalRef}
      className="relative bg-[#1f1f1f] p-6 rounded-xl w-[90%] max-w-[1000px] max-h-[80vh] overflow-y-auto text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Sub-Role Selector"
      tabIndex={-1}
    >
      <button
        className="absolute top-4 right-4 text-white text-xl font-bold"
        onClick={onClose}
        type="button"
        aria-label="Close dialog"
      >
        ✖
      </button>
      <h2 className="text-lg font-bold mb-4 text-center">Sub-Role Selector</h2>
      <div className="flex gap-6">
        <RoleColumn
          groups={OFFENSIVE_GROUPS}
          type="offense"
          selected={selection.offense}
          onToggle={onToggle}
          className="w-1/2 pr-3"
        />
        <RoleColumn
          groups={DEFENSIVE_GROUPS}
          type="defense"
          selected={selection.defense}
          onToggle={onToggle}
          className="w-1/2 pl-3"
        />
      </div>
    </div>
  </div>
);

export const SubRoleSelector = ({
  subRoles = {} as Partial<PlayerSubRoles>,
  setSubRoles,
  setOpenModal,
}: {
  subRoles?: Partial<PlayerSubRoles>;
  setSubRoles: React.Dispatch<React.SetStateAction<PlayerSubRoles>>;
  setOpenModal?: (modalKey: string) => void;
}) => {
  const safeSubRoles: PlayerSubRoles = {
    offense: Array.isArray(subRoles.offense) ? subRoles.offense : [],
    defense: Array.isArray(subRoles.defense) ? subRoles.defense : [],
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempSelection, setTempSelection] = useState({ ...safeSubRoles });
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const offense = Array.isArray(subRoles.offense) ? subRoles.offense : [];
    const defense = Array.isArray(subRoles.defense) ? subRoles.defense : [];
    setTempSelection({ offense, defense });
  }, [subRoles.offense, subRoles.defense]);

  const handleClose = useCallback(() => {
    setSubRoles(tempSelection);
    setIsModalOpen(false);
    const opener = lastActiveElementRef.current;
    if (opener && typeof opener.focus === 'function') {
      setTimeout(() => opener.focus(), 0);
    }
  }, [setSubRoles, tempSelection]);

  useClickOutside(modalRef, handleClose, isModalOpen);

  useEffect(() => {
    if (!isModalOpen) return;

    const focusTarget =
      modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || modalRef.current;

    if (focusTarget?.focus) {
      focusTarget.focus();
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, handleClose]);

  const handleToggle = (roleName: string) => {
    const roleData = SubRoleMasterList.find((r) => r.name === roleName);
    if (!roleData) return;

    const { type } = roleData;
    setTempSelection((prev) => {
      const currentList = prev[type] || [];
      return currentList.includes(roleName)
        ? { ...prev, [type]: currentList.filter((r) => r !== roleName) }
        : { ...prev, [type]: [...currentList, roleName] };
    });
  };

  const handleOpen = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    lastActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setIsModalOpen(true);
  };

  const handleEdit = (role: string) => setOpenModal?.(`subrole_${role}`);

  return (
    <div className="w-full cursor-pointer" onClick={handleOpen}>
      <div className="flex h-20 rounded-lg -mt-1.5 relative">
        <div className="w-1/2 p-1">
          <SelectedRoleList
            roles={safeSubRoles.offense}
            side="offense"
            onEdit={handleEdit}
          />
        </div>
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-neutral-800" />
        <div className="w-1/2 p-1">
          <SelectedRoleList
            roles={safeSubRoles.defense}
            side="defense"
            onEdit={handleEdit}
          />
        </div>
      </div>
      {isModalOpen && (
        <SubRoleModal
          selection={tempSelection}
          onToggle={handleToggle}
          onClose={handleClose}
          modalRef={modalRef}
        />
      )}
    </div>
  );
};

