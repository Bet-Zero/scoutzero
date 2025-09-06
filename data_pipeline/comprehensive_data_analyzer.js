/**
 * COMPREHENSIVE DATA ANALYZER
 * ===========================
 * 
 * STEP 2: Analyze ALL scraped data to help decide what's valuable
 * 
 * This script takes the comprehensive data from step 1 and:
 * 1. Shows you EVERYTHING that was found on the page
 * 2. Categorizes data by value/importance 
 * 3. Provides detailed breakdowns of each table/section
 * 4. Helps you decide what to extract vs what to skip
 * 5. Generates extraction recommendations
 * 
 * Usage: node comprehensive_data_analyzer.js --team hawks
 *        node comprehensive_data_analyzer.js --summary (all teams summary)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComprehensiveDataAnalyzer {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        this.comprehensiveDataDir = path.join(this.outputDir, 'comprehensive_data');
        this.analysisDir = path.join(this.outputDir, 'data_analysis');
        
        if (!fs.existsSync(this.analysisDir)) {
            fs.mkdirSync(this.analysisDir, { recursive: true });
        }
    }

    logProgress(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'progress' ? '🔄' : '🔍';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    analyzeTeamData(teamSlug) {
        const dataPath = path.join(this.comprehensiveDataDir, `${teamSlug}_comprehensive_data.json`);
        
        if (!fs.existsSync(dataPath)) {
            this.logProgress(`No comprehensive data found for ${teamSlug}`, 'error');
            this.logProgress(`Expected: ${dataPath}`, 'error');
            this.logProgress(`Run: node comprehensive_salaryswish_scraper.js --team ${teamSlug}`, 'info');
            return null;
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.logProgress(`Analyzing comprehensive data for ${data.metadata.team.name}`);
        
        // CREATE DETAILED ANALYSIS
        const analysis = {
            metadata: {
                team: data.metadata.team,
                analyzedAt: new Date().toISOString(),
                originalDataSize: JSON.stringify(data).length
            },
            
            // COMPLETE DATA INVENTORY
            dataInventory: {
                totalTables: data.allTables?.length || 0,
                totalSections: data.allSections?.length || 0,
                totalHeadings: data.allHeadings?.length || 0,
                totalSalaryElements: data.salaryElements?.length || 0,
                totalPlayerElements: data.playerElements?.length || 0,
                totalContractElements: data.contractElements?.length || 0,
                totalCapElements: data.capElements?.length || 0,
                totalExceptionElements: data.exceptionElements?.length || 0,
                totalDraftElements: data.draftElements?.length || 0
            },
            
            // HIGH-VALUE TABLE ANALYSIS
            tableAnalysis: this.analyzeAllTables(data.allTables || []),
            
            // SALARY CAP DATA BREAKDOWN
            salaryCapBreakdown: this.analyzeSalaryCapData(data),
            
            // CONTRACT DATA BREAKDOWN  
            contractDataBreakdown: this.analyzeContractData(data),
            
            // RECOMMENDED EXTRACTION STRATEGY
            extractionRecommendations: this.generateExtractionRecommendations(data),
            
            // COMPLETE TABLE DETAILS (for manual review)
            completeTableDetails: this.createCompleteTableDetails(data.allTables || [])
        };
        
        // Save detailed analysis
        const analysisPath = path.join(this.analysisDir, `${teamSlug}_data_analysis.json`);
        fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
        
        // Create human-readable report
        this.createReadableReport(analysis, teamSlug);
        
        this.logProgress(`Analysis complete: ${analysisPath}`, 'success');
        return analysis;
    }

    analyzeAllTables(tables) {
        const analysis = {
            highValueTables: [],
            mediumValueTables: [],
            lowValueTables: [],
            salaryTables: [],
            playerTables: [],
            contractTables: [],
            exceptionTables: []
        };

        tables.forEach((table, index) => {
            const tableScore = this.scoreTableValue(table);
            const tableAnalysis = {
                index: table.index,
                classes: table.classes,
                id: table.id,
                size: `${table.summary.rows}x${table.summary.columns}`,
                headers: table.headers,
                score: tableScore,
                dataTypes: {
                    salary: table.containsSalaryData,
                    player: table.containsPlayerData,
                    contract: table.containsContractData,
                    exception: table.containsExceptionData
                },
                sampleContent: table.sampleRows.map(row => 
                    row.map(cell => cell.text.substring(0, 50)).join(' | ')
                ).join('\n'),
                recommendation: this.getTableRecommendation(table, tableScore)
            };
            
            // Categorize by score
            if (tableScore >= 200) {
                analysis.highValueTables.push(tableAnalysis);
            } else if (tableScore >= 50) {
                analysis.mediumValueTables.push(tableAnalysis);
            } else {
                analysis.lowValueTables.push(tableAnalysis);
            }
            
            // Categorize by data type
            if (table.containsSalaryData) analysis.salaryTables.push(tableAnalysis);
            if (table.containsPlayerData) analysis.playerTables.push(tableAnalysis);
            if (table.containsContractData) analysis.contractTables.push(tableAnalysis);
            if (table.containsExceptionData) analysis.exceptionTables.push(tableAnalysis);
        });
        
        // Sort by score
        analysis.highValueTables.sort((a, b) => b.score - a.score);
        analysis.mediumValueTables.sort((a, b) => b.score - a.score);
        
        return analysis;
    }

    scoreTableValue(table) {
        let score = 0;
        
        // Size scoring
        const dataSize = table.summary.rows * table.summary.columns;
        score += dataSize;
        
        // Content scoring
        if (table.containsSalaryData) score += 100;
        if (table.containsContractData) score += 75;
        if (table.containsExceptionData) score += 85;
        if (table.containsPlayerData) score += 50;
        
        // Multi-year data bonus
        const hasMultiYearHeaders = table.headers.some(h => /20\d{2}-\d{2}/.test(h));
        if (hasMultiYearHeaders) score += 200;
        
        // Complex header bonus
        if (table.headers.length > 5) score += 25;
        
        // Penalty for tiny tables
        if (table.summary.rows < 2) score -= 50;
        
        return score;
    }

    getTableRecommendation(table, score) {
        if (score >= 200) {
            return {
                priority: 'HIGH',
                action: 'MUST EXTRACT',
                reason: 'Contains critical salary cap data with multi-year information'
            };
        } else if (score >= 100) {
            return {
                priority: 'MEDIUM', 
                action: 'SHOULD EXTRACT',
                reason: 'Contains valuable salary or contract data'
            };
        } else if (score >= 50) {
            return {
                priority: 'LOW',
                action: 'CONSIDER EXTRACTING',
                reason: 'May contain useful supplementary data'
            };
        } else {
            return {
                priority: 'SKIP',
                action: 'IGNORE',
                reason: 'Likely not valuable for salary cap management'
            };
        }
    }

    analyzeSalaryCapData(data) {
        const breakdown = {
            salaryElementsAnalysis: {
                totalFound: data.salaryElements.length,
                uniqueSalaryAmounts: [],
                salaryRanges: { min: null, max: null },
                commonSalaryPatterns: []
            },
            capElementsAnalysis: {
                totalFound: data.capElements.length,
                capTermsFound: [],
                capSpaceReferences: 0,
                luxuryTaxReferences: 0
            },
            yearsCovered: data.dataAnalysis?.yearsCovered || [],
            salaryDistribution: this.analyzeSalaryDistribution(data.salaryElements)
        };
        
        // Analyze salary amounts
        const allSalaries = data.salaryElements.flatMap(e => e.salaries.map(s => s.amount));
        if (allSalaries.length > 0) {
            breakdown.salaryElementsAnalysis.uniqueSalaryAmounts = [...new Set(allSalaries)].sort((a, b) => b - a);
            breakdown.salaryElementsAnalysis.salaryRanges.min = Math.min(...allSalaries);
            breakdown.salaryElementsAnalysis.salaryRanges.max = Math.max(...allSalaries);
        }
        
        // Analyze cap elements
        data.capElements.forEach(element => {
            const text = element.text.toLowerCase();
            if (text.includes('cap space')) breakdown.capElementsAnalysis.capSpaceReferences++;
            if (text.includes('luxury tax')) breakdown.capElementsAnalysis.luxuryTaxReferences++;
            
            breakdown.capElementsAnalysis.capTermsFound.push({
                text: element.text,
                classes: element.classes
            });
        });
        
        return breakdown;
    }

    analyzeContractData(data) {
        const breakdown = {
            contractElementsAnalysis: {
                totalFound: data.contractElements.length,
                optionReferences: 0,
                guaranteedReferences: 0,
                birdRightsReferences: 0,
                freeAgentReferences: 0
            },
            contractTermsFound: [],
            playerStatusTypes: []
        };
        
        data.contractElements.forEach(element => {
            const text = element.text.toLowerCase();
            if (text.includes('option')) breakdown.contractElementsAnalysis.optionReferences++;
            if (text.includes('guaranteed')) breakdown.contractElementsAnalysis.guaranteedReferences++;
            if (text.includes('bird rights')) breakdown.contractElementsAnalysis.birdRightsReferences++;
            if (text.includes('free agent') || text.includes('rfa') || text.includes('ufa')) {
                breakdown.contractElementsAnalysis.freeAgentReferences++;
            }
            
            breakdown.contractTermsFound.push({
                text: element.text,
                classes: element.classes
            });
        });
        
        return breakdown;
    }

    analyzeSalaryDistribution(salaryElements) {
        const distribution = {
            under1M: 0,
            between1M_5M: 0,
            between5M_15M: 0,  
            between15M_30M: 0,
            over30M: 0
        };
        
        salaryElements.forEach(element => {
            element.salaries.forEach(salary => {
                const amount = salary.amount;
                if (amount < 1000000) distribution.under1M++;
                else if (amount < 5000000) distribution.between1M_5M++;
                else if (amount < 15000000) distribution.between5M_15M++;
                else if (amount < 30000000) distribution.between15M_30M++;
                else distribution.over30M++;
            });
        });
        
        return distribution;
    }

    generateExtractionRecommendations(data) {
        const recommendations = {
            mustExtract: [],
            shouldExtract: [],
            considerExtracting: [],
            skipTables: [],
            extractionStrategy: {},
            priorityOrder: []
        };
        
        // Analyze each table and make recommendations
        data.allTables.forEach(table => {
            const score = this.scoreTableValue(table);
            const recommendation = this.getTableRecommendation(table, score);
            
            const tableInfo = {
                index: table.index,
                classes: table.classes,
                headers: table.headers,
                size: `${table.summary.rows}x${table.summary.columns}`,
                score: score,
                reason: recommendation.reason
            };
            
            switch (recommendation.priority) {
                case 'HIGH':
                    recommendations.mustExtract.push(tableInfo);
                    break;
                case 'MEDIUM':
                    recommendations.shouldExtract.push(tableInfo);
                    break;
                case 'LOW':
                    recommendations.considerExtracting.push(tableInfo);
                    break;
                default:
                    recommendations.skipTables.push(tableInfo);
            }
        });
        
        // Create extraction strategy
        recommendations.extractionStrategy = {
            phase1_critical: recommendations.mustExtract.length,
            phase2_valuable: recommendations.shouldExtract.length,
            phase3_supplementary: recommendations.considerExtracting.length,
            totalTablesFound: data.allTables.length,
            extractionCoverage: `${recommendations.mustExtract.length + recommendations.shouldExtract.length}/${data.allTables.length}`,
            recommendedApproach: this.getRecommendedApproach(recommendations)
        };
        
        // Priority order
        const allRecommended = [
            ...recommendations.mustExtract.map(t => ({ ...t, phase: 'CRITICAL' })),
            ...recommendations.shouldExtract.map(t => ({ ...t, phase: 'VALUABLE' })),
            ...recommendations.considerExtracting.map(t => ({ ...t, phase: 'SUPPLEMENTARY' }))
        ].sort((a, b) => b.score - a.score);
        
        recommendations.priorityOrder = allRecommended;
        
        return recommendations;
    }

    getRecommendedApproach(recommendations) {
        const criticalTables = recommendations.mustExtract.length;
        const valuableTables = recommendations.shouldExtract.length;
        
        if (criticalTables >= 5) {
            return {
                approach: 'COMPREHENSIVE_EXTRACTION',
                description: 'Many high-value tables found. Extract all critical and valuable tables.',
                phases: 3
            };
        } else if (criticalTables >= 2) {
            return {
                approach: 'FOCUSED_EXTRACTION', 
                description: 'Several high-value tables found. Focus on critical tables first.',
                phases: 2
            };
        } else {
            return {
                approach: 'SELECTIVE_EXTRACTION',
                description: 'Few high-value tables found. Carefully select what to extract.',
                phases: 1
            };
        }
    }

    createCompleteTableDetails(tables) {
        return tables.map(table => ({
            index: table.index,
            classes: table.classes,
            id: table.id,
            summary: table.summary,
            headers: table.headers,
            sampleRows: table.sampleRows,
            dataTypes: {
                salary: table.containsSalaryData,
                player: table.containsPlayerData,
                contract: table.containsContractData,
                exception: table.containsExceptionData
            },
            textPreview: table.allTextContent.substring(0, 200),
            htmlPreview: table.innerHTML.substring(0, 300)
        }));
    }

    createReadableReport(analysis, teamSlug) {
        const reportPath = path.join(this.analysisDir, `${teamSlug}_readable_report.md`);
        
        const report = `# ${analysis.metadata.team.name} - Comprehensive Data Analysis Report

## Data Inventory Summary
- **Total Tables Found:** ${analysis.dataInventory.totalTables}
- **Total Sections:** ${analysis.dataInventory.totalSections}  
- **Salary Elements:** ${analysis.dataInventory.totalSalaryElements}
- **Contract Elements:** ${analysis.dataInventory.totalContractElements}
- **Cap Elements:** ${analysis.dataInventory.totalCapElements}
- **Exception Elements:** ${analysis.dataInventory.totalExceptionElements}
- **Draft Elements:** ${analysis.dataInventory.totalDraftElements}

## High-Value Tables (MUST EXTRACT)
${analysis.tableAnalysis.highValueTables.map(table => `
### Table ${table.index} (Score: ${table.score})
- **Classes:** ${table.classes || 'none'}
- **Size:** ${table.size}
- **Headers:** ${table.headers.join(', ')}
- **Data Types:** ${Object.entries(table.dataTypes).filter(([k,v]) => v).map(([k]) => k).join(', ')}
- **Recommendation:** ${table.recommendation.action} - ${table.recommendation.reason}

**Sample Data:**
\`\`\`
${table.sampleContent}
\`\`\`
`).join('')}

## Medium-Value Tables (SHOULD EXTRACT)  
${analysis.tableAnalysis.mediumValueTables.map(table => `
### Table ${table.index} (Score: ${table.score})
- **Classes:** ${table.classes || 'none'}
- **Size:** ${table.size}
- **Headers:** ${table.headers.join(', ')}
- **Recommendation:** ${table.recommendation.action} - ${table.recommendation.reason}
`).join('')}

## Salary Cap Data Analysis
- **Years Covered:** ${analysis.salaryCapBreakdown.yearsCovered.join(', ')}
- **Salary Elements Found:** ${analysis.salaryCapBreakdown.salaryElementsAnalysis.totalFound}
- **Cap Space References:** ${analysis.salaryCapBreakdown.capElementsAnalysis.capSpaceReferences}
- **Luxury Tax References:** ${analysis.salaryCapBreakdown.capElementsAnalysis.luxuryTaxReferences}

### Salary Distribution
- **Under $1M:** ${analysis.salaryCapBreakdown.salaryDistribution.under1M}
- **$1M-$5M:** ${analysis.salaryCapBreakdown.salaryDistribution.between1M_5M}
- **$5M-$15M:** ${analysis.salaryCapBreakdown.salaryDistribution.between5M_15M}
- **$15M-$30M:** ${analysis.salaryCapBreakdown.salaryDistribution.between15M_30M}
- **Over $30M:** ${analysis.salaryCapBreakdown.salaryDistribution.over30M}

## Extraction Recommendations

### 📋 Extraction Strategy: ${analysis.extractionRecommendations.extractionStrategy.recommendedApproach.approach}
${analysis.extractionRecommendations.extractionStrategy.recommendedApproach.description}

### 📊 Extraction Coverage
- **Critical Tables:** ${analysis.extractionRecommendations.extractionStrategy.phase1_critical} 
- **Valuable Tables:** ${analysis.extractionRecommendations.extractionStrategy.phase2_valuable}
- **Supplementary Tables:** ${analysis.extractionRecommendations.extractionStrategy.phase3_supplementary}
- **Coverage:** ${analysis.extractionRecommendations.extractionStrategy.extractionCoverage}

### 🎯 Priority Order
${analysis.extractionRecommendations.priorityOrder.slice(0, 10).map((table, i) => 
`${i+1}. **Table ${table.index}** (${table.phase}, Score: ${table.score})
   - Headers: ${table.headers.slice(0, 3).join(', ')}${table.headers.length > 3 ? '...' : ''}
   - Reason: ${table.reason}`
).join('\n')}

## What This Means
Based on this analysis, you should:

1. **DEFINITELY EXTRACT** the ${analysis.extractionRecommendations.mustExtract.length} high-value tables - these contain critical salary cap data
2. **CONSIDER EXTRACTING** the ${analysis.extractionRecommendations.shouldExtract.length} medium-value tables based on your specific needs
3. **SKIP** the ${analysis.extractionRecommendations.skipTables.length} low-value tables to keep the scraper focused

The recommended approach is **${analysis.extractionRecommendations.extractionStrategy.recommendedApproach.approach}** with ${analysis.extractionRecommendations.extractionStrategy.recommendedApproach.phases} extraction phases.

---
*Report generated on ${analysis.metadata.analyzedAt}*
`;

        fs.writeFileSync(reportPath, report);
        this.logProgress(`Human-readable report saved: ${reportPath}`, 'success');
        
        // Also log key findings to console
        console.log('\n📊 KEY FINDINGS:');
        console.log('================');
        console.log(`💎 HIGH-VALUE TABLES: ${analysis.tableAnalysis.highValueTables.length} found`);
        console.log(`💰 SALARY TABLES: ${analysis.tableAnalysis.salaryTables.length} found`);
        console.log(`📋 CONTRACT TABLES: ${analysis.tableAnalysis.contractTables.length} found`);
        console.log(`🎫 EXCEPTION TABLES: ${analysis.tableAnalysis.exceptionTables.length} found`);
        console.log(`📅 YEARS COVERED: ${analysis.salaryCapBreakdown.yearsCovered.join(', ')}`);
        console.log(`🎯 RECOMMENDED APPROACH: ${analysis.extractionRecommendations.extractionStrategy.recommendedApproach.approach}`);
        console.log(`📄 DETAILED REPORT: ${reportPath}`);
    }

    analyzeSummary() {
        this.logProgress('Analyzing summary of all comprehensive data');
        
        // Find all comprehensive data files
        const dataFiles = fs.readdirSync(this.comprehensiveDataDir)
            .filter(file => file.endsWith('_comprehensive_data.json'))
            .map(file => {
                const teamSlug = file.replace('_comprehensive_data.json', '');
                return { teamSlug, file };
            });
        
        if (dataFiles.length === 0) {
            this.logProgress('No comprehensive data files found', 'error');
            this.logProgress('Run comprehensive scraper first: node comprehensive_salaryswish_scraper.js --team hawks', 'info');
            return;
        }
        
        this.logProgress(`Found ${dataFiles.length} team data files`);
        
        const summaryAnalysis = {
            metadata: {
                analyzedAt: new Date().toISOString(),
                teamsAnalyzed: dataFiles.length
            },
            overallFindings: {
                totalTables: 0,
                avgTablesPerTeam: 0,
                highValueTablesFound: 0,
                commonTableClasses: {},
                dataTypeDistribution: {
                    salary: 0,
                    contract: 0,
                    exception: 0,
                    player: 0
                }
            },
            teamComparisons: [],
            extractionStrategy: {}
        };
        
        // Analyze each team's data
        dataFiles.forEach(({ teamSlug, file }) => {
            this.logProgress(`Analyzing ${teamSlug}...`);
            const teamAnalysis = this.analyzeTeamData(teamSlug);
            
            if (teamAnalysis) {
                summaryAnalysis.overallFindings.totalTables += teamAnalysis.dataInventory.totalTables;
                summaryAnalysis.overallFindings.highValueTablesFound += teamAnalysis.tableAnalysis.highValueTables.length;
                
                summaryAnalysis.teamComparisons.push({
                    team: teamAnalysis.metadata.team.name,
                    slug: teamSlug,
                    tables: teamAnalysis.dataInventory.totalTables,
                    highValueTables: teamAnalysis.tableAnalysis.highValueTables.length,
                    salaryElements: teamAnalysis.dataInventory.totalSalaryElements,
                    contractElements: teamAnalysis.dataInventory.totalContractElements,
                    extractionApproach: teamAnalysis.extractionRecommendations.extractionStrategy.recommendedApproach.approach
                });
            }
        });
        
        // Calculate averages
        summaryAnalysis.overallFindings.avgTablesPerTeam = 
            Math.round(summaryAnalysis.overallFindings.totalTables / dataFiles.length);
        
        // Save summary
        const summaryPath = path.join(this.analysisDir, 'comprehensive_summary_analysis.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summaryAnalysis, null, 2));
        
        // Create summary report
        this.createSummaryReport(summaryAnalysis);
        
        this.logProgress(`Summary analysis complete: ${summaryPath}`, 'success');
    }

    createSummaryReport(summary) {
        const reportPath = path.join(this.analysisDir, 'comprehensive_summary_report.md');
        
        const report = `# Comprehensive SalarySwish Data Analysis - Summary Report

## Overall Findings
- **Teams Analyzed:** ${summary.metadata.teamsAnalyzed}
- **Total Tables Found:** ${summary.overallFindings.totalTables}
- **Average Tables per Team:** ${summary.overallFindings.avgTablesPerTeam}
- **High-Value Tables:** ${summary.overallFindings.highValueTablesFound}

## Team Comparisons
${summary.teamComparisons.map(team => 
`### ${team.team}
- Tables: ${team.tables} | High-Value: ${team.highValueTables}
- Salary Elements: ${team.salaryElements} | Contract Elements: ${team.contractElements}  
- Recommended Approach: ${team.extractionApproach}`
).join('\n')}

## Next Steps
1. Review individual team reports in the data_analysis folder
2. Decide which tables/data you want to extract based on the recommendations
3. Build targeted extractor using the findings from this analysis

---
*Summary generated on ${summary.metadata.analyzedAt}*
`;

        fs.writeFileSync(reportPath, report);
        this.logProgress(`Summary report saved: ${reportPath}`, 'success');
        
        console.log('\n📊 SUMMARY FINDINGS:');
        console.log('===================');
        console.log(`🏀 TEAMS ANALYZED: ${summary.metadata.teamsAnalyzed}`);
        console.log(`📋 TOTAL TABLES: ${summary.overallFindings.totalTables}`);
        console.log(`💎 HIGH-VALUE TABLES: ${summary.overallFindings.highValueTablesFound}`);
        console.log(`📊 AVG TABLES/TEAM: ${summary.overallFindings.avgTablesPerTeam}`);
        console.log(`📄 SUMMARY REPORT: ${reportPath}`);
    }

    async run(options = {}) {
        const { team, summary = false } = options;
        
        this.logProgress('Starting Comprehensive Data Analysis', 'progress');
        this.logProgress('====================================');
        console.log('');
        
        if (summary) {
            await this.analyzeSummary();
        } else if (team) {
            await this.analyzeTeamData(team);
        } else {
            this.logProgress('Please specify --team <teamslug> or --summary', 'error');
            this.logProgress('Example: node comprehensive_data_analyzer.js --team hawks', 'info');
            this.logProgress('Example: node comprehensive_data_analyzer.js --summary', 'info');
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
        } else if (args[i] === '--summary') {
            options.summary = true;
        }
    }
    
    const analyzer = new ComprehensiveDataAnalyzer();
    await analyzer.run(options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { ComprehensiveDataAnalyzer };