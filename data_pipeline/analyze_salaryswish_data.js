/**
 * SALARYSWISH DATA ANALYZER
 * ========================
 * 
 * This script analyzes the comprehensive SalarySwish data collected by
 * test_salaryswish_comprehensive.js and builds a targeted scraper based on findings.
 * 
 * Usage:
 * 1. Run test_salaryswish_comprehensive.js to collect data
 * 2. Share the JSON output with this script
 * 3. This script identifies valuable tables and data patterns
 * 4. Generates targeted scraper configuration
 * 
 * Input: hawks_comprehensive_data.json (or pasted JSON data)
 * Output: Targeted scraper configuration and implementation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Analyze comprehensive SalarySwish data to identify valuable tables and data patterns
 */
function analyzeSalarySwishData(comprehensiveData) {
    logProgress('🔍 ANALYZING SALARYSWISH DATA STRUCTURE');
    logProgress('=======================================');
    
    const analysis = {
        recommendations: [],
        targetTables: [],
        dataPatterns: {},
        scrapingStrategy: {}
    };
    
    // 1. ANALYZE TABLES FOR SALARY/CONTRACT DATA
    logProgress('📊 Analyzing tables for salary cap data...');
    
    comprehensiveData.allTables.forEach((table, index) => {
        const tableAnalysis = {
            index: index,
            confidence: 0,
            dataTypes: [],
            reasoning: []
        };
        
        // Check headers for salary-related terms
        const salaryKeywords = ['salary', 'cap', 'contract', 'guaranteed', 'player', 'year', 'option', 'exception'];
        const headers = table.headers.map(h => h.toLowerCase());
        const salaryHeaderCount = headers.filter(h => 
            salaryKeywords.some(keyword => h.includes(keyword))
        ).length;
        
        if (salaryHeaderCount > 0) {
            tableAnalysis.confidence += salaryHeaderCount * 20;
            tableAnalysis.reasoning.push(`${salaryHeaderCount} salary-related headers`);
            tableAnalysis.dataTypes.push('salary_data');
        }
        
        // Check for financial data in table content
        const tableText = table.allText;
        const dollarMatches = tableText.match(/\$[\d,]+/g) || [];
        if (dollarMatches.length > 5) {
            tableAnalysis.confidence += 30;
            tableAnalysis.reasoning.push(`${dollarMatches.length} dollar amounts`);
            tableAnalysis.dataTypes.push('financial_data');
        }
        
        // Check for year patterns (contracts span multiple years)
        const yearMatches = tableText.match(/20\d{2}[-–]\d{2}/g) || [];
        if (yearMatches.length > 2) {
            tableAnalysis.confidence += 25;
            tableAnalysis.reasoning.push(`${yearMatches.length} season references`);
            tableAnalysis.dataTypes.push('multi_year_data');
        }
        
        // Check table size (contract tables should have multiple players)
        if (table.rowCount >= 10 && table.rowCount <= 30) {
            tableAnalysis.confidence += 15;
            tableAnalysis.reasoning.push(`Appropriate size (${table.rowCount} rows)`);
            tableAnalysis.dataTypes.push('roster_sized');
        }
        
        // Check for player-like data (names in first column)
        if (table.rows.length > 1 && table.rows[1][0] && 
            table.rows[1][0].match(/^[A-Z][a-z]+ [A-Z][a-z]+/)) {
            tableAnalysis.confidence += 20;
            tableAnalysis.reasoning.push('Player names detected');
            tableAnalysis.dataTypes.push('player_data');
        }
        
        if (tableAnalysis.confidence > 50) {
            analysis.targetTables.push({
                ...tableAnalysis,
                table: table,
                recommendation: tableAnalysis.confidence > 80 ? 'PRIMARY' : 'SECONDARY'
            });
        }
        
        logProgress(`   Table ${index + 1}: Confidence ${tableAnalysis.confidence}% - ${tableAnalysis.reasoning.join(', ')}`);
    });
    
    // 2. IDENTIFY DATA PATTERNS
    logProgress('');
    logProgress('💰 Analyzing financial data patterns...');
    
    analysis.dataPatterns = {
        salaryFormats: comprehensiveData.allText.dollarAmounts || [],
        seasonFormats: comprehensiveData.allText.years || [],
        percentageFormats: comprehensiveData.allText.percentages || [],
        commonPatterns: []
    };
    
    // Identify common salary formats
    const salaryPatterns = {};
    analysis.dataPatterns.salaryFormats.forEach(amount => {
        const pattern = amount.replace(/\d/g, '#');
        salaryPatterns[pattern] = (salaryPatterns[pattern] || 0) + 1;
    });
    
    analysis.dataPatterns.commonPatterns = Object.entries(salaryPatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, count }));
    
    logProgress(`   Found ${analysis.dataPatterns.salaryFormats.length} unique salary formats`);
    logProgress(`   Most common: ${analysis.dataPatterns.commonPatterns.slice(0, 3).map(p => p.pattern).join(', ')}`);
    logProgress(`   Seasons: ${analysis.dataPatterns.seasonFormats.join(', ')}`);
    
    // 3. SECTION ANALYSIS FOR EXCEPTIONS
    logProgress('');
    logProgress('📋 Analyzing sections for exception data...');
    
    const exceptionSections = comprehensiveData.allSections.filter(section => {
        const text = section.textPreview.toLowerCase();
        return text.includes('exception') || text.includes('mle') || text.includes('trade') || 
               text.includes('luxury') || text.includes('cap space');
    });
    
    logProgress(`   Found ${exceptionSections.length} sections with exception-related content:`);
    exceptionSections.forEach((section, i) => {
        logProgress(`      ${i + 1}. ${section.tag}.${section.classes} - ${section.textPreview.substring(0, 100)}...`);
    });
    
    // 4. GENERATE SCRAPING STRATEGY
    logProgress('');
    logProgress('🎯 Generating targeted scraping strategy...');
    
    // Sort target tables by confidence
    analysis.targetTables.sort((a, b) => b.confidence - a.confidence);
    
    const primaryTables = analysis.targetTables.filter(t => t.recommendation === 'PRIMARY');
    const secondaryTables = analysis.targetTables.filter(t => t.recommendation === 'SECONDARY');
    
    analysis.scrapingStrategy = {
        primaryTableSelectors: primaryTables.map(t => ({
            index: t.index,
            selector: generateTableSelector(t.table),
            confidence: t.confidence,
            expectedData: t.dataTypes
        })),
        fallbackSelectors: secondaryTables.map(t => ({
            index: t.index,
            selector: generateTableSelector(t.table),
            confidence: t.confidence,
            expectedData: t.dataTypes
        })),
        exceptionSelectors: exceptionSections.map(s => ({
            selector: generateSectionSelector(s),
            expectedContent: ['exception', 'cap_info']
        })),
        totalRequestsNeeded: 30, // One per team
        estimatedDataYield: estimateDataYield(analysis.targetTables)
    };
    
    logProgress(`   PRIMARY tables to target: ${primaryTables.length}`);
    logProgress(`   FALLBACK tables available: ${secondaryTables.length}`);
    logProgress(`   Exception sections identified: ${exceptionSections.length}`);
    
    // 5. GENERATE RECOMMENDATIONS
    analysis.recommendations = [
        `Target ${primaryTables.length} high-confidence tables for contract data`,
        `Use ${secondaryTables.length} fallback tables if primary parsing fails`,
        `Extract exception data from ${exceptionSections.length} identified sections`,
        `Implement ${analysis.dataPatterns.commonPatterns.length} salary parsing patterns`,
        `Expect ${analysis.scrapingStrategy.estimatedDataYield} players per team`
    ];
    
    return analysis;
}

/**
 * Generate CSS selector for a table based on its characteristics
 */
function generateTableSelector(table) {
    if (table.id) {
        return `#${table.id}`;
    }
    
    if (table.classes) {
        const classList = table.classes.split(' ').filter(c => c.length > 0);
        return `table.${classList.join('.')}`;
    }
    
    return `table:nth-of-type(${table.index + 1})`;
}

/**
 * Generate CSS selector for a section
 */
function generateSectionSelector(section) {
    if (section.id) {
        return `#${section.id}`;
    }
    
    if (section.classes) {
        const classList = section.classes.split(' ').filter(c => c.length > 0);
        if (classList.length > 0) {
            return `${section.tag}.${classList.join('.')}`;
        }
    }
    
    return `${section.tag}:nth-of-type(${section.index + 1})`;
}

/**
 * Estimate how many players we can expect per team
 */
function estimateDataYield(targetTables) {
    if (targetTables.length === 0) return 'unknown';
    
    const avgRows = targetTables.reduce((sum, t) => sum + t.table.rowCount, 0) / targetTables.length;
    return `${Math.max(10, Math.floor(avgRows - 1))}-${Math.min(20, Math.floor(avgRows + 2))}`;
}

/**
 * Generate the targeted scraper based on analysis results
 */
function generateTargetedScraper(analysis) {
    logProgress('');
    logProgress('🔧 GENERATING TARGETED SCRAPER');
    logProgress('==============================');
    
    const scraperConfig = {
        teamUrlPattern: 'https://www.salaryswish.com/teams/{team-slug}',
        tableSelectors: analysis.scrapingStrategy.primaryTableSelectors.map(s => s.selector),
        fallbackSelectors: analysis.scrapingStrategy.fallbackSelectors.map(s => s.selector),
        exceptionSelectors: analysis.scrapingStrategy.exceptionSelectors.map(s => s.selector),
        salaryPatterns: analysis.dataPatterns.commonPatterns.map(p => p.pattern),
        seasonFormats: analysis.dataPatterns.seasonFormats,
        estimatedDataPerTeam: analysis.scrapingStrategy.estimatedDataYield
    };
    
    // Save scraper configuration
    const configFile = path.join(__dirname, 'salaryswish_scraper_config.json');
    fs.writeFileSync(configFile, JSON.stringify(scraperConfig, null, 2));
    
    logProgress(`✅ Scraper configuration saved: ${configFile}`);
    
    // Generate recommendations
    logProgress('');
    logProgress('📋 IMPLEMENTATION RECOMMENDATIONS:');
    analysis.recommendations.forEach((rec, i) => {
        logProgress(`   ${i + 1}. ${rec}`);
    });
    
    return scraperConfig;
}

/**
 * Main analysis function - can accept either file path or JSON data directly
 */
async function analyzeSalarySwish(input) {
    let comprehensiveData;
    
    if (typeof input === 'string') {
        // Input is file path
        try {
            const jsonContent = fs.readFileSync(input, 'utf8');
            comprehensiveData = JSON.parse(jsonContent);
            logProgress(`✅ Loaded data from: ${input}`);
        } catch (error) {
            logProgress(`❌ Error reading file: ${error.message}`);
            return null;
        }
    } else {
        // Input is JSON data object
        comprehensiveData = input;
        logProgress(`✅ Received data object directly`);
    }
    
    // Perform analysis
    const analysis = analyzeSalarySwishData(comprehensiveData);
    
    // Generate targeted scraper
    const scraperConfig = generateTargetedScraper(analysis);
    
    logProgress('');
    logProgress('🎉 ANALYSIS COMPLETE!');
    logProgress('====================');
    logProgress('Next steps:');
    logProgress('1. Review generated scraper configuration');
    logProgress('2. Test targeted scraper with Hawks data');
    logProgress('3. Scale to all 30 NBA teams');
    logProgress('4. Integrate with existing pipeline');
    
    return { analysis, scraperConfig };
}

// Export for use by other scripts
export { analyzeSalarySwish, analyzeSalarySwishData };

// Command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const inputFile = process.argv[2];
    if (!inputFile) {
        console.log('Usage: node analyze_salaryswish_data.js <path-to-json-file>');
        console.log('Example: node analyze_salaryswish_data.js salaryswish_analysis/hawks_comprehensive_data.json');
        process.exit(1);
    }
    
    analyzeSalarySwish(inputFile);
}