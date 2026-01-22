import React from 'react';
import PlayerHeader from './PlayerHeader';
import PlayerStatsTable from './PlayerStatsTable';
import PlayerTraitsGrid from './PlayerTraitsGrid';
import PlayerRolesSection from './PlayerRolesSection';
import BadgeSelector from './BadgeSelector';
import OverallBlurbBox from './OverallBlurbBox';

const PlayerDetails = ({
  player,
  selectedPlayer,
  traits,
  onTraitChange,
  roles,
  onRoleChange,
  twoWay,
  onTwoWayChange,
  subRoles,
  setSubRoles,
  shootingProfile,
  setShootingProfile,
  badges,
  setBadges,
  editedBlurbs,
  onBlurbChange,
  overallGrade,
  setOverallGrade,
  setOpenModal,
}) => (
  <>
    <PlayerHeader player={player} selectedPlayer={selectedPlayer} />
    <PlayerStatsTable player={player} />
    <div className="flex gap-[1.25rem] w-full max-w-[750px]">
      <PlayerTraitsGrid
        traits={traits}
        onTraitClick={onTraitChange}
        setOpenModal={setOpenModal}
      />
      <PlayerRolesSection
        roles={roles}
        onRoleChange={onRoleChange}
        subRoles={subRoles}
        setSubRoles={setSubRoles}
        shootingProfile={shootingProfile}
        setShootingProfile={setShootingProfile}
        twoWay={twoWay}
        onTwoWayChange={onTwoWayChange}
        setOpenModal={setOpenModal}
      />
    </div>
    <BadgeSelector badges={badges} setBadges={setBadges} />
    <OverallBlurbBox
      overallBlurb={editedBlurbs.overall || ''}
      setOverallBlurb={(val) => onBlurbChange('overall', val)}
      overallGrade={overallGrade}
      setOverallGrade={(val) => setOverallGrade(val)}
      setOpenModal={setOpenModal}
    />
  </>
);

export default PlayerDetails;
