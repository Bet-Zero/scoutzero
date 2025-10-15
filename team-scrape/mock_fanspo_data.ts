// mock_fanspo_data.ts
// Mock Fanspo data for testing enrichment without network access
//
// This file provides sample Fanspo HTML responses for different teams
// to enable testing and development of the enrichment feature

export const MOCK_FANSPO_RESPONSES: Record<string, string> = {
  // Lakers (Team ID 14)
  'Lakers-14': `
<html>
<body>
<h1>Los Angeles Lakers - Future Draft Picks</h1>

Incoming Draft Picks
2027 1-UTA
Top 10 protected, conveys 2028-2030 if not conveyed
2030 2-WAS or ORL
No protections

Outgoing Draft Picks
2029 1-NOP
Lottery protected
2026 2-Own
2027 2-Own
Unprotected
2028 2-Own
2029 2-Own
2030 2-Own
2031 2-Own
</body>
</html>
`,

  // Celtics (Team ID 2)
  'Celtics-2': `
<html>
<body>
<h1>Boston Celtics - Future Draft Picks</h1>

Incoming Draft Picks
2026 1-Own
2027 1-Own
2028 1-Own

Outgoing Draft Picks
2029 1-PHX or MIL
Top 4 protected, otherwise 2029-2030 second round picks
2030 2-LAL
</body>
</html>
`,

  // Warriors (Team ID 9)
  'Warriors-9': `
<html>
<body>
<h1>Golden State Warriors - Future Draft Picks</h1>

Incoming Draft Picks
2026 1-Own
2027 1-POR
Top 14 protected, conveys to lottery protected 2028 if not conveyed
2029 2-ATL

Outgoing Draft Picks
2028 1-BKN
Unprotected
2026 2-Own
2030 2-Own
</body>
</html>
`,
};

// Helper to get mock response
export function getMockFanspoResponse(
  teamSlug: string,
  teamId: number
): string | null {
  const key = `${teamSlug}-${teamId}`;
  return MOCK_FANSPO_RESPONSES[key] || null;
}

// Team mapping for convenience
export const TEAM_MAPPINGS = {
  Lakers: { id: 14, slug: 'Lakers' },
  Celtics: { id: 2, slug: 'Celtics' },
  Warriors: { id: 9, slug: 'Warriors' },
  // Add more teams as needed
};
