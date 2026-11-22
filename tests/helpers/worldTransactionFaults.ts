/** Faults stay attached to actual transaction writes/commit acknowledgements. */
import type { Firestore, Transaction } from 'firebase-admin/firestore';
export function withWorldTransactionFault(
  db: Firestore,
  worldId: string,
  fault: 'stage' | 'root-ack' | 'finish',
  code?: number
): Firestore {
  const wrapped = Object.create(db) as Firestore;
  let stages = 0,
    injected = false;
  wrapped.runTransaction = (async (
    update: (tx: Transaction) => Promise<unknown>,
    options?: never
  ) => {
    let createsRoot = false;
    const result = await db
      .runTransaction(async (tx) => {
        const proxy = new Proxy(tx, {
          get(target, key) {
            if (key === 'create')
              return (
                ref: FirebaseFirestore.DocumentReference,
                data: FirebaseFirestore.DocumentData
              ) => {
                if (ref.path === 'architect_worlds/' + worldId)
                  createsRoot = true;
                return target.create(ref, data);
              };
            if (key === 'set')
              return (
                ref: FirebaseFirestore.DocumentReference,
                data: FirebaseFirestore.DocumentData
              ) => {
                if (
                  !injected &&
                  fault === 'stage' &&
                  ref.path.startsWith(
                    'architect_worlds/' + worldId + '/teams/'
                  ) &&
                  ++stages === 11
                ) {
                  injected = true;
                  throw new Error('synthetic stage failure');
                }
                return target.set(ref, data);
              };
            if (key === 'update')
              return (
                ref: FirebaseFirestore.DocumentReference,
                data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
              ) => {
                if (
                  !injected &&
                  fault === 'finish' &&
                  ref.path ===
                    'architect_worldInitializationClaims/' + worldId &&
                  data.status === 'complete'
                ) {
                  injected = true;
                  throw new Error('synthetic status failure');
                }
                return target.update(ref, data);
              };
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        return update(proxy);
      }, options)
      .catch((error) => {
        if (code !== undefined && error.message === 'synthetic stage failure')
          Object.assign(error, { code });
        throw error;
      });
    if (!injected && fault === 'root-ack' && createsRoot) {
      injected = true;
      throw new Error('synthetic lost commit acknowledgement');
    }
    return result;
  }) as typeof db.runTransaction;
  return wrapped;
}
