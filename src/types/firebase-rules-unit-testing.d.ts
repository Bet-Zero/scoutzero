declare module '@firebase/rules-unit-testing' {
  import type { Firestore } from 'firebase/firestore';

  export type RulesTestContext = {
    firestore(): Firestore;
  };

  export type RulesTestEnvironment = {
    authenticatedContext(
      uid: string,
      tokenOptions?: Record<string, unknown>
    ): RulesTestContext;
    withSecurityRulesDisabled<T>(
      callback: (context: RulesTestContext) => Promise<T>
    ): Promise<T>;
    clearFirestore(): Promise<void>;
    cleanup(): Promise<void>;
  };

  export function initializeTestEnvironment(config: {
    projectId: string;
    firestore: {
      host: string;
      port: number;
      rules: string;
    };
  }): Promise<RulesTestEnvironment>;

  export function assertSucceeds<T>(promise: Promise<T>): Promise<T>;
  export function assertFails<T = unknown>(
    promise: Promise<T>
  ): Promise<unknown>;
}
