/**
 * TEST SPOTRAC SCRAPER - Single Team
 * =================================
 * 
 * Tests the scraper with just one team to validate it works
 * Run this locally to test the scraping logic before running the full pipeline
 * 
 * Usage: node test_single_team_scraper.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test with Atlanta Hawks first
const TEST_TEAM = { id: 'atlanta-hawks', name: 'Atlanta Hawks', abbrev: 'ATL' };

function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

async function testTeamScraping() {
    try {
        const url = `https://www.spotrac.com/nba/${TEST_TEAM.id}/payroll/`;
        logProgress(`🧪 TESTING TEAM SCRAPER`);
        logProgress(`========================`);
        logProgress(`Team: ${TEST_TEAM.name}`);
        logProgress(`URL: ${url}`);
        logProgress('');
        
        logProgress(`📡 Fetching data from Spotrac...`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        logProgress(`✅ Successfully fetched HTML (${html.length} characters)`);
        logProgress('');
        
        // Try multiple table selectors
        const tableSelectors = [
            'table.payroll',
            'table[class*="payroll"]',
            'table[class*="salary"]',  
            'table.table',
            'table.datatable',
            '.payroll-table table',
            '.salary-table table',
            'table'
        ];
        
        logProgress('🔍 TESTING TABLE SELECTORS:');
        for (const selector of tableSelectors) {
            const tables = $(selector);
            logProgress(`   "${selector}": ${tables.length} matches`);
            
            if (tables.length > 0) {
                tables.each((i, table) => {
                    const rows = $(table).find('tr').length;
                    const classes = $(table).attr('class') || 'no-class';
                    logProgress(`     Table ${i + 1}: ${rows} rows, class="${classes}"`);
                });
            }
        }
        logProgress('');
        
        // Find the best table
        let targetTable = null;
        let usedSelector = '';
        
        for (const selector of tableSelectors) {
            const tables = $(selector);
            if (tables.length > 0) {
                let bestTable = null;
                let maxRows = 0;
                
                tables.each((i, table) => {
                    const rowCount = $(table).find('tr').length;
                    if (rowCount > maxRows) {
                        maxRows = rowCount;
                        bestTable = $(table);
                    }
                });
                
                if (bestTable && maxRows > 5) {
                    targetTable = bestTable;
                    usedSelector = selector;
                    logProgress(`🎯 SELECTED TABLE: "${selector}" (${maxRows} rows)`);
                    break;
                }
            }
        }
        
        if (!targetTable) {
            logProgress('❌ NO SUITABLE TABLE FOUND');
            return;
        }
        
        // Parse the table
        logProgress('');
        logProgress('📋 PARSING TABLE ROWS:');
        const players = [];
        
        targetTable.find('tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const nameCell = $(cells[0]);
                const salaryCell = $(cells[1]);
                
                const playerName = nameCell.text().trim();
                const salaryText = salaryCell.text().trim();
                
                logProgress(`   Row ${i + 1}: "${playerName}" | "${salaryText}"`);
                
                if (playerName && 
                    salaryText && 
                    !playerName.toLowerCase().includes('player') &&
                    !playerName.toLowerCase().includes('total') &&
                    !salaryText.toLowerCase().includes('total') &&
                    !salaryText.toLowerCase().includes('cap') &&
                    salaryText.includes('$')) {
                    
                    const salaryMatch = salaryText.match(/\$([0-9,]+)/);
                    const salary = salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, '')) : 0;
                    
                    if (salary > 0) {
                        players.push({
                            name: playerName,
                            team: TEST_TEAM.abbrev,
                            salary: salary,
                            salaryDisplay: salaryText
                        });
                        logProgress(`     ✅ Valid player: ${playerName} - $${salary.toLocaleString()}`);
                    }
                }
            }
        });
        
        logProgress('');
        logProgress('🏆 FINAL RESULTS:');
        logProgress(`===============`);
        logProgress(`Players found: ${players.length}`);
        
        if (players.length > 0) {
            logProgress('');
            logProgress('Player list:');
            players.forEach((player, i) => {
                logProgress(`  ${i + 1}. ${player.name} - $${player.salary.toLocaleString()}`);
            });
            
            // Save test results
            const testFile = path.join(__dirname, `test_results_${TEST_TEAM.id}.json`);
            fs.writeFileSync(testFile, JSON.stringify({ team: TEST_TEAM, players }, null, 2));
            logProgress('');
            logProgress(`💾 Test results saved to: ${testFile}`);
        } else {
            logProgress('⚠️  No valid players found - check HTML structure');
        }
        
    } catch (error) {
        logProgress(`❌ Test failed: ${error.message}`);
        
        // If it's a network error, provide helpful guidance
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            logProgress('');
            logProgress('🔒 NETWORK ISSUE:');
            logProgress('   This environment blocks external API access.');
            logProgress('   Run this test on your local machine to validate the scraper.');
        }
    }
}

// Run test
testTeamScraping();