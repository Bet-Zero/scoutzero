/**
 * SIMPLE DATA ANALYZER for existing Hawks comprehensive data
 * Shows what's available in the existing comprehensive data structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logProgress(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'progress' ? '🔄' : '🔍';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

function analyzeExistingHawksData() {
    const dataPath = path.join(__dirname, 'output', 'comprehensive_data', 'hawks_comprehensive_data.json');
    
    if (!fs.existsSync(dataPath)) {
        logProgress('Hawks comprehensive data not found', 'error');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    logProgress('Analyzing Hawks Comprehensive Data', 'progress');
    logProgress('=================================');
    console.log('');

    // Basic info
    console.log('📊 DATA OVERVIEW:');
    console.log('=================');
    console.log(`🏀 Team: ${data.metadata.team.name}`);
    console.log(`📅 Scraped: ${data.metadata.scrapedAt}`);
    console.log(`📄 HTML Size: ${data.metadata.htmlSize.toLocaleString()} characters`);
    console.log('');

    // Page structure
    console.log('🔍 PAGE STRUCTURE:');
    console.log('==================');
    console.log(`📋 Total Tables: ${data.pageStructure.totalTables}`);
    console.log(`📝 Total Sections: ${data.pageStructure.totalSections}`);
    console.log(`📑 Total Headings: ${data.pageStructure.totalHeadings}`);
    console.log(`📊 Largest Table: ${data.pageStructure.largestTable} rows`);
    console.log(`📈 Tables with Many Rows: ${data.pageStructure.tablesWithManyRows}`);
    console.log('');

    // Analyze tables
    console.log('💎 TABLE ANALYSIS:');
    console.log('==================');
    
    const highValueTables = [];
    const mediumValueTables = [];
    const lowValueTables = [];

    data.allTables.forEach((table, index) => {
        const score = scoreTable(table);
        const tableInfo = {
            index: table.index,
            classes: table.classes,
            id: table.id,
            headers: table.headers,
            size: `${table.rowCount}x${table.columnCount}`,
            score: score,
            priority: score >= 200 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW'
        };

        if (score >= 200) {
            highValueTables.push(tableInfo);
        } else if (score >= 50) {
            mediumValueTables.push(tableInfo);
        } else {
            lowValueTables.push(tableInfo);
        }
    });

    // Show high value tables
    console.log('🔥 HIGH-VALUE TABLES (MUST EXTRACT):');
    highValueTables.forEach((table, i) => {
        console.log(`${i + 1}. Table ${table.index} (Score: ${table.score})`);
        console.log(`   Classes: ${table.classes}`);
        console.log(`   ID: ${table.id}`);
        console.log(`   Size: ${table.size}`);
        console.log(`   Headers: ${table.headers.join(', ')}`);
        console.log('');
    });

    // Show medium value tables
    if (mediumValueTables.length > 0) {
        console.log('💰 MEDIUM-VALUE TABLES (CONSIDER EXTRACTING):');
        mediumValueTables.forEach((table, i) => {
            console.log(`${i + 1}. Table ${table.index} (Score: ${table.score})`);
            console.log(`   Headers: ${table.headers.join(', ')}`);
            console.log(`   Size: ${table.size}`);
            console.log('');
        });
    }

    // Show sample data from the first high-value table
    if (highValueTables.length > 0) {
        const firstHighTable = data.allTables.find(t => t.index === highValueTables[0].index);
        if (firstHighTable && firstHighTable.rows && firstHighTable.rows.length > 1) {
            console.log('📝 SAMPLE DATA from highest-value table:');
            console.log('========================================');
            console.log('Headers:', firstHighTable.headers.join(' | '));
            console.log('Sample Row:', firstHighTable.rows[1].join(' | '));
            console.log('');
        }
    }

    // Recommendations
    console.log('🎯 EXTRACTION RECOMMENDATIONS:');
    console.log('==============================');
    console.log(`✅ Extract ${highValueTables.length} HIGH-value tables - these contain critical salary cap data`);
    console.log(`🤔 Consider ${mediumValueTables.length} MEDIUM-value tables based on your specific needs`);
    console.log(`❌ Skip ${lowValueTables.length} LOW-value tables to keep scraper focused`);
    console.log('');

    console.log('🚀 NEXT STEPS:');
    console.log('==============');
    console.log('1. Review the table analysis above');
    console.log('2. Decide which tables contain the data you need');
    console.log('3. Generate a targeted extractor for those specific tables');
    console.log('4. Test extraction with Hawks, then scale to all teams');
    console.log('');

    // Save simplified analysis
    const analysis = {
        metadata: data.metadata,
        summary: {
            highValueTables: highValueTables.length,
            mediumValueTables: mediumValueTables.length,
            lowValueTables: lowValueTables.length,
            totalTables: data.allTables.length
        },
        highValueTables,
        mediumValueTables,
        extractionTargets: highValueTables.map(t => t.index)
    };

    const analysisPath = path.join(__dirname, 'output', 'hawks_simple_analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    logProgress(`Simple analysis saved: ${analysisPath}`, 'success');
}

function scoreTable(table) {
    let score = 0;
    
    // Size scoring
    score += table.rowCount * table.columnCount;
    
    // Content scoring based on headers and classes
    const headers = table.headers.join(' ').toLowerCase();
    const classes = table.classes.toLowerCase();
    
    // High value indicators
    if (classes.includes('tradeexptn')) score += 150; // Trade exceptions table
    if (headers.includes('exception') || headers.includes('remaining')) score += 100;
    if (headers.includes('player') && headers.includes('salary')) score += 100;
    if (headers.includes('guaranteed') || headers.includes('option')) score += 75;
    
    // Multi-year data bonus
    const hasMultiYear = table.headers.some(h => /20\d{2}-\d{2}/.test(h));
    if (hasMultiYear) score += 200;
    
    // Salary data bonus
    if (table.rows && table.rows.some(row => 
        row.some(cell => typeof cell === 'string' && /\$[\d,]+/.test(cell))
    )) {
        score += 100;
    }
    
    // Complex data bonus
    if (table.columnCount > 5) score += 25;
    
    // Penalty for tiny tables
    if (table.rowCount < 2) score -= 50;
    
    return score;
}

// Run the analysis
analyzeExistingHawksData();