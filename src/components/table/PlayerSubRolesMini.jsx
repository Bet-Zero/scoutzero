import React from 'react';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';

const MiniSubRoleLine = ({ roles = [] }) => {
  const getRoleData = (roleName) =>
    SubRoleMasterList.find((r) => r.name === roleName);

  return (
    <div className="flex flex-wrap gap-1 text-[10px] w-full justify-center">
      {roles.length > 0 ? (
        roles.map((role) => {
          const roleData = getRoleData(role);
          if (!roleData) return null;

          return (
            <div
              key={role}
              className="flex items-center gap-1 px-2 py-[1px] rounded-md bg-[#2a2a2a]"
            >
              <span
                className={
                  roleData.isPositive ? 'text-green-500' : 'text-red-500'
                }
              >
                {roleData.isPositive ? '✓' : '✗'}
              </span>
              <span className="text-white truncate">{role}</span>
            </div>
          );
        })
      ) : (
        <span className="text-neutral-600 italic">None</span>
      )}
    </div>
  );
};

const PlayerSubRolesMini = ({ subRoles }) => {
  // Separate offense and defense roles from the subRoles prop
  const offenseRoles = subRoles?.offense || [];
  const defenseRoles = subRoles?.defense || [];

  return (
    <div className="w-[180px] rounded-md p-2 mt-1 shadow-sm">
      <div className="text-[11px] font-semibold mb-2 text-purple-400">
        Offense
      </div>
      <MiniSubRoleLine roles={offenseRoles} />
      <div className="text-[11px] font-semibold mt-4 mb-2 text-blue-400">
        Defense
      </div>
      <MiniSubRoleLine roles={defenseRoles} />
    </div>
  );
};

export default PlayerSubRolesMini;
