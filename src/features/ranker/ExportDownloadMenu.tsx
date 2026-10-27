/**
 * FILE: src/features/ranker/ExportDownloadMenu.tsx
 * PURPOSE: Download button for Player Ranker results that offers the image layouts, with the one that fits the list size marked
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created with the size-aware export layouts
 *  - 2026-10-27: Labelled on phones too
 *  - 2026-10-27: Spinner and "Preparing…" while the image is built
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingResults.tsx
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import { EXPORT_LAYOUTS, type ExportLayout } from './RankingExport';

type ExportDownloadMenuProps = {
  recommended: ExportLayout;
  busy: boolean;
  onPick: (layout: ExportLayout) => void;
};

export const ExportDownloadMenu = ({
  recommended,
  busy,
  onPick,
}: ExportDownloadMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-busy={busy}
        aria-expanded={open}
        className="px-3 py-2 text-sm text-white bg-white/10 rounded hover:bg-white/20 flex items-center transition-colors disabled:opacity-80 disabled:cursor-wait"
      >
        {busy ? (
          <Loader2
            size={16}
            className="mr-1.5 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Download size={16} className="mr-1" />
        )}
        <span>{busy ? 'Preparing…' : 'Download'}</span>
        {!busy && <ChevronDown size={14} className="ml-1 opacity-60" />}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Image layout"
          className="absolute right-0 top-full mt-1.5 z-40 w-64 rounded-xl bg-[#202020] border border-white/15 shadow-2xl p-1.5"
        >
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-white/35">
            Download image as
          </p>
          {EXPORT_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              onClick={() => {
                setOpen(false);
                onPick(layout.id);
              }}
              className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/[0.07]"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                {layout.label}
                {layout.id === recommended && (
                  <span className="px-1.5 rounded bg-white/15 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                    Best fit
                  </span>
                )}
              </span>
              <span className="block text-xs text-white/40">{layout.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
