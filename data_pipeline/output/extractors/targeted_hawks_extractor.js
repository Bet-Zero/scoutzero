/**
 * TARGETED SALARYSWISH EXTRACTOR - ATLANTA HAWKS
 * Generated on 2025-09-06T13:11:58.270Z
 * 
 * Extracts only the selected high-value data based on comprehensive analysis.
 * Selected tables: [0, 2, 3, 4, 6, 7, 8, 9, 10, 11]
 */

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

class AtlantaHawksTargetedExtractor {
    constructor() {
        this.baseURL = 'https://www.salaryswish.com/teams/hawks';
        this.targetTables = [0, 2, 3, 4, 6, 7, 8, 9, 10, 11];
        this.extractionConfig = {
        "0": {
                "index": 0,
                "classes": "sw_table__tradeExptn sw_table__default sw_table__fixed sw_table__sortable sw_table__collapsibleTeamColumn",
                "id": "sw_table__tradeExptn_tm",
                "headers": [
                        "Player",
                        "Exception",
                        "Used",
                        "Remaining",
                        "Start Date",
                        "End Date"
                ],
                "expectedRows": 4,
                "expectedColumns": 6,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": true
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": false
                }
        },
        "2": {
                "index": 2,
                "classes": "sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn",
                "id": "",
                "headers": [
                        "Active (14 - $184,432,415)",
                        "Status",
                        "Acquired",
                        "Age",
                        "Pos",
                        "Terms",
                        "2025-26",
                        "2026-27",
                        "2027-28",
                        "2028-29",
                        "2029-30",
                        "2030-31"
                ],
                "expectedRows": 16,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": true
                }
        },
        "3": {
                "index": 3,
                "classes": "sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn",
                "id": "",
                "headers": [
                        "Training Camp and Exhibit 10 (2 - $0)",
                        "Status",
                        "Acquired",
                        "Age",
                        "Pos",
                        "Terms",
                        "2025-26",
                        "2026-27",
                        "2027-28",
                        "2028-29",
                        "2029-30",
                        "2030-31"
                ],
                "expectedRows": 4,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": true
                }
        },
        "4": {
                "index": 4,
                "classes": "sw_teamProfileRosterSection__table sw_table__collapsiblePlayerColumn sw_table__default sw_table__fixed sw_table__stickyFirstColumn",
                "id": "",
                "headers": [
                        "Minors/G-League (4 - $0)",
                        "Status",
                        "Acquired",
                        "Age",
                        "Pos",
                        "Terms",
                        "2025-26",
                        "2026-27",
                        "2027-28",
                        "2028-29",
                        "2029-30",
                        "2030-31"
                ],
                "expectedRows": 6,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": true
                }
        },
        "6": {
                "index": 6,
                "classes": "sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel",
                "id": "",
                "headers": [
                        "",
                        "",
                        "",
                        "",
                        "",
                        "ROSTER CAP HIT",
                        "$184,432,415",
                        "$143,256,969",
                        "$88,568,302",
                        "$51,962,703",
                        "$30,000,000",
                        "-"
                ],
                "expectedRows": 9,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": false
                }
        },
        "7": {
                "index": 7,
                "classes": "sw_teamProfileStats__table sw_table__collapsiblePlayerColumn sw_table__fixed rel",
                "id": "",
                "headers": [
                        "",
                        "",
                        "",
                        "",
                        "",
                        "CAP",
                        "$154,647,000",
                        "$165,472,000",
                        "$182,019,000",
                        "$200,221,000",
                        "$220,243,000",
                        "$242,267,000"
                ],
                "expectedRows": 12,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": false
                }
        },
        "8": {
                "index": 8,
                "classes": "sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn",
                "id": "",
                "headers": [
                        "2nd Rd Picks (4 - $0)",
                        "Status",
                        "Acquired",
                        "Age",
                        "Pos",
                        "Terms",
                        "2025-26",
                        "2026-27",
                        "2027-28",
                        "2028-29",
                        "2029-30",
                        "2030-31"
                ],
                "expectedRows": 6,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": true
                }
        },
        "9": {
                "index": 9,
                "classes": "sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn",
                "id": "",
                "headers": [
                        "RFAs (11 - $0)",
                        "Status",
                        "Acquired",
                        "Age",
                        "Pos",
                        "Terms",
                        "2025-26",
                        "2026-27",
                        "2027-28",
                        "2028-29",
                        "2029-30",
                        "2030-31"
                ],
                "expectedRows": 13,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": true
                }
        },
        "10": {
                "index": 10,
                "classes": "sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn",
                "id": "",
                "headers": [
                        "UFAs (9 - $0)",
                        "Status",
                        "Acquired",
                        "Age",
                        "Pos",
                        "Terms",
                        "2025-26",
                        "2026-27",
                        "2027-28",
                        "2028-29",
                        "2029-30",
                        "2030-31"
                ],
                "expectedRows": 11,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": true
                }
        },
        "11": {
                "index": 11,
                "classes": "sw_teamProfileRosterSection__table sw_table__default sw_table__stickyFirstColumn sw_table__fixed sw_table__collapsiblePlayerColumn",
                "id": "",
                "headers": [
                        "FA Cap Hold (4 - $8,937,316)",
                        "Status",
                        "Acquired",
                        "Age",
                        "Pos",
                        "Terms",
                        "2025-26",
                        "2026-27",
                        "2027-28",
                        "2028-29",
                        "2029-30",
                        "2030-31"
                ],
                "expectedRows": 6,
                "expectedColumns": 12,
                "dataTypes": {
                        "salary": true,
                        "player": true,
                        "contract": false,
                        "exception": false
                },
                "extractionRules": {
                        "parseSalaries": true,
                        "parseContracts": false,
                        "parseOptions": false,
                        "parseYearlyData": true
                }
        }
};
    }

    async extract() {
        try {
            console.log('🎯 Starting targeted extraction for Atlanta Hawks');
            
            const response = await fetch(this.baseURL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;

            console.log('✅ Page fetched successfully');

            const results = {
                metadata: {
                    team: 'Atlanta Hawks',
                    slug: 'hawks',
                    extractedAt: new Date().toISOString(),
                    tablesExtracted: this.targetTables.length
                },
                extractedData: {}
            };

            // Extract each target table
            const tables = document.querySelectorAll('table');
            
            this.targetTables.forEach(tableIndex => {
                if (tableIndex < tables.length) {
                    const table = tables[tableIndex];
                    const config = this.extractionConfig[tableIndex];
                    const extractedData = this.extractTableData(table, config);
                    
                    results.extractedData[`table_${tableIndex}`] = {
                        config: config,
                        data: extractedData
                    };
                    
                    console.log(`📊 Table ${tableIndex}: ${extractedData.length} rows extracted`);
                }
            });

            return results;

        } catch (error) {
            console.error('❌ Extraction failed:', error.message);
            throw error;
        }
    }

    extractTableData(table, config) {
        const rows = [];
        const tableRows = table.querySelectorAll('tbody tr, tr');
        
        // Skip header row if it exists
        const startIndex = config.hasHeaders ? 1 : 0;
        
        for (let i = startIndex; i < tableRows.length; i++) {
            const row = tableRows[i];
            const cells = row.querySelectorAll('td, th');
            
            if (cells.length === 0) continue;
            
            const rowData = {};
            
            cells.forEach((cell, cellIndex) => {
                const headerName = config.headers[cellIndex] || `column_${cellIndex}`;
                const cellText = cell.textContent.trim();
                const cellHtml = cell.innerHTML;
                
                // Apply specific extraction logic based on header
                rowData[headerName] = this.processCellData(cellText, cellHtml, headerName, config);
            });
            
            rows.push(rowData);
        }
        
        return rows;
    }

    processCellData(text, html, headerName, config) {
        const processed = { 
            text: text,
            raw: html
        };

        // Detect and parse salary data
        if (this.containsSalaryData(text)) {
            processed.salaries = this.extractSalaryAmounts(text);
            processed.type = 'salary';
        }
        
        // Detect and parse contract years
        if (/20\d{2}-\d{2}/.test(headerName)) {
            processed.year = headerName;
            processed.type = 'yearly_data';
            
            // Look for options in the cell
            if (html.includes('option') || html.includes('P') || html.includes('T')) {
                processed.hasOption = true;
                processed.optionType = this.extractOptionType(html);
            }
        }
        
        // Detect player names
        if (this.containsPlayerData(text)) {
            processed.type = 'player';
            processed.cleanName = this.cleanPlayerName(text);
        }

        return processed;
    }

    containsSalaryData(text) {
        return /\$[\d,]+|\d+\.\d+[MK]|\$\d+[MK]/i.test(text);
    }

    containsPlayerData(text) {
        return /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text);
    }

    extractSalaryAmounts(text) {
        const amounts = [];
        const matches = text.match(/\$[\d,]+/g) || [];
        
        matches.forEach(match => {
            const amount = parseInt(match.replace(/[\$,]/g, ''));
            if (amount > 0) {
                amounts.push({ text: match, amount: amount });
            }
        });
        
        return amounts;
    }

    extractOptionType(html) {
        if (html.includes('class="player_option"') || html.includes('>P<')) {
            return 'Player Option';
        } else if (html.includes('class="team_option"') || html.includes('>T<')) {
            return 'Team Option';
        }
        return null;
    }

    cleanPlayerName(text) {
        // Handle "Last, First" format
        return text.replace(/^([^,]+),\s*(.+)$/, '$2 $1').trim();
    }
}

// Export for use in other scripts
export { AtlantaHawksTargetedExtractor };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const extractor = new AtlantaHawksTargetedExtractor();
    
    extractor.extract()
        .then(results => {
            console.log('\n🎉 EXTRACTION COMPLETE');
            console.log('=======================');
            console.log(`📊 Tables extracted: ${results.metadata.tablesExtracted}`);
            
            Object.entries(results.extractedData).forEach(([tableKey, tableData]) => {
                console.log(`📋 ${tableKey}: ${tableData.data.length} rows`);
            });
            
            // Save results
            const outputPath = `./targeted_${results.metadata.slug}_data_${Date.now()}.json`;
            require('fs').writeFileSync(outputPath, JSON.stringify(results, null, 2));
            console.log(`💾 Results saved: ${outputPath}`);
        })
        .catch(console.error);
}