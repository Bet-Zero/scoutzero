import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import RoleChecklist from '@/components/shared/ui/filters/RoleChecklist';
import {
  toggleSubroleSelection,
  offensiveRoles,
  defensiveRoles,
} from '@/utils/roles';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';

const RolesFilters = ({ filters, setFilters }) => {
  const [showSubroles, setShowSubroles] = useState(false);

  const handleToggleSubrole = (roleName) => {
    setFilters((prev) => ({
      ...prev,
      subRoles: toggleSubroleSelection(prev.subRoles, roleName),
    }));
  };

  return (
    <div className="p-2 space-y-3">
      <div className="space-y-3">
        {' '}
        {/* Added wrapper div */}
        <div>
          <label className="block mb-1 text-white/70 text-xs">
            Offense Role
          </label>
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
          <label className="block mb-1 text-white/70 text-xs">
            Defense Role
          </label>
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
      </div>

      {/* Divider - Now perfectly aligned */}
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
          <RoleChecklist
            roles={SubRoleMasterList}
            selected={filters.subRoles}
            onToggle={handleToggleSubrole}
            columns={2}
            className="mt-1"
          />
        )}
      </div>
    </div>
  );
};

export default RolesFilters;
