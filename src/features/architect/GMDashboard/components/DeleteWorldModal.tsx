/**
 * FILE: src/features/architect/GMDashboard/components/DeleteWorldModal.tsx
 * PURPOSE: Confirmation modal for permanent world deletion.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import { useEffect, useRef } from 'react';

type DeleteWorldModalProps = {
  worldName?: string | null;
  confirmText?: string;
  setConfirmText: (value: string) => void;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
};

export function DeleteWorldModal({
  worldName,
  confirmText,
  setConfirmText,
  onClose,
  onDelete,
  isSubmitting,
  error,
}: DeleteWorldModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isConfirmValid =
    confirmText === 'DELETE' || confirmText === worldName;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-[#1a1a1a] border border-red-900/50 rounded-lg shadow-xl p-4 w-96 max-w-[90vw]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg">!</span>
          </div>
          <h3 className="text-sm font-semibold text-red-400">
            Delete World Permanently
          </h3>
        </div>

        <div className="bg-red-900/20 border border-red-900/50 rounded p-3 mb-4">
          <p className="text-xs text-red-300 mb-2">
            <strong>⚠️ This action is irreversible!</strong>
          </p>
          <p className="text-xs text-white/80">
            You are about to permanently delete{' '}
            <strong className="text-white">&quot;{worldName}&quot;</strong>{' '}
            and all its data including:
          </p>
          <ul className="text-xs text-white/70 mt-2 ml-3 list-disc">
            <li>All team snapshots</li>
            <li>All player overrides</li>
            <li>World metadata and history</li>
          </ul>
        </div>

        <div className="mb-4">
          <label
            htmlFor="delete-confirm"
            className="block text-xs text-white/70 mb-1"
          >
            Type <strong className="text-red-400">DELETE</strong> or{' '}
            <strong className="text-red-400">{worldName}</strong> to confirm:
          </label>
          <input
            ref={inputRef}
            id="delete-confirm"
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className="w-full bg-[#0d0d0d] border border-red-900/50 rounded px-2 py-2 text-sm text-white focus:border-red-600 focus:outline-none"
            placeholder="Type confirmation..."
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-900 rounded p-2 mb-4">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            disabled={isSubmitting || !isConfirmValid}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⏳</span> Deleting...
              </span>
            ) : (
              'Delete Permanently'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
