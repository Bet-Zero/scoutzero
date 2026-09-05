/** Extract canonical RAW RESPONSE HTML without evaluating scripts or retrieving links. */
import { load } from 'cheerio/slim';
import { parse } from 'parse5';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { isTag, type AnyNode, type Element } from 'domhandler';
import type { PstSourcePageCapture } from '@/schemas/pstSourceRelease';
import {
  PstObservedPageZ,
  type PstEvidenceNode,
  type PstEvidenceSpan,
  type PstObservedCell,
  type PstObservedPage,
} from '@/schemas/pstLifecycle';
import { PST_TEAMS } from '../../../team-scrape/draft-picks/scripts/pst/pst_team_slugs';
import { createHash } from 'node:crypto';

const teamNames = new Map(
  PST_TEAMS.map((team) => [team.slug.toLowerCase(), team.code])
);
/** Whitespace normalization for interpretation only; observation text remains exact. */
export const normalizedText = (text: string): string =>
  text.replace(/\s+/gu, ' ').trim();

/** Map an explicit PST team label, never a default/current legacy owner. */
export function teamCode(text: string): string | null {
  return teamNames.get(normalizedText(text).toLowerCase()) ?? null;
}

/** Preserve the parse tree, source ranges and physical cells before interpreting terms. */
export function observePstPage(
  html: string,
  page: PstSourcePageCapture
): PstObservedPage {
  if (page.classification !== 'canonical-required')
    throw new Error('Repeats are stability evidence only');
  if (
    createHash('sha256').update(html).digest('hex') !== page.rawResponse.sha256
  )
    throw new Error('Raw page hash mismatch');
  // Use only Cheerio's query layer; its default entry point also imports
  // network loaders. Parse5 supplies browser-compatible source locations.
  const $ = load(
    parse(html, { treeAdapter: adapter, sourceCodeLocationInfo: true })
  );
  const nodes: PstEvidenceNode[] = [];
  const ids = new Map<AnyNode, string>();
  const spans = new Map<AnyNode, PstEvidenceSpan | null>();
  function visit(node: AnyNode, id: string, parentId: string | null): void {
    ids.set(node, id);
    const loc = (
      node as AnyNode & {
        sourceCodeLocation?: { startOffset: number; endOffset: number };
      }
    ).sourceCodeLocation;
    const span = loc
      ? {
          start: loc.startOffset,
          end: loc.endOffset,
          byteStart: Buffer.byteLength(html.slice(0, loc.startOffset)),
          byteEnd: Buffer.byteLength(html.slice(0, loc.endOffset)),
        }
      : null;
    spans.set(node, span);
    const children = 'children' in node ? node.children : [];
    nodes.push({
      id,
      parentId,
      children: children.map((_, index) => `${id}/${index}`),
      type: node.type,
      tag: isTag(node) ? node.name : null,
      attributes: isTag(node) ? { ...node.attribs } : {},
      data: 'data' in node ? node.data : null,
      span,
    });
    children.forEach((child, index) => visit(child, `${id}/${index}`, id));
  }
  visit($.root()[0], `${page.sourcePageId}/document`, null);
  const observed: PstObservedPage = {
    id: page.sourcePageId,
    url: page.finalUrl,
    rawPath: page.rawResponse.relativePath,
    rawSha256: page.rawResponse.sha256,
    captureStartedAt: page.captureStartedAt,
    captureCompletedAt: page.captureCompletedAt,
    pstLastUpdated: page.pstLastUpdated,
    nodes,
    tables: [],
    rows: [],
  };
  const idFor = (node: AnyNode): string => {
    const id = ids.get(node);
    if (!id) throw new Error('Unaddressed source node');
    return id;
  };
  const textFor = (node: AnyNode) => ({
    nodeId: idFor(node),
    text: $(node).text(),
    span: spans.get(node) ?? null,
  });
  function observeCell(
    cell: Element,
    id: string,
    column: number
  ): PstObservedCell {
    const display = $(cell).find('.textrightoflogo').first();
    const label = normalizedText(display.text()).split(' (')[0];
    const displayTeam =
      teamCode(label) ??
      teamCode($(cell).find('.logoleft img').first().attr('alt') ?? '');
    return {
      id,
      nodeId: idFor(cell),
      column,
      columnSpan: Number($(cell).attr('colspan') ?? 1),
      rowSpan: Number($(cell).attr('rowspan') ?? 1),
      text: $(cell).text(),
      attributes: { ...cell.attribs },
      displayTeam,
      displayText: display.text(),
      signals: $(cell)
        .find('[class]')
        .addBack('[class]')
        .add($(cell).parents('tr,table'))
        .toArray()
        .filter(
          (node) =>
            isTag(node) &&
            /condition|unsure|bodyCopyBold/i.test(node.attribs.class ?? '')
        )
        .map((node) => ({
          nodeId: idFor(node),
          classes: ($(node).attr('class') ?? '').split(/\s+/).filter(Boolean),
          text: $(node).text(),
        })),
      narratives: $(cell)
        .find('p.bodyCopySm')
        .toArray()
        .map((node) => ({
          ...textFor(node),
          highlights: $(node).find('strong,b').toArray().map(textFor),
        })),
      links: $(cell)
        .find('a[href]')
        .toArray()
        .map((node) => {
          const href = $(node).attr('href')!;
          return {
            nodeId: idFor(node),
            text: $(node).text(),
            href,
            resolvedUrl: new URL(href, page.finalUrl).href,
          };
        }),
    };
  }
  $('table').each((tableIndex, table) => {
    const tableId = `${page.sourcePageId}/t${tableIndex}`;
    const isDraft = $(table).hasClass('datatable');
    const heading = $(table).prevAll('p.headline').first().text().trim();
    const year =
      page.pageType === 'year'
        ? Number(page.sourcePageId.slice(5))
        : /^\d{4}$/.test(heading)
          ? Number(heading)
          : null;
    let round: number | null = null;
    const physicalRows = $(table)
      .find('tr')
      .toArray()
      .filter((row) => $(row).closest('table')[0] === table);
    const tableRecord = {
      id: tableId,
      nodeId: idFor(table),
      year,
      rowIds: [] as string[],
    };
    physicalRows.forEach((row, index) => {
      const id = `${tableId}/r${index}`;
      tableRecord.rowIds.push(id);
      let column = 0;
      const cells = $(row)
        .children('td,th')
        .toArray()
        .map((cell, cellIndex) => {
          const result = observeCell(cell, `${id}/c${cellIndex}`, column);
          column += result.columnSpan;
          return result;
        });
      const roundLabel = $(row)
        .find('.RoundLabel')
        .text()
        .match(/Round\s+(\d)/i);
      if (roundLabel) round = Number(roundLabel[1]);
      const original = cells.find((cell) => cell.displayTeam !== null);
      const originalIndex = original ? cells.indexOf(original) : -1;
      const isAsset =
        isDraft && year !== null && round !== null && originalIndex >= 0;
      const historical = page.sourcePageId === 'year-2026';
      const overall = historical
        ? Number(normalizedText(cells[0]?.text ?? ''))
        : NaN;
      const outcome =
        isAsset && historical && Number.isInteger(overall) && overall > 0
          ? {
              overall,
              roundPosition: normalizedText(cells[1].text),
              player: normalizedText(cells.at(-1)!.text),
              cellIds: [cells[0].id, cells[1].id, cells.at(-1)!.id],
            }
          : null;
      // PST also puts a pool allocation in the first cell. Its recipient is not
      // the original team of a new pick (e.g. the displayed most-favorable pool).
      const pooled =
        isAsset &&
        original!.narratives.length > 0 &&
        /favorable/i.test(original!.displayText);
      const transactionCells = isAsset
        ? cells.slice(
            originalIndex + (original!.narratives.length ? 0 : 1),
            outcome ? -1 : undefined
          )
        : [];
      observed.rows.push({
        id,
        nodeId: idFor(row),
        tableId,
        index,
        year,
        round,
        originalTeam: isAsset && !pooled ? original!.displayTeam : null,
        assetId:
          isAsset && !pooled
            ? `${original!.displayTeam}_${year}_${round === 1 ? '1st' : '2nd'}`
            : null,
        role: pooled
          ? 'pooled-allocation'
          : isAsset
            ? 'asset'
            : roundLabel ||
                $(row).hasClass('DraftTableLabel') ||
                /L\s+O\s+T\s+T\s+E\s+R\s+Y/.test($(row).text()) ||
                !isDraft
              ? 'header'
              : 'unresolved',
        originalCellId: isAsset ? original!.id : null,
        transactionCellIds: transactionCells.map((cell) => cell.id),
        outcome,
        cells,
      });
    });
    observed.tables.push(tableRecord);
  });
  return PstObservedPageZ.parse(observed);
}
