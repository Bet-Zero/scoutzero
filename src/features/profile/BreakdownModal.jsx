/**
 * FILE: src/features/profile/BreakdownModal.jsx
 * PURPOSE: Shared breakdown modal for blurbs with video examples.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Added video example controls (Phase 3)
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React from 'react';
import Modal from '@/shared/components/ui/Modal';
import VideoExamples from '@/shared/components/ui/VideoExamples';
import {
  getModalTitle,
  getBlurbValue,
  getVideoExamplesForKey,
} from '@/features/profile/utils/profileHelpers';

const BreakdownModal = ({
  modalKey,
  blurbs,
  videoExamples,
  onChange,
  onVideoExamplesChange,
  onClose,
}) => (
  <Modal title={getModalTitle(modalKey)} onClose={onClose}>
    <textarea
      className="w-full h-40 bg-neutral-900 text-white p-3 rounded-lg text-sm resize-none outline-none border border-neutral-700"
      placeholder="Write your breakdown here..."
      value={getBlurbValue(blurbs, modalKey)}
      onChange={(e) => onChange(modalKey, e.target.value)}
    />
    <VideoExamples
      contextKey={modalKey}
      videos={getVideoExamplesForKey(videoExamples, modalKey)}
      onChange={(next) => onVideoExamplesChange?.(modalKey, next)}
    />
  </Modal>
);

export default BreakdownModal;
