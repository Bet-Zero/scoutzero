/**
 * FILE: src/features/architect/GMDashboard/hooks/optimisticMutationLock.ts
 * PURPOSE: Serialize world optimistic cap mutations with a deterministic scope lock.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

const optimisticLockScopes = new Set<string>();

export function acquireOptimisticLock(scopeKey: string): boolean {
  if (!scopeKey) return false;
  if (optimisticLockScopes.has(scopeKey)) {
    return false;
  }

  optimisticLockScopes.add(scopeKey);
  return true;
}

export function releaseOptimisticLock(scopeKey: string): void {
  if (!scopeKey) return;
  optimisticLockScopes.delete(scopeKey);
}

export function isOptimisticLockHeld(scopeKey: string): boolean {
  if (!scopeKey) return false;
  return optimisticLockScopes.has(scopeKey);
}

export function resetOptimisticLocksForTests(): void {
  optimisticLockScopes.clear();
}
