import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { offensiveRoles, defensiveRoles } from '@/utils/roles';

const RolesFilters = ({ filters, setFilters }) => {
  const [showSubroles, setShowSubroles] = useState(false);

  const toggleSubrole = (roleName) => {
    const roleData = SubRoleMasterList.find((r) => r.name === roleName);
    if (!roleData) return;

    const type = roleData.type;
    setFilters((prev) => ({
      ...prev,
      subRoles: {
        ...prev.subRoles,
        [type]: prev.subRoles[type]?.includes(roleName)
          ? prev.subRoles[type].filter((r) => r !== roleName)
          : [...(prev.subRoles[type] || []), roleName],
      },
    }));
  };

  return (
    <div className="p-2 space-y-3">
      <div>
        <label className="block mb-1 text-white/70 text-xs">Offense Role</label>
        <select
          value={filters.offenseRole}
          onChange={(e) =>
            setFilters({ ...filters, offenseRole: e.target.value })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">All Roles</option>
          {offensiveRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1 text-white/70 text-xs">Defense Role</label>
        <select
          value={filters.defenseRole}
          onChange={(e) =>
            setFilters({ ...filters, defenseRole: e.target.value })
          }
          className="w-full bg-[#2a2a2a] text-white px-2 py-1 rounded text-xs"
        >
          <option value="">All Roles</option>
          {defensiveRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-white/10 my-2" />

      <div>
        <button
          onClick={() => setShowSubroles(!showSubroles)}
          className="flex items-center justify-between w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] px-2 py-1 rounded text-xs"
        >
          <span>Subroles</span>
          {showSubroles ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showSubroles && (
          <div className="mt-1 grid grid-cols-2 gap-1">
            {SubRoleMasterList.map((role) => (
              <div
                key={role.name}
                onClick={() => toggleSubrole(role.name)}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${
                  filters.subRoles[role.type]?.includes(role.name)
                    ? role.isPositive
                      ? 'bg-green-900/50 text-green-100'
                      : 'bg-red-900/50 text-red-100'
                    : role.isPositive
                      ? 'bg-[#2a2a2a] text-green-100 hover:bg-green-900/30'
                      : 'bg-[#2a2a2a] text-red-100 hover:bg-red-900/30'
                }`}
              >
                <span>{role.name}</span>
                <span>{role.isPositive ? '✓' : '✗'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RolesFilters;
