// src/features/lists/ExportOptionsModal.tsx
import React from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import type { ListExportType } from '@/features/lists/ListPreviewModal/ListExportWrapper';

type ExportOptionsModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (type: ListExportType) => void;
};

export const ExportOptionsModal = ({ open, onClose, onSelect }: ExportOptionsModalProps) => {
  const handleSelect = (type: ListExportType) => {
    onSelect(type);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-6 max-w-sm w-full flex flex-col gap-4">
        <h2 className="text-xl font-bold text-white">Choose Export Style</h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleSelect('list')}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            List Style
          </button>
          <button
            onClick={() => handleSelect('tier')}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tier Style
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

