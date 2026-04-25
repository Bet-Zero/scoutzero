import React from 'react';
import PlayerHeader from './PlayerHeader';
import PlayerStatsTable from './PlayerStatsTable';
import PlayerTraitsGrid from './PlayerTraitsGrid';
import PlayerRolesSection from './PlayerRolesSection';
import BadgeSelector from './BadgeSelector';
import OverallBlurbBox from './OverallBlurbBox';
import type {
  ProfileDetailKey,
} from '@/features/profile/utils/profileHelpers';
import type { Blurbs } from '@/shared/utils/blurbs';
import type {
  ProfileRoles,
  UsePlayerProfileStateResult,
} from '@/features/profile/hooks/usePlayerProfileState';
import type { PlayerSubRoles } from '@/features/roster/utils/enrichPlayerData';
import type {
  OpenProfileModal,
  ProfilePlayer,
  ProfileSetter,
} from '../profileUiTypes';

type PlayerDetailsProps = {
  player: ProfilePlayer;
  selectedPlayer: string | null;
  traits: Record<string, number>;
  onTraitChange: UsePlayerProfileStateResult['handleTraitChange'];
  roles: ProfileRoles;
  onRoleChange: (key: keyof ProfileRoles, value: string) => void;
  twoWay: number;
  onTwoWayChange: (value: number) => void;
  subRoles: PlayerSubRoles;
  setSubRoles: ProfileSetter<PlayerSubRoles>;
  shootingProfile: string;
  setShootingProfile: (value: string) => void;
  badges: string[];
  setBadges: ProfileSetter<string[]>;
  editedBlurbs: Blurbs;
  onBlurbChange: (key: ProfileDetailKey, value: string) => void;
  overallGrade: number | null;
  setOverallGrade: (value: number | null) => void;
  setOpenModal: OpenProfileModal;
};

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
}: PlayerDetailsProps) => (
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
