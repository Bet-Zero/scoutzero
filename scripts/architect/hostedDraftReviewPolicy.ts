import type { Route } from 'playwright';

/** The hosted proof may read the existing preview; it cannot write app data. */
export function hostedPreviewOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !/^scoutzero-[a-z0-9]+-brents-projects-686e97fc\.vercel\.app$/.test(
      url.hostname
    )
  )
    throw new Error('UNRECOGNIZED_PREVIEW');
  return url.origin;
}

export function hostedRequestPolicy(
  url: string,
  method: string,
  origin: string
) {
  const target = new URL(url);
  const read = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (target.origin === origin) return read ? 'preview' : 'deny';
  if (target.hostname === 'firestore.googleapis.com') {
    if (/\/Write\/|:(commit|batchWrite)(?:$|\?)/i.test(target.pathname))
      return 'deny';
    return read ||
      (method === 'POST' &&
        /\/Listen\/channel$|:(batchGet|runQuery)$/.test(target.pathname))
      ? 'read'
      : 'deny';
  }
  if (target.hostname === 'identitytoolkit.googleapis.com') {
    return method === 'POST' &&
      /^\/v1\/accounts:(signUp|lookup|delete)$/.test(target.pathname)
      ? 'auth'
      : 'deny';
  }
  if (target.hostname === 'securetoken.googleapis.com')
    return method === 'POST' && target.pathname === '/v1/token'
      ? 'auth'
      : 'deny';
  // Static assets only. No Functions, source writes, saved worlds or other APIs.
  return read &&
    ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(target.hostname)
    ? 'read'
    : 'deny';
}

export function originScopedHeaders(
  url: string,
  headers: Record<string, string>,
  origin: string,
  token: string
) {
  const result = Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) =>
        !/^x-vercel-(trusted-oidc-idp-token|protection-bypass)$/i.test(key)
    )
  );
  if (new URL(url).origin === origin)
    result['x-vercel-trusted-oidc-idp-token'] = token;
  return result;
}

export async function continueHostedRequest(
  route: Route,
  origin: string,
  token: string
) {
  const request = route.request();
  const headers = originScopedHeaders(
    request.url(),
    request.headers(),
    origin,
    token
  );
  if (new URL(request.url()).origin === origin) {
    // Never forward a credential through an HTTP redirect. Let the browser
    // create a fresh routed request, where the destination is checked again.
    const response = await route.fetch({ headers, maxRedirects: 0 });
    await route.fulfill({ response });
  } else await route.continue({ headers });
}
