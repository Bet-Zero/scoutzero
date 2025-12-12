/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectModals.ts
 * PURPOSE: Centralized modal state management hook for GMDashboard - manages all modal visibility and context.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted modal state from useArchitectState.ts (Phase 4 refactor)
 *
 * LINKS:
 *  - Plan: plans/extract_modal_state_hook_a4e2c416.plan.md
 */
import { useState, useCallback } from 'react';

// ==== Type Definitions ====

/** Action context for contract modal */
export type ActionContext = 'option' | 'freeAgent' | null;

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
  showSaveModal: boolean;
  showContractModal: boolean;

  // Modal state values
  newPlanName: string;
  initialAction: string | null;
  targetYear: number | null;
  actionContext: ActionContext;

  // Setters for UI bindings (e.g., input onChange)
  setNewPlanName: React.Dispatch<React.SetStateAction<string>>;

  // Open/close helpers (useCallback-wrapped)
  openSaveModal: () => void;
  closeSaveModal: () => void;
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
 * - Save plan modal (showSaveModal)
 * - Contract/player modal (showContractModal)
 *
 * @returns All modal state values, setters, and open/close helpers
 */
export function useArchitectModals(): UseArchitectModalsReturn {
  // === Modal visibility state ===
  const [showOffseasonModal, setShowOffseasonModal] = useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showContractModal, setShowContractModal] = useState<boolean>(false);

  // === Save modal state ===
  const [newPlanName, setNewPlanName] = useState<string>('');

  // === Contract modal context state ===
  const [initialAction, setInitialAction] = useState<string | null>(null);
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [actionContext, setActionContext] = useState<ActionContext>(null);

  // === Offseason Modal Helpers ===

  /**
   * Open the offseason summary modal
   */
  const openOffseasonModal = useCallback((): void => {
    setShowModal(true);
  }, []);

  /**
   * Close the offseason summary modal
   */
  const closeOffseasonModal = useCallback((): void => {
    setShowModal(false);
  }, []);

  // === Save Modal Helpers ===

  /**
   * Open the save plan modal
   */
  const openSaveModal = useCallback((): void => {
    setShowSaveModal(true);
  }, []);

  /**
   * Close the save plan modal
   */
  const closeSaveModal = useCallback((): void => {
    setShowSaveModal(false);
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
    showSaveModal,
    showContractModal,

    // Modal state values
    newPlanName,
    initialAction,
    targetYear,
    actionContext,

    // Setters for UI bindings
    setNewPlanName,

    // Open/close helpers
    openSaveModal,
    closeSaveModal,
    openContractModal,
    closeContractModal,
    openOffseasonModal,
    closeOffseasonModal,

    // Raw setters (needed for edge cases)
    setShowOffseasonModal,
  };
}
