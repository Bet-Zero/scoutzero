/**
 * DEBUG SPOTRAC SCRAPER
 * ====================
 * 
 * This debug version shows us exactly what HTML structure Spotrac uses
 * so we can fix the CSS selectors in the main scraper.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugSpotracStructure() {
    try {
        // Test with one team first - Atlanta Hawks
        const url = 'https://www.spotrac.com/nba/atlanta-hawks/payroll/';
        console.log(`🔍 Debugging Spotrac HTML structure for: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) {
            console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        console.log(`✅ Successfully fetched HTML (${html.length} characters)`);
        console.log('');
        
        // Debug: Show all table classes
        console.log('🔍 ALL TABLES FOUND:');
        $('table').each((i, table) => {
            const classes = $(table).attr('class') || 'no-class';
            const rows = $(table).find('tr').length;
            console.log(`  Table ${i + 1}: class="${classes}", rows=${rows}`);
        });
        console.log('');
        
        // Debug: Show table with most rows (likely the payroll table)
        let largestTable = null;
        let maxRows = 0;
        $('table').each((i, table) => {
            const rows = $(table).find('tr').length;
            if (rows > maxRows) {
                maxRows = rows;
                largestTable = $(table);
            }
        });
        
        if (largestTable) {
            console.log(`🎯 LARGEST TABLE (${maxRows} rows):`);
            const tableClass = largestTable.attr('class') || 'no-class';
            console.log(`   Class: "${tableClass}"`);
            
            // Show first few rows to understand structure
            console.log('   First 5 rows:');
            largestTable.find('tr').slice(0, 5).each((i, row) => {
                const cells = $(row).find('td, th');
                const cellData = [];
                cells.each((j, cell) => {
                    const text = $(cell).text().trim();
                    if (text.length > 50) {
                        cellData.push(text.substring(0, 50) + '...');
                    } else {
                        cellData.push(text);
                    }
                });
                console.log(`     Row ${i + 1}: [${cellData.join(' | ')}]`);
            });
        }
        console.log('');
        
        // Debug: Look for salary-related content
        console.log('🔍 SEARCHING FOR SALARY PATTERNS:');
        const salaryPatterns = [
            '$', 'salary', 'payroll', 'cap', 'million', 'contract'
        ];
        
        salaryPatterns.forEach(pattern => {
            const matches = $(`*:contains("${pattern}")`).length;
            console.log(`   "${pattern}": ${matches} elements`);
        });
        console.log('');
        
        // Debug: Look for player names (common NBA names)
        console.log('🔍 SEARCHING FOR PLAYER NAMES:');
        const commonNames = ['Trae Young', 'De\'Andre Hunter', 'Clint Capela', 'Bogdan Bogdanovic'];
        commonNames.forEach(name => {
            const found = $(`*:contains("${name}")`).length > 0;
            console.log(`   "${name}": ${found ? '✅ Found' : '❌ Not found'}`);
        });
        console.log('');
        
        // Debug: Save a sample of HTML for manual inspection
        const samplePath = path.join(__dirname, 'debug_spotrac_sample.html');
        fs.writeFileSync(samplePath, html);
        console.log(`💾 Full HTML saved to: ${samplePath}`);
        console.log('');
        
        // Debug: Try different table selectors
        console.log('🔍 TESTING DIFFERENT TABLE SELECTORS:');
        const selectors = [
            'table.payroll',
            'table[class*="payroll"]',
            'table[class*="salary"]',
            'table[class*="roster"]',
            'table[class*="cap"]',
            'table.datatable',
            'table.table',
            '.payroll-table',
            '.salary-table'
        ];
        
        selectors.forEach(selector => {
            const found = $(selector).length;
            console.log(`   "${selector}": ${found} matches`);
        });
        
    } catch (error) {
        console.error(`❌ Debug error: ${error.message}`);
    }
}

// Run debug
debugSpotracStructure();