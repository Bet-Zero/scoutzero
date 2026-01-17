#!/usr/bin/env tsx
import { PROFILE_DIR } from './pst_session_helpers.js';


const CDP_PORT = 9222;

function getChromeCommand() {
    const platform = process.platform;
    const commonFlags = `--remote-debugging-port=${CDP_PORT} --user-data-dir="${PROFILE_DIR}"`;
    
    if (platform === 'darwin') {
        const appPath = '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome';
        return `${appPath} ${commonFlags}`;
    } else if (platform === 'win32') {
        return `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ${commonFlags}`;
    } else {
        return `google-chrome ${commonFlags}`;
    }
}

console.log('\n🔵 TO EXTRACT PST SESSION, LAUNCH CHROME WITH THIS COMMAND:\n');
console.log('1. Close ALL running Chrome instances first.');
console.log('2. Copy and run this command:\n');

console.log(getChromeCommand());

console.log('\n3. Once Chrome opens, go to a PST page and solve the Cloudflare challenge.');
console.log('4. Then run: npm run pst:session:capture:cdp\n');
