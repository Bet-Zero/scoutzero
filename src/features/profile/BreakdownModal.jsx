import React from 'react';
import Modal from '@/components/shared/ui/Modal';
import { getModalTitle, getBlurbValue } from '@/utils/profileHelpers';

const BreakdownModal = ({ modalKey, blurbs, onChange, onClose }) => (
  <Modal title={getModalTitle(modalKey)} onClose={onClose}>
    <textarea
      className="w-full h-40 bg-neutral-900 text-white p-3 rounded-lg text-sm resize-none outline-none border border-neutral-700"
      placeholder="Write your breakdown here..."
      value={getBlurbValue(blurbs, modalKey)}
      onChange={(e) => onChange(modalKey, e.target.value)}
    />
    <div className="w-full h-40 bg-neutral-700 rounded-xl flex items-center justify-center text-sm text-neutral-400 mt-4">
      [Video examples coming soon]
    </div>
  </Modal>
);

export default BreakdownModal;
