import React from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import ContractEditor from '../ContractEditor';

type ContractEditorModalProps = {
  player: Record<string, unknown> | null | undefined;
  isOpen: boolean;
  onClose: (...args: any[]) => any;
  capProjections: Record<string, unknown> | null | undefined;
  teamCapSheet?: Record<string, unknown> | null;
  onSign: (...args: any[]) => any;
  playersMap?: Record<string, unknown>;
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
