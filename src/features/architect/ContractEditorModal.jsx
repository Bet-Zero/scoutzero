import React from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/dialog';
import ContractEditor from './ContractEditor';

const ContractEditorModal = ({
  player,
  isOpen,
  onClose,
  capSettings,
  teamCapSheet,
  onSign,
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="p-4 max-w-xl">
      <ContractEditor
        player={player}
        capSettings={capSettings}
        teamCapSheet={teamCapSheet}
        onSign={onSign}
      />
    </DialogContent>
  </Dialog>
);

export default ContractEditorModal;
