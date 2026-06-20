/**
 * FILE: src/features/architect/cockpit/PlayerActionMenu.tsx
 * PURPOSE: One reusable player-action menu for every cockpit player surface
 *          (Roster, Cap Sheet, Full Cap, pinned rail rows, receipt rows, Free
 *          Agency). Renders a surface-aware subset of the shared player-action
 *          vocabulary as primary buttons plus an overflow menu, and emits
 *          intents only — it contains NO business/mutation logic.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Interconnectivity Slice 2 foundation. GMDashboard (Slice 2b) wires the
 * intents to existing owners (pin/trade plumbing, navigation, EditContractModal);
 * the menu must never import `useArchitectActions`/`mutationPipeline`.
 *
 * `extraItems` lets a surface append source-specific, mutation-bearing
 * launchers (e.g. Full Cap's waive/extend/stretch) into the same overflow —
 * those still route to the surface's own owner, not through `onAction`.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { PlayerAction, PlayerActionContext } from './playerActionContext';

export interface PlayerActionMenuExtraItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  testId?: string;
  tone?: 'default' | 'danger';
}

export interface PlayerActionMenuProps {
  context: PlayerActionContext;
  /** Actions rendered inline as primary buttons. */
  visibleActions: PlayerAction[];
  /** Actions tucked into the overflow (⋯) menu. */
  overflowActions?: PlayerAction[];
  /** When the player is already pinned, a `pin` action renders/emits as Unpin. */
  isPinned?: boolean;
  /** Single intent sink. The menu emits the resolved action + its context. */
  onAction: (action: PlayerAction, context: PlayerActionContext) => void;
  /** Surface-specific launchers appended to the overflow (e.g. Full Cap actions). */
  extraItems?: PlayerActionMenuExtraItem[];
  /** Test-id / a11y namespace. Defaults to `player-action-menu`. */
  testIdPrefix?: string;
  size?: 'sm' | 'md';
  /** Which edge the overflow dropdown aligns to. Defaults to `right`. */
  menuAlign?: 'left' | 'right';
  className?: string;
}

const ACTION_LABELS: Record<PlayerAction, string> = {
  open: 'Open',
  pin: 'Pin',
  unpin: 'Unpin',
  trade: 'Trade',
  'view-on-roster': 'View on Roster',
  'view-on-cap': 'View on Cap Sheet',
  'view-in-full-cap': 'View in Full Cap',
  'find-in-history': 'Find in History',
  'compare-impact': 'Compare impact',
  'guide-next-move': 'Guide next move',
};

/**
 * Resolve the label + the action actually emitted. Only `pin` is dynamic:
 * when the player is already pinned it presents as Unpin and emits `unpin`.
 */
function resolveAction(
  action: PlayerAction,
  isPinned: boolean
): { label: string; emit: PlayerAction } {
  if (action === 'pin') {
    return isPinned
      ? { label: 'Unpin', emit: 'unpin' }
      : { label: 'Pin', emit: 'pin' };
  }
  return { label: ACTION_LABELS[action], emit: action };
}

export function PlayerActionMenu({
  context,
  visibleActions,
  overflowActions = [],
  isPinned = false,
  onAction,
  extraItems = [],
  testIdPrefix = 'player-action-menu',
  size = 'sm',
  menuAlign = 'right',
  className,
}: PlayerActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // `null` until positioned; rendered off-screen on the first layout pass so the
  // portaled menu can be measured before it snaps into place (no visible flash).
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const hasOverflow = overflowActions.length > 0 || extraItems.length > 0;
  const primaryTextSize = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  const emit = (action: PlayerAction) => {
    setOpen(false);
    onAction(action, context);
  };

  // M1: the overflow dropdown is portaled to <body> with fixed positioning so it
  // escapes the Full Cap Table's `overflow-auto` scroll container (which used to
  // clip it). Position is anchored to the trigger and flips above when there is
  // not enough room below.
  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuEl = menuRef.current;
      const menuHeight = menuEl?.offsetHeight ?? 0;
      const menuWidth = menuEl?.offsetWidth ?? 150;
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp =
        menuHeight > 0 &&
        spaceBelow < menuHeight + gap &&
        rect.top > spaceBelow;
      const top = openUp
        ? Math.max(gap, rect.top - menuHeight - gap)
        : rect.bottom + gap;
      const rawLeft = menuAlign === 'left' ? rect.left : rect.right - menuWidth;
      const left = Math.min(
        Math.max(gap, rawLeft),
        Math.max(gap, window.innerWidth - menuWidth - gap)
      );
      setMenuStyle({ position: 'fixed', top, left, zIndex: 50 });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, menuAlign]);

  // Close on outside pointer-down or Escape (the portaled menu can't rely on the
  // wrapper's blur containment anymore).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      className={`relative flex items-center gap-1 ${className ?? ''}`}
      data-testid={testIdPrefix}
    >
      {visibleActions.map((action) => {
        const { label, emit: emitted } = resolveAction(action, isPinned);
        return (
          <button
            key={action}
            type="button"
            onClick={() => emit(emitted)}
            className={`shrink-0 rounded border border-cockpit-edge bg-cockpit-inlay px-1.5 py-0.5 ${primaryTextSize} font-medium text-cockpit-text-secondary hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40`}
            data-testid={`${testIdPrefix}-${action}`}
            title={`${label} ${context.playerLabel}`}
          >
            {label}
          </button>
        );
      })}

      {hasOverflow ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={`More actions for ${context.playerLabel}`}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-cockpit-text-muted hover:bg-cockpit-raised hover:text-cockpit-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40`}
          data-testid={`${testIdPrefix}-overflow`}
        >
          <span aria-hidden className="text-sm leading-none">
            ⋯
          </span>
        </button>
      ) : null}

      {hasOverflow && open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              data-testid={`${testIdPrefix}-overflow-menu`}
              style={
                menuStyle ?? { position: 'fixed', top: -9999, left: -9999 }
              }
              className="min-w-[150px] overflow-hidden rounded-md border border-cockpit-edge bg-cockpit-slab py-1 shadow-xl"
            >
              {overflowActions.map((action) => {
                const { label, emit: emitted } = resolveAction(
                  action,
                  isPinned
                );
                return (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    onClick={() => emit(emitted)}
                    className="block w-full px-3 py-1.5 text-left text-[11px] text-cockpit-text-secondary hover:bg-white/10 hover:text-cockpit-text-primary"
                    data-testid={`${testIdPrefix}-overflow-${action}`}
                  >
                    {label}
                  </button>
                );
              })}

              {extraItems.length > 0 && overflowActions.length > 0 ? (
                <div className="my-1 h-px bg-cockpit-edge" />
              ) : null}

              {extraItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[11px] hover:bg-white/10 ${
                    item.tone === 'danger'
                      ? 'text-cockpit-danger hover:text-cockpit-danger'
                      : 'text-cockpit-text-secondary hover:text-cockpit-text-primary'
                  }`}
                  data-testid={
                    item.testId ?? `${testIdPrefix}-extra-${item.id}`
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
