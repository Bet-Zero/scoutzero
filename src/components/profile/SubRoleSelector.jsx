import React, { useState, useEffect, useRef } from 'react';
import { SubRoleMasterList } from '@/constants/SubRoleMasterList';
import { NotebookText } from 'lucide-react';

const SubRoleSelector = ({ subRoles = {}, setSubRoles, setOpenModal }) => {
  const safeSubRoles = {
    offense: Array.isArray(subRoles.offense) ? subRoles.offense : [],
    defense: Array.isArray(subRoles.defense) ? subRoles.defense : [],
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempSelection, setTempSelection] = useState({ ...safeSubRoles });
  const modalRef = useRef(null);

  useEffect(() => {
    setTempSelection({ ...safeSubRoles });
  }, [subRoles]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen, tempSelection]);

  const isPositive = (roleName) => {
    const roleData = SubRoleMasterList.find((r) => r.name === roleName);
    return roleData?.isPositive;
  };

  const handleToggle = (roleName) => {
    const roleData = SubRoleMasterList.find((r) => r.name === roleName);
    if (!roleData) return;

    const type = roleData.type;

    setTempSelection((prev) => {
      const currentList = prev[type] || [];
      if (currentList.includes(roleName)) {
        return { ...prev, [type]: currentList.filter((r) => r !== roleName) };
      } else {
        return { ...prev, [type]: [...currentList, roleName] };
      }
    });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setSubRoles(tempSelection);
    setIsModalOpen(false);
  };

  // Organized group categories
  const offensiveGroups = [
    'Playmaking',
    'Scoring',
    'Shooting',
    'Finishing',
    'Off-Ball',
    'Rebounding',
    'Intangibles',
  ];

  const defensiveGroups = [
    'Perimeter',
    'Interior',
    'Rebounding',
    'Team Defense',
    'Intangibles',
  ];

  return (
    <div className="w-full cursor-pointer" onClick={handleOpen}>
      <div className="flex h-20 rounded-lg -mt-1.5 relative">
        <div className="w-1/2 p-1">
          {safeSubRoles.offense.length > 0 ? (
            safeSubRoles.offense.map((role) => (
              <div key={role} className="flex items-center h-6 pl-3 gap-1">
                {isPositive(role) ? (
                  <span className="text-green-500 text-[11px]">✓</span>
                ) : (
                  <span className="text-red-500 text-[11px]">✗</span>
                )}
                <span className="text-white text-[11px] truncate">{role}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenModal?.(`subrole_${role}`);
                  }}
                  className="text-black hover:text-white"
                  title={`Edit ${role} blurb`}
                >
                  <NotebookText size={14} strokeWidth={1.25} />
                </button>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 italic text-[11px]">
              Click to add
            </div>
          )}
        </div>

        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-neutral-800"></div>

        <div className="w-1/2 p-1">
          {safeSubRoles.defense.length > 0 ? (
            safeSubRoles.defense.map((role) => (
              <div key={role} className="flex items-center h-6 pl-[22px] gap-1">
                {isPositive(role) ? (
                  <span className="text-green-500 text-[11px]">✓</span>
                ) : (
                  <span className="text-red-500 text-[11px]">✗</span>
                )}
                <span className="text-white text-[11px] truncate">{role}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenModal?.(`subrole_${role}`);
                  }}
                  className="text-black hover:text-white"
                  title={`Edit ${role} blurb`}
                >
                  <NotebookText size={14} strokeWidth={1.25} />
                </button>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 italic text-[11px]">
              Click to add
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center">
          <div className="absolute inset-0 bg-black bg-opacity-70" />
          <div
            ref={modalRef}
            className="relative bg-[#1f1f1f] p-6 rounded-xl w-[90%] max-w-[1000px] max-h-[80vh] overflow-y-auto text-white"
          >
            <button
              className="absolute top-4 right-4 text-white text-xl font-bold"
              onClick={handleClose}
            >
              ✖
            </button>
            <h2 className="text-lg font-bold mb-4 text-center">
              Sub-Role Selector
            </h2>

            <div className="flex gap-6">
              {/* Offensive Side */}
              <div className="w-1/2 pr-3">
                {offensiveGroups.map((group) => {
                  const groupRoles = SubRoleMasterList.filter(
                    (r) => r.type === 'offense' && r.group === group
                  );
                  if (groupRoles.length === 0) return null;

                  return (
                    <div key={`offense-${group}`} className="mb-4">
                      <div className="text-sm font-semibold mb-1 pl-3">
                        {group}
                      </div>
                      {groupRoles.map((role) => (
                        <div
                          key={role.name}
                          className={`flex items-center px-3 py-1 mb-1 rounded cursor-pointer text-[11px] ${
                            tempSelection.offense.includes(role.name)
                              ? 'bg-gray-700'
                              : 'bg-neutral-800'
                          }`}
                          onClick={() => handleToggle(role.name)}
                        >
                          <span
                            className={`${
                              role.isPositive
                                ? 'text-green-500'
                                : 'text-red-500'
                            } mr-2`}
                          >
                            {role.isPositive ? '✓' : '✗'}
                          </span>
                          {role.name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Defensive Side */}
              <div className="w-1/2 pl-3">
                {defensiveGroups.map((group) => {
                  const groupRoles = SubRoleMasterList.filter(
                    (r) => r.type === 'defense' && r.group === group
                  );
                  if (groupRoles.length === 0) return null;

                  return (
                    <div key={`defense-${group}`} className="mb-4">
                      <div className="text-sm font-semibold mb-1 pl-3">
                        {group}
                      </div>
                      {groupRoles.map((role) => (
                        <div
                          key={role.name}
                          className={`flex items-center px-3 py-1 mb-1 rounded cursor-pointer text-[11px] ${
                            tempSelection.defense.includes(role.name)
                              ? 'bg-gray-700'
                              : 'bg-neutral-800'
                          }`}
                          onClick={() => handleToggle(role.name)}
                        >
                          <span
                            className={`${
                              role.isPositive
                                ? 'text-green-500'
                                : 'text-red-500'
                            } mr-2`}
                          >
                            {role.isPositive ? '✓' : '✗'}
                          </span>
                          {role.name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubRoleSelector;
