#!/usr/bin/env node

/**
 * SalarySwish Data Analysis Tool
 * 
 * Analyzes the comprehensive Hawks data to identify the most valuable tables and data points
 * for salary cap management. This guides the creation of targeted scrapers.
 */

const fs = require('fs');
const path = require('path');

class SalarySwishAnalyzer {
    constructor() {
        this.dataPath = path.join(__dirname, 'hawks_comprehensive_data.json');
        this.hawksData = null;
        this.analysis = {
            tables: [],
            sections: [],
            keyDataPoints: [],
            recommendations: []
        };
    }

    loadData() {
        try {
            console.log(`📁 Loading Hawks data from: ${this.dataPath}`);
            const rawData = fs.readFileSync(this.dataPath, 'utf8');
            this.hawksData = JSON.parse(rawData);
            console.log(`✅ Successfully loaded ${this.hawksData.allTables.length} tables and ${this.hawksData.allSections.length} sections`);
            return true;
        } catch (error) {
            console.error('❌ Failed to load Hawks data:', error.message);
            return false;
        }
    }

    analyzeTables() {
        console.log('\n🔍 ANALYZING TABLES:');
        console.log('=' .repeat(50));

        this.hawksData.allTables.forEach((table, index) => {
            const analysis = this.analyzeTable(table, index);
            this.analysis.tables.push(analysis);
            
            // Display analysis
            console.log(`\n📊 TABLE ${index}: ${analysis.confidence} CONFIDENCE`);
            console.log(`   Classes: ${table.classes}`);
            console.log(`   Dimensions: ${table.rowCount} rows × ${table.columnCount} columns`);
            console.log(`   Key Data: ${analysis.keyDataPoints.join(', ')}`);
            console.log(`   Purpose: ${analysis.purpose}`);
            
            if (analysis.confidence === 'HIGH') {
                console.log('   🎯 HIGH VALUE TABLE - Include in scraper');
            }
        });
    }

    analyzeTable(table, index) {
        const analysis = {
            index,
            confidence: 'LOW',
            purpose: 'Unknown',
            keyDataPoints: [],
            salaryCapRelevance: 0,
            rowCount: table.rowCount,
            columnCount: table.columnCount,
            classes: table.classes,
            headers: table.headers || []
        };

        // Analyze headers for salary cap relevance
        const salaryCapKeywords = [
            'salary', 'cap', 'contract', 'exception', 'trade', 'player', 
            'guaranteed', 'incentive', 'option', 'draft', 'age', 'position'
        ];
        
        const dollarHeaders = table.headers?.filter(h => h.includes('$') || h.includes('20')) || [];
        const yearHeaders = table.headers?.filter(h => /20\d{2}-\d{2}/.test(h)) || [];
        const salaryHeaders = table.headers?.filter(h => 
            salaryCapKeywords.some(keyword => h.toLowerCase().includes(keyword))
        ) || [];

        // Analyze table content
        const allText = table.allText || '';
        const hasDollarAmounts = allText.includes('$');
        const hasPlayerNames = this.hasPlayerNames(allText);
        const hasContractTerms = /UFA|RFA|Max|MLE|RSC|Two-Way/.test(allText);
        
        // Score table relevance
        let score = 0;
        if (dollarHeaders.length > 0) score += 3;
        if (yearHeaders.length > 2) score += 3;
        if (salaryHeaders.length > 0) score += 2;
        if (hasDollarAmounts) score += 2;
        if (hasPlayerNames) score += 2;
        if (hasContractTerms) score += 2;
        if (table.rowCount > 10) score += 1;

        analysis.salaryCapRelevance = score;

        // Determine purpose and confidence
        if (table.classes?.includes('tradeExptn')) {
            analysis.purpose = 'Trade Exceptions';
            analysis.confidence = 'HIGH';
            analysis.keyDataPoints = ['TPE amounts', 'Usage', 'Expiration dates'];
        } else if (table.classes?.includes('draftTable')) {
            analysis.purpose = 'Draft Picks';
            analysis.confidence = 'HIGH';
            analysis.keyDataPoints = ['Draft pick ownership', 'Trade history'];
        } else if (yearHeaders.length >= 4 && hasPlayerNames && hasDollarAmounts) {
            analysis.purpose = 'Multi-Year Player Contracts';
            analysis.confidence = 'HIGH';
            analysis.keyDataPoints = [
                'Player salaries by year',
                'Guaranteed money',
                'Contract options',
                'Free agency status'
            ];
        } else if (table.id?.includes('Stats') || table.classes?.includes('Stats')) {
            analysis.purpose = 'Salary Cap Statistics';
            analysis.confidence = 'MEDIUM';
            analysis.keyDataPoints = ['Cap space', 'Luxury tax', 'Roster limits'];
        } else if (score >= 8) {
            analysis.confidence = 'HIGH';
            analysis.purpose = 'High-Value Salary Data';
        } else if (score >= 5) {
            analysis.confidence = 'MEDIUM';
            analysis.purpose = 'Moderate-Value Salary Data';
        }

        return analysis;
    }

    hasPlayerNames(text) {
        // Common NBA player name patterns
        const playerPatterns = [
            /\w+,\s[A-Z][a-z]+/,  // "Young, Trae"
            /[A-Z][a-z]+\s[A-Z][a-z]+/  // "Trae Young"
        ];
        
        return playerPatterns.some(pattern => pattern.test(text));
    }

    generateRecommendations() {
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('=' .repeat(50));

        const highValueTables = this.analysis.tables.filter(t => t.confidence === 'HIGH');
        const mediumValueTables = this.analysis.tables.filter(t => t.confidence === 'MEDIUM');

        console.log(`\n🎯 HIGH PRIORITY TABLES (${highValueTables.length}):`);
        highValueTables.forEach(table => {
            console.log(`   • Table ${table.index}: ${table.purpose}`);
            console.log(`     Data: ${table.keyDataPoints.join(', ')}`);
        });

        console.log(`\n📊 MEDIUM PRIORITY TABLES (${mediumValueTables.length}):`);
        mediumValueTables.forEach(table => {
            console.log(`   • Table ${table.index}: ${table.purpose}`);
        });

        // Generate scraper strategy
        console.log('\n🔧 SCRAPER STRATEGY:');
        console.log('1. Focus on HIGH priority tables for core contract data');
        console.log('2. Include MEDIUM priority tables for supplementary cap info');
        console.log('3. Extract player contracts with multi-year salary projections');
        console.log('4. Capture trade exceptions and signing exceptions');
        console.log('5. Include cap space and luxury tax calculations');

        // Data transformation strategy
        console.log('\n🔄 DATA TRANSFORMATION:');
        console.log('1. Normalize player names and positions');
        console.log('2. Parse salary strings to numeric values');
        console.log('3. Extract contract options and free agency status');
        console.log('4. Map to existing Firebase schema structure');
        console.log('5. Validate data integrity and completeness');
    }

    exportAnalysis() {
        const outputPath = path.join(__dirname, 'hawks_data_analysis.json');
        
        const fullAnalysis = {
            metadata: {
                analyzedAt: new Date().toISOString(),
                sourceFile: 'hawks_comprehensive_data.json',
                totalTables: this.hawksData.allTables.length,
                totalSections: this.hawksData.allSections.length
            },
            summary: {
                highPriorityTables: this.analysis.tables.filter(t => t.confidence === 'HIGH').length,
                mediumPriorityTables: this.analysis.tables.filter(t => t.confidence === 'MEDIUM').length,
                lowPriorityTables: this.analysis.tables.filter(t => t.confidence === 'LOW').length
            },
            tableAnalysis: this.analysis.tables,
            recommendations: this.analysis.recommendations
        };

        fs.writeFileSync(outputPath, JSON.stringify(fullAnalysis, null, 2));
        console.log(`\n💾 Analysis saved to: ${outputPath}`);
        
        return fullAnalysis;
    }

    run() {
        console.log('🏀 SalarySwish Hawks Data Analysis');
        console.log('=' .repeat(50));

        if (!this.loadData()) {
            process.exit(1);
        }

        this.analyzeTables();
        this.generateRecommendations();
        const analysis = this.exportAnalysis();

        console.log('\n✅ Analysis Complete!');
        console.log('Next steps:');
        console.log('1. Review analysis output');
        console.log('2. Run targeted scraper generator');
        console.log('3. Test with single team');
        console.log('4. Scale to all 30 teams');

        return analysis;
    }
}

// Run analysis if called directly
if (require.main === module) {
    const analyzer = new SalarySwishAnalyzer();
    analyzer.run();
}

module.exports = SalarySwishAnalyzer;