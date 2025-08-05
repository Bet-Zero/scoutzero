import React from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';
import ContractEditor from './ContractEditor';

const ContractEditorModal = ({
  player,
  isOpen,
  onClose,
  capProjections,
  teamCapSheet,
  onSign,
  playersMap = {},
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="p-4 max-w-xl">
      <ContractEditor
        player={player}
        capProjections={capProjections}
        teamCapSheet={teamCapSheet}
        onSign={onSign}
        playersMap={playersMap}
      />
    </DialogContent>
  </Dialog>
);

export default ContractEditorModal;
