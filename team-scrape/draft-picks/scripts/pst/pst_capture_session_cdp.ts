#!/usr/bin/env tsx
import { chromium } from 'playwright';
import { 
  assertPstAccess, 
  detectCloudflareChallenge,
  STORAGE_STATE_PATH, 
  saveSessionMeta, 
  SESSION_DIR,
  PROFILE_DIR,
  waitForEnter 
} from './pst_session_helpers.js';
import path from 'path';

const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
const TEST_URL = 'https://www.prosportstransactions.com/basketball/DraftTrades/Future/Mavericks.htm';

async function main() {
  console.log('\n🏀 PST SESSION CAPTURE (CDP METHOD) 🏀\n');
  console.log('This script connects to your running Chrome instance to capture a Cloudflare-passed session.');
  
  console.log('\n--- INSTRUCTIONS ---\n');
  console.log('1. Close ALL running instances of Google Chrome.');
  console.log('2. Run this command in a NEW terminal window:');
  console.log(`\n   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${CDP_PORT} --user-data-dir="${PROFILE_DIR}"\n`); 
  console.log('3. In the new Chrome window, navigate to a PST page (e.g. Mavericks Future Draft Trades).');
  console.log('4. Complete any Cloudflare challenges manually until you see the real table.');
  
  await waitForEnter('5. When the real table is visible, press ENTER here to connect...');

  try {
    console.log(`\nConnecting to Chrome at ${CDP_URL}...`);
    const browser = await chromium.connectOverCDP(CDP_URL);
    
    // Find the right context and page
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser contexts found. Is Chrome running?');
    }

    const context = contexts[0]; // Usually the default context
    const pages = context.pages();
    
    let targetPage = pages.find(p => p.url().includes('prosportstransactions.com'));

    if (!targetPage) {
        console.log('No existing PST tab found. Opening a new tab to test URL...');
        targetPage = await context.newPage();
        await targetPage.goto(TEST_URL);
    } else {
        console.log(`Found existing PST tab: ${targetPage.url()}`);
        targetPage.bringToFront();
    }

    console.log('Verifying access...');
    
    try {
        await assertPstAccess(targetPage);
        console.log('✅ Access Verified! Page content looks good.');
        
        console.log(`Saving storage state to: ${STORAGE_STATE_PATH}`);
        await context.storageState({ path: STORAGE_STATE_PATH });
        
        await saveSessionMeta({
            capturedAt: new Date().toISOString(),
            testedUrl: targetPage.url(),
            userAgent: await targetPage.evaluate(() => navigator.userAgent),
            method: 'cdp',
            profileDir: PROFILE_DIR,
            storageStatePath: STORAGE_STATE_PATH
        } as any); // Type assertion because we are adding 'method' which might not be in the shared type yet, or I need to check the type def.

        console.log('✅ Session captured successfully.');
        console.log('\nYou can now run: npm run pst:session:test');

    } catch (error: any) {
        console.error('\n❌ ACCESS CHECK FAILED');
        console.error(error.message);
        console.log('\nPlease verify you have completed the Cloudflare challenge in the browser.');
    } finally {
        console.log('\nDisconnecting from Chrome (browser will remain open)...');
        await browser.close(); // Disconnects CDP, does not close browser if it was external
    }

  } catch (error: any) {
    console.error('\n❌ CONNECTION FAILED');
    console.error(`Could not connect to Chrome at ${CDP_URL}`);
    console.error('Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log(`- Is Chrome running with --remote-debugging-port=${CDP_PORT}?`);
    console.log('- Did you completely close Chrome before starting it with the flag?');
    console.log('- Check if port 9222 is allowed/available.');
  }
}

main().catch(console.error);
