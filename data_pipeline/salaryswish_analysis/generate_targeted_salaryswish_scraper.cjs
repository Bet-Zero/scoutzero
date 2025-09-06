#!/usr/bin/env node

/**
 * SalarySwish Targeted Scraper Generator
 * 
 * Based on the comprehensive data analysis, this generates a production-ready
 * scraper that extracts only the essential salary cap data efficiently.
 */

const fs = require('fs');
const path = require('path');

class SalarySwishScraperGenerator {
    constructor() {
        this.analysisPath = path.join(__dirname, 'hawks_data_analysis.json');
        this.templatePath = path.join(__dirname, 'targeted_scraper_template.js');
        this.analysis = null;
    }

    loadAnalysis() {
        try {
            console.log('📊 Loading data analysis...');
            const rawData = fs.readFileSync(this.analysisPath, 'utf8');
            this.analysis = JSON.parse(rawData);
            console.log(`✅ Loaded analysis of ${this.analysis.totalTables} tables`);
            return true;
        } catch (error) {
            console.error('❌ Analysis file not found. Run analyze_salaryswish_data.js first');
            return false;
        }
    }

    generateScraperCode() {
        const highPriorityTables = this.analysis.tableAnalysis.filter(t => t.confidence === 'HIGH');
        const mediumPriorityTables = this.analysis.tableAnalysis.filter(t => t.confidence === 'MEDIUM');

        const scraperCode = `#!/usr/bin/env node

/**
 * SalarySwish Targeted NBA Salary Cap Scraper
 * Generated automatically based on comprehensive data analysis
 * 
 * Extracts only essential salary cap data efficiently from SalarySwish.com
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

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
            console.log(\`🏀 Scraping \${team.name} (\${team.slug})...\`);
            
            const url = \`\${this.baseURL}/\${team.slug}\`;
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const teamData = {
                metadata: {
                    name: team.name,
                    slug: team.slug,
                    url: url,
                    scrapedAt: new Date().toISOString()
                }
            };

            // Extract high-priority data based on analysis
            ${this.generateExtractionCode(highPriorityTables)}

            // Extract medium-priority supplementary data
            ${this.generateExtractionCode(mediumPriorityTables, 'supplementary')}

            console.log(\`✅ \${team.name}: Found \${teamData.players?.length || 0} players\`);
            return teamData;

        } catch (error) {
            console.error(\`❌ \${team.name}: \${error.message}\`);
            return {
                metadata: { name: team.name, slug: team.slug, error: error.message },
                players: []
            };
        }
    }

    ${this.generateHelperMethods()}

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
        console.log(\`\\n✅ Scraping complete! (\${duration.toFixed(1)}s)\`);
        
        this.saveResults();
        this.generateSummary();
        
        return this.results;
    }

    saveResults() {
        const outputPath = path.join(__dirname, '../salaryswish_targeted_data.json');
        fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
        console.log(\`💾 Results saved to: \${outputPath}\`);
    }

    generateSummary() {
        const teams = Object.values(this.results.teams);
        const successfulTeams = teams.filter(t => !t.metadata.error);
        const totalPlayers = successfulTeams.reduce((sum, team) => sum + (team.players?.length || 0), 0);
        
        console.log('\\n📊 SCRAPING SUMMARY:');
        console.log(\`   Teams scraped: \${teams.length}/30\`);
        console.log(\`   Successful: \${successfulTeams.length}\`);
        console.log(\`   Total players: \${totalPlayers}\`);
        console.log(\`   Data points: Contract salaries, exceptions, cap space\`);
    }

    // Test with single team first
    async testSingleTeam(teamSlug = 'hawks') {
        const team = this.teams.find(t => t.slug === teamSlug);
        if (!team) {
            console.error(\`❌ Team not found: \${teamSlug}\`);
            return null;
        }

        console.log('🧪 TESTING SINGLE TEAM SCRAPER');
        console.log('=' .repeat(40));
        
        const result = await this.scrapeTeam(team);
        
        console.log('\\n📊 TEST RESULTS:');
        console.log(\`Players found: \${result.players?.length || 0}\`);
        console.log(\`Exceptions found: \${result.exceptions?.length || 0}\`);
        console.log(\`Cap data: \${result.capSpace ? 'Yes' : 'No'}\`);
        
        // Save test results
        const testPath = path.join(__dirname, \`test_\${teamSlug}_result.json\`);
        fs.writeFileSync(testPath, JSON.stringify(result, null, 2));
        console.log(\`💾 Test results: \${testPath}\`);
        
        return result;
    }
}

// Command-line interface
if (require.main === module) {
    const scraper = new SalarySwishScraper();
    
    const command = process.argv[2];
    const teamSlug = process.argv[3];
    
    if (command === 'test') {
        scraper.testSingleTeam(teamSlug);
    } else if (command === 'all') {
        scraper.scrapeAllTeams();
    } else {
        console.log('Usage:');
        console.log('  node targeted_salaryswish_scraper.js test [team-slug]  # Test single team');
        console.log('  node targeted_salaryswish_scraper.js all              # Scrape all teams');
    }
}

module.exports = SalarySwishScraper;`;

        return scraperCode;
    }

    generateExtractionCode(tables, category = 'primary') {
        if (!tables.length) return '// No tables identified for this category';

        let code = `\n            // ${category.toUpperCase()} DATA EXTRACTION\n`;
        
        tables.forEach(table => {
            if (table.purpose === 'Multi-Year Player Contracts') {
                code += `
            // Table ${table.index}: Main Roster Contracts
            teamData.players = this.extractPlayerContracts($);
            teamData.rosterStats = this.extractRosterStats($);`;
                
            } else if (table.purpose === 'Trade Exceptions') {
                code += `
            // Table ${table.index}: Trade Exceptions  
            teamData.tradeExceptions = this.extractTradeExceptions($);`;
                
            } else if (table.purpose === 'Draft Picks') {
                code += `
            // Table ${table.index}: Draft Picks
            teamData.draftPicks = this.extractDraftPicks($);`;
                
            } else if (table.purpose === 'Salary Cap Statistics') {
                code += `
            // Table ${table.index}: Cap Statistics
            teamData.capSpace = this.extractCapStatistics($);`;
            }
        });

        return code;
    }

    generateHelperMethods() {
        return `
    extractPlayerContracts($) {
        const players = [];
        
        // Find main roster table (typically has multi-year columns)
        $('table').each((index, table) => {
            const $table = $(table);
            const headers = [];
            $table.find('thead th').each((i, th) => {
                headers.push($(th).text().trim());
            });
            
            // Look for multi-year salary table
            const hasMultiYear = headers.some(h => /20\\d{2}-\\d{2}/.test(h));
            const hasPlayers = $table.find('tbody tr').length > 5;
            
            if (hasMultiYear && hasPlayers) {
                $table.find('tbody tr').each((i, row) => {
                    const $row = $(row);
                    const cells = $row.find('td').map((j, cell) => $(cell).text().trim()).get();
                    
                    if (cells.length > 0 && cells[0] && !cells[0].includes('TOTAL')) {
                        const player = this.parsePlayerRow(cells, headers);
                        if (player.name) {
                            players.push(player);
                        }
                    }
                });
                return false; // Break after finding main table
            }
        });
        
        return players;
    }

    parsePlayerRow(cells, headers) {
        const player = {
            name: this.cleanPlayerName(cells[0] || ''),
            position: '',
            age: null,
            salaries: {}
        };
        
        // Map data based on headers
        headers.forEach((header, index) => {
            const cell = cells[index] || '';
            
            if (header.toLowerCase().includes('pos')) {
                player.position = cell;
            } else if (header.toLowerCase().includes('age')) {
                player.age = parseInt(cell) || null;
            } else if (header.match(/20\\d{2}-\\d{2}/)) {
                // Extract salary for this year
                const salary = this.parseSalary(cell);
                if (salary > 0) {
                    player.salaries[header] = salary;
                }
            }
        });
        
        return player;
    }

    cleanPlayerName(nameText) {
        // Handle "Last, First" format
        return nameText.replace(/^([^,]+),\\s*(.+)$/, '$2 $1').trim();
    }

    parseSalary(salaryText) {
        // Extract first dollar amount from text like "$45,999,660$45,999,660$45,999,660$0"
        const match = salaryText.match(/\\$([0-9,]+)/);
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
        const capData = {};
        
        // Look for cap-related headings and values
        $('h5').each((i, heading) => {
            const $heading = $(heading);
            const text = $heading.text().trim();
            
            if (text.includes('CAP HIT')) {
                capData.capHit = this.parseSalary(text);
            } else if (text.includes('CAP ROOM')) {
                capData.capRoom = this.parseSalary(text);
            } else if (text.includes('LUXURY TAX')) {
                capData.luxuryTaxRoom = this.parseSalary(text);
            }
        });
        
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
        // Extract draft pick information
        const picks = {};
        
        $('table#sw_teamProfile__draftTable').each((index, table) => {
            const $table = $(table);
            const headers = $table.find('thead th').map((i, th) => $(th).text().trim()).get();
            
            headers.forEach((year, colIndex) => {
                if (year.match(/20\\d{2}/)) {
                    picks[year] = {
                        round1: 'Unknown',
                        round2: 'Unknown'
                    };
                }
            });
        });
        
        return picks;
    }`;
    }

    generateScraper() {
        console.log('🔧 Generating targeted SalarySwish scraper...');
        
        if (!this.loadAnalysis()) {
            return false;
        }

        const scraperCode = this.generateScraperCode();
        const outputPath = path.join(__dirname, '../targeted_salaryswish_scraper.js');
        
        fs.writeFileSync(outputPath, scraperCode);
        console.log(`✅ Scraper generated: ${outputPath}`);
        
        // Make executable
        require('child_process').execSync(`chmod +x "${outputPath}"`);
        
        console.log('\n📋 USAGE:');
        console.log(`node ${outputPath} test hawks    # Test with Hawks`);
        console.log(`node ${outputPath} all          # Scrape all 30 teams`);
        
        return true;
    }

    run() {
        console.log('⚡ SalarySwish Scraper Generator');
        console.log('=' .repeat(40));
        
        const success = this.generateScraper();
        
        if (success) {
            console.log('\n✅ Generator Complete!');
            console.log('Next steps:');
            console.log('1. Test scraper with single team');
            console.log('2. Validate data extraction');
            console.log('3. Scale to all 30 teams');
            console.log('4. Integrate with pipeline');
        }
        
        return success;
    }
}

// Run generator if called directly
if (require.main === module) {
    const generator = new SalarySwishScraperGenerator();
    generator.run();
}

module.exports = SalarySwishScraperGenerator;