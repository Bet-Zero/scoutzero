// components/PlayerRolesSection.jsx
import React from 'react';
import SubRoleSelector from './SubRoleSelector';
import ShootingProfileSelector from './ShootingProfileSelector';
import TwoWayMeter from './TwoWayMeter';
import { NotebookText } from 'lucide-react';
import { offensiveRoles, defensiveRoles } from '@/utils/roles';

const RoleSelect = ({ value, onChange, setOpenModal, options, roleKey }) => (
  <div className="relative w-full mb-2">
    <select
      className="bg-neutral-800 text-white px-3 py-2 rounded-full w-full border border-black appearance-none pr-10"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value=""></option>
      {options.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
    {value && (
      <button
        onClick={() => setOpenModal(`role_${roleKey}`)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:text-neutral-400"
        title={`Edit ${value} blurb`}
      >
        <NotebookText size={14} strokeWidth={1.25} />
      </button>
    )}
  </div>
);

const CenteredLabelWithIcon = ({ label, onClick, modalKey }) => (
  <div className="flex justify-center mb-2">
    <div className="relative inline-flex items-center">
      <span className="text-base font-bold">{label}</span>
      <button
        onClick={() => onClick(modalKey)}
        className="absolute -right-5 text-black hover:text-white"
        title={`Edit ${label} blurb`}
      >
        <NotebookText size={14} strokeWidth={1.25} />
      </button>
    </div>
  </div>
);

const PlayerRolesSection = ({
  roles,
  onRoleChange,
  subRoles,
  setSubRoles,
  shootingProfile,
  setShootingProfile,
  onTwoWayChange,
  setOpenModal,
}) => {
  return (
    <div
      className="bg-[#1f1f1f] rounded-2xl shadow-lg px-4 py-4 text-white text-sm font-medium flex flex-col justify-between"
      style={{ width: '500px', height: '460px' }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-4">
          {/* Offense Roles */}
          <div className="w-1/2 flex flex-col items-center">
            <div className="text-lg font-bold mb-2 text-center underline">
              Offense
            </div>
            <RoleSelect
              value={roles.offense1}
              onChange={(val) => onRoleChange('offense1', val)}
              setOpenModal={setOpenModal}
              options={offensiveRoles}
              roleKey="offense1"
            />
            <RoleSelect
              value={roles.offense2}
              onChange={(val) => onRoleChange('offense2', val)}
              setOpenModal={setOpenModal}
              options={offensiveRoles}
              roleKey="offense2"
            />
          </div>

          {/* Defense Roles */}
          <div className="w-1/2 flex flex-col items-center">
            <div className="text-lg font-bold mb-2 text-center underline">
              Defense
            </div>
            <RoleSelect
              value={roles.defense1}
              onChange={(val) => onRoleChange('defense1', val)}
              setOpenModal={setOpenModal}
              options={defensiveRoles}
              roleKey="defense1"
            />
            <RoleSelect
              value={roles.defense2}
              onChange={(val) => onRoleChange('defense2', val)}
              setOpenModal={setOpenModal}
              options={defensiveRoles}
              roleKey="defense2"
            />
          </div>
        </div>

        <SubRoleSelector
          subRoles={subRoles}
          setSubRoles={setSubRoles}
          setOpenModal={setOpenModal}
        />

        <div className="border-t border-neutral-600 my-2"></div>

        {/* Shooting Profile */}
        <div className="px-2 -mt-1.5">
          <CenteredLabelWithIcon
            label="Shooting Profile"
            onClick={setOpenModal}
            modalKey="shooting_profile"
          />
          <ShootingProfileSelector
            value={shootingProfile}
            onChange={setShootingProfile}
          />
        </div>
      </div>

      {/* Two-Way Meter */}
      <div className="mt-6 mb-1 px-2">
        <CenteredLabelWithIcon
          label="Two-Way Meter"
          onClick={setOpenModal}
          modalKey="two_way_meter"
        />
        <TwoWayMeter twoWayValue={roles.twoWay} onChange={onTwoWayChange} />
      </div>
    </div>
  );
};

export default React.memo(PlayerRolesSection);
