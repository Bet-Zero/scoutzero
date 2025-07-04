import React from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/dialog';
import RosterViewer from './RosterViewer';

const RosterExportModal = ({ open, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-4 w-full max-w-[1100px]">
        <RosterViewer isExport={true} />
      </DialogContent>
    </Dialog>
  );
};

export default RosterExportModal;
