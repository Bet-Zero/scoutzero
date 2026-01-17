#!/usr/bin/env tsx
/**
 * pst_session_helpers.ts
 *
 * Shared helper functions for PST session management and Cloudflare detection.
 *
 * Usage:
 *   import { assertPstAccess, detectCloudflareChallenge, ... } from './pst_session_helpers.js';
 */

import { readFile, writeFile, access, constants } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import readline from "node:readline";

// ============================================================================
// DIRECTORY PATHS
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

export const SESSION_DIR = path.join(PROJECT_ROOT, 'data', 'pst', 'session');
export const PROFILE_DIR = path.join(SESSION_DIR, 'profile');
export const STORAGE_STATE_PATH = path.join(SESSION_DIR, 'storageState.json');
export const SESSION_META_PATH = path.join(SESSION_DIR, 'session_meta.json');
export const PAGES_DIR = path.join(PROJECT_ROOT, 'data', 'pst', 'pages');
export const MANIFEST_PATH = path.join(PROJECT_ROOT, 'data', 'pst', 'pst_fetch_manifest.json');

// ============================================================================
// TYPES
// ============================================================================

export type CloudflareDetectionResult = {
  isChallenge: boolean;
  markers: string[];
  confidence: 'high' | 'medium' | 'low';
  details: string;
};

export type SessionMeta = {
  capturedAt: string;
  testedUrl: string;
  userAgent: string;
  method?: 'headless' | 'headed' | 'cdp';
  browserChannel?: string;
  profileDir: string;
  storageStatePath: string;
  notes?: string;
};

// ============================================================================
// CLOUDFLARE DETECTION
// ============================================================================

/**
 * Detects if the page content is a Cloudflare challenge page
 * @param html - The HTML content to analyze
 * @returns Detection result with markers and confidence
 */
export function detectCloudflareChallenge(html: string): CloudflareDetectionResult {
  const lowerHtml = html.toLowerCase();
  const markers: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // High confidence markers
  if (lowerHtml.includes('just a moment')) {
    markers.push('title:just_a_moment');
    confidence = 'high';
  }
  if (lowerHtml.includes('cf-challenge')) {
    markers.push('element:cf-challenge');
    confidence = 'high';
  }
  if (lowerHtml.includes('checking your browser')) {
    markers.push('text:checking_your_browser');
    confidence = 'high';
  }
  if (lowerHtml.includes('403 forbidden')) {
    markers.push('status:403_forbidden');
    confidence = 'high';
  }
  if (lowerHtml.includes('access denied')) {
    markers.push('text:access_denied');
    confidence = 'high';
  }

  // Medium confidence markers
  if (lowerHtml.includes('cloudflare') && lowerHtml.includes('ray id')) {
    markers.push('cloudflare:ray_id');
    if (confidence === 'low') confidence = 'medium';
  }
  if (lowerHtml.includes('enable javascript and cookies')) {
    markers.push('text:enable_js_cookies');
    if (confidence === 'low') confidence = 'medium';
  }

  // Check for content length (challenge pages are typically short)
  if (html.length < 5000 && markers.length > 0) {
    markers.push('size:short_content');
  }

  const isChallenge = markers.length > 0;
  const details = isChallenge
    ? `Cloudflare challenge detected: ${markers.join(', ')}`
    : 'No Cloudflare challenge detected';

  return { isChallenge, markers, confidence, details };
}

/**
 * Detects if the page has valid PST content (draft pick tables)
 * @param html - The HTML content to analyze
 * @returns true if valid PST content is present
 */
export function hasPstContent(html: string): boolean {
  const lowerHtml = html.toLowerCase();

  // Check for PST-specific content markers
  const hasTable = lowerHtml.includes('<table');
  const hasDraftContent =
    lowerHtml.includes('round') ||
    lowerHtml.includes('draft') ||
    lowerHtml.includes('pick');
  const hasTeamContent =
    lowerHtml.includes('future draft') || lowerHtml.includes('draft trades');

  return hasTable && (hasDraftContent || hasTeamContent);
}

/**
 * Asserts that the page has valid PST access (not blocked by Cloudflare)
 * @param page - Playwright Page object
 * @throws Error if page is a Cloudflare challenge or lacks PST content
 */
export async function assertPstAccess(page: Page): Promise<void> {
  const html = await page.content();
  const cfResult = detectCloudflareChallenge(html);

  if (cfResult.isChallenge) {
    throw new Error(
      `PST access blocked by Cloudflare!\n` +
        `  Detection: ${cfResult.details}\n` +
        `  Confidence: ${cfResult.confidence}\n` +
        `  Markers: ${cfResult.markers.join(', ')}\n\n` +
        `Suggestions:\n` +
        `  1. Rerun session capture: npm run pst:session:capture\n` +
        `  2. Try a different browser channel: --channel=chrome\n` +
        `  3. If still blocked, consider Path B/C fallbacks`
    );
  }

  if (!hasPstContent(html)) {
    throw new Error(
      `PST page lacks expected content!\n` +
        `  Page appears to be missing draft pick tables.\n` +
        `  Content length: ${html.length} bytes\n\n` +
        `Suggestions:\n` +
        `  1. Check if the URL is correct\n` +
        `  2. Verify session is still valid: npm run pst:session:test`
    );
  }
}

// ============================================================================
// SESSION METADATA
// ============================================================================

/**
 * Loads session metadata from disk
 * @returns Session metadata or null if not found
 */
export async function loadSessionMeta(): Promise<SessionMeta | null> {
  try {
    await access(SESSION_META_PATH, constants.R_OK);
    const content = await readFile(SESSION_META_PATH, 'utf8');
    return JSON.parse(content) as SessionMeta;
  } catch {
    return null;
  }
}

/**
 * Saves session metadata to disk
 * @param meta - Session metadata to save
 */
export async function saveSessionMeta(meta: SessionMeta): Promise<void> {
  await writeFile(SESSION_META_PATH, JSON.stringify(meta, null, 2), 'utf8');
}

/**
 * Checks if a valid session exists
 * @returns true if session files exist and are recent
 */
export async function hasValidSession(): Promise<boolean> {
  try {
    // Check profile directory exists
    await access(PROFILE_DIR, constants.R_OK);

    // Check session meta exists
    const meta = await loadSessionMeta();
    if (!meta) return false;

    // Check if session is less than 24 hours old
    const capturedAt = new Date(meta.capturedAt);
    const hoursSinceCapture = (Date.now() - capturedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCapture > 24) {
      console.warn(`⚠ Session is ${hoursSinceCapture.toFixed(1)} hours old (captured: ${meta.capturedAt})`);
      console.warn('  Session may have expired. Consider recapturing: npm run pst:session:capture');
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Gets the default user agent string for consistency
 */
export function getDefaultUserAgent(): string {
  return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

// ==============================
// PST SESSION HELPERS — ENTER WAIT
// (ESM-safe: no require)
// ==============================

export async function waitForEnter(promptText = "Press ENTER to continue..."): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`\n${promptText}\n`, () => {
      rl.close();
      resolve();
    });
  });
}


/**
 * Delays execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serializes an object to JSON string
 */
export function serialize(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}
