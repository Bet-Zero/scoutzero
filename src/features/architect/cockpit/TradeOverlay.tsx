/**
 * FILE: src/features/architect/cockpit/TradeOverlay.tsx
 * PURPOSE: Full-viewport overlay host for the Trade Machine. The Trade Machine
 *          was built for a full window; rendering it inside the cockpit
 *          Workbench (between the nav + activity rails) squeezed it, especially
 *          once additional teams were added.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Design notes:
 *  - This is a presentation shell ONLY. It owns no trade state. The Trade
 *    Machine's draft lives inside its own subtree (TradeEditor) and survives
 *    close/reopen because the caller keeps this overlay MOUNTED and merely
 *    toggles `open`. When closed we hide via `hidden` (display:none) rather
 *    than unmounting, so the in-progress draft — and scroll/sub-panel state —
 *    is exactly where the user left it on reopen.
 *  - Covers the whole cockpit (nav rail + activity rail included) via
 *    `fixed inset-0`, giving the Trade Machine the full viewport width.
 *  - z-50 sits above the cockpit chrome. Inner modals either portal to <body>
 *    (Radix Dialog, e.g. EditContractModal) or render their own fixed layer
 *    inside this subtree, so they still stack above the overlay body.
 */
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface TradeOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export const TradeOverlay = ({
  open,
  onClose,
  title = 'Trade Machine',
  children,
}: TradeOverlayProps) => {
  // Escape closes the overlay (returns to whatever room sits underneath).
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-cockpit-void text-cockpit-text-primary ${
        open ? '' : 'hidden'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-hidden={open ? undefined : true}
      data-testid="trade-overlay"
      data-open={open ? 'true' : 'false'}
    >
      {/* Slim close bar only — TradeEditor renders its own "Trade Machine"
          title below, so the overlay intentionally avoids a duplicate heading. */}
      <div className="flex h-10 shrink-0 items-center border-b border-cockpit-edge bg-cockpit-bar px-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Trade Machine"
          title="Close (Esc)"
          className="ml-auto flex shrink-0 items-center gap-2 rounded-md border border-cockpit-edge bg-cockpit-inlay px-3 py-1.5 text-xs font-medium text-cockpit-text-secondary transition-colors hover:bg-cockpit-raised hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          data-testid="trade-overlay-close"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-auto px-5 py-4"
        data-testid="trade-overlay-body"
      >
        {children}
      </div>
    </div>
  );
};
