import React from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';
import RosterSection from './RosterSection';
import { getTeamColors } from '@/utils/formatting/teamColors';

const RosterPreviewModal = ({ open, onClose, roster, team }) => {
  if (!roster) return null;
  const { primary, secondary } = getTeamColors(team);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-4 w-full max-w-[1100px]">
        <div className="relative text-white p-6 flex flex-col items-center overflow-hidden">
          {team && (
            <img
              src={`/assets/logos/${team.toLowerCase()}.png`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-4 pointer-events-none select-none"
              style={{ zIndex: 0 }}
            />
          )}
          {team && (
            <h2
              className="text-5xl font-black tracking-wide z-10 uppercase relative mb-2"
              style={{
                color: '#1e1e1e',
                textShadow: `0 0 10px ${primary}, 0 0 18px ${secondary}`,
              }}
            >
              {team}
            </h2>
          )}
          <h3 className="text-xl text-neutral-500 font-semibold z-10 mb-8 opacity-90 tracking-wide">
            Team Roster
          </h3>
          <RosterSection players={roster.starters} section="starters" isExport />
          <RosterSection players={roster.rotation} section="rotation" isExport />
          <RosterSection players={roster.bench} section="bench" isExport />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RosterPreviewModal;
