/**
 * TEST SPOTRAC SCRAPER - Multi-Year Contracts + Exceptions
 * ========================================================
 * 
 * Tests the enhanced scraper with:
 * - Multi-year contract data (/yearly endpoint)  
 * - Exception data (/cap endpoint)
 * 
 * Run this locally to test the scraping logic before running the full pipeline
 * 
 * Usage: node test_single_team_scraper.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test with Atlanta Hawks first
const TEST_TEAM = { id: 'atlanta-hawks', name: 'Atlanta Hawks', abbrev: 'ATL' };

function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

async function testMultiYearContracts(team) {
    try {
        const url = `https://www.spotrac.com/nba/${team.id}/yearly/`;
        logProgress(`📅 Testing multi-year contracts from: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        logProgress(`   ✅ Successfully fetched HTML (${html.length} characters)`);
        
        // Find the multi-year table
        let targetTable = null;
        $('table').each((i, table) => {
            const headerText = $(table).find('tr').first().text();
            if (headerText.includes('2025-26') || headerText.includes('2026-27') || 
                headerText.includes('2025') || headerText.includes('2026')) {
                targetTable = $(table);
                return false;
            }
        });
        
        if (!targetTable) {
            logProgress(`   ❌ Could not find multi-year contract table`);
            return [];
        }
        
        logProgress(`   ✅ Found multi-year table (${targetTable.find('tr').length} rows)`);
        
        // Parse year columns
        const headerRow = targetTable.find('tr').first();
        const yearColumns = [];
        headerRow.find('th, td').each((i, cell) => {
            const text = $(cell).text().trim();
            const yearMatch = text.match(/20\d{2}[-–]\d{2}/);
            if (yearMatch) {
                yearColumns.push({ index: i, year: yearMatch[0] });
            }
        });
        
        logProgress(`   📅 Found ${yearColumns.length} year columns: ${yearColumns.map(y => y.year).join(', ')}`);
        
        // Parse players
        const players = [];
        targetTable.find('tr').slice(1).each((i, row) => {
            const cells = $(row).find('td, th');
            if (cells.length < 2) return;
            
            const playerName = $(cells[0]).text().trim();
            const nameCheck = playerName.toLowerCase();
            if (nameCheck.includes('player') || nameCheck.includes('total') || nameCheck.length < 3) {
                return;
            }
            
            const playerContracts = { name: playerName, yearlyContracts: {} };
            
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
        
        logProgress(`   ✅ Parsed ${players.length} players with multi-year contracts`);
        return players;
        
    } catch (error) {
        logProgress(`   ❌ Error testing multi-year contracts: ${error.message}`);
        return [];
    }
}

async function testExceptions(team) {
    try {
        const url = `https://www.spotrac.com/nba/${team.id}/cap/`;
        logProgress(`🔄 Testing exceptions from: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        logProgress(`   ✅ Successfully fetched HTML (${html.length} characters)`);
        
        const exceptions = { freeAgent: [], tradedPlayer: [] };
        let foundExceptionTables = 0;
        
        $('table').each((i, table) => {
            const tableText = $(table).text().toLowerCase();
            
            if (tableText.includes('exception')) {
                foundExceptionTables++;
                
                if (tableText.includes('free agent') || tableText.includes('mle')) {
                    $(table).find('tr').each((j, row) => {
                        const cells = $(row).find('td, th');
                        if (cells.length >= 2) {
                            const type = $(cells[0]).text().trim();
                            const amount = $(cells[1]).text().trim();
                            
                            if (amount.includes('$')) {
                                const amountMatch = amount.match(/\$([0-9,]+)/);
                                const value = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0;
                                if (value > 0) {
                                    exceptions.freeAgent.push({ type, amount: value, amountDisplay: amount });
                                }
                            }
                        }
                    });
                }
                
                if (tableText.includes('traded')) {
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
                                    exceptions.tradedPlayer.push({ player, amount: value, amountDisplay: amount, expires });
                                }
                            }
                        }
                    });
                }
            }
        });
        
        logProgress(`   📋 Found ${foundExceptionTables} tables with "exception" text`);
        logProgress(`   ✅ Parsed ${exceptions.freeAgent.length} free agent exceptions, ${exceptions.tradedPlayer.length} traded player exceptions`);
        
        return exceptions;
        
    } catch (error) {
        logProgress(`   ❌ Error testing exceptions: ${error.message}`);
        return { freeAgent: [], tradedPlayer: [] };
    }
}

async function testComprehensiveScraping() {
    try {
        logProgress(`🧪 TESTING COMPREHENSIVE TEAM SCRAPER`);
        logProgress(`=====================================`);
        logProgress(`Team: ${TEST_TEAM.name}`);
        logProgress(`Testing: Multi-year contracts + Exceptions`);
        logProgress('');
        
        // Test both endpoints
        const [multiYearPlayers, exceptions] = await Promise.all([
            testMultiYearContracts(TEST_TEAM),
            testExceptions(TEST_TEAM)
        ]);
        
        logProgress('');
        logProgress('🏆 COMPREHENSIVE RESULTS:');
        logProgress(`=========================`);
        
        if (multiYearPlayers.length > 0) {
            logProgress(`✅ SUCCESS! Found ${multiYearPlayers.length} ${TEST_TEAM.name} players with multi-year contracts:`);
            logProgress('');
            
            multiYearPlayers.slice(0, 5).forEach((player, i) => {
                const years = Object.keys(player.yearlyContracts);
                const currentYear = Object.entries(player.yearlyContracts)[0];
                if (currentYear) {
                    logProgress(`   ${i + 1}. ${player.name}: ${currentYear[1].salaryDisplay} (${years.length} years: ${years.join(', ')})`);
                }
            });
            
            if (multiYearPlayers.length > 5) {
                logProgress(`   ... and ${multiYearPlayers.length - 5} more players`);
            }
            
            // Calculate totals per year
            const yearlyTotals = {};
            multiYearPlayers.forEach(player => {
                Object.entries(player.yearlyContracts).forEach(([year, contract]) => {
                    if (!yearlyTotals[year]) yearlyTotals[year] = 0;
                    yearlyTotals[year] += contract.salary;
                });
            });
            
            logProgress('');
            logProgress('📊 Team Payroll by Year:');
            Object.entries(yearlyTotals).forEach(([year, total]) => {
                logProgress(`   ${year}: $${total.toLocaleString()}`);
            });
        } else {
            logProgress('❌ FAILED: No multi-year contract data found');
        }
        
        logProgress('');
        if (exceptions.freeAgent.length > 0 || exceptions.tradedPlayer.length > 0) {
            logProgress(`✅ EXCEPTIONS FOUND:`);
            if (exceptions.freeAgent.length > 0) {
                logProgress(`   🆓 Free Agent Exceptions (${exceptions.freeAgent.length}):`);
                exceptions.freeAgent.forEach((exc, i) => {
                    logProgress(`      ${i + 1}. ${exc.type}: ${exc.amountDisplay}`);
                });
            }
            if (exceptions.tradedPlayer.length > 0) {
                logProgress(`   🔄 Traded Player Exceptions (${exceptions.tradedPlayer.length}):`);
                exceptions.tradedPlayer.forEach((exc, i) => {
                    logProgress(`      ${i + 1}. ${exc.player}: ${exc.amountDisplay} (expires ${exc.expires})`);
                });
            }
        } else {
            logProgress('⚠️  No exceptions found (may not have any or structure changed)');
        }
        
        // Save comprehensive test results
        const testFile = path.join(__dirname, 'test_results', `comprehensive_${TEST_TEAM.id}.json`);
        const testDir = path.dirname(testFile);
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        fs.writeFileSync(testFile, JSON.stringify({ 
            team: TEST_TEAM, 
            multiYearPlayers, 
            exceptions,
            scrapedAt: new Date().toISOString()
        }, null, 2));
        
        logProgress('');
        logProgress(`💾 Comprehensive results saved to: ${testFile}`);
        
        // Provide guidance
        if (multiYearPlayers.length > 0 && (exceptions.freeAgent.length > 0 || exceptions.tradedPlayer.length > 0)) {
            logProgress('');
            logProgress('🎉 READY FOR FULL PIPELINE!');
            logProgress('   Both multi-year contracts and exceptions are working');
            logProgress('   Run: ./setup_complete_fresh_pipeline.sh');
        } else if (multiYearPlayers.length > 0) {
            logProgress('');
            logProgress('✅ Multi-year contracts working, exceptions may need adjustment');
            logProgress('   You can proceed with the pipeline - exception parsing can be refined later');
        } else {
            logProgress('');
            logProgress('❌ Multi-year contract parsing needs fixes before running full pipeline');
        }
        
    } catch (error) {
        logProgress(`❌ Test failed: ${error.message}`);
        
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            logProgress('');
            logProgress('🔒 NETWORK ISSUE:');
            logProgress('   This environment blocks external API access.');
            logProgress('   Run this test on your local machine to validate the scraper.');
        }
    }
}

// Run test
testComprehensiveScraping();