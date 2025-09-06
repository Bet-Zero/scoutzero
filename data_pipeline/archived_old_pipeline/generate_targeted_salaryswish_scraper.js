/**
 * TARGETED SALARYSWISH SCRAPER GENERATOR
 * =====================================
 * 
 * This script generates a production-ready SalarySwish scraper based on
 * data analysis results from analyze_salaryswish_data.js
 * 
 * Input: Scraper configuration from analysis
 * Output: Complete targeted scraper for all 30 NBA teams
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NBA Team to SalarySwish slug mapping
const NBA_TEAM_SLUGS = [
    { name: 'Atlanta Hawks', slug: 'hawks', abbrev: 'ATL' },
    { name: 'Boston Celtics', slug: 'celtics', abbrev: 'BOS' },
    { name: 'Brooklyn Nets', slug: 'nets', abbrev: 'BKN' },
    { name: 'Charlotte Hornets', slug: 'hornets', abbrev: 'CHA' },
    { name: 'Chicago Bulls', slug: 'bulls', abbrev: 'CHI' },
    { name: 'Cleveland Cavaliers', slug: 'cavaliers', abbrev: 'CLE' },
    { name: 'Dallas Mavericks', slug: 'mavericks', abbrev: 'DAL' },
    { name: 'Denver Nuggets', slug: 'nuggets', abbrev: 'DEN' },
    { name: 'Detroit Pistons', slug: 'pistons', abbrev: 'DET' },
    { name: 'Golden State Warriors', slug: 'warriors', abbrev: 'GSW' },
    { name: 'Houston Rockets', slug: 'rockets', abbrev: 'HOU' },
    { name: 'Indiana Pacers', slug: 'pacers', abbrev: 'IND' },
    { name: 'Los Angeles Clippers', slug: 'clippers', abbrev: 'LAC' },
    { name: 'Los Angeles Lakers', slug: 'lakers', abbrev: 'LAL' },
    { name: 'Memphis Grizzlies', slug: 'grizzlies', abbrev: 'MEM' },
    { name: 'Miami Heat', slug: 'heat', abbrev: 'MIA' },
    { name: 'Milwaukee Bucks', slug: 'bucks', abbrev: 'MIL' },
    { name: 'Minnesota Timberwolves', slug: 'timberwolves', abbrev: 'MIN' },
    { name: 'New Orleans Pelicans', slug: 'pelicans', abbrev: 'NOP' },
    { name: 'New York Knicks', slug: 'knicks', abbrev: 'NYK' },
    { name: 'Oklahoma City Thunder', slug: 'thunder', abbrev: 'OKC' },
    { name: 'Orlando Magic', slug: 'magic', abbrev: 'ORL' },
    { name: 'Philadelphia 76ers', slug: '76ers', abbrev: 'PHI' },
    { name: 'Phoenix Suns', slug: 'suns', abbrev: 'PHX' },
    { name: 'Portland Trail Blazers', slug: 'trail-blazers', abbrev: 'POR' },
    { name: 'Sacramento Kings', slug: 'kings', abbrev: 'SAC' },
    { name: 'San Antonio Spurs', slug: 'spurs', abbrev: 'SAS' },
    { name: 'Toronto Raptors', slug: 'raptors', abbrev: 'TOR' },
    { name: 'Utah Jazz', slug: 'jazz', abbrev: 'UTA' },
    { name: 'Washington Wizards', slug: 'wizards', abbrev: 'WAS' }
];

function generateTargetedScraper(scraperConfig) {
    const scraperTemplate = `/**
 * TARGETED SALARYSWISH SCRAPER - AUTO-GENERATED
 * ============================================
 * 
 * Generated based on comprehensive data analysis.
 * Targets specific tables and data patterns identified from SalarySwish structure.
 * 
 * Generated on: ${new Date().toISOString()}
 * Expected yield: ${scraperConfig.estimatedDataPerTeam} players per team
 * Primary selectors: ${scraperConfig.tableSelectors.length}
 * Fallback selectors: ${scraperConfig.fallbackSelectors.length}
 * 
 * Usage: node targeted_salaryswish_scraper.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Team configurations
const NBA_TEAMS = ${JSON.stringify(NBA_TEAM_SLUGS, null, 4)};

// Scraper configuration (generated from analysis)
const SCRAPER_CONFIG = ${JSON.stringify(scraperConfig, null, 4)};

function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(\`[\${timestamp}] \${message}\`);
}

/**
 * Parse salary string to numeric value
 */
function parseSalary(salaryStr) {
    if (!salaryStr || typeof salaryStr !== 'string') return null;
    
    // Remove all non-numeric characters except decimal point
    const cleaned = salaryStr.replace(/[^\\d.]/g, '');
    const number = parseFloat(cleaned);
    
    if (isNaN(number)) return null;
    
    // Handle M/K suffixes
    if (salaryStr.toLowerCase().includes('m')) {
        return Math.round(number * 1000000);
    } else if (salaryStr.toLowerCase().includes('k')) {
        return Math.round(number * 1000);
    }
    
    return Math.round(number);
}

/**
 * Extract contract years from table headers
 */
function extractContractYears(headers) {
    const yearPattern = /20\\d{2}[-–]\\d{2}/g;
    const years = [];
    
    headers.forEach(header => {
        const matches = header.match(yearPattern);
        if (matches) {
            years.push(...matches);
        }
    });
    
    return [...new Set(years)].sort();
}

/**
 * Parse player contract data from table row
 */
function parsePlayerRow(row, headers, contractYears) {
    if (!row || row.length < 2) return null;
    
    const player = {
        name: row[0]?.trim(),
        position: '',
        contracts: {},
        options: {},
        incentives: {}
    };
    
    // Skip if no valid name
    if (!player.name || !player.name.match(/^[A-Za-z\\s\\.'\\-]+$/)) return null;
    
    // Find position (usually second column or embedded in name)
    if (row[1] && row[1].match(/^[A-Z]{1,3}$/)) {
        player.position = row[1].trim();
    }
    
    // Extract salary data for each contract year
    contractYears.forEach(year => {
        headers.forEach((header, index) => {
            if (header.includes(year) && row[index]) {
                const salary = parseSalary(row[index]);
                if (salary && salary > 0) {
                    player.contracts[year] = {
                        salary: salary,
                        guaranteed: !row[index].toLowerCase().includes('option')
                    };
                    
                    // Check for options/incentives
                    if (row[index].toLowerCase().includes('team option')) {
                        player.options[year] = 'team';
                    } else if (row[index].toLowerCase().includes('player option')) {
                        player.options[year] = 'player';
                    }
                }
            }
        });
    });
    
    // Only return player if they have at least one valid contract
    return Object.keys(player.contracts).length > 0 ? player : null;
}

/**
 * Scrape team data from SalarySwish
 */
async function scrapeTeamSalaryData(team) {
    try {
        const url = \`https://www.salaryswish.com/teams/\${team.slug}\`;
        logProgress(\`📊 Scraping \${team.name}...\`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(30000)
        });
        
        if (!response.ok) {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
        
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        // Try primary selectors first
        let targetTable = null;
        let usedSelector = '';
        
        for (const selector of SCRAPER_CONFIG.tableSelectors) {
            const table = document.querySelector(selector);
            if (table && table.querySelectorAll('tr').length > 5) {
                targetTable = table;
                usedSelector = selector;
                break;
            }
        }
        
        // Fallback to secondary selectors
        if (!targetTable) {
            for (const selector of SCRAPER_CONFIG.fallbackSelectors) {
                const table = document.querySelector(selector);
                if (table && table.querySelectorAll('tr').length > 5) {
                    targetTable = table;
                    usedSelector = selector + ' (fallback)';
                    break;
                }
            }
        }
        
        if (!targetTable) {
            logProgress(\`     ❌ No suitable table found using configured selectors\`);
            return { team: team.name, players: [], contracts: [], exceptions: [] };
        }
        
        logProgress(\`     ✅ Found table using: \${usedSelector}\`);
        
        // Extract table data
        const rows = Array.from(targetTable.querySelectorAll('tr'));
        if (rows.length < 2) {
            logProgress(\`     ❌ Table has insufficient data (\${rows.length} rows)\`);
            return { team: team.name, players: [], contracts: [], exceptions: [] };
        }
        
        // Get headers and extract contract years
        const headerRow = rows[0];
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => cell.textContent.trim());
        const contractYears = extractContractYears(headers);
        
        logProgress(\`     📋 Headers: [\${headers.slice(0, 4).join(', ')}\${headers.length > 4 ? '...' : ''}]\`);
        logProgress(\`     📅 Contract years: [\${contractYears.join(', ')}]\`);
        
        // Parse player data
        const players = [];
        const contracts = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = Array.from(rows[i].querySelectorAll('th, td')).map(cell => cell.textContent.trim());
            const player = parsePlayerRow(row, headers, contractYears);
            
            if (player) {
                players.push(player);
                
                // Convert to contract format for compatibility
                Object.entries(player.contracts).forEach(([year, contract]) => {
                    contracts.push({
                        player: player.name,
                        team: team.name,
                        season: year,
                        salary: contract.salary,
                        guaranteed: contract.guaranteed
                    });
                });
            }
        }
        
        // Try to extract exception data
        const exceptions = [];
        for (const selector of SCRAPER_CONFIG.exceptionSelectors) {
            const section = document.querySelector(selector);
            if (section) {
                const text = section.textContent.toLowerCase();
                
                // Look for common exception patterns
                if (text.includes('mid-level') || text.includes('mle')) {
                    exceptions.push({ type: 'Mid-Level Exception', amount: null });
                }
                if (text.includes('bi-annual') || text.includes('bae')) {
                    exceptions.push({ type: 'Bi-Annual Exception', amount: null });
                }
                if (text.includes('traded player') || text.includes('tpe')) {
                    exceptions.push({ type: 'Traded Player Exception', amount: null });
                }
            }
        }
        
        logProgress(\`     ✅ Found \${players.length} players with contracts\`);
        if (exceptions.length > 0) {
            logProgress(\`     ✅ Found \${exceptions.length} exceptions\`);
        }
        
        return {
            team: team.name,
            abbrev: team.abbrev,
            players: players,
            contracts: contracts,
            exceptions: exceptions,
            metadata: {
                scrapedAt: new Date().toISOString(),
                url: url,
                selector: usedSelector,
                tableRows: rows.length - 1,
                contractYears: contractYears
            }
        };
        
    } catch (error) {
        logProgress(\`     ❌ Error scraping \${team.name}: \${error.message}\`);
        return { team: team.name, players: [], contracts: [], exceptions: [], error: error.message };
    }
}

/**
 * Scrape all 30 NBA teams
 */
async function scrapeAllTeams() {
    logProgress('🚀 TARGETED SALARYSWISH SCRAPING');
    logProgress('================================');
    logProgress(\`Targeting \${SCRAPER_CONFIG.tableSelectors.length} primary selectors with \${SCRAPER_CONFIG.fallbackSelectors.length} fallbacks\`);
    logProgress(\`Expected yield: \${SCRAPER_CONFIG.estimatedDataPerTeam} players per team\`);
    logProgress('');
    
    const results = {
        scrapedAt: new Date().toISOString(),
        configuration: SCRAPER_CONFIG,
        teams: [],
        summary: {
            totalTeams: NBA_TEAMS.length,
            successfulTeams: 0,
            totalPlayers: 0,
            totalContracts: 0,
            errors: []
        }
    };
    
    // Process teams with delay to be respectful
    for (let i = 0; i < NBA_TEAMS.length; i++) {
        const team = NBA_TEAMS[i];
        const teamData = await scrapeTeamSalaryData(team);
        
        results.teams.push(teamData);
        
        if (teamData.players && teamData.players.length > 0) {
            results.summary.successfulTeams++;
            results.summary.totalPlayers += teamData.players.length;
            results.summary.totalContracts += teamData.contracts ? teamData.contracts.length : 0;
        } else if (teamData.error) {
            results.summary.errors.push(\`\${team.name}: \${teamData.error}\`);
        }
        
        // Progress update every 5 teams
        if ((i + 1) % 5 === 0) {
            logProgress(\`📊 Progress: \${i + 1}/\${NBA_TEAMS.length} teams completed (\${results.summary.successfulTeams} successful)\`);
        }
        
        // Small delay between requests
        if (i < NBA_TEAMS.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Save results
    const outputFile = path.join(__dirname, 'salaryswish_targeted_results.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    // Final summary
    logProgress('');
    logProgress('🎉 SCRAPING COMPLETE!');
    logProgress('====================');
    logProgress(\`✅ Successful teams: \${results.summary.successfulTeams}/\${results.summary.totalTeams}\`);
    logProgress(\`✅ Total players: \${results.summary.totalPlayers}\`);
    logProgress(\`✅ Total contracts: \${results.summary.totalContracts}\`);
    logProgress(\`✅ Results saved: \${outputFile}\`);
    
    if (results.summary.errors.length > 0) {
        logProgress('');
        logProgress('❌ ERRORS:');
        results.summary.errors.forEach(error => logProgress(\`   \${error}\`));
    }
    
    return results;
}

// Main execution
if (import.meta.url === \`file://\${process.argv[1]}\`) {
    scrapeAllTeams();
}

export { scrapeAllTeams, scrapeTeamSalaryData };
`;
    
    return scraperTemplate;
}

/**
 * Generate complete SalarySwish pipeline replacement
 */
async function generateCompletePipeline(scraperConfig) {
    const scraper = generateTargetedScraper(scraperConfig);
    
    // Save the generated scraper
    const scraperFile = path.join(__dirname, 'targeted_salaryswish_scraper.js');
    fs.writeFileSync(scraperFile, scraper);
    
    console.log('✅ Generated targeted SalarySwish scraper');
    console.log(`   File: ${scraperFile}`);
    
    // Create integration guide
    const integrationGuide = `# SalarySwish Integration Guide

## Generated Files

1. **targeted_salaryswish_scraper.js** - Production scraper based on data analysis
2. **salaryswish_scraper_config.json** - Configuration extracted from comprehensive analysis

## Usage

### Step 1: Run Targeted Scraper
\`\`\`bash
node targeted_salaryswish_scraper.js
\`\`\`
Output: \`salaryswish_targeted_results.json\`

### Step 2: Integration with Existing Pipeline
The output format is compatible with existing pipeline:
- \`migrate_and_structure.js\` can process the results
- \`load_to_firebase.js\` can upload to Firebase
- Maintains schema compatibility with frontend

### Step 3: Replace Spotrac Pipeline
Update \`local_fresh_data_scraper.js\`:
- Replace Spotrac scraping with SalarySwish results
- Maintain NBA stats scraping (unchanged)
- Merge data in same format

## Benefits Achieved

- **30 requests total** (vs 60 with Spotrac)
- **${scraperConfig.estimatedDataPerTeam} players per team** expected
- **Multi-year contract data** from single page
- **Exception data** where available
- **Robust fallback selectors** for reliability

## Configuration Details

Primary Selectors: ${scraperConfig.tableSelectors.length}
Fallback Selectors: ${scraperConfig.fallbackSelectors.length}  
Exception Selectors: ${scraperConfig.exceptionSelectors.length}
Salary Patterns: ${scraperConfig.salaryPatterns.length}
`;
    
    const guideFile = path.join(__dirname, 'SALARYSWISH_INTEGRATION_GUIDE.md');
    fs.writeFileSync(guideFile, integrationGuide);
    
    console.log('✅ Generated integration guide');
    console.log(`   File: ${guideFile}`);
    
    return {
        scraperFile,
        guideFile,
        configuration: scraperConfig
    };
}

// Export functions
export { generateTargetedScraper, generateCompletePipeline };

// Command line usage  
if (import.meta.url === `file://${process.argv[1]}`) {
    const configFile = process.argv[2] || 'salaryswish_scraper_config.json';
    
    try {
        const scraperConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        generateCompletePipeline(scraperConfig);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        console.log('Usage: node generate_targeted_salaryswish_scraper.js [config-file]');
        console.log('Default: salaryswish_scraper_config.json');
    }
}