import React, { useEffect, useRef, useState } from 'react';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import {
  defensiveRoles,
  offensiveRoles,
  shootingProfileTiers,
} from '@/utils/roles';
import { toggleSubroleSelection } from '@/utils/roles';

const RoleSelect = ({
  label,
  value,
  onChange,
  options,
  allLabel = 'All Roles',
}) => (
  <div className="flex flex-col">
    <label className="mb-1 text-white/70 text-xs uppercase tracking-wider">
      {label}
    </label>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#2a2a2a] p-2 rounded text-sm border border-white/10"
    >
      <option value="">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

const SelectedSubroles = ({ subRoles }) => {
  const selected = [...(subRoles.offense || []), ...(subRoles.defense || [])];
  if (selected.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="text-xs text-white/60 mb-1">Selected Subroles:</div>
      <div className="flex flex-wrap gap-1">
        {selected.map((role) => {
          const roleData = SubRoleMasterList.find((r) => r.name === role);
          if (!roleData) return null;
          return (
            <div
              key={role}
              className={`text-xs px-2 py-1 rounded ${
                roleData.isPositive
                  ? 'bg-green-900/50 text-green-100'
                  : 'bg-red-900/50 text-red-100'
              }`}
            >
              {role}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SubroleMenu = ({ show, toggleShow, filters, onToggleRole, menuRef }) => (
  <div className="mt-4" ref={menuRef}>
    <button
      onClick={() => toggleShow(!show)}
      className="flex items-center justify-between w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] px-4 py-2 rounded-md transition-colors"
    >
      <span className="text-sm font-medium">Subroles</span>
      <span className="text-white/60">
        {show ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
    </button>
    {show && (
      <div className="mt-3 grid grid-cols-2 gap-6 bg-[#1f1f1f] p-4 rounded-md border border-white/10 max-h-[400px] overflow-y-auto">
        {['offense', 'defense'].map((type) => (
          <div key={type} className="space-y-4">
            <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider border-b border-white/10 pb-1">
              {type === 'offense' ? 'Offensive Subroles' : 'Defensive Subroles'}
            </h3>
            {Array.from(
              new Set(
                SubRoleMasterList.filter((r) => r.type === type).map(
                  (r) => r.group
                )
              )
            ).map((group) => (
              <div key={group} className="space-y-2">
                <div className="text-xs text-white/60 font-medium">{group}</div>
                <div className="grid grid-cols-1 gap-1">
                  {SubRoleMasterList.filter(
                    (r) => r.type === type && r.group === group
                  ).map((role) => (
                    <div
                      key={role.name}
                      onClick={() => onToggleRole(role.name)}
                      className={`flex items-center justify-between px-3 py-1 rounded cursor-pointer text-sm ${
                        (filters.subRoles?.[type] || []).includes(role.name)
                          ? role.isPositive
                            ? 'bg-green-900/50 text-green-100'
                            : 'bg-red-900/50 text-red-100'
                          : role.isPositive
                            ? 'bg-[#2a2a2a] text-green-100 hover:bg-green-900/30'
                            : 'bg-[#2a2a2a] text-red-100 hover:bg-red-900/30'
                      }`}
                    >
                      <span className="flex-1">{role.name}</span>
                      <span className="text-xs opacity-70">
                        {role.isPositive ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="col-span-2 pt-2 border-t border-white/10">
          <button
            onClick={() => toggleShow(false)}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white text-sm"
          >
            OK
          </button>
        </div>
      </div>
    )}
  </div>
);

const RoleFilters = ({ filters, setFilters }) => {
  const [showSubroles, setShowSubroles] = useState(false);
  const subroleMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        subroleMenuRef.current &&
        !subroleMenuRef.current.contains(event.target)
      ) {
        setShowSubroles(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleSubrole = (roleName) => {
    setFilters((prev) => ({
      ...prev,
      subRoles: toggleSubroleSelection(prev.subRoles, roleName),
    }));
  };

  return (
    <div className="bg-[#1a1a1a] p-4 rounded-md border border-white/10">
      <h2 className="text-white text-sm font-bold border-b border-white/20 pb-2 mb-4">
        Roles
      </h2>

      <div className="grid grid-cols-3 gap-4 text-white text-sm mb-4">
        <RoleSelect
          label="Offensive Role"
          value={filters.offenseRole}
          onChange={(val) => update('offenseRole', val)}
          options={offensiveRoles}
        />
        <RoleSelect
          label="Defensive Role"
          value={filters.defenseRole}
          onChange={(val) => update('defenseRole', val)}
          options={defensiveRoles}
        />
        <RoleSelect
          label="Shooting"
          value={filters.shootingProfile}
          onChange={(val) => update('shootingProfile', val)}
          options={shootingProfileTiers}
          allLabel="All"
        />
      </div>

      <SelectedSubroles subRoles={filters.subRoles || {}} />

      <SubroleMenu
        show={showSubroles}
        toggleShow={setShowSubroles}
        filters={filters}
        onToggleRole={handleToggleSubrole}
        menuRef={subroleMenuRef}
      />
    </div>
  );
};

export default RoleFilters;
