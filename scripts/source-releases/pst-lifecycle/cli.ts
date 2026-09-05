/** Offline build/verify command. No fetching, publication or runtime writes. */
import { pathToFileURL } from 'node:url';
import {
  buildPstCandidate,
  verifyPstCandidate,
  writePstCandidate,
} from './candidate';

export async function runPstLifecycleCli(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  if (!['build', 'verify'].includes(command))
    throw new Error('Use build or verify');
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    if (
      ![
        '--release',
        '--evidence',
        '--archive',
        '--legacy',
        '--out',
        '--candidate',
        '--reverse-enumeration',
      ].includes(rest[index]) ||
      values.has(rest[index]) ||
      !rest[index + 1]
    )
      throw new Error(`Invalid or duplicate argument: ${rest[index]}`);
    values.set(rest[index], rest[index + 1]);
  }
  function required(name: string): string {
    const value = values.get(name);
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  }
  const files = await buildPstCandidate({
    releasePath: required('--release'),
    evidenceDirectory: required('--evidence'),
    archivePath: required('--archive'),
    legacyPath: required('--legacy'),
    reverseEnumeration: values.get('--reverse-enumeration') === 'true',
  });
  if (command === 'build') await writePstCandidate(files, required('--out'));
  else await verifyPstCandidate(files, required('--candidate'));
  const manifest = JSON.parse(String(files.get('manifest.json')));
  const coverage = JSON.parse(String(files.get('coverage.json')));
  console.log(
    JSON.stringify(
      {
        command,
        derivedDigestSha256: manifest.derivedDigestSha256,
        sourceReleaseDigest: manifest.sourceVerification.releaseDigestSha256,
        counts: coverage.counts,
        comparisonByKind: coverage.comparisonByKind,
        files: files.size,
        result: 'PASS',
        positivePathAuthority: 'unavailable',
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runPstLifecycleCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
