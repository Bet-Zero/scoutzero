/** Official Firestore paged RPCs include missing intermediates without loading document fields. */
import { v1 } from 'firebase-admin/firestore';
import { grpc } from 'google-gax';
import type { WorldTreePager } from '../functions/src/architect/worldLifecycle';

export function createWorldTreePager(
  projectId: string,
  emulator?: string,
  credentials?: { client_email: string; private_key: string }
): WorldTreePager {
  if (
    !/^[a-z0-9-]+$/.test(projectId) ||
    (emulator && !/^127\.0\.0\.1:\d+$/.test(emulator))
  )
    throw new Error('Invalid world tree environment');
  const resource = `projects/${projectId}/databases/(default)/documents/`;
  const client = new v1.FirestoreClient(
    emulator
      ? {
          apiEndpoint: '127.0.0.1',
          port: Number(emulator.split(':')[1]),
          sslCreds: grpc.credentials.createInsecure(),
        }
      : { projectId, credentials }
  ); // Hosted traversal uses the same identity as Admin Firestore and normal TLS.
  const options = {
    autoPaginate: false,
    timeout: 10000,
    retry: null,
    ...(emulator
      ? { otherArgs: { headers: { authorization: 'Bearer owner' } } }
      : {}),
  };
  const pager: WorldTreePager = async (parent, collectionId, pageToken) => {
    if (
      !/^architect_worlds\/[A-Za-z0-9_-]{1,128}(\/[^/]+\/[^/]+)*$/.test(
        parent
      ) ||
      collectionId?.includes('/')
    )
      throw new Error('World-only listing required');
    const request = {
      parent: resource + parent,
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    };
    if (collectionId) {
      const [documents, , response] = await client.listDocuments(
        {
          ...request,
          collectionId,
          showMissing: true,
          mask: { fieldPaths: [] },
        },
        options
      );
      return {
        names: documents.map((doc) => {
          if (!doc.name?.startsWith(resource))
            throw new Error('Invalid world listing');
          return doc.name.slice(resource.length);
        }),
        nextPageToken: response?.nextPageToken || undefined,
      };
    }
    const [names, , response] = await client.listCollectionIds(
      request,
      options
    );
    return { names, nextPageToken: response?.nextPageToken || undefined };
  };
  pager.close = () => client.close();
  return pager;
}
