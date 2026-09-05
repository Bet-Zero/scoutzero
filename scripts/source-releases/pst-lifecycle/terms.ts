/** Source-language terms, scoped before interpretation. This is not a rules engine. */
import { PST_TEAMS } from '../../../team-scrape/draft-picks/scripts/pst/pst_team_slugs';
import { normalizedText, teamCode } from './observe';

import type { PstTerm } from '@/schemas/pstLifecycle';
export type { PstTerm } from '@/schemas/pstLifecycle';

const teamPattern = PST_TEAMS.map((team) => team.slug).join('|');
const mentionPattern = new RegExp(`\\b(${teamPattern})\\b`, 'gi');
export const mentionedTeams = (text: string): string[] => [
  ...new Set(
    [...text.matchAll(mentionPattern)]
      .map((match) => teamCode(match[1])!)
      .filter(Boolean)
  ),
];

/** Expand only a stated year range; no page-wide search can lend a year to a term. */
export function statedYears(text: string): number[] {
  const years: number[] = [];
  for (const match of text.matchAll(/\b(20\d{2})(?:-(\d{2}|20\d{2}))?\b/g)) {
    const first = Number(match[1]);
    const last = match[2]
      ? Number(match[2].length === 2 ? `20${match[2]}` : match[2])
      : first;
    if (last < first || last - first > 15) continue;
    for (let year = first; year <= last; year++) years.push(year);
  }
  return [...new Set(years)].sort((a, b) => a - b);
}

function groups(
  text: string,
  start = 0
): { children: PstTerm[]; balanced: boolean } {
  const children: PstTerm[] = [];
  let depth = 0;
  let opening = -1;
  let balanced = true;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '(') {
      if (depth++ === 0) opening = index;
    } else if (text[index] === ')') {
      if (depth === 0) {
        balanced = false;
        continue;
      }
      if (--depth === 0)
        children.push(
          parseTerm(text.slice(opening + 1, index), start + opening + 1)
        );
    }
  }
  if (depth > 0) {
    balanced = false;
    children.push(parseTerm(text.slice(opening + 1), start + opening + 1));
  }
  return { children, balanced };
}

/** A source-scoped expression tree retains nested guards and ordered alternatives. */
export function parseTerm(text: string, start = 0): PstTerm {
  const nested = groups(text, start);
  const local = text.split('');
  for (const child of nested.children) {
    const left = Math.max(0, child.start - start - 1);
    const right = Math.min(text.length, child.end - start + 1);
    for (let index = left; index < right; index++) local[index] = ' ';
  }
  const surface = normalizedText(local.join(''));
  const node: PstTerm = {
    kind: 'context',
    text,
    start,
    end: start + text.length,
    parameters: { balanced: nested.balanced },
    children: nested.children,
  };
  for (const child of node.children) {
    const before = text.slice(0, child.start - start - 1);
    const subject = new RegExp(`(${teamPattern})(?: pick)?\\s*$`, 'i').exec(
      before
    );
    if (subject) child.parameters.subjectTeam = teamCode(subject[1]);
  }
  const localSemicolon = local.join('').indexOf(';');
  if (localSemicolon >= 0) {
    node.kind = 'group';
    node.parameters.operator = 'joint-governing-terms';
    node.children = [
      parseTerm(text.slice(0, localSemicolon), start),
      parseTerm(text.slice(localSemicolon + 1), start + localSemicolon + 1),
    ];
    return node;
  }
  const commas = [...local.join('').matchAll(/,/g)].map(
    (match) => match.index!
  );
  const cuts = [0, ...commas.map((index) => index + 1), text.length + 1];
  const pieces = cuts.slice(0, -1).map((cut, index) => ({
    start: cut,
    text: text.slice(cut, cuts[index + 1] - 1),
  }));
  if (
    !/\belse\b/i.test(surface) &&
    pieces.length > 1 &&
    pieces.every((piece) => /(?:first|second) round|\bcash\b/i.test(piece.text))
  ) {
    node.kind = 'group';
    node.parameters.operator = 'joint-asset-terms';
    node.children = pieces.map((piece) =>
      parseTerm(piece.text, start + piece.start)
    );
    return node;
  }
  // Separators remain ordered. A conditional fallback is distinct from an
  // unresolved source assertion; this preserves every explicit else branch.
  const fallback = /\belse\b/i.exec(surface);
  if (fallback) {
    const offset = local.join('').search(/\belse\b/i);
    node.kind = 'alternative';
    node.parameters.operator = 'if-conveys-otherwise';
    node.children = [
      parseTerm(text.slice(0, offset), start),
      parseTerm(text.slice(offset + 4), start + offset + 4),
    ];
    node.children[1].parameters.branchRole = 'fallback';
    const explicitIf = text
      .slice(0, offset)
      .match(
        new RegExp(
          `if (${teamPattern}) pick is transferred to (${teamPattern})`,
          'i'
        )
      );
    if (explicitIf) {
      node.parameters.operator = 'if-explicit-transfer-otherwise';
      node.parameters.whenTransferFrom = teamCode(explicitIf[1]);
      node.parameters.whenTransferTo = teamCode(explicitIf[2]);
    }
    return node;
  }
  const swap = new RegExp(
    `^\\s*(${teamPattern})\\s+(?:option|have option|has option) to swap`,
    'i'
  ).exec(surface);
  if (swap) {
    node.kind = 'swap';
    node.parameters.controller = teamCode(swap[1]);
    node.parameters.years = statedYears(surface);
    node.parameters.participants = mentionedTeams(text);
    const counterparty = new RegExp(`\\bwith (${teamPattern})`, 'i').exec(
      surface
    );
    node.parameters.counterparty = counterparty
      ? teamCode(counterparty[1])
      : null;
    node.parameters.exercise = /not exercised/i.test(text)
      ? 'not-exercised'
      : /relinquished/i.test(text)
        ? 'relinquished'
        : 'outcome-not-stated';
  } else if (/at least \d+ years after/i.test(surface)) {
    node.kind = 'dependency';
    node.parameters.minimumYearsAfter = Number(
      surface.match(/at least (\d+) years after/i)![1]
    );
    node.parameters.teams = mentionedTeams(surface);
    node.parameters.trigger = /receive/i.test(surface)
      ? 'prior-receipt'
      : 'prior-conveyance';
    node.parameters.priorObligationIdentity = 'requires-linked-history';
  } else if (/\b(?:most|least|more|less)[ -]favorable\b/i.test(surface)) {
    node.kind = 'selection';
    node.parameters.order = /\b(?:least|less)[ -]favorable\b/i.test(surface)
      ? 'least-favorable-first'
      : 'most-favorable-first';
    node.parameters.rank = /second[ -](?:most|least)/i.test(surface) ? 2 : 1;
    node.parameters.members = mentionedTeams(surface);
    node.parameters.tieRule = 'not-stated';
    // Bind a nested protection to the immediately preceding named participant,
    // never every pick in a selection pool.
    for (const child of node.children) {
      const before = text.slice(0, child.start - start - 1);
      const subject = new RegExp(`(${teamPattern})(?: pick)?\\s*$`, 'i').exec(
        before
      );
      if (subject) child.parameters.subjectTeam = teamCode(subject[1]);
    }
  } else if (/\b(?:protected|unprotected|top \d+)\b/i.test(surface)) {
    node.kind = 'protection';
    node.parameters.subjectTeams = mentionedTeams(surface);
    node.parameters.years = statedYears(surface);
    node.parameters.unprotected = /\bunprotected\b/i.test(surface);
    node.parameters.lottery = /lottery/i.test(surface);
    const top = [...surface.matchAll(/\btop (\d+)/gi)].map((match) =>
      Number(match[1])
    );
    node.parameters.topThresholds = top;
    node.parameters.excludedPositionRanges = [
      ...surface.matchAll(/#(\d+)-(\d+)/g),
    ].map((match) => [Number(match[1]), Number(match[2])]);
    // Explicitly pair each stated threshold with its own year phrase.
    const schedules = [
      ...surface.matchAll(
        /(?:(unprotected)|(?:protected )?top (\d+)|lottery protected)(?: in)? (20\d{2}(?:-(?:20)?\d{2})?)/gi
      ),
    ];
    if (schedules.length) {
      node.children.push(
        ...schedules.map((match) => ({
          kind: 'protection' as const,
          text: match[0],
          start: start + text.indexOf(match[0]),
          end: start + text.indexOf(match[0]) + match[0].length,
          parameters: {
            years: statedYears(match[3]),
            topThresholds: match[2] ? [Number(match[2])] : [],
            unprotected: Boolean(match[1]),
            lottery: /lottery/i.test(match[0]),
          },
          children: [],
        }))
      );
      node.parameters.scheduleMode = 'ordered-stated-year-terms';
      delete node.parameters.topThresholds;
      delete node.parameters.years;
      delete node.parameters.unprotected;
      delete node.parameters.lottery;
    }
  } else if (/relinquish|amend|subsequent trade|changed/i.test(surface)) {
    node.kind = 'relinquishment';
    node.parameters.teams = mentionedTeams(surface);
    node.parameters.controllingEvent = 'requires-linked-history';
  } else if (/option|defer|elect/i.test(surface)) {
    node.kind = 'election';
    node.parameters.parties = mentionedTeams(surface);
    node.parameters.years = statedYears(surface);
    node.parameters.window = 'not-stated';
  } else if (
    /not exercised|did not convey|not transfer|#\d+-|\?-\?/i.test(surface)
  ) {
    node.kind = 'outcome';
    node.parameters.state = /\?-\?/.test(surface)
      ? 'future-outcome-unknown'
      : /not exercised/i.test(surface)
        ? 'not-exercised'
        : /#\d+-/.test(surface)
          ? 'reported-draft-result'
          : 'did-not-convey';
  } else if (/\b(?:first|second) round|draft pick|cash/i.test(surface)) {
    node.kind = 'pick';
    node.parameters.years = statedYears(surface);
    node.parameters.round = /second round/i.test(surface)
      ? 2
      : /first round/i.test(surface)
        ? 1
        : null;
    node.parameters.teams = mentionedTeams(surface);
    node.parameters.cash = /cash/i.test(surface);
    if (/20\d{2} or 20\d{2}/.test(surface))
      node.parameters.yearRelationship = 'alternative-years';
  } else if (/\bor\b/i.test(surface)) {
    node.kind = 'alternative';
    node.parameters.operator = 'source-alternative';
    node.parameters.teams = mentionedTeams(surface);
  } else if (nested.children.length) {
    node.kind = 'group';
  }
  const ownYears = statedYears(surface);
  if (ownYears.length === 1 && /round|draft pick/i.test(surface)) {
    for (const child of node.children)
      child.parameters.contextYear = ownYears[0];
  }
  return node;
}
