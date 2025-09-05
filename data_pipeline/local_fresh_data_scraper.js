/**
 * COMPREHENSIVE TEAM-BASED FRESH DATA SCRAPER - RUN LOCALLY ONLY
 * ============================================================
 * 
 * This script scrapes comprehensive contract data using DUAL-ENDPOINT approach:
 * 
 * MULTI-YEAR CONTRACTS (/yearly endpoint):
 * - Scrapes 30 team yearly pages for complete 4-year contract tables (2025-29)
 * - Gets future contract years that single-season endpoints miss
 * 
 * EXCEPTION DATA (/cap endpoint):
 * - Scrapes 30 team cap pages for current season exception info
 * - Free Agent Exceptions (MLE, BAE, etc.)
 * - Traded Player Exceptions (TPE)
 * 
 * TOTAL: 60 requests (2 per team) instead of 450+ individual player requests
 * RESULT: Complete multi-year contract data + essential exception information
 * 
 * Starting point: Your 630 player list from public/players.json
 * Output: Fresh NBA data + Comprehensive Spotrac contract/exception data
 * 
 * NO FALLBACKS - If scraping fails, results will be empty so you can see what works.
 * 
 * Usage:
 * 1. Run this script on your LOCAL machine: node local_fresh_data_scraper.js
 * 2. It creates fresh_data.json with all scraped results including multi-year contracts
 * 3. Run migrate_and_structure.js to create separated schema
 * 4. Run load_to_firebase.js to upload to new collections
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
 * Scrape multi-year contracts from Spotrac yearly page
 */
async function scrapeMultiYearContracts(team) {
    try {
        const url = `https://www.spotrac.com/nba/${team.id}/yearly/`;
        logProgress(`    📅 Scraping multi-year contracts...`);
        
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
        const players = [];
        
        // Find the multi-year table
        const tableSelectors = [
            'table.dataTable',
            'table[class*="dataTable"]',
            'table.table',
            'table'
        ];
        
        let targetTable = null;
        
        for (const selector of tableSelectors) {
            const tables = $(selector);
            if (tables.length > 0) {
                // Look for table with year columns (2024-25, 2025-26, etc.)
                tables.each((i, table) => {
                    const headerText = $(table).find('tr').first().text();
                    if (headerText.includes('2025-26') || headerText.includes('2026-27') || 
                        headerText.includes('2025') || headerText.includes('2026')) {
                        targetTable = $(table);
                        return false; // Break loop
                    }
                });
                if (targetTable) break;
            }
        }
        
        if (!targetTable) {
            throw new Error('Multi-year contract table not found');
        }
        
        // Parse multi-year contract data
        const headerRow = targetTable.find('tr').first();
        const yearColumns = [];
        
        // Find year column indices
        headerRow.find('th, td').each((i, cell) => {
            const text = $(cell).text().trim();
            const yearMatch = text.match(/20\d{2}[-–]\d{2}/); // Match 2024-25 format
            if (yearMatch) {
                yearColumns.push({ index: i, year: yearMatch[0] });
            }
        });
        
        // Parse player rows
        targetTable.find('tr').slice(1).each((i, row) => {
            const cells = $(row).find('td, th');
            if (cells.length < 2) return;
            
            const playerName = $(cells[0]).text().trim();
            
            // Skip header and summary rows
            const nameCheck = playerName.toLowerCase();
            if (nameCheck.includes('player') || nameCheck.includes('total') || 
                nameCheck.includes('cap') || nameCheck.length < 3) {
                return;
            }
            
            const playerContracts = { name: playerName, team: team.abbrev, yearlyContracts: {} };
            
            // Extract salary for each year
            yearColumns.forEach(yearCol => {
                if (yearCol.index < cells.length) {
                    const salaryText = $(cells[yearCol.index]).text().trim();
                    const salaryMatch = salaryText.match(/\$?([0-9,]+)/);
                    const salary = salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, '')) : 0;
                    
                    if (salary > 0) {
                        playerContracts.yearlyContracts[yearCol.year] = {
                            salary: salary,
                            salaryDisplay: salaryText.includes('$') ? salaryText : '$' + salaryText
                        };
                    }
                }
            });
            
            if (Object.keys(playerContracts.yearlyContracts).length > 0) {
                players.push(playerContracts);
            }
        });
        
        return players;
        
    } catch (error) {
        logProgress(`    ❌ Error scraping multi-year contracts: ${error.message}`);
        return [];
    }
}

/**
 * Scrape current season exceptions from Spotrac cap page
 */
async function scrapeTeamExceptions(team) {
    try {
        const url = `https://www.spotrac.com/nba/${team.id}/cap/`;
        logProgress(`    🔄 Scraping exceptions...`);
        
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
        
        const exceptions = {
            freeAgent: [],
            tradedPlayer: []
        };
        
        // Look for exception sections
        $('table').each((i, table) => {
            const tableText = $(table).text().toLowerCase();
            
            // Free Agent Exception
            if (tableText.includes('exception') && (tableText.includes('free agent') || tableText.includes('mle'))) {
                $(table).find('tr').each((j, row) => {
                    const cells = $(row).find('td, th');
                    if (cells.length >= 2) {
                        const type = $(cells[0]).text().trim();
                        const amount = $(cells[1]).text().trim();
                        
                        if (amount.includes('$')) {
                            const amountMatch = amount.match(/\$([0-9,]+)/);
                            const value = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0;
                            
                            if (value > 0) {
                                exceptions.freeAgent.push({
                                    type: type,
                                    amount: value,
                                    amountDisplay: amount
                                });
                            }
                        }
                    }
                });
            }
            
            // Traded Player Exception
            if (tableText.includes('traded') && tableText.includes('exception')) {
                $(table).find('tr').each((j, row) => {
                    const cells = $(row).find('td, th');
                    if (cells.length >= 3) {
                        const player = $(cells[0]).text().trim();
                        const amount = $(cells[1]).text().trim();
                        const expires = $(cells[2]).text().trim();
                        
                        if (amount.includes('$')) {
                            const amountMatch = amount.match(/\$([0-9,]+)/);
                            const value = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0;
                            
                            if (value > 0) {
                                exceptions.tradedPlayer.push({
                                    player: player,
                                    amount: value,
                                    amountDisplay: amount,
                                    expires: expires
                                });
                            }
                        }
                    }
                });
            }
        });
        
        return exceptions;
        
    } catch (error) {
        logProgress(`    ❌ Error scraping exceptions: ${error.message}`);
        return { freeAgent: [], tradedPlayer: [] };
    }
}

/**
 * Scrape complete team data (multi-year contracts + exceptions)
 */
async function scrapeTeamContracts(team) {
    try {
        logProgress(`  📊 Scraping ${team.name} complete data...`);
        
        // Scrape both multi-year contracts and exceptions
        const [multiYearPlayers, exceptions] = await Promise.all([
            scrapeMultiYearContracts(team),
            scrapeTeamExceptions(team)
        ]);
        
        const playerCount = multiYearPlayers.length;
        const exceptionCount = exceptions.freeAgent.length + exceptions.tradedPlayer.length;
        
        logProgress(`    ✅ Found ${playerCount} players with multi-year contracts`);
        logProgress(`    ✅ Found ${exceptionCount} exceptions (${exceptions.freeAgent.length} FA, ${exceptions.tradedPlayer.length} TPE)`);
        
        return {
            team: team.abbrev,
            players: multiYearPlayers,
            exceptions: exceptions,
            totalPlayers: playerCount,
            totalExceptions: exceptionCount,
            scrapedAt: new Date().toISOString(),
            scrapedFrom: {
                contracts: `https://www.spotrac.com/nba/${team.id}/yearly/`,
                exceptions: `https://www.spotrac.com/nba/${team.id}/cap/`
            }
        };
        
    } catch (error) {
        logProgress(`    ❌ Error scraping ${team.name}: ${error.message}`);
        return {
            team: team.abbrev,
            players: [],
            exceptions: { freeAgent: [], tradedPlayer: [] },
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
    
    // Step 2: Scrape team contracts from Spotrac (COMPREHENSIVE APPROACH)
    logProgress('');
    logProgress('💰 Step 2: Scraping Team Contracts + Exceptions from Spotrac...');
    logProgress(`   🎯 COMPREHENSIVE APPROACH: Multi-year contracts + Exception data`);
    logProgress(`   📅 Multi-year: /yearly endpoint (2025-26 through 2028-29)`);
    logProgress(`   🔄 Exceptions: /cap endpoint (Free Agent + Traded Player exceptions)`);
    logProgress(`   ⚡ Efficient: 60 requests total (2 per team) instead of 450+ individual players`);
    
    for (let i = 0; i < NBA_TEAMS.length; i++) {
        const team = NBA_TEAMS[i];
        logProgress(`[${i + 1}/${NBA_TEAMS.length}] ${team.name}...`);
        logProgress(`  📊 Scraping ${team.name} contracts...`);
        
        const teamData = await scrapeTeamContracts(team);
        results.teamContracts.push(teamData);
        
        // Show individual team results immediately  
        if (teamData.players && teamData.players.length > 0) {
            const totalYears = teamData.players.reduce((sum, p) => sum + Object.keys(p.yearlyContracts || {}).length, 0);
            logProgress(`  ✅ Found ${teamData.players.length} players with ${totalYears} total contract years`);
            logProgress(`  ✅ Found ${teamData.totalExceptions} exceptions (FA: ${teamData.exceptions?.freeAgent?.length || 0}, TPE: ${teamData.exceptions?.tradedPlayer?.length || 0})`);
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
            const totalExceptions = results.teamContracts.reduce((sum, t) => sum + (t.totalExceptions || 0), 0);
            logProgress(`   📊 Progress: ${i + 1}/${NBA_TEAMS.length} teams processed, ${processed} successful teams`);
            logProgress(`   📊 Found: ${totalContracts} players, ${totalExceptions} exceptions so far`);
        }
    }
    
    // Calculate summary
    const totalContracts = results.teamContracts.reduce((sum, team) => sum + (team.players ? team.players.length : 0), 0);
    const totalExceptions = results.teamContracts.reduce((sum, team) => sum + (team.totalExceptions || 0), 0);
    const totalContractYears = results.teamContracts.reduce((sum, team) => {
        if (!team.players) return sum;
        return sum + team.players.reduce((yearSum, player) => yearSum + Object.keys(player.yearlyContracts || {}).length, 0);
    }, 0);
    const successfulTeams = results.teamContracts.filter(t => t.players && t.players.length > 0).length;
    const failedTeams = results.teamContracts.filter(t => t.error).length;
    
    results.summary = {
        nbaPlayersFound: results.nbaStats.length,
        teamsScraped: NBA_TEAMS.length,
        successfulTeams: successfulTeams,
        failedTeams: failedTeams,
        emptyTeams: NBA_TEAMS.length - successfulTeams - failedTeams,
        totalContractsFound: totalContracts,
        totalExceptionsFound: totalExceptions,
        totalContractYears: totalContractYears,
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
    logProgress(`💰 Players with Contracts: ${totalContracts}`);
    logProgress(`📅 Contract Years Found: ${totalContractYears}`);
    logProgress(`🔄 Exceptions Found: ${totalExceptions}`);
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