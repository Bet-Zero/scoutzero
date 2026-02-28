/**
 * FILE: src/features/architect/GMDashboard/components/index.js
 * PURPOSE: Public export surface for GMDashboard reusable components.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-20: Created - exports WorldSelector for Phase 2A
 *  - 2025-12-20: Added SeasonAdvanceModal for Phase 3B
 *  - 2025-12-21: Added DeleteWorldModal for Phase 4A
 *  - 2026-01-07: Added DraftPositionsInput for Phase 5
 *  - 2026-02-28: Added CapAuditDebugPanel for cap auditability debugging (E4)
 *
 * LINKS:
 *  - WorldSelector: ./WorldSelector.jsx
 *  - SeasonAdvanceModal: ./SeasonAdvanceModal.jsx
 *  - DeleteWorldModal: ./DeleteWorldModal.jsx
 *  - DraftPositionsInput: ./DraftPositionsInput.jsx
 *  - CapAuditDebugPanel: ./CapAuditDebugPanel.tsx
 */

export { WorldSelector } from './WorldSelector';
export { SeasonAdvanceModal } from './SeasonAdvanceModal';
export { DeleteWorldModal } from './DeleteWorldModal';
export { DraftPositionsInput } from './DraftPositionsInput';
export {
  CapAuditDebugPanel,
  ARCHITECT_DEBUG_FLAG_STORAGE_KEY,
  isCapAuditDebugEnabled,
} from './CapAuditDebugPanel';
