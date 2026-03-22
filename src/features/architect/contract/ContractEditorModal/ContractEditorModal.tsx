import React from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import ContractEditor, {
  type ContractEditorProps,
} from '../ContractEditor/ContractEditor';

export type ContractEditorModalProps = ContractEditorProps & {
  isOpen: boolean;
  onClose: () => void;
};

const ContractEditorModal = ({
  player,
  isOpen,
  onClose,
  capProjections,
  teamCapSheet,
  onSign,
  playersMap = {},
}: ContractEditorModalProps) => (
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
