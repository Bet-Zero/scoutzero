import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const endpoint = 'api/architect/draft-review.ts';
const server = 'server/draftReview.ts';
const hook = 'src/features/architect/tradeMachine/useRealDraftReview.ts';
const allowedPackages = new Set(['node:crypto', 'node:http', 'zod']);

// Deliberately narrow: inspect the endpoint's actual import closure and network
// call sites, not comments or a claimed provider configuration. The controlled
// provider tests separately assert every effective URL, identity and HTTP method.
function violations(
  entry: string,
  overrides = new Map<string, string>()
): string[] {
  const errors: string[] = [];
  const visited = new Set<string>();
  function inspect(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    const source =
      overrides.get(file) ?? readFileSync(path.join(root, file), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const name = node.moduleSpecifier.text;
        if (name.startsWith('.')) {
          inspect(
            path.posix.normalize(
              path.posix.join(
                path.posix.dirname(file),
                name.replace(/\.js$/, '.ts')
              )
            )
          );
        } else if (!allowedPackages.has(name))
          errors.push(`${file}: unapproved dependency ${name}`);
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(ast);
        if (['require', 'import', 'eval', 'Function'].includes(callee))
          errors.push(`${file}: opaque runtime dependency`);
        if (/(?:^|\.)(?:fetch|request)$/.test(callee)) {
          const argument = node.arguments[0]?.getText(ast);
          const permitted =
            file === server &&
            callee === 'request' &&
            (argument ===
              '`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`' ||
              argument === '`https://firestore.googleapis.com/v1/${name}`');
          if (!permitted)
            errors.push(`${file}: unapproved draft-data network call`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  inspect(entry);
  return errors;
}

describe('owner-mandated Firebase draft-data architecture', () => {
  it('keeps the actual production endpoint and all its dependencies within the Firebase read boundary', () => {
    expect(violations(endpoint)).toEqual([]);
    const source = readFileSync(path.join(root, server), 'utf8');
    expect(source).not.toMatch(
      /BLOB_READ_WRITE_TOKEN|SCOUTZERO_DRAFT_REVIEW_BLOB_URL|process\.env\[/
    );
    const client = ts.createSourceFile(
      hook,
      readFileSync(path.join(root, hook), 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const requests: string[] = [];
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(client) === 'fetch'
      )
        requests.push(node.arguments[0]?.getText(client));
      ts.forEachChild(node, visit);
    }
    visit(client);
    expect(requests).toEqual(["'/api/architect/draft-review'"]);
  });
  it('would reject the previous external Blob transport and an imported provider or Linear runtime client', () => {
    for (const substitute of [
      'async function read() { return request(blobUrl, {headers: {Authorization: blobToken}}); }',
      'import { get } from "@vercel/blob"; export const read = get;',
      'async function read() { return fetch("https://api.linear.app/graphql"); }',
      'import { S3Client } from "@aws-sdk/client-s3"; export const read = S3Client;',
    ]) {
      expect(violations(endpoint, new Map([[server, substitute]]))).not.toEqual(
        []
      );
    }
  });
});
