/** Byte proof only. Never evaluates scripts, fetches URLs or certifies draft facts. */
import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';

export const VERIFIER_VERSION = 'bze307-official-html-v1';
export const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');

type Node = DefaultTreeAdapterMap['node'];
type Span = { start: number; end: number; locator: string };
type ElementSpan = Span & { tag: string; parent: string; raw: string };
type Difference = { kind: string; left: Span; right: Span };

/** Parsing supplies element identity and offsets; original bytes supply all comparisons. */
function elements(bytes: Buffer): ElementSpan[] {
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!Buffer.from(html).equals(bytes))
    throw new Error('Non-roundtrippable UTF-8');
  const result: ElementSpan[] = [];
  const visit = (node: Node): void => {
    if ('tagName' in node && node.sourceCodeLocation) {
      const loc = node.sourceCodeLocation;
      const parent =
        node.parentNode && 'tagName' in node.parentNode
          ? node.parentNode.tagName
          : '';
      const start = Buffer.byteLength(html.slice(0, loc.startOffset));
      const end = Buffer.byteLength(html.slice(0, loc.endOffset));
      result.push({
        tag: node.tagName,
        parent,
        start,
        end,
        locator: `${parent}/${node.tagName}@bytes[${start},${end})`,
        raw: html.slice(loc.startOffset, loc.endOffset),
      });
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
    // Template contents cannot become eligible direct head/body elements.
    if ('content' in node) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return result;
}

/** Parsed element identity for evidence locators; labels are never accepted on trust. */
export function elementLocations(bytes: Buffer): Span[] {
  return elements(bytes).map(({ start, end, locator }) => ({
    start,
    end,
    locator,
  }));
}

// Only two integer values in this entire literal configuration grammar are eligible.
// Identifiers and every other character remain part of the protected byte comparison.
const MONITOR =
  /^<script type="text\/javascript">window\.NREUM\|\|\(NREUM=\{\}\);NREUM\.info=\{"beacon":"bam\.nr-data\.net","licenseKey":"[a-f0-9]{10}","applicationID":"[0-9]+","transactionName":"[A-Za-z0-9+/=]+","queueTime":([0-9]+),"applicationTime":([0-9]+),"atts":"[A-Za-z0-9+/=]+","errorBeacon":"bam\.nr-data\.net","agent":""\}<\/script>$/;

function timingSpans(nodes: ElementSpan[]): Span[] {
  const matches = nodes.filter(
    (n) => n.tag === 'script' && n.parent === 'body' && MONITOR.test(n.raw)
  );
  if (matches.length !== 1)
    throw new Error('Expected one exact monitoring configuration');
  const node = matches[0];
  return ['queueTime', 'applicationTime'].map((key) => {
    const value = new RegExp(`"${key}":([0-9]+)`).exec(node.raw);
    if (!value) throw new Error('Missing monitoring integer');
    const start = node.start + value.index + key.length + 3;
    return {
      start,
      end: start + value[1].length,
      locator: `${node.locator}/NREUM.info.${key}`,
    };
  });
}

const INITIALIZER = /^<script >bazadebezolkohpepadr="[0-9]{1,10}"<\/script>$/;
const LOADER =
  /^<script type="text\/javascript" src="https:\/\/www\.nba\.com\/akam\/13\/([a-f0-9]{8})"  defer><\/script>$/;
const PIXEL =
  /^<noscript><img src="https:\/\/www\.nba\.com\/akam\/13\/pixel_([a-f0-9]{8})\?a=([A-Za-z0-9+/]+={0,2})" style="visibility: hidden; position: absolute; left: -999px; top: -999px;" \/><\/noscript>$/;

function securitySpans(nodes: ElementSpan[]): Span[] {
  const initializers = nodes.filter(
    (n) => n.tag === 'script' && n.parent === 'head' && INITIALIZER.test(n.raw)
  );
  const loaders = nodes.filter(
    (n) => n.tag === 'script' && n.parent === 'head' && LOADER.test(n.raw)
  );
  const pixels = nodes.filter(
    (n) => n.tag === 'noscript' && n.parent === 'body' && PIXEL.test(n.raw)
  );
  if (!initializers.length && !loaders.length && !pixels.length) return [];
  if (initializers.length !== 1 || loaders.length !== 1 || pixels.length !== 1)
    throw new Error('Incomplete or duplicate security markup');
  const [init] = initializers;
  const [loader] = loaders;
  const [pixel] = pixels;
  const loaderMatch = LOADER.exec(loader.raw)!;
  const pixelMatch = PIXEL.exec(pixel.raw)!;
  const decoded = Buffer.from(pixelMatch[2], 'base64');
  if (
    init.end !== loader.start ||
    loader.end >= pixel.start ||
    loaderMatch[1] !== pixelMatch[1] ||
    decoded.toString('base64') !== pixelMatch[2] ||
    !/^t=[a-f0-9]{40}&js=off$/.test(decoded.toString('ascii')) ||
    !Buffer.from(decoded.toString('ascii'), 'ascii').equals(decoded)
  )
    throw new Error('Unrecognized security identity or payload');
  return [
    {
      start: init.start,
      end: loader.end,
      locator: `${init.locator}+${loader.locator}`,
    },
    { start: pixel.start, end: pixel.end, locator: pixel.locator },
  ];
}

/** Reject every unexplained difference; preserve the distinct original identities. */
export function compareOfficialHtml(
  left: Buffer,
  right: Buffer,
  mode: 'monitoring-timing' | 'security-presence' | 'exact-only'
) {
  const leftNodes = elements(left);
  const rightNodes = elements(right);
  const rawByteIdentical = left.equals(right);
  const differences: Difference[] = [];
  if (!rawByteIdentical && mode === 'monitoring-timing') {
    const a = timingSpans(leftNodes);
    const b = timingSpans(rightNodes);
    a.forEach((span, i) => {
      if (
        !left
          .subarray(span.start, span.end)
          .equals(right.subarray(b[i].start, b[i].end))
      )
        differences.push({
          kind: 'monitoring-integer',
          left: span,
          right: b[i],
        });
    });
  } else if (!rawByteIdentical && mode === 'security-presence') {
    const a = securitySpans(leftNodes);
    const b = securitySpans(rightNodes);
    if (
      !(
        (a.length === 2 && b.length === 0) ||
        (a.length === 0 && b.length === 2)
      )
    )
      throw new Error(
        'Only paired security presence versus absence is allowed'
      );
    let removed = 0;
    for (const span of a.length ? a : b) {
      const position = span.start - removed;
      const empty = {
        start: position,
        end: position,
        locator: `absent@bytes[${position},${position})`,
      };
      differences.push({
        kind: 'security-presence',
        left: a.length ? span : empty,
        right: a.length ? empty : span,
      });
      removed += span.end - span.start;
    }
  }
  let a = 0;
  let b = 0;
  const equalIntervals = [];
  for (const d of [
    ...differences,
    {
      kind: 'end',
      left: { start: left.length, end: left.length, locator: 'end' },
      right: { start: right.length, end: right.length, locator: 'end' },
    },
  ]) {
    if (d.left.start < a || d.right.start < b)
      throw new Error('Overlapping or reordered exclusions');
    const x = left.subarray(a, d.left.start);
    const y = right.subarray(b, d.right.start);
    if (!x.equals(y))
      throw new Error('Unexplained or substantive byte difference');
    equalIntervals.push({
      left: [a, d.left.start],
      right: [b, d.right.start],
      byteSize: x.length,
      sha256: sha256(x),
    });
    a = d.left.end;
    b = d.right.end;
  }
  if (!rawByteIdentical && !differences.length)
    throw new Error('Unequal originals without an allowed explanation');
  return {
    verifierVersion: VERIFIER_VERSION,
    rawByteIdentical,
    byteRule: rawByteIdentical ? 'whole-response-equality' : mode,
    originals: [left, right].map((bytes) => ({
      sha256: sha256(bytes),
      byteSize: bytes.length,
    })),
    protectedIntervalsByteIdentical: true,
    differences: differences.map((d) => ({
      kind: d.kind,
      left: {
        ...d.left,
        sha256: sha256(left.subarray(d.left.start, d.left.end)),
      },
      right: {
        ...d.right,
        sha256: sha256(right.subarray(d.right.start, d.right.end)),
      },
    })),
    equalIntervals,
    factAcceptance: false,
    requirementSatisfaction: false,
    runtimeAuthority: false,
  };
}
