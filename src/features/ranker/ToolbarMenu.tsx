/**
 * FILE: src/features/ranker/ToolbarMenu.tsx
 * PURPOSE: Button plus dropdown panel for the ranker workbench toolbar (closes on outside click and Escape)
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created for the pool workbench layout
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolSourceMenus.tsx
 */
import React, { useEffect, useRef, useState } from 'react';
import { toolbarButtonClass } from './RankerPanel';

type ToolbarMenuProps = {
  label: React.ReactNode;
  // Accessible name for the panel
  title: string;
  // Rendered with a close callback so picking an item can close the menu
  children: (close: () => void) => React.ReactNode;
};

export const ToolbarMenu = ({ label, title, children }: ToolbarMenuProps) => {
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
        aria-expanded={open}
        aria-haspopup="dialog"
        className={toolbarButtonClass(open)}
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className="absolute right-0 top-full mt-1.5 z-40 w-[340px] max-w-[calc(100vw-2rem)] max-h-[380px] overflow-y-auto rounded-xl bg-[#202020] border border-white/15 shadow-2xl p-2.5"
        >
          <p className="px-1 pt-0.5 pb-2 text-[10px] font-semibold tracking-[0.1em] uppercase text-white/35">
            {title}
          </p>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};
