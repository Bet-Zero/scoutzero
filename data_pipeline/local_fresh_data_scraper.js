/**
 * TEAM-BASED FRESH DATA SCRAPER - RUN LOCALLY ONLY
 * ===============================================
 * 
 * This script scrapes fresh data using TEAM-BASED approach:
 * - Scrapes 30 team payroll pages (NOT individual players)
 * - 30 requests total instead of 450+ individual player requests
 * - Gets all contracts for each team in one efficient request
 * 
 * Starting point: Your 630 player list from public/players.json
 * Output: Fresh NBA data + Fresh Spotrac contract data via team pages
 * 
 * NO FALLBACKS - If scraping fails, results will be empty so you can see what works.
 * 
 * Usage:
 * 1. Run this script on your LOCAL machine: node local_fresh_data_scraper.js
 * 2. It creates fresh_data.json with all scraped results
 * 3. Run migrate_and_structure.js to create separated schema
 * 4. Run load_to_firebase.js to upload to new collections
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const NBA_TEAMS = [
    { id: 'atlanta-hawks', name: 'Atlanta Hawks', abbrev: 'ATL' },
    { id: 'boston-celtics', name: 'Boston Celtics', abbrev: 'BOS' },
    { id: 'brooklyn-nets', name: 'Brooklyn Nets', abbrev: 'BKN' },
    { id: 'charlotte-hornets', name: 'Charlotte Hornets', abbrev: 'CHA' },
    { id: 'chicago-bulls', name: 'Chicago Bulls', abbrev: 'CHI' },
    { id: 'cleveland-cavaliers', name: 'Cleveland Cavaliers', abbrev: 'CLE' },
    { id: 'dallas-mavericks', name: 'Dallas Mavericks', abbrev: 'DAL' },
    { id: 'denver-nuggets', name: 'Denver Nuggets', abbrev: 'DEN' },
    { id: 'detroit-pistons', name: 'Detroit Pistons', abbrev: 'DET' },
    { id: 'golden-state-warriors', name: 'Golden State Warriors', abbrev: 'GSW' },
    { id: 'houston-rockets', name: 'Houston Rockets', abbrev: 'HOU' },
    { id: 'indiana-pacers', name: 'Indiana Pacers', abbrev: 'IND' },
    { id: 'los-angeles-clippers', name: 'Los Angeles Clippers', abbrev: 'LAC' },
    { id: 'los-angeles-lakers', name: 'Los Angeles Lakers', abbrev: 'LAL' },
    { id: 'memphis-grizzlies', name: 'Memphis Grizzlies', abbrev: 'MEM' },
    { id: 'miami-heat', name: 'Miami Heat', abbrev: 'MIA' },
    { id: 'milwaukee-bucks', name: 'Milwaukee Bucks', abbrev: 'MIL' },
    { id: 'minnesota-timberwolves', name: 'Minnesota Timberwolves', abbrev: 'MIN' },
    { id: 'new-orleans-pelicans', name: 'New Orleans Pelicans', abbrev: 'NOP' },
    { id: 'new-york-knicks', name: 'New York Knicks', abbrev: 'NYK' },
    { id: 'oklahoma-city-thunder', name: 'Oklahoma City Thunder', abbrev: 'OKC' },
    { id: 'orlando-magic', name: 'Orlando Magic', abbrev: 'ORL' },
    { id: 'philadelphia-76ers', name: 'Philadelphia 76ers', abbrev: 'PHI' },
    { id: 'phoenix-suns', name: 'Phoenix Suns', abbrev: 'PHX' },
    { id: 'portland-trail-blazers', name: 'Portland Trail Blazers', abbrev: 'POR' },
    { id: 'sacramento-kings', name: 'Sacramento Kings', abbrev: 'SAC' },
    { id: 'san-antonio-spurs', name: 'San Antonio Spurs', abbrev: 'SAS' },
    { id: 'toronto-raptors', name: 'Toronto Raptors', abbrev: 'TOR' },
    { id: 'utah-jazz', name: 'Utah Jazz', abbrev: 'UTA' },
    { id: 'washington-wizards', name: 'Washington Wizards', abbrev: 'WAS' }
];

const OUTPUT_DIR = path.join(__dirname, 'output', 'fresh_scrape');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Progress logging
function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

// Sleep function for rate limiting
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrape player contracts from Spotrac team page
 */
async function scrapeTeamContracts(team) {
    try {
        const url = `https://www.spotrac.com/nba/${team.id}/payroll/`;
        logProgress(`  📊 Scraping ${team.name} contracts...`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            signal: AbortSignal.timeout(15000) // Increased timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const players = [];
        
        logProgress(`    🔍 Finding payroll table...`);
        
        // Try multiple table selectors that Spotrac might use
        const tableSelectors = [
            'table.payroll',           // Original selector
            'table[class*="payroll"]', // Contains "payroll"
            'table[class*="salary"]',  // Contains "salary"  
            'table.datatable',         // Common datatable class
            'table.dataTable',         // Case variation
            'table[class*="dataTable"]', // Contains dataTable
            'table.table',             // Generic table class
            '.payroll-table table',    // Table inside payroll div
            '.salary-table table',     // Table inside salary div
            'table',                   // Any table (fallback)
        ];
        
        let targetTable = null;
        let usedSelector = '';
        
        // Find the best table (largest with reasonable row count)
        for (const selector of tableSelectors) {
            const tables = $(selector);
            if (tables.length > 0) {
                let bestTable = null;
                let maxRows = 0;
                
                tables.each((i, table) => {
                    const rowCount = $(table).find('tr').length;
                    if (rowCount > maxRows && rowCount > 5) { // Must have at least 6 rows
                        maxRows = rowCount;
                        bestTable = $(table);
                    }
                });
                
                if (bestTable) {
                    targetTable = bestTable;
                    usedSelector = selector;
                    logProgress(`    ✅ Found payroll table using: ${selector} (${maxRows} rows)`);
                    break;
                }
            }
        }
        
        if (!targetTable) {
            logProgress(`    ❌ No suitable payroll table found`);
            return {
                team: team.abbrev,
                players: [],
                error: 'No payroll table found',
                scrapedAt: new Date().toISOString(),
                debugInfo: {
                    htmlLength: html.length,
                    totalTables: $('table').length
                }
            };
        }
        
        // Parse the payroll table rows
        logProgress(`    📋 Parsing table rows for player extraction...`);
        targetTable.find('tr').each((i, row) => {
            const cells = $(row).find('td, th');
            
            if (cells.length >= 1 && i < 5) {
                // Show first 5 rows for debugging
                const cellTexts = [];
                cells.each((j, cell) => {
                    const text = $(cell).text().trim();
                    cellTexts.push(text.substring(0, 20));
                });
                logProgress(`      Row ${i + 1}: [${cellTexts.join(' | ')}]`);
            }
            
            if (cells.length >= 2) {
                // Try different column strategies
                let playerName = '';
                let salaryText = '';
                let foundValidPair = false;
                
                // Strategy 1: First column = name, second = salary
                const name1 = $(cells[0]).text().trim();
                const salary1 = $(cells[1]).text().trim();
                if (name1 && salary1 && salary1.includes('$')) {
                    playerName = name1;
                    salaryText = salary1;
                    foundValidPair = true;
                }
                
                // Strategy 2: Look for salary in any column 2-6 (expanded range)
                if (!foundValidPair) {
                    for (let j = 1; j < Math.min(cells.length, 7); j++) {
                        const potentialSalary = $(cells[j]).text().trim();
                        // More flexible salary pattern matching
                        if ((potentialSalary.includes('$') || potentialSalary.match(/\d{1,3}(,\d{3})*(,\d{3})/)) && 
                            (potentialSalary.match(/\$[\d,]+/) || potentialSalary.match(/\d+,\d{3}/))) {
                            playerName = $(cells[0]).text().trim();
                            salaryText = potentialSalary;
                            foundValidPair = true;
                            break;
                        }
                    }
                }
                
                // Strategy 3: Look for any cell with large numbers (salary without $)
                if (!foundValidPair) {
                    for (let j = 1; j < Math.min(cells.length, 7); j++) {
                        const potentialSalary = $(cells[j]).text().trim();
                        // Match large numbers that could be salaries
                        if (potentialSalary.match(/^\d{1,3}(,\d{3})+$/) && 
                            parseInt(potentialSalary.replace(/,/g, '')) > 100000) {
                            playerName = $(cells[0]).text().trim();
                            salaryText = '$' + potentialSalary; // Add $ prefix
                            foundValidPair = true;
                            break;
                        }
                    }
                }
                
                if (foundValidPair && playerName && salaryText) {
                    // Skip header rows and total rows
                    const nameCheck = playerName.toLowerCase();
                    const salaryCheck = salaryText.toLowerCase();
                    
                    if (!nameCheck.includes('player') &&
                        !nameCheck.includes('total') &&
                        !nameCheck.includes('cap') &&
                        !nameCheck.includes('payroll') &&
                        !salaryCheck.includes('total') &&
                        !salaryCheck.includes('cap') &&
                        salaryText.includes('$') &&
                        nameCheck.length > 3) { // Reasonable name length
                        
                        // More flexible salary parsing
                        let salaryMatch = salaryText.match(/\$([0-9,]+)/);
                        if (!salaryMatch) {
                            // Try without $ prefix
                            salaryMatch = salaryText.match(/([0-9,]+)/);
                        }
                        const salary = salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, '')) : 0;
                        
                        // Extract contract length if available
                        const contractYearsMatch = salaryText.match(/(\d+)\s*yr/i);
                        const contractYears = contractYearsMatch ? parseInt(contractYearsMatch[1]) : 1;
                        
                        // Only add if we have a valid salary > $0
                        if (salary > 0) {
                            players.push({
                                name: playerName,
                                team: team.abbrev,
                                salary: salary,
                                salaryDisplay: salaryText,
                                contractYears: contractYears,
                                scrapedFrom: url,
                                tableSelector: usedSelector
                            });
                        }
                    }
                }
            }
        });
        
        logProgress(`    ✅ Found ${players.length} players with contracts`);
        
        if (players.length === 0) {
            logProgress(`    🔍 Debug: First 5 rows from selected table:`);
            targetTable.find('tr').slice(0, 5).each((i, row) => {
                const cells = $(row).find('td, th');
                const cellData = [];
                cells.each((j, cell) => {
                    const text = $(cell).text().trim();
                    cellData.push(text.substring(0, 25));
                });
                logProgress(`       Row ${i + 1}: [${cellData.join(' | ')}]`);
            });
            
            logProgress(`    🔍 Looking for salary patterns in all cells...`);
            let salaryFound = false;
            targetTable.find('td, th').each((i, cell) => {
                const text = $(cell).text().trim();
                if (text.includes('$') && text.match(/\$[\d,]+/) && !salaryFound) {
                    logProgress(`       💰 Found salary pattern: "${text}"`);
                    salaryFound = true;
                }
            });
            
            if (!salaryFound) {
                logProgress(`       ⚠️  No salary patterns ($xxx,xxx) found in table`);
            }
        }
        
        return {
            team: team.abbrev,
            players: players,
            totalPlayers: players.length,
            scrapedAt: new Date().toISOString(),
            tableSelector: usedSelector
        };
        
    } catch (error) {
        logProgress(`    ❌ Error scraping ${team.name}: ${error.message}`);
        return {
            team: team.abbrev,
            players: [],
            error: error.message,
            scrapedAt: new Date().toISOString()
        };
    }
}

/**
 * Scrape fresh NBA player stats from NBA.com API
 */
async function scrapeNBAStats() {
    try {
        logProgress('📈 Scraping current NBA player stats...');
        
        // NBA Stats API endpoint for all players
        const url = 'https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=1';
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://stats.nba.com/',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
        
        const data = await response.json();
        const players = [];
        
        if (data.resultSets && data.resultSets[0] && data.resultSets[0].rowSet) {
            data.resultSets[0].rowSet.forEach(playerRow => {
                // NBA API returns: [PERSON_ID, DISPLAY_LAST_COMMA_FIRST, DISPLAY_FIRST_LAST, ROSTER_STATUS, FROM_YEAR, TO_YEAR, PLAYERCODE, TEAM_ID, TEAM_CITY, TEAM_NAME, TEAM_ABBREVIATION, TEAM_CODE, GAMES_PLAYED_FLAG]
                players.push({
                    nba_id: playerRow[0],
                    name: playerRow[2], // DISPLAY_FIRST_LAST
                    roster_status: playerRow[3],
                    from_year: playerRow[4],
                    to_year: playerRow[5],
                    team_id: playerRow[7],
                    team_city: playerRow[8],
                    team_name: playerRow[9],
                    team_abbrev: playerRow[10],
                    is_active: playerRow[3] === 1
                });
            });
        }
        
        logProgress(`  ✅ Found ${players.length} NBA players`);
        return players;
        
    } catch (error) {
        logProgress(`  ❌ Error scraping NBA stats: ${error.message}`);
        return [];
    }
}

/**
 * Main scraping function
 */
async function scrapeFreshData() {
    logProgress('🚀 STARTING FRESH DATA SCRAPING');
    logProgress('================================');
    logProgress('⚠️  This script must be run locally - external APIs are blocked in sandboxed environments');
    logProgress('');
    
    const results = {
        scrapeStarted: new Date().toISOString(),
        nbaStats: [],
        teamContracts: [],
        errors: [],
        summary: {}
    };
    
    // Step 1: Scrape NBA player stats
    logProgress('📈 Step 1: Scraping NBA Player Stats...');
    results.nbaStats = await scrapeNBAStats();
    await sleep(2000); // Rate limiting
    
    // Step 2: Scrape team contracts from Spotrac (TEAM-BASED APPROACH)
    logProgress('');
    logProgress('💰 Step 2: Scraping Team Contracts from Spotrac...');
    logProgress(`   🎯 TEAM-BASED APPROACH: ${NBA_TEAMS.length} team payroll pages`);
    logProgress(`   ⚡ Efficient: 30 requests instead of 450+ individual players`);
    
    for (let i = 0; i < NBA_TEAMS.length; i++) {
        const team = NBA_TEAMS[i];
        logProgress(`[${i + 1}/${NBA_TEAMS.length}] ${team.name}...`);
        logProgress(`  📊 Scraping ${team.name} contracts...`);
        
        const teamData = await scrapeTeamContracts(team);
        results.teamContracts.push(teamData);
        
        // Show individual team results immediately
        if (teamData.players && teamData.players.length > 0) {
            logProgress(`  ✅ Found ${teamData.players.length} players with contracts`);
            logProgress(`  ✅ ${teamData.players.length} contracts found for ${team.name}`);
        } else if (teamData.error) {
            logProgress(`  ❌ Error scraping ${team.name}: ${teamData.error}`);
        } else {
            logProgress(`  ⚠️  Found 0 players with contracts (structure may have changed)`);
        }
        
        // Rate limiting - be respectful to Spotrac
        await sleep(3000);
        
        // Progress update every 3 teams instead of 5 for better monitoring
        if ((i + 1) % 3 === 0) {
            const processed = results.teamContracts.filter(t => t.players && t.players.length > 0).length;
            const totalContracts = results.teamContracts.reduce((sum, t) => sum + (t.players ? t.players.length : 0), 0);
            logProgress(`   📊 Progress: ${i + 1}/${NBA_TEAMS.length} teams processed, ${processed} successful teams, ${totalContracts} contracts found`);
        }
    }
    
    // Calculate summary
    const totalContracts = results.teamContracts.reduce((sum, team) => sum + (team.players ? team.players.length : 0), 0);
    const successfulTeams = results.teamContracts.filter(t => t.players && t.players.length > 0).length;
    const failedTeams = results.teamContracts.filter(t => t.error).length;
    
    results.summary = {
        nbaPlayersFound: results.nbaStats.length,
        teamsScraped: NBA_TEAMS.length,
        successfulTeams: successfulTeams,
        failedTeams: failedTeams,
        emptyTeams: NBA_TEAMS.length - successfulTeams - failedTeams,
        totalContractsFound: totalContracts,
        scrapeCompleted: new Date().toISOString()
    };
    
    // Save results
    const outputFile = path.join(OUTPUT_DIR, `fresh_scrape_${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    logProgress('');
    logProgress('✅ SCRAPING COMPLETE!');
    logProgress('====================');
    logProgress(`📊 NBA Players: ${results.summary.nbaPlayersFound}`);
    logProgress(`🏀 Teams Scraped: ${successfulTeams}/${NBA_TEAMS.length}`);
    logProgress(`💰 Contracts Found: ${totalContracts}`);
    logProgress(`❌ Failed Teams: ${results.summary.failedTeams}`);
    logProgress(`⚠️  Empty Teams: ${results.summary.emptyTeams}`);
    logProgress(`💾 Results saved to: ${outputFile}`);
    logProgress('');
    logProgress('Next Step: Run migrate_and_structure.js to create the separated schema');
    
    return results;
}

// Run if script is executed directly (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
    scrapeFreshData().catch(error => {
        logProgress(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
}

export { scrapeFreshData };