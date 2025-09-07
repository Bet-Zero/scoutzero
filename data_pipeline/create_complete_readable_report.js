/**
 * CREATE COMPLETE HUMAN-READABLE DATA REPORT
 * ==========================================
 * 
 * Creates a comprehensive human-readable report showing ALL data found on SalarySwish page
 * Shows complete tables with all rows, not just samples, formatted for human consumption
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CompleteReadableReportGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, 'output', 'data_analysis');
        
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async createCompleteReport(teamSlug) {
        console.log(`🔄 Creating COMPLETE readable report for ${teamSlug}...`);
        console.log(`📋 This will show ALL data from every table, not just samples`);
        
        // Load comprehensive data
        const dataPath = path.join(__dirname, 'output', 'comprehensive_data', `${teamSlug}_comprehensive_data.json`);
        
        if (!fs.existsSync(dataPath)) {
            console.error(`❌ Comprehensive data not found: ${dataPath}`);
            console.log(`   Run: node data_pipeline/comprehensive_salaryswish_scraper.js --team ${teamSlug}`);
            return;
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        const report = this.generateCompleteDataReport(data);
        
        // Save the report
        const reportPath = path.join(this.outputDir, `${teamSlug}_complete_data_report.md`);
        fs.writeFileSync(reportPath, report, 'utf8');
        
        console.log(`✅ Complete readable report saved: ${reportPath}`);
        console.log(`📖 This shows ALL data found on the SalarySwish page in human-readable format`);
        return reportPath;
    }

    generateCompleteDataReport(data) {
        const teamName = data.metadata.team.name;
        const scrapedAt = new Date(data.metadata.scrapedAt).toLocaleString();
        
        let report = `# ${teamName} - Complete SalarySwish Data Report\n\n`;
        report += `**Data Source:** ${data.metadata.url}\n`;
        report += `**Scraped:** ${scrapedAt}\n`;
        report += `**Total Tables Found:** ${data.allTables.length}\n\n`;
        
        report += `## 🔍 IMPORTANT: About This Report\n\n`;
        report += `**This report shows ALL data from each table found on SalarySwish.** The comprehensive scraper captures every row from every table to provide complete data inventory.\n\n`;
        report += `**What you see below:**\n`;
        report += `- Complete table structure (headers, size, data types)\n`;
        report += `- ALL rows from each table showing complete data\n`;
        report += `- Analysis of what each table contains\n\n`;
        report += `---\n\n`;
        report += `## 📊 ALL DATA FOUND ON SALARYSWISH PAGE\n\n`;
        report += `This report shows EVERY piece of data found on the SalarySwish page.\n`;
        report += `Each table below contains ALL rows of data, not samples.\n\n`;

        // Process each table
        data.allTables.forEach((table, index) => {
            report += this.generateTableSection(table, index + 1);
        });

        // Add summary sections
        report += this.generateDataSummary(data);
        
        return report;
    }

    generateTableSection(table, tableNum) {
        let section = `## Table ${tableNum}: ${this.getTableTitle(table)}\n\n`;
        
        // Table info
        section += `**Table Type:** ${table.id || 'Unknown'}\n`;
        section += `**Size:** ${table.summary.rows} rows × ${table.summary.columns} columns\n`;
        section += `**Data Types:** ${this.getDataTypes(table)}\n\n`;
        
        // Extract ALL data from the table using innerHTML
        const completeData = this.extractCompleteTableData(table);
        
        if (completeData.rows.length > 0) {
            section += `### Complete Data (showing all ${completeData.rows.length} rows):\n\n`;
            section += this.formatTableAsMarkdown(completeData.headers, completeData.rows);
        } else {
            section += `### Table Content (Raw Text):\n`;
            section += `\`\`\`\n${table.allTextContent}\n\`\`\`\n\n`;
            section += `*Note: Could not parse structured data from this table*\n\n`;
        }
        
        // Show raw HTML structure for debugging
        if (table.innerHTML && completeData.rows.length === 0) {
            section += `### Raw HTML Structure:\n`;
            section += `\`\`\`html\n${table.innerHTML.substring(0, 500)}...\n\`\`\`\n\n`;
        }
        
        section += `---\n\n`;
        return section;
    }

    extractCompleteTableData(table) {
        // Parse the innerHTML to extract all rows
        const headers = table.headers || [];
        const rows = [];
        
        // Extract from innerHTML if available
        if (table.innerHTML) {
            const innerHTML = table.innerHTML;
            
            // Extract tbody content
            const tbodyMatch = innerHTML.match(/<tbody>(.*?)<\/tbody>/s);
            if (tbodyMatch) {
                const tbodyContent = tbodyMatch[1];
                const rowMatches = tbodyContent.match(/<tr[^>]*>(.*?)<\/tr>/gs);
                
                if (rowMatches) {
                    rowMatches.forEach(rowHtml => {
                        const cellMatches = rowHtml.match(/<td[^>]*>(.*?)<\/td>/gs);
                        if (cellMatches) {
                            const row = cellMatches.map(cellHtml => {
                                // Extract text content, removing HTML tags but preserving structure
                                let text = cellHtml.replace(/<\/?(td|div|span|strong|b|i|em)[^>]*>/gi, '').trim();
                                text = text.replace(/<[^>]*>/g, '').trim();
                                return text || '-';
                            });
                            rows.push(row);
                        }
                    });
                }
            }
            
            // If tbody didn't work, try extracting all tr elements
            if (rows.length === 0) {
                const allRowMatches = innerHTML.match(/<tr[^>]*>(.*?)<\/tr>/gs);
                if (allRowMatches) {
                    // Skip header row if it exists
                    const dataRows = allRowMatches.filter(row => !row.includes('<th'));
                    
                    dataRows.forEach(rowHtml => {
                        const cellMatches = rowHtml.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs);
                        if (cellMatches) {
                            const row = cellMatches.map(cellHtml => {
                                let text = cellHtml.replace(/<\/?(t[dh]|div|span|strong|b|i|em)[^>]*>/gi, '').trim();
                                text = text.replace(/<[^>]*>/g, '').trim();
                                return text || '-';
                            });
                            rows.push(row);
                        }
                    });
                }
            }
        }
        
        // If no data extracted from innerHTML, use all rows (or sampleRows for backwards compatibility)
        const rowData = table.allRows || table.sampleRows;
        if (rows.length === 0 && rowData) {
            rowData.forEach(dataRow => {
                if (Array.isArray(dataRow)) {
                    const row = dataRow.map(cell => {
                        if (typeof cell === 'object' && cell.text) {
                            return cell.text;
                        }
                        return String(cell);
                    });
                    rows.push(row);
                }
            });
        }
        
        // If still no rows, try parsing from allTextContent as last resort
        if (rows.length === 0 && table.allTextContent) {
            const textContent = table.allTextContent;
            const lines = textContent.split('\n').filter(line => line.trim());
            
            // Try to parse structured data
            if (lines.length > headers.length) {
                // Skip header line
                const dataLines = lines.slice(headers.length);
                
                // Group data into rows based on header count
                for (let i = 0; i < dataLines.length; i += headers.length) {
                    const row = [];
                    for (let j = 0; j < headers.length && i + j < dataLines.length; j++) {
                        row.push(dataLines[i + j].trim() || '-');
                    }
                    if (row.length === headers.length) {
                        rows.push(row);
                    }
                }
            }
        }
        
        return { headers, rows };
    }

    formatTableAsMarkdown(headers, rows) {
        if (!headers.length || !rows.length) {
            return `*No structured data available*\n\n`;
        }
        
        let markdown = '';
        
        // Headers
        markdown += '| ' + headers.join(' | ') + ' |\n';
        markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
        
        // Rows
        rows.forEach(row => {
            // Pad row to match header length
            while (row.length < headers.length) {
                row.push('-');
            }
            markdown += '| ' + row.join(' | ') + ' |\n';
        });
        
        markdown += '\n';
        return markdown;
    }

    getTableTitle(table) {
        // Generate human-friendly title based on table info
        if (table.id) {
            return table.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        if (table.classes) {
            if (table.classes.includes('roster')) return 'Player Roster';
            if (table.classes.includes('cap')) return 'Salary Cap Statistics';
            if (table.classes.includes('trade')) return 'Trade Exceptions';
            if (table.classes.includes('exception')) return 'Signing Exceptions';
            if (table.classes.includes('draft')) return 'Draft Picks';
            if (table.classes.includes('free-agent')) return 'Free Agents';
        }
        
        return 'Data Table';
    }

    getDataTypes(table) {
        const types = [];
        if (table.containsSalaryData) types.push('💰 Salary Data');
        if (table.containsPlayerData) types.push('👤 Player Data');
        if (table.containsContractData) types.push('📄 Contract Data');
        if (table.containsExceptionData) types.push('🎫 Exception Data');
        
        return types.length > 0 ? types.join(', ') : 'General Data';
    }

    generateDataSummary(data) {
        let summary = `## 📈 Data Summary\n\n`;
        
        if (data.dataAnalysis) {
            const analysis = data.dataAnalysis;
            
            summary += `**Players Found:** ${analysis.uniquePlayerNames ? analysis.uniquePlayerNames.length : 'Unknown'}\n`;
            if (analysis.uniquePlayerNames) {
                summary += `**Player Names:** ${analysis.uniquePlayerNames.join(', ')}\n`;
            }
            
            summary += `**Years Covered:** ${analysis.yearsCovered ? analysis.yearsCovered.join(', ') : 'Unknown'}\n`;
            
            if (analysis.salaryRanges) {
                summary += `**Salary Range:** $${analysis.salaryRanges.min.toLocaleString()} - $${analysis.salaryRanges.max.toLocaleString()}\n`;
            }
            
            summary += `**Tables with Salary Data:** ${analysis.tablesWithSalaryData || 0}\n`;
            summary += `**Tables with Player Data:** ${analysis.tablesWithPlayerData || 0}\n`;
            summary += `**Tables with Contract Data:** ${analysis.tablesWithContractData || 0}\n`;
        }
        
        summary += `\n---\n\n`;
        summary += `## 🎯 What This Data Provides\n\n`;
        summary += `This SalarySwish page contains comprehensive NBA salary cap data including:\n\n`;
        summary += `- **Complete Player Contracts:** Multi-year salary details for all roster players\n`;
        summary += `- **Salary Cap Management:** Team payroll, cap room, luxury tax calculations\n`;
        summary += `- **Trade Exceptions:** Available TPEs with amounts and expiration dates\n`;
        summary += `- **Future Projections:** Salary commitments through multiple seasons\n\n`;
        summary += `This data is essential for NBA salary cap management and trade analysis.\n`;
        
        summary += `## 🎯 What Each Table Contains\n\n`;
        
        data.allTables.forEach((table, index) => {
            summary += `**Table ${index + 1} (${this.getTableTitle(table)}):**\n`;
            summary += `- ${table.summary.rows} total rows with ${table.summary.columns} columns\n`;
            summary += `- Headers: ${table.headers ? table.headers.join(', ') : 'Unknown'}\n`;
            summary += `- Data Types: ${this.getDataTypes(table)}\n`;
            summary += `- Contains: ${this.describeTableContent(table)}\n\n`;
        });
        
        summary += `## 🚀 Next Steps\n\n`;
        summary += `**To extract complete data from specific tables:**\n`;
        summary += `1. Run the targeted scraper: \`node data_pipeline/targeted_extractor_generator.js --team ${data.metadata.team.slug}\`\n`;
        summary += `2. This will generate a targeted extractor that captures ALL rows from high-value tables\n`;
        summary += `3. The extractor focuses on tables containing salary cap data you identified as important\n\n`;
        summary += `**This comprehensive-first approach ensures:**\n`;
        summary += `- You see what data is available before deciding what to extract\n`;
        summary += `- No wasted time extracting irrelevant data\n`;
        summary += `- Efficient targeted extraction of only valuable tables\n\n`;
        
        return summary;
    }
    
    describeTableContent(table) {
        const descriptions = [];
        
        if (table.containsSalaryData) {
            if (table.id && table.id.includes('roster')) {
                descriptions.push('Player salary contracts with multi-year projections');
            } else if (table.id && table.id.includes('cap')) {
                descriptions.push('Salary cap calculations and team payroll summary');
            } else if (table.id && table.id.includes('exception')) {
                descriptions.push('Trade exceptions and signing exceptions with amounts');
            } else {
                descriptions.push('Salary and contract information');
            }
        }
        
        if (table.containsPlayerData) {
            descriptions.push('Player names, positions, ages, and roster status');
        }
        
        if (table.containsContractData) {
            descriptions.push('Contract terms, options, and acquisition details');
        }
        
        if (table.containsExceptionData) {
            descriptions.push('Trade exceptions with usage tracking and expiration dates');
        }
        
        // Analyze sample data for more insights
        const rowData = table.allRows || table.sampleRows;
        if (rowData && rowData.length > 0) {
            const sampleRow = rowData[0];
            if (Array.isArray(sampleRow)) {
                const textValues = sampleRow.map(cell => 
                    typeof cell === 'object' ? cell.text : String(cell)
                ).join(' ').toLowerCase();
                
                if (textValues.includes('draft') && !descriptions.some(d => d.includes('draft'))) {
                    descriptions.push('Draft pick information and obligations');
                }
                if (textValues.includes('free agent') && !descriptions.some(d => d.includes('free agent'))) {
                    descriptions.push('Free agent status and classifications');
                }
                if (textValues.includes('bird rights') && !descriptions.some(d => d.includes('bird'))) {
                    descriptions.push('Bird rights and cap hold information');
                }
            }
        }
        
        return descriptions.length > 0 ? descriptions.join(', ') : 'General team data';
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    let teamSlug = 'hawks'; // default
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--team' && args[i + 1]) {
            teamSlug = args[i + 1];
            break;
        }
        if (args[i] && !args[i].startsWith('--')) {
            teamSlug = args[i];
            break;
        }
    }
    
    const generator = new CompleteReadableReportGenerator();
    await generator.createCompleteReport(teamSlug);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default CompleteReadableReportGenerator;