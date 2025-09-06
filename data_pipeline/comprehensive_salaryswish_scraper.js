/**
 * COMPREHENSIVE SALARYSWISH SCRAPER
 * =================================
 * 
 * STEP 1: Comprehensive Data Discovery Approach
 * 
 * This implements the correct methodology:
 * 1. Scrape ENTIRE page content from SalarySwish
 * 2. Clean and structure ALL data found 
 * 3. Present complete data inventory for decision-making
 * 4. Build targeted extraction based on what's actually valuable
 * 
 * No assumptions, no guesswork - see everything first, then decide.
 * 
 * Usage: node comprehensive_salaryswish_scraper.js --team hawks
 *        node comprehensive_salaryswish_scraper.js --teams hawks,celtics,warriors
 *        node comprehensive_salaryswish_scraper.js --all (all 30 teams)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComprehensiveSalarySwishScraper {
    constructor() {
        this.baseURL = 'https://www.salaryswish.com/teams';
        this.teams = this.generateTeamList();
        this.outputDir = path.join(__dirname, 'output');
        this.comprenhsiveDataDir = path.join(this.outputDir, 'comprehensive_data');
        
        // Ensure output directories exist
        if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
        if (!fs.existsSync(this.comprenhsiveDataDir)) fs.mkdirSync(this.comprenhsiveDataDir, { recursive: true });
        
        this.results = {
            metadata: {
                scrapedAt: new Date().toISOString(),
                approach: 'comprehensive_first',
                totalTeams: 0
            },
            teamSummaries: {},
            dataInventory: {
                allTablesFound: [],
                allSectionsFound: [],
                uniqueDataTypes: [],
                salaryCapElements: []
            }
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

    logProgress(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'progress' ? '🔄' : '🔍';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async scrapeComprehensiveTeamData(team) {
        try {
            const url = `${this.baseURL}/${team.slug}`;
            this.logProgress(`Starting comprehensive scrape: ${team.name}`);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                signal: AbortSignal.timeout(30000)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            this.logProgress(`Fetched HTML: ${html.length.toLocaleString()} characters`);
            
            // COMPREHENSIVE DATA EXTRACTION - NO ASSUMPTIONS
            const comprehensiveData = {
                metadata: {
                    team: team,
                    url: url,
                    scrapedAt: new Date().toISOString(),
                    htmlSize: html.length
                },
                
                // Extract EVERYTHING we can find
                allTables: this.extractAllTables(document),
                allSections: this.extractAllSections(document),
                allHeadings: this.extractAllHeadings(document),
                allLists: this.extractAllLists(document),
                salaryElements: this.extractSalaryElements(document),
                playerElements: this.extractPlayerElements(document),
                contractElements: this.extractContractElements(document),
                capElements: this.extractCapElements(document),
                exceptionElements: this.extractExceptionElements(document),
                draftElements: this.extractDraftElements(document),
                
                // Structured analysis
                dataAnalysis: {
                    tablesWithSalaryData: 0,
                    tablesWithPlayerData: 0,
                    tablesWithContractData: 0,
                    uniquePlayerNames: [],
                    salaryRanges: { min: null, max: null },
                    yearsCovered: []
                }
            };

            // Analyze the data we found
            this.analyzeComprehensiveData(comprehensiveData);
            
            // Save individual team's complete data
            const teamDataPath = path.join(this.comprenhsiveDataDir, `${team.slug}_comprehensive_data.json`);
            fs.writeFileSync(teamDataPath, JSON.stringify(comprehensiveData, null, 2));
            
            this.logProgress(`Saved comprehensive data: ${teamDataPath}`, 'success');
            
            // Create summary for overall inventory
            const summary = this.createTeamSummary(comprehensiveData);
            this.results.teamSummaries[team.slug] = summary;
            
            this.logProgress(`${team.name}: Found ${comprehensiveData.allTables.length} tables, ${comprehensiveData.salaryElements.length} salary elements`, 'success');
            
            return comprehensiveData;

        } catch (error) {
            this.logProgress(`Error scraping ${team.name}: ${error.message}`, 'error');
            return {
                metadata: { team: team, error: error.message },
                error: true
            };
        }
    }

    extractAllTables(document) {
        const tables = [];
        const tableElements = document.querySelectorAll('table');
        
        tableElements.forEach((table, index) => {
            const tableData = {
                index: index,
                classes: table.className || '',
                id: table.id || '',
                summary: {
                    rows: table.querySelectorAll('tr').length,
                    columns: table.querySelector('tr') ? table.querySelector('tr').querySelectorAll('th, td').length : 0,
                    hasHeaders: table.querySelectorAll('thead, th').length > 0
                },
                headers: [],
                sampleRows: [],
                allTextContent: table.textContent.trim(),
                innerHTML: table.innerHTML
            };
            
            // Extract all headers
            const headerCells = table.querySelectorAll('th');
            headerCells.forEach(th => {
                tableData.headers.push(th.textContent.trim());
            });
            
            // If no th elements, try first row
            if (tableData.headers.length === 0) {
                const firstRow = table.querySelector('tr');
                if (firstRow) {
                    firstRow.querySelectorAll('td').forEach(td => {
                        tableData.headers.push(td.textContent.trim());
                    });
                }
            }
            
            // Extract sample rows (first 3 data rows)
            const rows = table.querySelectorAll('tbody tr, tr');
            for (let i = 0; i < Math.min(3, rows.length); i++) {
                const row = rows[i];
                const rowData = [];
                row.querySelectorAll('td, th').forEach(cell => {
                    rowData.push({
                        text: cell.textContent.trim(),
                        html: cell.innerHTML,
                        classes: cell.className || ''
                    });
                });
                if (rowData.length > 0) {
                    tableData.sampleRows.push(rowData);
                }
            }
            
            // Flag if this table contains salary data
            tableData.containsSalaryData = this.detectsSalaryData(tableData.allTextContent);
            tableData.containsPlayerData = this.detectsPlayerData(tableData.allTextContent);
            tableData.containsContractData = this.detectsContractData(tableData.allTextContent);
            tableData.containsExceptionData = this.detectsExceptionData(tableData.allTextContent);
            
            tables.push(tableData);
        });
        
        return tables;
    }

    extractAllSections(document) {
        const sections = [];
        
        // Look for div sections with meaningful content
        const sectionElements = document.querySelectorAll('div[class*="section"], div[class*="Section"], section, .sw_');
        
        sectionElements.forEach((section, index) => {
            if (section.textContent.trim().length < 10) return; // Skip tiny sections
            
            const sectionData = {
                index: index,
                tag: section.tagName.toLowerCase(),
                classes: section.className || '',
                id: section.id || '',
                textContent: section.textContent.trim().substring(0, 500), // First 500 chars
                innerHTML: section.innerHTML.substring(0, 1000), // First 1000 chars of HTML
                childCount: section.children.length,
                containsSalaryData: this.detectsSalaryData(section.textContent),
                containsPlayerData: this.detectsPlayerData(section.textContent),
                containsContractData: this.detectsContractData(section.textContent),
            };
            
            sections.push(sectionData);
        });
        
        return sections;
    }

    extractAllHeadings(document) {
        const headings = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headingElements.forEach((heading, index) => {
            headings.push({
                level: heading.tagName.toLowerCase(),
                text: heading.textContent.trim(),
                classes: heading.className || '',
                id: heading.id || ''
            });
        });
        
        return headings;
    }

    extractAllLists(document) {
        const lists = [];
        const listElements = document.querySelectorAll('ul, ol');
        
        listElements.forEach((list, index) => {
            const items = [];
            list.querySelectorAll('li').forEach(li => {
                items.push(li.textContent.trim());
            });
            
            lists.push({
                type: list.tagName.toLowerCase(),
                classes: list.className || '',
                itemCount: items.length,
                items: items.slice(0, 5), // First 5 items
                containsSalaryData: this.detectsSalaryData(list.textContent)
            });
        });
        
        return lists;
    }

    extractSalaryElements(document) {
        const salaryElements = [];
        
        // Look for any element containing salary data
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element, index) => {
            const text = element.textContent.trim();
            if (this.detectsSalaryData(text) && text.length < 200) { // Avoid huge blocks
                salaryElements.push({
                    tag: element.tagName.toLowerCase(),
                    classes: element.className || '',
                    text: text,
                    html: element.innerHTML,
                    salaries: this.extractSalaryAmounts(text)
                });
            }
        });
        
        return salaryElements;
    }

    extractPlayerElements(document) {
        const playerElements = [];
        
        // Look for elements that might contain player data
        const potentialPlayerElements = document.querySelectorAll('[class*="player"], [class*="Player"], [class*="roster"], [class*="Roster"]');
        
        potentialPlayerElements.forEach((element, index) => {
            const text = element.textContent.trim();
            if (text.length > 5 && text.length < 300) {
                playerElements.push({
                    classes: element.className || '',
                    text: text,
                    html: element.innerHTML.substring(0, 500),
                    containsSalaryData: this.detectsSalaryData(text)
                });
            }
        });
        
        return playerElements;
    }

    extractContractElements(document) {
        const contractElements = [];
        
        // Look for contract-related elements
        const contractKeywords = ['contract', 'option', 'guaranteed', 'bird rights', 'free agent', 'rfa', 'ufa'];
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element, index) => {
            const text = element.textContent.trim().toLowerCase();
            if (contractKeywords.some(keyword => text.includes(keyword)) && text.length < 200) {
                contractElements.push({
                    tag: element.tagName.toLowerCase(),
                    classes: element.className || '',
                    text: element.textContent.trim(),
                    html: element.innerHTML
                });
            }
        });
        
        return contractElements;
    }

    extractCapElements(document) {
        const capElements = [];
        
        // Look for salary cap related elements
        const capKeywords = ['cap space', 'luxury tax', 'apron', 'hard cap', 'cap room', 'payroll'];
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element, index) => {
            const text = element.textContent.trim().toLowerCase();
            if (capKeywords.some(keyword => text.includes(keyword)) && text.length < 200) {
                capElements.push({
                    tag: element.tagName.toLowerCase(),
                    classes: element.className || '',
                    text: element.textContent.trim(),
                    html: element.innerHTML
                });
            }
        });
        
        return capElements;
    }

    extractExceptionElements(document) {
        const exceptionElements = [];
        
        // Look for trade exception related elements
        const exceptionKeywords = ['exception', 'mle', 'trade exception', 'tpe', 'mid-level', 'bi-annual'];
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element, index) => {
            const text = element.textContent.trim().toLowerCase();
            if (exceptionKeywords.some(keyword => text.includes(keyword)) && text.length < 200) {
                exceptionElements.push({
                    tag: element.tagName.toLowerCase(),
                    classes: element.className || '',
                    text: element.textContent.trim(),
                    html: element.innerHTML
                });
            }
        });
        
        return exceptionElements;
    }

    extractDraftElements(document) {
        const draftElements = [];
        
        // Look for draft pick related elements
        const draftKeywords = ['draft pick', 'pick', '1st round', '2nd round', 'protection', 'conveyed'];
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element, index) => {
            const text = element.textContent.trim().toLowerCase();
            if (draftKeywords.some(keyword => text.includes(keyword)) && text.length < 200) {
                draftElements.push({
                    tag: element.tagName.toLowerCase(),
                    classes: element.className || '',
                    text: element.textContent.trim(),
                    html: element.innerHTML
                });
            }
        });
        
        return draftElements;
    }

    detectsSalaryData(text) {
        return /\$[\d,]+|\d+\.\d+[MK]|\$\d+[MK]|salary|contract|cap hit/i.test(text);
    }

    detectsPlayerData(text) {
        return /\b[A-Z][a-z]+ [A-Z][a-z]+\b|PG|SG|SF|PF|C\b|guard|forward|center/i.test(text);
    }

    detectsContractData(text) {
        return /option|guaranteed|bird rights|free agent|rfa|ufa|contract|rookie scale/i.test(text);
    }

    detectsExceptionData(text) {
        return /exception|mle|tpe|mid-level|bi-annual|trade exception/i.test(text);
    }

    extractSalaryAmounts(text) {
        const salaryMatches = text.match(/\$[\d,]+/g) || [];
        return salaryMatches.map(match => {
            const amount = parseInt(match.replace(/[\$,]/g, ''));
            return { text: match, amount: amount };
        });
    }

    analyzeComprehensiveData(data) {
        // Analyze what we found
        data.dataAnalysis.tablesWithSalaryData = data.allTables.filter(t => t.containsSalaryData).length;
        data.dataAnalysis.tablesWithPlayerData = data.allTables.filter(t => t.containsPlayerData).length;
        data.dataAnalysis.tablesWithContractData = data.allTables.filter(t => t.containsContractData).length;
        
        // Extract unique years mentioned
        const yearMatches = data.allTables.map(t => t.allTextContent).join(' ').match(/20\d{2}-\d{2}/g) || [];
        data.dataAnalysis.yearsCovered = [...new Set(yearMatches)].sort();
        
        // Find salary ranges
        const allSalaries = data.salaryElements.flatMap(e => e.salaries.map(s => s.amount));
        if (allSalaries.length > 0) {
            data.dataAnalysis.salaryRanges.min = Math.min(...allSalaries);
            data.dataAnalysis.salaryRanges.max = Math.max(...allSalaries);
        }
    }

    createTeamSummary(data) {
        return {
            team: data.metadata.team.name,
            dataFound: {
                totalTables: data.allTables.length,
                tablesWithSalaryData: data.dataAnalysis.tablesWithSalaryData,
                tablesWithPlayerData: data.dataAnalysis.tablesWithPlayerData,
                tablesWithContractData: data.dataAnalysis.tablesWithContractData,
                yearsCovered: data.dataAnalysis.yearsCovered,
                salaryElementsFound: data.salaryElements.length,
                contractElementsFound: data.contractElements.length,
                capElementsFound: data.capElements.length,
                exceptionElementsFound: data.exceptionElements.length,
                draftElementsFound: data.draftElements.length
            },
            highValueTables: data.allTables
                .filter(t => t.containsSalaryData || t.containsContractData || t.containsExceptionData)
                .map(t => ({
                    index: t.index,
                    classes: t.classes,
                    headers: t.headers,
                    rows: t.summary.rows,
                    columns: t.summary.columns,
                    dataTypes: {
                        salary: t.containsSalaryData,
                        player: t.containsPlayerData,
                        contract: t.containsContractData,
                        exception: t.containsExceptionData
                    }
                }))
        };
    }

    async run(options = {}) {
        const { teams, all = false } = options;
        
        this.logProgress('Starting Comprehensive SalarySwish Data Discovery', 'progress');
        this.logProgress('=================================================');
        this.logProgress('Approach: Scrape EVERYTHING first, analyze second');
        console.log('');
        
        let teamsToScrape = [];
        
        if (all) {
            teamsToScrape = this.teams;
        } else if (teams) {
            const teamSlugs = teams.split(',').map(s => s.trim());
            teamsToScrape = this.teams.filter(team => teamSlugs.includes(team.slug));
        } else {
            // Default to Hawks for testing
            teamsToScrape = this.teams.filter(team => team.slug === 'hawks');
        }
        
        this.logProgress(`Scraping ${teamsToScrape.length} teams: ${teamsToScrape.map(t => t.name).join(', ')}`);
        console.log('');
        
        // Scrape all teams
        for (const team of teamsToScrape) {
            await this.scrapeComprehensiveTeamData(team);
            console.log(''); // Space between teams
        }
        
        // Create comprehensive summary report
        this.results.metadata.totalTeams = teamsToScrape.length;
        this.createComprehensiveReport();
        
        // Save comprehensive results
        const resultsPath = path.join(this.outputDir, `comprehensive_salaryswish_results_${Date.now()}.json`);
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
        
        this.logProgress(`=================================================`, 'success');
        this.logProgress(`COMPREHENSIVE DATA DISCOVERY COMPLETE`, 'success');
        this.logProgress(`Results saved to: ${resultsPath}`, 'success');
        this.logProgress(`Individual team data in: ${this.comprenhsiveDataDir}`, 'success');
        this.logProgress(`=================================================`, 'success');
        
        return this.results;
    }

    createComprehensiveReport() {
        // Analyze across all teams to create data inventory
        const allTables = [];
        const allDataTypes = new Set();
        const salaryCapElements = [];
        
        Object.values(this.results.teamSummaries).forEach(summary => {
            summary.highValueTables.forEach(table => {
                allTables.push({
                    team: summary.team,
                    ...table
                });
                
                if (table.dataTypes.salary) allDataTypes.add('salary');
                if (table.dataTypes.player) allDataTypes.add('player');
                if (table.dataTypes.contract) allDataTypes.add('contract');
                if (table.dataTypes.exception) allDataTypes.add('exception');
            });
        });
        
        this.results.dataInventory = {
            totalHighValueTables: allTables.length,
            uniqueDataTypes: Array.from(allDataTypes),
            tablesByDataType: {
                salary: allTables.filter(t => t.dataTypes.salary).length,
                player: allTables.filter(t => t.dataTypes.player).length,  
                contract: allTables.filter(t => t.dataTypes.contract).length,
                exception: allTables.filter(t => t.dataTypes.exception).length
            },
            commonTableClasses: this.getMostCommonClasses(allTables),
            recommendedExtractionTargets: this.identifyExtractionTargets(allTables)
        };
    }

    getMostCommonClasses(tables) {
        const classCount = {};
        tables.forEach(table => {
            if (table.classes) {
                table.classes.split(' ').forEach(cls => {
                    if (cls.trim()) {
                        classCount[cls] = (classCount[cls] || 0) + 1;
                    }
                });
            }
        });
        
        return Object.entries(classCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([cls, count]) => ({ class: cls, count }));
    }

    identifyExtractionTargets(tables) {
        // Identify the most valuable tables for extraction
        return tables
            .filter(t => t.rows > 1 && t.columns > 2) // Must have meaningful data
            .map(t => ({
                team: t.team,
                index: t.index,
                classes: t.classes,
                headers: t.headers,
                size: t.rows * t.columns,
                dataTypes: t.dataTypes,
                priority: this.calculateTablePriority(t)
            }))
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 20); // Top 20 most valuable tables
    }

    calculateTablePriority(table) {
        let priority = 0;
        
        // Size matters
        priority += table.rows * table.columns;
        
        // Data types matter more
        if (table.dataTypes.salary) priority += 100;
        if (table.dataTypes.contract) priority += 50;  
        if (table.dataTypes.exception) priority += 75;
        if (table.dataTypes.player) priority += 25;
        
        // Headers indicating multi-year data
        const hasMultiYear = table.headers.some(h => /20\d{2}-\d{2}/.test(h));
        if (hasMultiYear) priority += 200;
        
        return priority;
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--team' && args[i + 1]) {
            options.teams = args[i + 1];
            i++;
        } else if (args[i] === '--teams' && args[i + 1]) {
            options.teams = args[i + 1];
            i++;
        } else if (args[i] === '--all') {
            options.all = true;
        }
    }
    
    const scraper = new ComprehensiveSalarySwishScraper();
    await scraper.run(options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { ComprehensiveSalarySwishScraper };