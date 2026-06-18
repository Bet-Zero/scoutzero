/**
 * Dev-flag gate for the Trade Machine's Development Tools panel (salary
 * calculator sandbox, trade receipt, entitlement health, S&T injector).
 *
 * Finished-product users never see these panels. They appear only when the
 * runtime flag is set:
 *   localStorage.setItem('hz.dev.tradeMachineDebug', 'true')
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
  return hasRuntimeDebugFlag();
}
