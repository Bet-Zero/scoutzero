/**
 * Dev-flag gate for the Trade Machine's Development Tools panel (salary
 * calculator sandbox, trade receipt, entitlement health, S&T injector).
 *
 * Finished-product users never see these panels. They appear when:
 *  - running a dev build (`import.meta.env.DEV`), so the tooling stays on
 *    by day-to-day during `npm run dev` with zero extra steps; or
 *  - the runtime flag is set in any build, for inspecting a production bundle:
 *      localStorage.setItem('hz.dev.tradeMachineDebug', 'true')
 *
 * Mirrors the established `isCapAuditDebugEnabled` pattern.
 */

export const TRADE_MACHINE_DEBUG_FLAG = 'hz.dev.tradeMachineDebug';

function hasRuntimeDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(TRADE_MACHINE_DEBUG_FLAG) === 'true';
  } catch {
    return false;
  }
}

export function isTradeMachineDebugEnabled(): boolean {
  return import.meta.env.DEV || hasRuntimeDebugFlag();
}
