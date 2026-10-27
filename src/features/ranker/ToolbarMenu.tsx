/**
 * FILE: src/features/ranker/ToolbarMenu.tsx
 * PURPOSE: Button plus show/hide panel for the ranker workbench toolbar, with keyboard focus handling
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-24: Created for the pool workbench layout
 *  - 2026-10-24: Disclosure pattern with focus moved in on open and back on Escape/pick (review follow-up, PR #573)
 *  - 2026-10-27: Below xl the panel opens against the toolbar (full width on phones) instead of hanging off-screen from its button
 *
 * LINKS:
 *  - Used in: src/features/ranker/PoolSourceMenus.tsx
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toolbarButtonClass } from './RankerPanel';

type ToolbarMenuProps = {
  label: React.ReactNode;
  // Accessible name for the panel
  title: string;
  // Rendered with a close callback so picking an item can close the menu
  children: (close: () => void) => React.ReactNode;
};

// Disclosure: the button shows or hides a panel of ordinary buttons. Opening
// moves focus into the panel; Escape or picking an item returns it to the
// button; clicking or tabbing away just closes it. Until the toolbar fits on
// one row (xl) the panel opens under the toolbar (which must be `relative`):
// full width on phones, at its right edge otherwise.
export const ToolbarMenu = ({ label, title, children }: ToolbarMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLElement>('button, [href], input, select')
      ?.focus();
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
      if (e.key === 'Escape') closeAndRefocus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closeAndRefocus]);

  return (
    <div
      className="xl:relative"
      ref={ref}
      onBlur={(e) => {
        // Tabbing out of the button and panel closes the menu. Only a known
        // focus target outside counts: Safari doesn't focus clicked buttons
        // (no target), and outside clicks are handled by the mousedown listener.
        if (
          open &&
          e.relatedTarget instanceof Node &&
          !ref.current?.contains(e.relatedTarget)
        ) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={toolbarButtonClass(open)}
      >
        {label}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-label={title}
          className="absolute left-0 right-0 sm:left-auto top-full mt-1.5 z-40 sm:w-[340px] max-h-[380px] overflow-y-auto rounded-xl bg-[#202020] border border-white/15 shadow-2xl p-2.5"
        >
          <p className="px-1 pt-0.5 pb-2 text-[10px] font-semibold tracking-[0.1em] uppercase text-white/35">
            {title}
          </p>
          {children(closeAndRefocus)}
        </div>
      )}
    </div>
  );
};
