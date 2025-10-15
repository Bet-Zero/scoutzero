# Quick Reference: Team Data Fetch Commands

## TL;DR - Just Use These

### Get Roster (Fast, Reliable)
```bash
TEAM_CODE="LAL" npm run fetch:api
```
Output: `team_nba_api.json` with roster from NBA.com

### Get Cap Data (Simple, Works)
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch:simple
TEAM_CODE="LAL" npm run parse
```
Output: `team.json` with roster, cap holds, exceptions

### Complete Data (Slow, May Timeout)
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
TEAM_CODE="LAL" npm run parse
```
Output: `team.json` with everything (if it works)

---

## All Available Commands

| Command | Speed | What You Get | Reliability |
|---------|-------|--------------|-------------|
| `npm run fetch:api` | ⚡ 2-3s | Roster only | ★★★★★ |
| `npm run fetch:simple` | ⚡ 2-5s | Roster + basic cap | ★★★★☆ |
| `npm run fetch` | 🐌 30-60s | Everything | ★☆☆☆☆ |

---

## Team Codes Reference

**For `fetch:api` (TEAM_CODE):**
```
ATL BOS BKN CHA CHI CLE DAL DEN DET GSW
HOU IND LAC LAL MEM MIA MIL MIN NOP NYK
OKC ORL PHI PHX POR SAC SAS TOR UTA WAS
```

**For `fetch:simple` and `fetch` (TEAM_URL):**
```
https://www.salaryswish.com/teams/hawks
https://www.salaryswish.com/teams/celtics
https://www.salaryswish.com/teams/lakers
... etc (use team name in lowercase)
```

---

## Common Scenarios

### "I just want the roster"
```bash
TEAM_CODE="LAL" npm run fetch:api
```

### "I need cap space and exceptions"
```bash
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch:simple
TEAM_CODE="LAL" npm run parse
```

### "I need EVERYTHING including draft picks"
```bash
# Cross your fingers 🤞
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch
FANSPO_ENRICH=1 TEAM_SLUG="Lakers" TEAM_ID=14 TEAM_CODE="LAL" npm run parse
```

### "Playwright keeps timing out!"
```bash
# Use the simple method instead
TEAM_URL="https://www.salaryswish.com/teams/lakers" npm run fetch:simple
TEAM_CODE="LAL" npm run parse
```

---

## Troubleshooting

**"Request timed out"**
→ Use `fetch:simple` or `fetch:api` instead

**"Network error"**  
→ Check internet connection, try `fetch:api`

**"Draft picks missing"**
→ Simple fetch doesn't get dynamic content
→ Either use `fetch` (Playwright) or manually add

**"Playwright not installed"**
→ Skip it! Use `fetch:simple` or `fetch:api`

---

## Output Files

- `page.html` - Raw HTML from fetch (simple or Playwright)
- `team.json` - Parsed team data (from `parse` command)
- `team_nba_api.json` - Roster from NBA.com API

---

## Full Documentation

📚 See these files for more details:
- `ALTERNATIVE_FETCH_METHODS.md` - Complete comparison and guide
- `FIX_SUMMARY_ALTERNATIVES.md` - What changed and why
- `README.md` - Original documentation

---

**Bottom line:** Stop using Playwright. Use `fetch:api` for roster or `fetch:simple` for cap data.
