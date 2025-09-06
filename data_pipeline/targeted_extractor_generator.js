/**
 * TARGETED EXTRACTOR GENERATOR
 * ============================
 * 
 * STEP 3: Generate targeted extractor based on comprehensive analysis
 * 
 * This script takes the comprehensive analysis results and:
 * 1. Lets you specify exactly what data you want to extract
 * 2. Generates a targeted scraper that extracts only that data
 * 3. Creates production-ready extraction code
 * 4. No guesswork - extracts exactly what you choose
 * 
 * Usage: node targeted_extractor_generator.js --team hawks --tables 0,2,3
 *        node targeted_extractor_generator.js --team hawks --auto (use recommendations)  
 *        node targeted_extractor_generator.js --interactive (interactive mode)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TargetedExtractorGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        this.analysisDir = path.join(this.outputDir, 'data_analysis');
        this.extractorsDir = path.join(this.outputDir, 'extractors');
        
        if (!fs.existsSync(this.extractorsDir)) {
            fs.mkdirSync(this.extractorsDir, { recursive: true });
        }
    }

    logProgress(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'progress' ? '🔄' : '🔍';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    loadTeamAnalysis(teamSlug) {
        const analysisPath = path.join(this.analysisDir, `${teamSlug}_data_analysis.json`);
        
        if (!fs.existsSync(analysisPath)) {
            this.logProgress(`No analysis found for ${teamSlug}`, 'error');
            this.logProgress(`Run: node comprehensive_data_analyzer.js --team ${teamSlug}`, 'info');
            return null;
        }

        return JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    }

    async generateExtractorInteractive() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => {
            rl.question(prompt, resolve);
        });

        try {
            console.log('🎯 INTERACTIVE TARGETED EXTRACTOR GENERATOR');
            console.log('==========================================');
            console.log('');

            // Get team
            const teamSlug = await question('Which team to analyze? (e.g., hawks): ');
            const analysis = this.loadTeamAnalysis(teamSlug);
            
            if (!analysis) {
                rl.close();
                return;
            }

            console.log(`\n📊 Analysis loaded for ${analysis.metadata.team.name}`);
            console.log(`Found ${analysis.dataInventory.totalTables} total tables`);
            console.log('');

            // Show high-value tables
            console.log('💎 HIGH-VALUE TABLES (Recommended):');
            analysis.tableAnalysis.highValueTables.forEach((table, i) => {
                console.log(`${i + 1}. Table ${table.index} (Score: ${table.score})`);
                console.log(`   Classes: ${table.classes || 'none'}`);
                console.log(`   Headers: ${table.headers.join(', ')}`);
                console.log(`   Data Types: ${Object.entries(table.dataTypes).filter(([k,v]) => v).map(([k]) => k).join(', ')}`);
                console.log('');
            });

            // Show medium-value tables  
            if (analysis.tableAnalysis.mediumValueTables.length > 0) {
                console.log('💰 MEDIUM-VALUE TABLES:');
                analysis.tableAnalysis.mediumValueTables.forEach((table, i) => {
                    console.log(`${i + 1}. Table ${table.index} (Score: ${table.score})`);
                    console.log(`   Headers: ${table.headers.join(', ')}`);
                    console.log('');
                });
            }

            // Get user choice
            const choice = await question('\nChoose extraction method:\n1. Auto (use all high-value recommendations)\n2. Manual (specify table indices)\n3. Custom (interactive selection)\nChoice (1/2/3): ');

            let selectedTables = [];

            if (choice === '1') {
                selectedTables = analysis.tableAnalysis.highValueTables.map(t => t.index);
                console.log(`Selected ${selectedTables.length} high-value tables: [${selectedTables.join(', ')}]`);
            } else if (choice === '2') {
                const tableIndices = await question('Enter table indices (comma-separated, e.g., 0,2,3): ');
                selectedTables = tableIndices.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                console.log(`Selected tables: [${selectedTables.join(', ')}]`);
            } else if (choice === '3') {
                console.log('\nCustom selection coming soon...');
                selectedTables = analysis.tableAnalysis.highValueTables.map(t => t.index);
            } else {
                console.log('Invalid choice, using auto mode');
                selectedTables = analysis.tableAnalysis.highValueTables.map(t => t.index);
            }

            rl.close();

            // Generate the extractor
            await this.generateTargetedExtractor(teamSlug, selectedTables, analysis);

        } catch (error) {
            rl.close();
            this.logProgress(`Interactive mode error: ${error.message}`, 'error');
        }
    }

    async generateTargetedExtractor(teamSlug, selectedTables, analysis) {
        this.logProgress(`Generating targeted extractor for ${analysis.metadata.team.name}`);
        
        // Get full table details for selected tables
        const selectedTableDetails = analysis.completeTableDetails.filter(table => 
            selectedTables.includes(table.index)
        );

        this.logProgress(`Selected ${selectedTableDetails.length} tables for extraction`);

        // Generate the extractor code
        const extractorCode = this.generateExtractorCode(analysis, selectedTableDetails);
        
        // Save the extractor
        const extractorPath = path.join(this.extractorsDir, `targeted_${teamSlug}_extractor.js`);
        fs.writeFileSync(extractorPath, extractorCode);

        // Generate configuration file
        const configData = this.generateExtractorConfig(analysis, selectedTableDetails);
        const configPath = path.join(this.extractorsDir, `${teamSlug}_extraction_config.json`);
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

        // Generate test script
        const testScript = this.generateTestScript(teamSlug, selectedTables);
        const testPath = path.join(this.extractorsDir, `test_${teamSlug}_extractor.js`);
        fs.writeFileSync(testPath, testScript);

        this.logProgress(`Targeted extractor generated: ${extractorPath}`, 'success');
        this.logProgress(`Configuration saved: ${configPath}`, 'success');
        this.logProgress(`Test script saved: ${testPath}`, 'success');

        console.log('\n🎯 TARGETED EXTRACTOR GENERATED');
        console.log('===============================');
        console.log(`📁 Extractor: ${extractorPath}`);
        console.log(`⚙️ Config: ${configPath}`);
        console.log(`🧪 Test: ${testPath}`);
        console.log('');
        console.log('🚀 To test the extractor:');
        console.log(`node ${testPath}`);
        console.log('');
        console.log('📊 Extractor will extract data from:');
        selectedTableDetails.forEach(table => {
            console.log(`   • Table ${table.index}: ${table.headers.join(', ')}`);
        });
    }

    generateExtractorCode(analysis, selectedTables) {
        const teamName = analysis.metadata.team.name;
        const teamSlug = analysis.metadata.team.slug;

        return `/**
 * TARGETED SALARYSWISH EXTRACTOR - ${teamName.toUpperCase()}
 * Generated on ${new Date().toISOString()}
 * 
 * Extracts only the selected high-value data based on comprehensive analysis.
 * Selected tables: [${selectedTables.map(t => t.index).join(', ')}]
 */

import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

class ${teamName.replace(/[^a-zA-Z0-9]/g, '')}TargetedExtractor {
    constructor() {
        this.baseURL = 'https://www.salaryswish.com/teams/${teamSlug}';
        this.targetTables = [${selectedTables.map(t => t.index).join(', ')}];
        this.extractionConfig = ${JSON.stringify(this.createExtractionConfig(selectedTables), null, 8)};
    }

    async extract() {
        try {
            console.log('🎯 Starting targeted extraction for ${teamName}');
            
            const response = await fetch(this.baseURL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
            }

            const html = await response.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;

            console.log('✅ Page fetched successfully');

            const results = {
                metadata: {
                    team: '${teamName}',
                    slug: '${teamSlug}',
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
                    
                    results.extractedData[\`table_\${tableIndex}\`] = {
                        config: config,
                        data: extractedData
                    };
                    
                    console.log(\`📊 Table \${tableIndex}: \${extractedData.length} rows extracted\`);
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
                const headerName = config.headers[cellIndex] || \`column_\${cellIndex}\`;
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
        if (/20\\d{2}-\\d{2}/.test(headerName)) {
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
        return /\\$[\\d,]+|\\d+\\.\\d+[MK]|\\$\\d+[MK]/i.test(text);
    }

    containsPlayerData(text) {
        return /\\b[A-Z][a-z]+ [A-Z][a-z]+\\b/.test(text);
    }

    extractSalaryAmounts(text) {
        const amounts = [];
        const matches = text.match(/\\$[\\d,]+/g) || [];
        
        matches.forEach(match => {
            const amount = parseInt(match.replace(/[\\$,]/g, ''));
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
        return text.replace(/^([^,]+),\\s*(.+)$/, '$2 $1').trim();
    }
}

// Export for use in other scripts
export { ${teamName.replace(/[^a-zA-Z0-9]/g, '')}TargetedExtractor };

// CLI usage
if (import.meta.url === \`file://\${process.argv[1]}\`) {
    const extractor = new ${teamName.replace(/[^a-zA-Z0-9]/g, '')}TargetedExtractor();
    
    extractor.extract()
        .then(results => {
            console.log('\\n🎉 EXTRACTION COMPLETE');
            console.log('=======================');
            console.log(\`📊 Tables extracted: \${results.metadata.tablesExtracted}\`);
            
            Object.entries(results.extractedData).forEach(([tableKey, tableData]) => {
                console.log(\`📋 \${tableKey}: \${tableData.data.length} rows\`);
            });
            
            // Save results
            const outputPath = \`./targeted_\${results.metadata.slug}_data_\${Date.now()}.json\`;
            require('fs').writeFileSync(outputPath, JSON.stringify(results, null, 2));
            console.log(\`💾 Results saved: \${outputPath}\`);
        })
        .catch(console.error);
}`;
    }

    createExtractionConfig(selectedTables) {
        const config = {};
        
        selectedTables.forEach(table => {
            config[table.index] = {
                index: table.index,
                classes: table.classes,
                id: table.id,
                hasHeaders: table.summary.hasHeaders,
                headers: table.headers,
                expectedRows: table.summary.rows,
                expectedColumns: table.summary.columns,
                dataTypes: table.dataTypes,
                extractionRules: {
                    parseSalaries: table.dataTypes.salary,
                    parseContracts: table.dataTypes.contract,
                    parseOptions: table.dataTypes.contract,
                    parseYearlyData: table.headers.some(h => /20\d{2}-\d{2}/.test(h))
                }
            };
        });
        
        return config;
    }

    generateExtractorConfig(analysis, selectedTables) {
        return {
            metadata: {
                team: analysis.metadata.team,
                generatedAt: new Date().toISOString(),
                basedOnAnalysis: analysis.metadata.analyzedAt
            },
            extraction: {
                targetTables: selectedTables.map(t => t.index),
                totalTablesAvailable: analysis.dataInventory.totalTables,
                extractionCoverage: `${selectedTables.length}/${analysis.dataInventory.totalTables}`
            },
            tableDetails: selectedTables,
            extractionRules: {
                parseSalaryAmounts: true,
                parseContractOptions: true,
                parseYearlyData: true,
                cleanPlayerNames: true,
                extractBirdRights: true,
                extractFreeAgentStatus: true
            },
            outputFormat: {
                includeRawHTML: true,
                includeMetadata: true,
                preserveTableStructure: true
            }
        };
    }

    generateTestScript(teamSlug, selectedTables) {
        return `/**
 * TEST SCRIPT for ${teamSlug.toUpperCase()} Targeted Extractor
 * Run this to test the generated extractor
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testExtractor() {
    console.log('🧪 TESTING TARGETED EXTRACTOR');
    console.log('=============================');
    
    try {
        // Import the generated extractor
        const { ${teamSlug.charAt(0).toUpperCase() + teamSlug.slice(1)}TargetedExtractor } = await import(\`./targeted_${teamSlug}_extractor.js\`);
        
        const extractor = new ${teamSlug.charAt(0).toUpperCase() + teamSlug.slice(1)}TargetedExtractor();
        
        console.log('📋 Target tables: [${selectedTables.join(', ')}]');
        console.log('🚀 Starting extraction test...');
        console.log('');
        
        const results = await extractor.extract();
        
        console.log('');
        console.log('✅ TEST RESULTS');
        console.log('===============');
        console.log(\`📊 Tables processed: \${results.metadata.tablesExtracted}\`);
        console.log(\`⏰ Extracted at: \${results.metadata.extractedAt}\`);
        console.log('');
        
        // Show sample data from each table
        Object.entries(results.extractedData).forEach(([tableKey, tableData]) => {
            console.log(\`📋 \${tableKey.toUpperCase()}:\`);
            console.log(\`   📏 Rows: \${tableData.data.length}\`);
            console.log(\`   🏗️  Structure: \${Object.keys(tableData.data[0] || {}).join(', ')}\`);
            
            // Show first row as sample
            if (tableData.data.length > 0) {
                console.log(\`   📝 Sample: \${JSON.stringify(tableData.data[0], null, 6).substring(0, 200)}...\`);
            }
            console.log('');
        });
        
        // Save test results
        const testResultsPath = path.join(__dirname, \`test_results_${teamSlug}_\${Date.now()}.json\`);
        fs.writeFileSync(testResultsPath, JSON.stringify(results, null, 2));
        
        console.log(\`💾 Test results saved: \${testResultsPath}\`);
        console.log('🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
    testExtractor();
}

export { testExtractor };`;
    }

    async run(options = {}) {
        const { team, tables, auto = false, interactive = false } = options;
        
        this.logProgress('Starting Targeted Extractor Generator', 'progress');
        this.logProgress('====================================');
        console.log('');
        
        if (interactive) {
            await this.generateExtractorInteractive();
        } else if (team) {
            const analysis = this.loadTeamAnalysis(team);
            
            if (!analysis) return;
            
            let selectedTables = [];
            
            if (auto) {
                // Use high-value recommendations
                selectedTables = analysis.tableAnalysis.highValueTables.map(t => t.index);
                this.logProgress(`Auto mode: selected ${selectedTables.length} high-value tables`);
            } else if (tables) {
                // Use specified tables
                selectedTables = tables.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                this.logProgress(`Manual mode: selected tables [${selectedTables.join(', ')}]`);
            } else {
                this.logProgress('No table selection method specified, using auto mode', 'info');
                selectedTables = analysis.tableAnalysis.highValueTables.map(t => t.index);
            }
            
            await this.generateTargetedExtractor(team, selectedTables, analysis);
        } else {
            this.logProgress('Please specify a team or use interactive mode', 'error');
            this.logProgress('Examples:', 'info');
            this.logProgress('  node targeted_extractor_generator.js --team hawks --auto', 'info');
            this.logProgress('  node targeted_extractor_generator.js --team hawks --tables 0,2,3', 'info');
            this.logProgress('  node targeted_extractor_generator.js --interactive', 'info');
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--team' && args[i + 1]) {
            options.team = args[i + 1];
            i++;
        } else if (args[i] === '--tables' && args[i + 1]) {
            options.tables = args[i + 1];
            i++;
        } else if (args[i] === '--auto') {
            options.auto = true;
        } else if (args[i] === '--interactive') {
            options.interactive = true;
        }
    }
    
    const generator = new TargetedExtractorGenerator();
    await generator.run(options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { TargetedExtractorGenerator };