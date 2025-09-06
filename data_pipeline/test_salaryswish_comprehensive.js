/**
 * COMPREHENSIVE SALARYSWISH DATA SCRAPER
 * ====================================== 
 * 
 * This script scrapes EVERYTHING from a SalarySwish team page to discover
 * all available data points, rather than targeting specific elements.
 * 
 * Approach:
 * 1. Fetch entire SalarySwish page content 
 * 2. Extract ALL tables, sections, and data elements
 * 3. Save complete data structure to JSON for analysis
 * 4. Let human analyze what data is valuable and should be kept
 * 
 * Target: https://www.salaryswish.com/teams/hawks
 * 
 * Usage: node test_salaryswish_comprehensive.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test team
const TEST_TEAM = { slug: 'hawks', name: 'Atlanta Hawks' };

function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

async function scrapeComprehensiveTeamData(teamSlug) {
    try {
        const url = `https://www.salaryswish.com/teams/${teamSlug}`;
        logProgress(`🔍 Scraping ALL data from: ${url}`);
        
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
        
        logProgress(`✅ Successfully fetched HTML (${html.length.toLocaleString()} characters)`);
        logProgress('');
        
        // COMPREHENSIVE DATA EXTRACTION
        const comprehensiveData = {
            metadata: {
                url: url,
                scrapedAt: new Date().toISOString(),
                htmlSize: html.length,
                team: TEST_TEAM
            },
            pageStructure: {},
            allTables: [],
            allSections: [],
            allHeadings: [],
            allText: {},
            specialElements: {}
        };
        
        // 1. EXTRACT ALL TABLES
        logProgress('📊 ANALYZING ALL TABLES:');
        logProgress('========================');
        
        const tables = document.querySelectorAll('table');
        tables.forEach((table, index) => {
            const tableData = {
                index: index,
                classes: table.className || '',
                id: table.id || '',
                rowCount: table.querySelectorAll('tr').length,
                columnCount: table.querySelector('tr') ? table.querySelector('tr').querySelectorAll('th, td').length : 0,
                headers: [],
                rows: [],
                allText: table.textContent.trim(),
                html: table.innerHTML
            };
            
            // Extract headers
            const firstRow = table.querySelector('tr');
            if (firstRow) {
                firstRow.querySelectorAll('th, td').forEach(cell => {
                    tableData.headers.push(cell.textContent.trim());
                });
            }
            
            // Extract all rows
            table.querySelectorAll('tr').forEach((row, rowIndex) => {
                const rowData = [];
                row.querySelectorAll('th, td').forEach(cell => {
                    rowData.push(cell.textContent.trim());
                });
                tableData.rows.push(rowData);
            });
            
            comprehensiveData.allTables.push(tableData);
            
            logProgress(`   Table ${index + 1}: ${tableData.rowCount} rows × ${tableData.columnCount} cols`);
            logProgress(`      Classes: "${tableData.classes}"`);
            logProgress(`      Headers: [${tableData.headers.slice(0, 5).join(', ')}${tableData.headers.length > 5 ? '...' : ''}]`);
            
            // Show sample data from first few rows
            if (tableData.rows.length > 1) {
                logProgress(`      Sample row: [${tableData.rows[1].slice(0, 3).join(', ')}${tableData.rows[1].length > 3 ? '...' : ''}]`);
            }
            logProgress('');
        });
        
        // 2. EXTRACT ALL MAJOR SECTIONS
        logProgress('📋 ANALYZING ALL SECTIONS:');
        logProgress('==========================');
        
        ['section', 'div', 'article', 'main'].forEach(tagName => {
            const elements = document.querySelectorAll(tagName);
            elements.forEach((element, index) => {
                const classes = element.className || '';
                const id = element.id || '';
                const text = element.textContent.trim();
                
                // Only capture meaningful sections (with content and identifiable structure)
                if (text.length > 50 || classes || id) {
                    comprehensiveData.allSections.push({
                        tag: tagName,
                        index: index,
                        classes: classes,
                        id: id,
                        textLength: text.length,
                        textPreview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                        hasTable: element.querySelectorAll('table').length > 0,
                        tableCount: element.querySelectorAll('table').length,
                        html: element.innerHTML
                    });
                }
            });
        });
        
        logProgress(`   Found ${comprehensiveData.allSections.length} major sections:`);
        comprehensiveData.allSections.slice(0, 10).forEach((section, i) => {
            logProgress(`      ${i + 1}. <${section.tag}> class="${section.classes}" id="${section.id}"`);
            logProgress(`         Text: ${section.textPreview.replace(/\n/g, ' ')}`);
            logProgress(`         Tables: ${section.tableCount}`);
            logProgress('');
        });
        
        // 3. EXTRACT ALL HEADINGS
        logProgress('🏷️  ANALYZING ALL HEADINGS:');
        logProgress('============================');
        
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            const elements = document.querySelectorAll(tag);
            elements.forEach((heading, index) => {
                const text = heading.textContent.trim();
                if (text) {
                    comprehensiveData.allHeadings.push({
                        level: tag,
                        text: text,
                        classes: heading.className || '',
                        id: heading.id || ''
                    });
                }
            });
        });
        
        comprehensiveData.allHeadings.forEach(heading => {
            logProgress(`   ${heading.level.toUpperCase()}: "${heading.text}"`);
        });
        logProgress('');
        
        // 4. EXTRACT SPECIFIC TEXT PATTERNS  
        logProgress('💰 ANALYZING FINANCIAL DATA PATTERNS:');
        logProgress('=====================================');
        
        const allTextContent = document.body.textContent;
        
        // Find all dollar amounts
        const dollarAmounts = allTextContent.match(/\$[\d,]+(?:\.\d{2})?[MmKkBb]?/g) || [];
        const uniqueDollarAmounts = [...new Set(dollarAmounts)].slice(0, 20);
        
        // Find all years/seasons
        const years = allTextContent.match(/20\d{2}[-–]\d{2}/g) || [];
        const uniqueYears = [...new Set(years)];
        
        // Find percentage patterns
        const percentages = allTextContent.match(/\d+\.?\d*%/g) || [];
        const uniquePercentages = [...new Set(percentages)].slice(0, 10);
        
        comprehensiveData.allText = {
            dollarAmounts: uniqueDollarAmounts,
            years: uniqueYears,
            percentages: uniquePercentages,
            fullTextLength: allTextContent.length
        };
        
        logProgress(`   Found ${uniqueDollarAmounts.length} unique dollar amounts: ${uniqueDollarAmounts.slice(0, 8).join(', ')}${uniqueDollarAmounts.length > 8 ? '...' : ''}`);
        logProgress(`   Found ${uniqueYears.length} seasons: ${uniqueYears.join(', ')}`);
        logProgress(`   Found ${uniquePercentages.length} percentages: ${uniquePercentages.join(', ')}`);
        logProgress('');
        
        // 5. LOOK FOR SPECIFIC ELEMENTS
        logProgress('🎯 ANALYZING SPECIAL ELEMENTS:');
        logProgress('==============================');
        
        comprehensiveData.specialElements = {
            forms: document.querySelectorAll('form').length,
            buttons: document.querySelectorAll('button').length,
            inputs: document.querySelectorAll('input').length,
            links: document.querySelectorAll('a').length,
            images: document.querySelectorAll('img').length,
            scripts: document.querySelectorAll('script').length,
            navElements: document.querySelectorAll('nav').length,
            listItems: document.querySelectorAll('li').length
        };
        
        Object.entries(comprehensiveData.specialElements).forEach(([type, count]) => {
            logProgress(`   ${type}: ${count}`);
        });
        
        // 6. PAGE STRUCTURE ANALYSIS
        logProgress('');
        logProgress('🏗️  PAGE STRUCTURE SUMMARY:');
        logProgress('============================');
        
        comprehensiveData.pageStructure = {
            totalTables: comprehensiveData.allTables.length,
            totalSections: comprehensiveData.allSections.length,
            totalHeadings: comprehensiveData.allHeadings.length,
            largestTable: Math.max(...comprehensiveData.allTables.map(t => t.rowCount)),
            tablesWithManyRows: comprehensiveData.allTables.filter(t => t.rowCount > 10).length,
            sectionsWithTables: comprehensiveData.allSections.filter(s => s.hasTable).length
        };
        
        Object.entries(comprehensiveData.pageStructure).forEach(([key, value]) => {
            logProgress(`   ${key}: ${value}`);
        });
        
        // 7. SAVE COMPREHENSIVE DATA
        const outputDir = path.join(__dirname, 'salaryswish_analysis');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputFile = path.join(outputDir, `${teamSlug}_comprehensive_data.json`);
        fs.writeFileSync(outputFile, JSON.stringify(comprehensiveData, null, 2));
        
        logProgress('');
        logProgress('💾 COMPREHENSIVE DATA SAVED:');
        logProgress(`   File: ${outputFile}`);
        logProgress(`   Size: ${fs.statSync(outputFile).size.toLocaleString()} bytes`);
        
        // 8. ANALYSIS SUMMARY
        logProgress('');
        logProgress('🎉 SCRAPING COMPLETE!');
        logProgress('====================');
        logProgress(`✅ Captured ${comprehensiveData.allTables.length} tables`);
        logProgress(`✅ Captured ${comprehensiveData.allSections.length} sections`);
        logProgress(`✅ Found ${comprehensiveData.allText.dollarAmounts.length} financial data points`);
        logProgress(`✅ Found ${comprehensiveData.allText.years.length} season references`);
        logProgress('');
        logProgress('📋 NEXT STEPS:');
        logProgress(`   1. Review ${outputFile}`);
        logProgress(`   2. Identify which tables/sections contain the data you need`);
        logProgress(`   3. Create targeted scraper based on findings`);
        
        return comprehensiveData;
        
    } catch (error) {
        logProgress(`❌ Error scraping comprehensive data: ${error.message}`);
        
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            logProgress('');
            logProgress('🔒 NETWORK ISSUE:');
            logProgress('   This environment blocks external websites.');
            logProgress('   Run this script on your local machine to access SalarySwish.');
        }
        
        return null;
    }
}

// Main execution
async function main() {
    logProgress('🚀 COMPREHENSIVE SALARYSWISH SCRAPER');
    logProgress('====================================');
    logProgress(`Target: ${TEST_TEAM.name} (${TEST_TEAM.slug})`);
    logProgress('Goal: Extract ALL available data for analysis');
    logProgress('');
    
    await scrapeComprehensiveTeamData(TEST_TEAM.slug);
}

main();