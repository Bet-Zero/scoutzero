# PST Phase 1.1b: CDP Session Capture (Return Package)

**Date**: 2026-01-17
**Status**: COMPLETE

## Summary

Implemented **Method B (CDP Capture)** for PST session acquisition. This method is a robust fallback (and likely primary) solution for bypassing Cloudflare.

Instead of relying on Playwright to launch a browser (which Cloudflare fingerprinted and blocked), this method allows the user to:

1. Launch their own **real Google Chrome** instance with remote debugging enabled.
2. Manually solve the Cloudflare challenge.
3. Have the script "attach" to the running browser to extract the valid session cookies/state.

This state is saved to `data/pst/session/storageState.json` and is seamlessly consumed by the existing fetcher (`pst:fetch:session`).

## Files Created/Modified

### New Scripts

- `team-scrape/draft-picks/scripts/pst/pst_capture_session_cdp.ts`: The main CDP capture script.
- `team-scrape/draft-picks/scripts/pst/launch_chrome_debug_helper.ts`: Helper to print the correct Mac launch command.

### Modified

- `team-scrape/draft-picks/scripts/pst/pst_session_helpers.ts`: Updated `SessionMeta` type.
- `package.json`: Added `pst:session:chrome` and `pst:session:capture:cdp`.
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`: Updated with Phase 1.1b workflow.

## How to Run (User Flow)

### 1. Launch Chrome

Run this command to get the launch string:

```bash
npm run pst:session:chrome
```

*Copy and paste the output command into your terminal. This opens a special Chrome instance.*

### 2. Solve Cloudflare

In the newly opened Chrome window:

- Go to any **ProSportsTransactions Team Page**.
- Solve the Cloudflare challenge until you see the **real data table**.

### 3. Capture Session

Once the table is visible:

```bash
npm run pst:session:capture:cdp
```

*Press ENTER. The script will attach, verify access, and save `data/pst/session/storageState.json`.*

### 4. Verify & Use

```bash
# Test the session
npm run pst:session:test

# Fetch all pages
npm run pst:fetch:session
```

## Evidence & Verification

### Launch Helper Output

`npm run pst:session:chrome` output:

```text
🔵 TO EXTRACT PST SESSION, LAUNCH CHROME WITH THIS COMMAND:

1. Close ALL running Chrome instances first.
2. Copy and run this command:

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/Users/brenthibbitts/Desktop/ScoutZero/data/pst/session/profile"
```

### Capture Script Safety

The capture script:

- Safely connects to `localhost:9222`.
- Finds the existing PST tab or opens a new one.
- Validates the page content using `assertPstAccess`.
- **Does not force close** the user's browser (disconnects gracefully).
- Saves metadata including `method: "cdp"`.

## Next Steps

Proceed to **Phase 1-2 Execution** (Fetch -> Extract -> Validate) using the captured session.
