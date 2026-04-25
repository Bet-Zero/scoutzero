/**
 * FILE: src/features/profile/BreakdownModal.tsx
 * PURPOSE: Shared breakdown modal for blurbs with video examples, Save/Close buttons.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Added Save/Close footer with modal-local dirty tracking
 *  - 2026-01-22: Added video example controls (Phase 3)
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Modal from '@/shared/components/ui/Modal';
import VideoExamples from '@/shared/components/ui/VideoExamples';
import {
  getModalTitle,
  getBlurbValue,
  getVideoExamplesForKey,
  type ProfileDetailKey,
} from '@/features/profile/utils/profileHelpers';
import type { Blurbs } from '@/shared/utils/blurbs';
import type { VideoExample } from '@/schemas/players_v2';
import type { NormalizedVideoExamples } from '@/shared/utils/videoExamples';
import type {
  ModalSavePayload,
} from '@/features/profile/hooks/usePlayerProfileState';
import type { UseAutoSavePlayerResult } from './hooks/useAutoSavePlayer';

const BreakdownModal = ({
  modalKey,
  blurbs,
  videoExamples,
  onClose,
  onBuildSavePayload,
  onCommitSavedDraft,
  onSaveNow,
  saveState,
  saveError,
}: {
  modalKey: ProfileDetailKey;
  blurbs: Blurbs;
  videoExamples: NormalizedVideoExamples;
  onClose: () => void;
  onBuildSavePayload: (
    key: ProfileDetailKey,
    value: string,
    list: VideoExample[]
  ) => ModalSavePayload;
  onCommitSavedDraft: (payload: Partial<ModalSavePayload> | null | undefined) => void;
  onSaveNow: UseAutoSavePlayerResult['saveNow'];
  saveState: UseAutoSavePlayerResult['saveState'];
  saveError: string | null;
}) => {
  const [draftBlurb, setDraftBlurb] = useState(() =>
    getBlurbValue(blurbs, modalKey)
  );
  const [draftVideoExamples, setDraftVideoExamples] = useState(() =>
    getVideoExamplesForKey(videoExamples, modalKey)
  );
  // Track modal-local dirty state (reset when modal opens or save succeeds)
  const [modalDirty, setModalDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localSaveState, setLocalSaveState] = useState('idle');
  const prevSaveStateRef = useRef(saveState);

  // Track save state transitions to update local feedback
  useEffect(() => {
    // If we were saving and now saved, update local state
    if (prevSaveStateRef.current === 'saving' && saveState === 'saved') {
      setLocalSaveState('saved');
      setModalDirty(false);
      // Reset to idle after showing "Saved"
      const timer = setTimeout(() => setLocalSaveState('idle'), 2000);
      return () => clearTimeout(timer);
    }
    if (saveState === 'saving') {
      setLocalSaveState('saving');
    }
    if (saveState === 'error') {
      setLocalSaveState('error');
    }
    prevSaveStateRef.current = saveState;
  }, [saveState]);

  // Wrapped change handlers that mark modal dirty
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraftBlurb(e.target.value);
      setModalDirty(true);
      setLocalSaveState('idle');
    },
    []
  );

  const handleVideoChange = useCallback(
    (next: VideoExample[]) => {
      setDraftVideoExamples(next);
      setModalDirty(true);
      setLocalSaveState('idle');
    },
    []
  );

  // Handle Save button click
  const handleSave = useCallback(async () => {
    if (!onSaveNow) return;
    setLocalSaveState('saving');
    try {
      const payload = onBuildSavePayload?.(
        modalKey,
        draftBlurb,
        draftVideoExamples
      );
      await onSaveNow(payload);
      onCommitSavedDraft?.(payload);
      // State update handled by useEffect watching saveState
    } catch {
      setLocalSaveState('error');
    }
  }, [
    draftBlurb,
    draftVideoExamples,
    modalKey,
    onBuildSavePayload,
    onCommitSavedDraft,
    onSaveNow,
  ]);

  // Handle Close button click
  const handleCloseClick = useCallback(() => {
    if (modalDirty) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  }, [modalDirty, onClose]);

  // Discard changes and close
  const handleDiscard = useCallback(() => {
    setShowConfirm(false);
    onClose();
  }, [onClose]);

  // Keep editing
  const handleKeepEditing = useCallback(() => {
    setShowConfirm(false);
  }, []);

  // Get status text
  const getStatusText = () => {
    switch (localSaveState) {
      case 'saving':
        return 'Saving…';
      case 'saved':
        return 'Saved';
      case 'error':
        return saveError || 'Save failed';
      default:
        return '';
    }
  };

  const statusText = getStatusText();
  const statusColor =
    localSaveState === 'error'
      ? 'text-red-400'
      : localSaveState === 'saved'
        ? 'text-green-400'
        : 'text-white/50';

  return (
    <Modal title={getModalTitle(modalKey)} onClose={handleCloseClick}>
      <textarea
        className="w-full h-40 bg-neutral-900 text-white p-3 rounded-lg text-sm resize-none outline-none border border-neutral-700"
        placeholder="Write your breakdown here..."
        value={draftBlurb}
        onChange={handleTextChange}
      />
      <VideoExamples
        contextKey={modalKey}
        videos={draftVideoExamples}
        onChange={handleVideoChange}
      />

      {/* Footer bar with Save/Close */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-700">
        <span className={`text-sm ${statusColor}`}>{statusText}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={localSaveState === 'saving'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {localSaveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCloseClick}
            className="px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirm discard dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center">
          <div className="bg-neutral-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">
              Discard changes?
            </h3>
            <p className="text-white/70 text-sm mb-4">
              You have unsaved changes. Are you sure you want to close without
              saving?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleKeepEditing}
                className="px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BreakdownModal;
