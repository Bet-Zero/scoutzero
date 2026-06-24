/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectModals.ts
 * PURPOSE: Centralized modal state management hook for GMDashboard - manages all modal visibility and context.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted modal state from useArchitectState.ts (Phase 4 refactor)
 *  - 2025-12-25: Removed legacy plan save modal state (worlds-only cleanup)
 *
 * LINKS:
 *  - Plan: plans/extract_modal_state_hook_a4e2c416.plan.md
 */
import { useState, useCallback } from 'react';

// ==== Type Definitions ====

/** Action context for contract modal */
export type ActionContext = 'option' | 'freeAgent' | 'underContract' | null;

/** Context parameters for opening the edit-contract modal */
export interface EditModalContext {
  initialAction?: string | null;
  targetYear?: number | null;
  actionContext?: ActionContext;
}

/** Return type of the useArchitectModals hook */
export interface UseArchitectModalsReturn {
  // Modal visibility booleans
  showOffseasonModal: boolean;
  showContractModal: boolean;

  // Modal state values
  initialAction: string | null;
  targetYear: number | null;
  actionContext: ActionContext;

  // Open/close helpers (useCallback-wrapped)
  openContractModal: (context?: EditModalContext) => void;
  closeContractModal: () => void;
  openOffseasonModal: () => void;
  closeOffseasonModal: () => void;

  // Raw setters (needed for edge cases like OffseasonSection)
  setShowOffseasonModal: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Centralized modal state management hook for GMDashboard
 *
 * Manages visibility and context for:
 * - Offseason summary modal (showOffseasonModal)
 * - Contract/player modal (showContractModal)
 *
 * @returns All modal state values, setters, and open/close helpers
 */
export function useArchitectModals(): UseArchitectModalsReturn {
  // === Modal visibility state ===
  const [showOffseasonModal, setShowOffseasonModal] = useState<boolean>(false);
  const [showContractModal, setShowContractModal] = useState<boolean>(false);

  // === Contract modal context state ===
  const [initialAction, setInitialAction] = useState<string | null>(null);
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [actionContext, setActionContext] = useState<ActionContext>(null);

  // === Offseason Modal Helpers ===

  /**
   * Open the offseason summary modal
   */
  const openOffseasonModal = useCallback((): void => {
    setShowOffseasonModal(true);
  }, []);

  /**
   * Close the offseason summary modal
   */
  const closeOffseasonModal = useCallback((): void => {
    setShowOffseasonModal(false);
  }, []);

  // === Contract Modal Helpers ===

  /**
   * Open the contract modal with optional context
   * @param context - Optional context for pre-selecting action, year, or context type
   */
  const openContractModal = useCallback((context?: EditModalContext): void => {
    if (context) {
      setInitialAction(context.initialAction ?? null);
      setTargetYear(context.targetYear ?? null);
      setActionContext(context.actionContext ?? null);
    }
    setShowContractModal(true);
  }, []);

  /**
   * Close the contract modal and reset all context state
   */
  const closeContractModal = useCallback((): void => {
    setShowContractModal(false);
    setInitialAction(null);
    setTargetYear(null);
    setActionContext(null);
  }, []);

  return {
    // Modal visibility booleans
    showOffseasonModal,
    showContractModal,

    // Modal state values
    initialAction,
    targetYear,
    actionContext,

    // Open/close helpers
    openContractModal,
    closeContractModal,
    openOffseasonModal,
    closeOffseasonModal,

    // Raw setters (needed for edge cases)
    setShowOffseasonModal,
  };
}
