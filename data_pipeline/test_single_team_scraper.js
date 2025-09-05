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
            'table.datatable',
            'table.dataTable',
            'table[class*="dataTable"]',
            'table.table',
            '.payroll-table table',
            '.salary-table table',
            'table'
        ];
        
        logProgress('🔍 FINDING PAYROLL TABLE...');
        
        // Quick table overview
        const allTables = $('table');
        logProgress(`   Found ${allTables.length} total tables on page`);
        
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
                
                if (bestTable && maxRows > 3) {
                    targetTable = bestTable;
                    usedSelector = selector;
                    logProgress(`   ✅ Found payroll table using: ${selector} (${maxRows} rows)`);
                    break;
                }
            }
        }
        
        if (!targetTable) {
            logProgress('❌ Could not find a suitable payroll table');
            logProgress('   Available tables with 10+ rows:');
            allTables.each((i, table) => {
                const rows = $(table).find('tr').length;
                const classes = $(table).attr('class') || 'no-class';
                if (rows > 10) {
                    logProgress(`     Table ${i + 1}: ${rows} rows (${classes})`);
                }
            });
            return;
        }
        
        // Parse the table
        logProgress('');
        logProgress('📋 Parsing table rows for player extraction...');
        const players = [];
        let validRows = 0;
        let headerRows = 0;
        
        targetTable.find('tr').each((i, row) => {
            const cells = $(row).find('td, th');
            
            if (cells.length < 2) {
                return; // Skip rows with too few columns
            }
            
            // Try different strategies to find name and salary
            let playerName = '';
            let salaryText = '';
            let salary = 0;
            
            // Strategy 1: Name in first column, salary in columns 2-6
            const name = $(cells[0]).text().trim();
            if (name) {
                for (let j = 1; j < Math.min(cells.length, 7); j++) {
                    const cellText = $(cells[j]).text().trim();
                    
                    // Look for salary patterns
                    if (cellText.includes('$') || 
                        (cellText.match(/^\d{1,3}(,\d{3})+$/) && parseInt(cellText.replace(/,/g, '')) > 500000)) {
                        
                        const salaryMatch = cellText.match(/\$?([0-9,]+)/);
                        const parsedSalary = salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, '')) : 0;
                        
                        if (parsedSalary > 0) {
                            playerName = name;
                            salaryText = cellText.includes('$') ? cellText : '$' + cellText;
                            salary = parsedSalary;
                            break;
                        }
                    }
                }
            }
            
            // Validate the result
            if (playerName && salary > 0) {
                const nameCheck = playerName.toLowerCase();
                const isHeader = nameCheck.includes('player') || 
                               nameCheck.includes('total') || 
                               nameCheck.includes('cap') ||
                               nameCheck.includes('payroll') ||
                               nameCheck.includes('name');
                
                if (isHeader) {
                    headerRows++;
                } else {
                    validRows++;
                    players.push({
                        name: playerName,
                        team: TEST_TEAM.abbrev,
                        salary: salary,
                        salaryDisplay: salaryText
                    });
                }
            }
        });
        
        logProgress(`   Processed ${targetTable.find('tr').length} total rows`);
        logProgress(`   Found ${headerRows} header/summary rows`);
        logProgress(`   Found ${validRows} player rows with valid contracts`);
        
        logProgress('');
        logProgress('🏆 RESULTS:');
        logProgress(`===========`);
        
        if (players.length > 0) {
            logProgress(`✅ SUCCESS! Found ${players.length} ${TEST_TEAM.name} players with contracts:`);
            logProgress('');
            players.slice(0, 5).forEach((player, i) => {
                logProgress(`   ${i + 1}. ${player.name}: $${player.salary.toLocaleString()}`);
            });
            
            if (players.length > 5) {
                logProgress(`   ... and ${players.length - 5} more players`);
            }
            
            // Calculate total
            const totalSalary = players.reduce((sum, p) => sum + p.salary, 0);
            logProgress('');
            logProgress(`📊 Total team payroll: $${totalSalary.toLocaleString()}`);
            
            // Save test results
            const testFile = path.join(__dirname, 'test_results', `${TEST_TEAM.id}.json`);
            
            // Create test_results directory if it doesn't exist
            const testDir = path.dirname(testFile);
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            fs.writeFileSync(testFile, JSON.stringify({ 
                team: TEST_TEAM, 
                players, 
                totalSalary,
                scrapedAt: new Date().toISOString()
            }, null, 2));
            
            logProgress('');
            logProgress(`💾 Results saved to: ${testFile}`);
            
        } else {
            logProgress('❌ FAILED: No players with contracts found');
            logProgress('');
            logProgress('This could mean:');
            logProgress('  • The table structure has changed');
            logProgress('  • The salary detection patterns need adjustment');
            logProgress('  • The page layout is different than expected');
            
            // Save debug info
            const debugFile = path.join(__dirname, 'test_results', `debug_${TEST_TEAM.id}.html`);
            const testDir = path.dirname(debugFile);
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            // Save a sample of the HTML around the table
            const tableHtml = targetTable.html();
            fs.writeFileSync(debugFile, `
                <h1>Debug Info for ${TEST_TEAM.name}</h1>
                <h2>Selected Table (${usedSelector}):</h2>
                <table class="debug-table">
                ${tableHtml}
                </table>
            `);
            
            logProgress('');
            logProgress(`🔍 Debug HTML saved to: ${debugFile}`);
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