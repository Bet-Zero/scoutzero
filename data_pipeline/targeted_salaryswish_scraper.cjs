#!/usr/bin/env node

/**
 * SalarySwish Targeted NBA Salary Cap Scraper
 * Generated automatically based on comprehensive data analysis
 * 
 * Extracts only essential salary cap data efficiently from SalarySwish.com
 */

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class SalarySwishScraper {
    constructor() {
        this.baseURL = 'https://www.salaryswish.com/teams';
        this.teams = this.generateTeamList();
        this.results = {
            metadata: {
                scrapedAt: new Date().toISOString(),
                totalTeams: 30,
                dataVersion: 'targeted'
            },
            teams: {}
        };
    }

    generateTeamList() {
        return [
            { name: 'Atlanta Hawks', slug: 'hawks' },
            { name: 'Boston Celtics', slug: 'celtics' },
            { name: 'Brooklyn Nets', slug: 'nets' },
            { name: 'Charlotte Hornets', slug: 'hornets' },
            { name: 'Chicago Bulls', slug: 'bulls' },
            { name: 'Cleveland Cavaliers', slug: 'cavaliers' },
            { name: 'Dallas Mavericks', slug: 'mavericks' },
            { name: 'Denver Nuggets', slug: 'nuggets' },
            { name: 'Detroit Pistons', slug: 'pistons' },
            { name: 'Golden State Warriors', slug: 'warriors' },
            { name: 'Houston Rockets', slug: 'rockets' },
            { name: 'Indiana Pacers', slug: 'pacers' },
            { name: 'LA Clippers', slug: 'clippers' },
            { name: 'Los Angeles Lakers', slug: 'lakers' },
            { name: 'Memphis Grizzlies', slug: 'grizzlies' },
            { name: 'Miami Heat', slug: 'heat' },
            { name: 'Milwaukee Bucks', slug: 'bucks' },
            { name: 'Minnesota Timberwolves', slug: 'timberwolves' },
            { name: 'New Orleans Pelicans', slug: 'pelicans' },
            { name: 'New York Knicks', slug: 'knicks' },
            { name: 'Oklahoma City Thunder', slug: 'thunder' },
            { name: 'Orlando Magic', slug: 'magic' },
            { name: 'Philadelphia 76ers', slug: 'sixers' },
            { name: 'Phoenix Suns', slug: 'suns' },
            { name: 'Portland Trail Blazers', slug: 'blazers' },
            { name: 'Sacramento Kings', slug: 'kings' },
            { name: 'San Antonio Spurs', slug: 'spurs' },
            { name: 'Toronto Raptors', slug: 'raptors' },
            { name: 'Utah Jazz', slug: 'jazz' },
            { name: 'Washington Wizards', slug: 'wizards' }
        ];
    }

    async scrapeTeam(team) {
        try {
            console.log(`🏀 Scraping ${team.name} (${team.slug})...`);
            
            const url = `${this.baseURL}/${team.slug}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();

            const $ = cheerio.load(html);
            const teamData = {
                metadata: {
                    name: team.name,
                    slug: team.slug,
                    url: url,
                    scrapedAt: new Date().toISOString()
                }
            };

            // Extract comprehensive salary cap data based on analysis
            
            // PRIMARY DATA EXTRACTION
            console.log(`🔍 Extracting comprehensive salary cap data...`);
            
            // Table 0: Trade Exceptions  
            teamData.tradeExceptions = this.extractTradeExceptions($);
            console.log(`   📋 Trade Exceptions: ${teamData.tradeExceptions.length} found`);
            
            // Tables 2,3,4,8,9,10,11: Multi-Year Player Contracts (all roster sections)
            teamData.players = this.extractPlayerContracts($);
            console.log(`   👥 Players: ${teamData.players.length} with complete contract details`);
            
            // SUPPLEMENTARY DATA EXTRACTION
            
            // Tables 5,6,7: Cap Statistics and Multi-Year Projections
            teamData.capStatistics = this.extractCapStatistics($);
            console.log(`   💰 Cap Data: $${teamData.capStatistics.capHit?.toLocaleString()} cap hit`);
            
            // Table 1: Draft Picks
            teamData.draftPicks = this.extractDraftPicks($);
            const totalPicks = Object.keys(teamData.draftPicks.owned).length;
            console.log(`   🎯 Draft Picks: ${totalPicks} years tracked`);
            
            // Cap Holds from FA Cap Hold table
            teamData.capHolds = this.extractCapHolds($);
            console.log(`   ⚖️ Cap Holds: ${teamData.capHolds.length} free agents`);
            
            // Signing Exceptions (MLE, BAE, etc.)
            teamData.exceptions = this.extractExceptions($);
            console.log(`   🎫 Exceptions: ${teamData.exceptions.trade.length} trade, ${Object.keys(teamData.exceptions.signing).length} signing`);
            
            // Basic roster stats
            teamData.rosterStats = this.extractRosterStats($);

            console.log(`✅ ${team.name}: Complete extraction finished`);
            console.log(`   👥 Players: ${teamData.players?.length || 0} with full contract details`);
            console.log(`   📋 Exceptions: ${teamData.tradeExceptions?.length || 0} trade, ${Object.keys(teamData.exceptions?.signing || {}).length} signing`);
            console.log(`   🎯 Draft Picks: ${Object.keys(teamData.draftPicks?.owned || {}).length} years tracked`);
            console.log(`   ⚖️ Cap Holds: ${teamData.capHolds?.length || 0} free agents`);
            console.log(`   💰 Cap Hit: $${teamData.capStatistics?.capHit?.toLocaleString() || '0'}`);
            
            return teamData;

        } catch (error) {
            console.error(`❌ ${team.name}: ${error.message}`);
            return {
                metadata: { name: team.name, slug: team.slug, error: error.message },
                players: []
            };
        }
    }

    
    extractPlayerContracts($) {
        const allPlayers = [];
        
        // Extract from all roster tables identified in analysis
        const rosterTableClasses = [
            'sw_teamProfileRosterSection__table',  // Main active roster
        ];
        
        $('table').each((index, table) => {
            const $table = $(table);
            const hasRosterClass = rosterTableClasses.some(cls => $table.hasClass(cls));
            const headers = $table.find('thead th').map((i, th) => $(th).text().trim()).get();
            const hasMultiYear = headers.some(h => /20\d{2}-\d{2}/.test(h));
            
            if (hasRosterClass && hasMultiYear) {
                console.log(`📊 Processing roster table ${index}: ${headers[0]}`);
                
                $table.find('tbody tr').each((i, row) => {
                    const $row = $(row);
                    if ($row.find('td').length === 0) return; // Skip empty rows
                    
                    const player = this.parseAdvancedPlayerRow($row, headers);
                    if (player && player.name && !player.name.includes('TOTAL')) {
                        allPlayers.push(player);
                    }
                });
            }
        });
        
        console.log(`✅ Extracted ${allPlayers.length} players with complete contract details`);
        return allPlayers;
    }

    parseAdvancedPlayerRow($row, headers) {
        const cells = $row.find('td');
        if (cells.length === 0) return null;
        
        const player = {
            name: this.cleanPlayerName($(cells[0]).text().trim()),
            status: '',
            acquired: '',
            age: null,
            position: '',
            contractTerms: '',
            contractDetails: {},
            salaries: {},
            freeAgencyStatus: '',
            birdRights: '',
            options: {}
        };

        // Parse each column based on headers
        headers.forEach((header, colIndex) => {
            if (colIndex >= cells.length) return;
            const $cell = $(cells[colIndex]);
            const cellText = $cell.text().trim();
            
            if (header.toLowerCase().includes('status')) {
                player.status = cellText;
            } else if (header.toLowerCase().includes('acquired')) {
                player.acquired = cellText;
            } else if (header.toLowerCase().includes('age')) {
                player.age = parseInt(cellText) || null;
            } else if (header.toLowerCase().includes('pos')) {
                player.position = cellText;
            } else if (header.toLowerCase().includes('terms')) {
                player.contractTerms = cellText;
            } else if (header.match(/20\d{2}-\d{2}/)) {
                // Parse complex salary data for each year
                const salaryData = this.parseComplexSalaryCell($cell);
                if (salaryData.capHit > 0 || salaryData.guaranteed > 0) {
                    player.salaries[header] = salaryData;
                }
                
                // Check for options in this year
                const optionType = this.extractOptionType($cell);
                if (optionType) {
                    player.options[header] = optionType;
                }
            }
        });
        
        // Extract free agency and bird rights from special cells
        $row.find('.sw_playerProfile__freeAgentTag').each((i, tag) => {
            const $tag = $(tag);
            const faStatus = $tag.find('.sw_playerProfile__freeAgentTag_tag').text().trim();
            if (faStatus) {
                player.freeAgencyStatus = faStatus;
            }
            
            // Extract bird rights
            const $birdIcon = $tag.find('.sw_playerProfile__birdRights_icon');
            if ($birdIcon.length > 0) {
                const birdTitle = $birdIcon.attr('title') || '';
                player.birdRights = this.parseBirdRights(birdTitle);
            }
        });
        
        return player;
    }

    parseComplexSalaryCell($cell) {
        // Extract all salary components from the complex cell structure
        const capHit = this.parseSalaryFromElement($cell.find('.cap_hit'));
        const guaranteed = this.parseSalaryFromElement($cell.find('.guaranteed'));
        const baseSalary = this.parseSalaryFromElement($cell.find('.base_salary'));
        const incentives = this.parseSalaryFromElement($cell.find('.incentive'));
        
        return {
            capHit: capHit || 0,
            guaranteed: guaranteed || 0,
            baseSalary: baseSalary || 0,
            incentives: incentives || 0
        };
    }

    parseSalaryFromElement($element) {
        if ($element.length === 0) return 0;
        const text = $element.text().trim();
        return this.parseSalary(text);
    }

    extractOptionType($cell) {
        // Check for player/team option indicators
        const $option = $cell.find('.team_option_tag');
        if ($option.length > 0) {
            const optionText = $option.text().trim();
            if (optionText === 'P') return 'Player Option';
            if (optionText === 'T') return 'Team Option';
        }
        return null;
    }

    parseBirdRights(titleText) {
        if (titleText.includes('Bird (QVFA)')) return 'Full Bird Rights';
        if (titleText.includes('Early-Bird')) return 'Early Bird Rights';
        if (titleText.includes('Non-Bird')) return 'Non-Bird Rights';
        return titleText;
    }

    cleanPlayerName(nameText) {
        // Handle "Last, First" format
        return nameText.replace(/^([^,]+),\s*(.+)$/, '$2 $1').trim();
    }

    parseSalary(salaryText) {
        // Extract first dollar amount from text like "$45,999,660$45,999,660$45,999,660$0"
        const match = salaryText.match(/\$([0-9,]+)/);
        if (match) {
            return parseInt(match[1].replace(/,/g, '')) || 0;
        }
        return 0;
    }

    extractTradeExceptions($) {
        const exceptions = [];
        
        $('table').each((index, table) => {
            const $table = $(table);
            if ($table.hasClass('sw_table__tradeExptn') || $table.attr('id') === 'sw_table__tradeExptn_tm') {
                $table.find('tbody tr').each((i, row) => {
                    const $row = $(row);
                    const cells = $row.find('td').map((j, cell) => $(cell).text().trim()).get();
                    
                    if (cells.length >= 6) {
                        exceptions.push({
                            player: cells[0],
                            amount: this.parseSalary(cells[1]),
                            used: this.parseSalary(cells[2]),
                            remaining: this.parseSalary(cells[3]),
                            startDate: cells[4],
                            endDate: cells[5]
                        });
                    }
                });
                return false; // Break after finding table
            }
        });
        
        return exceptions;
    }

    extractCapStatistics($) {
        const capData = {
            capHit: 0,
            capRoom: 0,
            luxuryTaxRoom: 0,
            salaryFloor: 0,
            hardCap: null,
            apronStatus: {},
            years: {}
        };
        
        // Find cap statistics tables
        $('.sw_teamProfileStats__table').each((index, table) => {
            const $table = $(table);
            const headers = $table.find('thead th, tr:first td').map((i, th) => $(th).text().trim()).get();
            
            $table.find('tr').each((i, row) => {
                const $row = $(row);
                const cells = $row.find('td').map((j, cell) => $(cell).text().trim()).get();
                
                if (cells.length > 6 && cells[5]) { // Has current year data
                    const label = cells[5];
                    const currentValue = cells[6];
                    
                    if (label.includes('ROSTER CAP HIT')) {
                        capData.capHit = this.parseSalary(currentValue);
                    } else if (label.includes('CAP ROOM')) {
                        capData.capRoom = this.parseSalary(currentValue);
                    } else if (label.includes('LUXURY TAX')) {
                        capData.luxuryTaxRoom = this.parseSalary(currentValue);
                    } else if (label.includes('CAP FLOOR')) {
                        capData.salaryFloor = this.parseSalary(currentValue);
                    }
                    
                    // Extract multi-year projections
                    for (let yearCol = 7; yearCol < Math.min(cells.length, 12); yearCol++) {
                        const yearHeader = headers[yearCol];
                        const yearValue = this.parseSalary(cells[yearCol]);
                        
                        if (yearHeader && yearValue > 0) {
                            if (!capData.years[yearHeader]) {
                                capData.years[yearHeader] = {};
                            }
                            
                            if (label.includes('CAP HIT')) {
                                capData.years[yearHeader].capHit = yearValue;
                            } else if (label.includes('CAP ROOM')) {
                                capData.years[yearHeader].capRoom = yearValue;
                            } else if (label.includes('CAP')) {
                                capData.years[yearHeader].salaryCap = yearValue;
                            }
                        }
                    }
                }
            });
        });
        
        // Extract apron and hard cap information from page text
        const pageText = $('body').text();
        if (pageText.includes('First Apron')) {
            capData.apronStatus.firstApron = 'At or Above';
        } else if (pageText.includes('Second Apron')) {
            capData.apronStatus.secondApron = 'At or Above';
        }
        
        if (pageText.includes('Hard Cap')) {
            capData.hardCap = 'Active';
        }
        
        return capData;
    }

    extractRosterStats($) {
        // Extract roster size, average age, etc.
        const stats = {};
        
        $('table').each((index, table) => {
            const $table = $(table);
            if ($table.hasClass('sw_teamProfileStats__table')) {
                $table.find('tr').each((i, row) => {
                    const $row = $(row);
                    const label = $row.find('td:first').text().trim();
                    const value = $row.find('td:nth-child(7)').text().trim(); // Current season column
                    
                    if (label.includes('ROSTER SIZE')) {
                        stats.rosterSize = parseInt(value) || 0;
                    } else if (label.includes('AVERAGE AGE')) {
                        stats.averageAge = parseFloat(value) || 0;
                    }
                });
                return false;
            }
        });
        
        return stats;
    }

    extractDraftPicks($) {
        const picks = {
            owned: {},
            traded: {},
            incoming: {}
        };
        
        $('#sw_teamProfile__draftTable').each((index, table) => {
            const $table = $(table);
            const headers = $table.find('thead th').map((i, th) => $(th).text().trim()).get();
            
            $table.find('tbody tr').each((rowIndex, row) => {
                const $row = $(row);
                const roundLabel = $row.find('td:first').text().trim();
                
                headers.forEach((year, colIndex) => {
                    if (!year.match(/20\d{2}/) || colIndex === 0) return;
                    
                    const $cell = $($row.find('td')[colIndex]);
                    const pickElements = $cell.find('.d_pick');
                    
                    if (!picks.owned[year]) picks.owned[year] = { round1: [], round2: [] };
                    if (!picks.traded[year]) picks.traded[year] = { round1: [], round2: [] };
                    if (!picks.incoming[year]) picks.incoming[year] = { round1: [], round2: [] };
                    
                    pickElements.each((pickIndex, pickElement) => {
                        const $pick = $(pickElement);
                        const isTraded = $pick.hasClass('d_pick_traded');
                        const isConditional = $pick.parent().find('.condit').length > 0;
                        const isContention = $pick.parent().find('.sw_teamProfile__draftPick_inContention').length > 0;
                        
                        const pickData = {
                            round: roundLabel.includes('1') ? 1 : 2,
                            status: isTraded ? 'traded' : 'owned',
                            conditional: isConditional,
                            inContention: isContention,
                            title: $pick.parent().attr('title') || ''
                        };
                        
                        const roundKey = roundLabel.includes('1') ? 'round1' : 'round2';
                        
                        if (isTraded) {
                            picks.traded[year][roundKey].push(pickData);
                        } else {
                            picks.owned[year][roundKey].push(pickData);
                        }
                    });
                });
            });
        });
        
        return picks;
    }

    extractCapHolds($) {
        const capHolds = [];
        
        // Find cap holds table - usually contains "FA Cap Hold" in header
        $('table').each((index, table) => {
            const $table = $(table);
            const headerText = $table.find('thead th:first, tr:first td:first').text();
            
            if (headerText.includes('FA Cap Hold') || headerText.includes('Cap Hold')) {
                const totalHold = this.parseSalary(headerText);
                
                $table.find('tbody tr').each((i, row) => {
                    const $row = $(row);
                    const cells = $row.find('td');
                    
                    if (cells.length > 0) {
                        const playerName = $(cells[0]).text().trim();
                        if (playerName && !playerName.includes('TOTAL')) {
                            const capHold = {
                                player: this.cleanPlayerName(playerName),
                                amount: totalHold / $table.find('tbody tr').length, // Estimate individual hold
                                status: $(cells[1]).text().trim(),
                                age: parseInt($(cells[3]).text().trim()) || null,
                                position: $(cells[4]).text().trim()
                            };
                            capHolds.push(capHold);
                        }
                    }
                });
            }
        });
        
        return capHolds;
    }

    extractExceptions($) {
        const exceptions = {
            trade: [],
            signing: {}
        };
        
        // Extract trade exceptions (already handled)
        exceptions.trade = this.extractTradeExceptions($);
        
        // Extract signing exceptions from page content
        const pageText = $('body').text();
        
        // Look for MLE, BAE, etc. mentions
        if (pageText.includes('MLE') || pageText.includes('Mid-Level')) {
            const mleMatch = pageText.match(/MLE[^\d]*(\$?[\d,]+)/);
            if (mleMatch) {
                exceptions.signing.midLevel = this.parseSalary(mleMatch[1]);
            }
        }
        
        if (pageText.includes('BAE') || pageText.includes('Bi-Annual')) {
            const baeMatch = pageText.match(/BAE[^\d]*(\$?[\d,]+)/);
            if (baeMatch) {
                exceptions.signing.biAnnual = this.parseSalary(baeMatch[1]);
            }
        }
        
        if (pageText.includes('Room Exception')) {
            const roomMatch = pageText.match(/Room Exception[^\d]*(\$?[\d,]+)/);
            if (roomMatch) {
                exceptions.signing.room = this.parseSalary(roomMatch[1]);
            }
        }
        
        return exceptions;
    }

    async scrapeAllTeams() {
        console.log('🚀 Starting SalarySwish scrape for all 30 NBA teams...');
        console.log('📊 Targeting high-value salary cap data only');
        
        const startTime = Date.now();
        
        for (const team of this.teams) {
            const teamData = await this.scrapeTeam(team);
            this.results.teams[team.slug] = teamData;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log(`\n✅ Scraping complete! (${duration.toFixed(1)}s)`);
        
        this.saveResults();
        this.generateSummary();
        
        return this.results;
    }

    saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join(__dirname, 'output', `salaryswish_contracts_${timestamp}.json`);
        
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
        console.log(`💾 Complete results saved to: ${outputPath}`);
        return outputPath;
    }

    generateSummary() {
        const teams = Object.values(this.results.teams);
        const successfulTeams = teams.filter(t => !t.metadata.error);
        const totalPlayers = successfulTeams.reduce((sum, team) => sum + (team.players?.length || 0), 0);
        
        console.log('\n📊 SCRAPING SUMMARY:');
        console.log(`   Teams scraped: ${teams.length}/30`);
        console.log(`   Successful: ${successfulTeams.length}`);
        console.log(`   Total players: ${totalPlayers}`);
        console.log(`   Data points: Contract salaries, exceptions, cap space`);
    }

    // Test with single team first
    async testSingleTeam(teamSlug = 'hawks') {
        const team = this.teams.find(t => t.slug === teamSlug);
        if (!team) {
            console.error(`❌ Team not found: ${teamSlug}`);
            return null;
        }

        console.log('🧪 TESTING SINGLE TEAM SCRAPER');
        console.log('=' .repeat(40));
        
        const result = await this.scrapeTeam(team);
        
        console.log('\n📊 TEST RESULTS:');
        console.log(`Players found: ${result.players?.length || 0}`);
        console.log(`Exceptions found: ${result.exceptions?.length || 0}`);
        console.log(`Cap data: ${result.capSpace ? 'Yes' : 'No'}`);
        
        // Save test results
        const testPath = path.join(__dirname, `test_${teamSlug}_result.json`);
        fs.writeFileSync(testPath, JSON.stringify(result, null, 2));
        console.log(`💾 Test results: ${testPath}`);
        
        return result;
    }
}

// Command-line interface
if (require.main === module) {
    const scraper = new SalarySwishScraper();
    
    const args = process.argv.slice(2);
    const command = args[0];
    const teamsArg = args.find(arg => arg.startsWith('--team'));
    const teamsArgValue = teamsArg ? teamsArg.split('=')[1] || args[args.indexOf(teamsArg) + 1] : null;
    
    if (teamsArgValue) {
        const teamSlugs = teamsArgValue.split(',');
        console.log(`🏀 Testing SalarySwish scraper with teams: ${teamSlugs.join(', ')}`);
        
        (async () => {
            const startTime = Date.now();
            
            for (const teamSlug of teamSlugs) {
                const team = scraper.teams.find(t => t.slug === teamSlug.trim());
                if (team) {
                    const teamData = await scraper.scrapeTeam(team);
                    scraper.results.teams[team.slug] = teamData;
                    
                    // Rate limiting between teams
                    if (teamSlugs.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } else {
                    console.error(`❌ Team not found: ${teamSlug}`);
                }
            }
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`\n✅ Scraping complete! (${duration.toFixed(1)}s)`);
            
            const outputPath = scraper.saveResults();
            scraper.generateSummary();
            
            console.log(`\n📊 FINAL OUTPUT: ${outputPath}`);
        })();
    } else {
        console.log('Usage:');
        console.log('  node targeted_salaryswish_scraper.cjs --team hawks');
        console.log('  node targeted_salaryswish_scraper.cjs --teams hawks,celtics,warriors');
    }
}

module.exports = SalarySwishScraper;