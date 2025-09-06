/**
 * COMPLETE SALARYSWISH MIGRATION WORKFLOW
 * ======================================
 * 
 * This script orchestrates the complete migration from Spotrac to SalarySwish:
 * 
 * 1. Analyzes comprehensive Hawks data (when provided)
 * 2. Generates targeted scraper configuration
 * 3. Creates production scraper for all 30 teams
 * 4. Tests scraper with single team
 * 5. Provides integration plan for existing pipeline
 * 
 * Usage:
 * - With Hawks data file: node complete_salaryswish_migration.js hawks_data.json
 * - With pasted JSON data: Modify SAMPLE_DATA const below
 * - Interactive mode: node complete_salaryswish_migration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeSalarySwish } from './analyze_salaryswish_data.js';
import { generateCompletePipeline } from './generate_targeted_salaryswish_scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logProgress(message, section = '') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = section ? `[${section}] ` : '';
    console.log(`[${timestamp}] ${prefix}${message}`);
}

/**
 * Placeholder for Hawks data - replace with actual JSON content when available
 */
const SAMPLE_DATA = {
    metadata: {
        url: "https://www.salaryswish.com/teams/hawks",
        scrapedAt: new Date().toISOString(),
        htmlSize: 926775,
        team: { slug: 'hawks', name: 'Atlanta Hawks' }
    },
    allTables: [
        // This will be replaced with actual Hawks data from user
    ],
    allSections: [],
    allHeadings: [],
    allText: {
        dollarAmounts: [],
        years: [],
        percentages: []
    },
    specialElements: {}
};

/**
 * Interactive data input when no file is provided
 */
async function getHawksData(inputFile) {
    if (inputFile) {
        try {
            const jsonContent = fs.readFileSync(inputFile, 'utf8');
            return JSON.parse(jsonContent);
        } catch (error) {
            logProgress(`❌ Error reading file ${inputFile}: ${error.message}`, 'INPUT');
            return null;
        }
    }
    
    logProgress('📋 No Hawks data file provided', 'INPUT');
    logProgress('   You can:', 'INPUT');
    logProgress('   1. Run with file: node complete_salaryswish_migration.js hawks_data.json', 'INPUT');
    logProgress('   2. Paste JSON data into SAMPLE_DATA const in this file', 'INPUT');
    logProgress('   3. Use sample structure for testing', 'INPUT');
    logProgress('', 'INPUT');
    
    // For now, return sample data structure
    // User should replace SAMPLE_DATA with actual Hawks JSON
    return SAMPLE_DATA;
}

/**
 * Validate Hawks data structure
 */
function validateHawksData(data) {
    const required = ['metadata', 'allTables', 'allSections', 'allHeadings', 'allText'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
        logProgress(`❌ Missing required fields: ${missing.join(', ')}`, 'VALIDATION');
        return false;
    }
    
    if (!data.allTables || !Array.isArray(data.allTables)) {
        logProgress('❌ allTables must be an array', 'VALIDATION');
        return false;
    }
    
    logProgress('✅ Hawks data structure is valid', 'VALIDATION');
    logProgress(`   Tables: ${data.allTables.length}`, 'VALIDATION');
    logProgress(`   Sections: ${data.allSections.length}`, 'VALIDATION');
    logProgress(`   Headings: ${data.allHeadings.length}`, 'VALIDATION');
    
    return true;
}

/**
 * Create team slug mapping file
 */
function generateTeamMappings() {
    const mappings = [
        { name: 'Atlanta Hawks', slug: 'hawks', spotrac: 'atlanta-hawks' },
        { name: 'Boston Celtics', slug: 'celtics', spotrac: 'boston-celtics' },
        { name: 'Brooklyn Nets', slug: 'nets', spotrac: 'brooklyn-nets' },
        { name: 'Charlotte Hornets', slug: 'hornets', spotrac: 'charlotte-hornets' },
        { name: 'Chicago Bulls', slug: 'bulls', spotrac: 'chicago-bulls' },
        { name: 'Cleveland Cavaliers', slug: 'cavaliers', spotrac: 'cleveland-cavaliers' },
        { name: 'Dallas Mavericks', slug: 'mavericks', spotrac: 'dallas-mavericks' },
        { name: 'Denver Nuggets', slug: 'nuggets', spotrac: 'denver-nuggets' },
        { name: 'Detroit Pistons', slug: 'pistons', spotrac: 'detroit-pistons' },
        { name: 'Golden State Warriors', slug: 'warriors', spotrac: 'golden-state-warriors' },
        { name: 'Houston Rockets', slug: 'rockets', spotrac: 'houston-rockets' },
        { name: 'Indiana Pacers', slug: 'pacers', spotrac: 'indiana-pacers' },
        { name: 'Los Angeles Clippers', slug: 'clippers', spotrac: 'los-angeles-clippers' },
        { name: 'Los Angeles Lakers', slug: 'lakers', spotrac: 'los-angeles-lakers' },
        { name: 'Memphis Grizzlies', slug: 'grizzlies', spotrac: 'memphis-grizzlies' },
        { name: 'Miami Heat', slug: 'heat', spotrac: 'miami-heat' },
        { name: 'Milwaukee Bucks', slug: 'bucks', spotrac: 'milwaukee-bucks' },
        { name: 'Minnesota Timberwolves', slug: 'timberwolves', spotrac: 'minnesota-timberwolves' },
        { name: 'New Orleans Pelicans', slug: 'pelicans', spotrac: 'new-orleans-pelicans' },
        { name: 'New York Knicks', slug: 'knicks', spotrac: 'new-york-knicks' },
        { name: 'Oklahoma City Thunder', slug: 'thunder', spotrac: 'oklahoma-city-thunder' },
        { name: 'Orlando Magic', slug: 'magic', spotrac: 'orlando-magic' },
        { name: 'Philadelphia 76ers', slug: '76ers', spotrac: 'philadelphia-76ers' },
        { name: 'Phoenix Suns', slug: 'suns', spotrac: 'phoenix-suns' },
        { name: 'Portland Trail Blazers', slug: 'trail-blazers', spotrac: 'portland-trail-blazers' },
        { name: 'Sacramento Kings', slug: 'kings', spotrac: 'sacramento-kings' },
        { name: 'San Antonio Spurs', slug: 'spurs', spotrac: 'san-antonio-spurs' },
        { name: 'Toronto Raptors', slug: 'raptors', spotrac: 'toronto-raptors' },
        { name: 'Utah Jazz', slug: 'jazz', spotrac: 'utah-jazz' },
        { name: 'Washington Wizards', slug: 'wizards', spotrac: 'washington-wizards' }
    ];
    
    const mappingFile = path.join(__dirname, 'nba_team_mappings.json');
    fs.writeFileSync(mappingFile, JSON.stringify(mappings, null, 2));
    
    logProgress('✅ Generated team mappings', 'SETUP');
    logProgress(`   File: ${mappingFile}`, 'SETUP');
    logProgress(`   Teams: ${mappings.length}`, 'SETUP');
    
    return mappingFile;
}

/**
 * Generate integration plan
 */
function generateMigrationPlan(analysis, config) {
    const plan = {
        migrationSteps: [
            {
                step: 1,
                title: "Test Single Team Scraper",
                description: "Validate scraper with Hawks data before scaling",
                command: "node targeted_salaryswish_scraper.js --test-team=hawks",
                expectedResult: `${config.estimatedDataPerTeam} Hawks players with contracts`
            },
            {
                step: 2,
                title: "Run Complete 30-Team Scraping",
                description: "Scrape all NBA teams using targeted selectors",
                command: "node targeted_salaryswish_scraper.js",
                expectedResult: `${30 * parseInt(config.estimatedDataPerTeam.split('-')[0])}+ total players across all teams`
            },
            {
                step: 3,
                title: "Integrate with Existing Pipeline",
                description: "Replace Spotrac in main pipeline",
                files: ["local_fresh_data_scraper.js"],
                changes: [
                    "Replace Spotrac endpoints with SalarySwish results",
                    "Maintain NBA stats scraping (unchanged)",
                    "Update progress logging to reflect SalarySwish source"
                ]
            },
            {
                step: 4,
                title: "Test Data Migration",
                description: "Ensure compatibility with existing Firebase schema",
                command: "node migrate_and_structure.js",
                expectedResult: "Separated schema with contracts compatible with frontend"
            },
            {
                step: 5,
                title: "Deploy to Production",
                description: "Upload new data to Firebase",
                command: "node load_to_firebase.js",
                expectedResult: "Updated Firebase collections with SalarySwish data"
            }
        ],
        benefits: [
            "50% reduction in API requests (30 vs 60)",
            "Single page contains multi-year contracts + exceptions",
            "More reliable parsing with targeted selectors",
            "Better error handling and fallback strategies"
        ],
        riskMitigation: [
            "Test with single team first",
            "Multiple fallback selectors for robustness", 
            "Maintain existing schema compatibility",
            "Clear logging for debugging issues"
        ],
        timeline: {
            "Day 1": "Test Hawks scraper, validate data extraction",
            "Day 2": "Run full 30-team scraping, review results", 
            "Day 3": "Integrate with pipeline, test end-to-end",
            "Day 4": "Deploy to production, validate frontend"
        }
    };
    
    const planFile = path.join(__dirname, 'SALARYSWISH_MIGRATION_PLAN_DETAILED.md');
    const planContent = `# SalarySwish Migration Plan - Detailed Implementation

## Analysis Results

**Target Tables Identified:** ${analysis.targetTables.length}
**Primary Selectors:** ${config.tableSelectors.length} 
**Fallback Selectors:** ${config.fallbackSelectors.length}
**Expected Data Yield:** ${config.estimatedDataPerTeam} players per team

## Step-by-Step Migration

${plan.migrationSteps.map((step, i) => `
### Step ${step.step}: ${step.title}

${step.description}

${step.command ? `**Command:** \`${step.command}\`` : ''}
${step.files ? `**Files to modify:** ${step.files.join(', ')}` : ''}
${step.changes ? `**Changes:**\n${step.changes.map(c => `- ${c}`).join('\n')}` : ''}
${step.expectedResult ? `**Expected result:** ${step.expectedResult}` : ''}
`).join('')}

## Benefits

${plan.benefits.map(b => `- ${b}`).join('\n')}

## Risk Mitigation

${plan.riskMitigation.map(r => `- ${r}`).join('\n')}

## Implementation Timeline

${Object.entries(plan.timeline).map(([day, task]) => `- **${day}:** ${task}`).join('\n')}

## Generated Files

1. \`targeted_salaryswish_scraper.js\` - Production scraper
2. \`salaryswish_scraper_config.json\` - Configuration file
3. \`nba_team_mappings.json\` - Team slug mappings
4. \`SALARYSWISH_INTEGRATION_GUIDE.md\` - Integration instructions

## Next Steps

1. Review generated scraper configuration
2. Test with single team (Hawks) first
3. Validate data structure matches expectations
4. Scale to all 30 teams when confident
5. Integrate with existing pipeline

---
*Generated on: ${new Date().toISOString()}*
*Based on comprehensive SalarySwish data analysis*
`;

    fs.writeFileSync(planFile, planContent);
    
    logProgress('✅ Generated detailed migration plan', 'PLANNING');
    logProgress(`   File: ${planFile}`, 'PLANNING');
    
    return plan;
}

/**
 * Main migration workflow
 */
async function completeSalarySwishMigration(inputFile) {
    logProgress('🚀 COMPLETE SALARYSWISH MIGRATION', 'MAIN');
    logProgress('==================================', 'MAIN');
    
    try {
        // Step 1: Load and validate Hawks data
        logProgress('Step 1: Loading Hawks comprehensive data...', 'MAIN');
        const hawksData = await getHawksData(inputFile);
        
        if (!hawksData) {
            logProgress('❌ No Hawks data available - cannot proceed', 'MAIN');
            return;
        }
        
        if (!validateHawksData(hawksData)) {
            logProgress('❌ Hawks data validation failed - cannot proceed', 'MAIN');
            return;
        }
        
        // Step 2: Generate team mappings
        logProgress('Step 2: Generating team mappings...', 'MAIN');
        generateTeamMappings();
        
        // Step 3: Analyze Hawks data
        logProgress('Step 3: Analyzing SalarySwish data structure...', 'MAIN');
        const { analysis, scraperConfig } = await analyzeSalarySwish(hawksData);
        
        if (!analysis || !scraperConfig) {
            logProgress('❌ Data analysis failed - cannot generate scraper', 'MAIN');
            return;
        }
        
        // Step 4: Generate targeted scraper
        logProgress('Step 4: Generating targeted scraper...', 'MAIN');
        const pipelineFiles = await generateCompletePipeline(scraperConfig);
        
        // Step 5: Create detailed migration plan
        logProgress('Step 5: Creating migration plan...', 'MAIN');
        const migrationPlan = generateMigrationPlan(analysis, scraperConfig);
        
        // Summary
        logProgress('', 'MAIN');
        logProgress('🎉 MIGRATION SETUP COMPLETE!', 'MAIN');
        logProgress('===========================', 'MAIN');
        logProgress(`✅ Analyzed ${hawksData.allTables.length} tables from Hawks data`, 'MAIN');
        logProgress(`✅ Generated ${analysis.targetTables.length} target table selectors`, 'MAIN');
        logProgress(`✅ Created production scraper: ${path.basename(pipelineFiles.scraperFile)}`, 'MAIN');
        logProgress(`✅ Expected yield: ${scraperConfig.estimatedDataPerTeam} players per team`, 'MAIN');
        logProgress('', 'MAIN');
        logProgress('📋 NEXT STEPS:', 'MAIN');
        logProgress('   1. Review generated scraper configuration', 'MAIN');
        logProgress('   2. Test single team: node targeted_salaryswish_scraper.js --test', 'MAIN');
        logProgress('   3. Run full scraping when confident', 'MAIN');
        logProgress('   4. Integrate with existing pipeline', 'MAIN');
        
        return {
            analysis,
            scraperConfig,
            pipelineFiles,
            migrationPlan
        };
        
    } catch (error) {
        logProgress(`❌ Migration failed: ${error.message}`, 'MAIN');
        console.error(error);
        return null;
    }
}

// Command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const inputFile = process.argv[2];
    completeSalarySwishMigration(inputFile);
}

export { completeSalarySwishMigration };