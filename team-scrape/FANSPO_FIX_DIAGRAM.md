# Fanspo Scraper Fix - Technical Flow Diagram

## Problem: "0 picks enriched"

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE (BROKEN) ❌                           │
└─────────────────────────────────────────────────────────────────┘

1. HTTP Request (using `got`)
   ┌──────────────┐
   │ ScoutZero    │
   │ Scraper      │──── HTTP GET ────>  https://fanspo.com/...
   └──────────────┘

2. Server Response
                        <──── HTML ──────  ┌─────────────────┐
                                            │ Fanspo Server   │
                                            │ Returns:        │
                                            │ React Shell     │
                                            │ (empty HTML)    │
                                            └─────────────────┘

3. HTML Content Received
   ┌──────────────────────────────────────┐
   │ <html>                               │
   │   <div id="root"></div>              │ <- Empty React container
   │   <script src="bundle.js"></script>  │ <- JavaScript (not executed)
   │ </html>                              │
   └──────────────────────────────────────┘

4. Parse HTML
   ┌──────────────┐
   │ Cheerio      │
   │ Parser       │──> Search for "Incoming Draft Picks"
   └──────────────┘
                  └──> NOT FOUND (data never loaded)

5. Result
   ┌──────────────────────────────────┐
   │  0 picks found                   │
   │  ❌ "0 picks enriched"           │
   └──────────────────────────────────┘
```

## Solution: Use Playwright

```
┌─────────────────────────────────────────────────────────────────┐
│                     AFTER (FIXED) ✅                            │
└─────────────────────────────────────────────────────────────────┘

1. Launch Browser (using Playwright)
   ┌──────────────┐
   │ ScoutZero    │
   │ Scraper      │──── Launch ────>  ┌─────────────────┐
   └──────────────┘                    │ Chromium        │
                                       │ (Headless)      │
                                       └─────────────────┘

2. Navigate to Page
                        <──── Navigate ──  https://fanspo.com/...
                        
3. Server Sends React Shell
                        <──── HTML ────────  ┌─────────────────┐
                                             │ Fanspo Server   │
                                             │ Returns:        │
                                             │ React Shell     │
                                             └─────────────────┘

4. Browser Executes JavaScript
   ┌─────────────────┐
   │ Chromium        │
   │ - Parse HTML    │
   │ - Load bundle.js │ <- Execute JavaScript
   │ - React init    │ <- React app starts
   │ - API calls     │ <- Fetch draft picks data
   │ - DOM update    │ <- Render picks to DOM
   └─────────────────┘

5. Wait for Content to Load
   ┌──────────────┐
   │ Playwright   │
   │              │──> Wait for networkidle (JS loaded)
   │              │──> Wait for "Incoming Draft Picks" text
   └──────────────┘
                  └──> ✓ Content found!

6. Get Fully Rendered HTML
   ┌──────────────────────────────────────┐
   │ <html>                               │
   │   <div id="root">                    │
   │     <h2>Incoming Draft Picks</h2>    │ <- Rendered by React
   │     <div>2027 1-UTA</div>            │ <- Real data
   │     <div>Top 10 protected</div>      │ <- Real data
   │     ...                              │
   │   </div>                             │
   │ </html>                              │
   └──────────────────────────────────────┘

7. Parse HTML
   ┌──────────────┐
   │ Cheerio      │
   │ Parser       │──> Search for "Incoming Draft Picks"
   └──────────────┘
                  └──> FOUND! (data is in DOM)
                  
8. Extract Draft Picks
   ┌──────────────────────────────────┐
   │ Pick: 2027 Round 1 from UTA      │
   │ Protection: Top 10 protected     │
   │ Pick: 2030 Round 2 from WAS/ORL  │
   │ Protection: No protections       │
   │ ... (6 more picks)               │
   └──────────────────────────────────┘

9. Result
   ┌──────────────────────────────────┐
   │  8 picks found                   │
   │  ✅ "8 picks enriched"           │
   └──────────────────────────────────┘
```

## Key Differences

| Aspect | Before (got) | After (Playwright) |
|--------|-------------|-------------------|
| **Executes JavaScript** | ❌ No | ✅ Yes |
| **Waits for React** | ❌ No | ✅ Yes |
| **Gets Dynamic Content** | ❌ No | ✅ Yes |
| **Result** | 0 picks | 8+ picks |
| **Time** | ~1 second | ~5 seconds |
| **Works with Fanspo** | ❌ No | ✅ Yes |

## Code Comparison

### Before (Broken)
```typescript
async function fetchFanspoTeamPicks(teamSlug: string, teamId: number) {
  const url = `https://fanspo.com/nba/teams/${teamSlug}/${teamId}/draft-picks`;
  
  // ❌ Only gets empty React shell
  const html = await got(url, { timeout: { request: 20000 } }).text();
  
  const $ = cheerio.load(html);
  // Parse html... but it's empty!
}
```

### After (Fixed)
```typescript
async function fetchFanspoTeamPicks(teamSlug: string, teamId: number) {
  const url = `https://fanspo.com/nba/teams/${teamSlug}/${teamId}/draft-picks`;
  
  // ✅ Launch browser and execute JavaScript
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // ✅ Wait for JavaScript to load
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // ✅ Wait for React to render content
  await page.waitForSelector('text=/Incoming Draft Picks|Outgoing Draft Picks/i');
  
  // ✅ Get fully rendered HTML
  const html = await page.content();
  await browser.close();
  
  const $ = cheerio.load(html);
  // Parse html... it has the data!
}
```

## Summary

**The fix changes how we fetch the Fanspo page:**

- **Old way**: HTTP request → Get empty shell → Parse nothing → 0 picks ❌
- **New way**: Launch browser → Execute JS → Wait for data → Parse rendered HTML → 8 picks ✅

The core issue was that Fanspo is a **React Single Page Application (SPA)** that loads data dynamically. Simple HTTP clients like `got` cannot handle this - you need a real browser (or headless browser like Playwright) to execute JavaScript and render the React app before parsing.
