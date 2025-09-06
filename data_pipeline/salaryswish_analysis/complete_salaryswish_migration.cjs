#!/usr/bin/env node

/**
 * Complete SalarySwish Migration Workflow
 * 
 * Orchestrates the complete transition from Spotrac to SalarySwish:
 * 1. Analyzes comprehensive Hawks data structure
 * 2. Generates targeted scraper based on findings
 * 3. Tests with single team validation
 * 4. Provides migration roadmap
 */

const path = require('path');
const { execSync } = require('child_process');

class SalarySwishMigrationWorkflow {
    constructor() {
        this.workingDir = path.join(__dirname);
        this.steps = [
            { name: 'Analyze Hawks Data', script: 'analyze_salaryswish_data.cjs', required: true },
            { name: 'Generate Targeted Scraper', script: 'generate_targeted_salaryswish_scraper.cjs', required: true },
            { name: 'Test Single Team', script: '../targeted_salaryswish_scraper.cjs', args: 'test hawks', required: true },
            { name: 'Validate Data Quality', method: 'validateTestResults', required: true },
            { name: 'Generate Migration Plan', method: 'generateMigrationPlan', required: true }
        ];
        this.results = {
            completed: [],
            failed: [],
            analysis: null,
            testResults: null
        };
    }

    async executeStep(step) {
        console.log(`\n🚀 STEP: ${step.name}`);
        console.log('-'.repeat(50));
        
        try {
            if (step.script) {
                const scriptPath = path.join(this.workingDir, step.script);
                const command = step.args ? `node "${scriptPath}" ${step.args}` : `node "${scriptPath}"`;
                
                console.log(`📟 Executing: ${command}`);
                const output = execSync(command, {
                    cwd: this.workingDir,
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                
                console.log(output);
                this.results.completed.push({
                    step: step.name,
                    output: output,
                    timestamp: new Date().toISOString()
                });
                
                return { success: true, output };
                
            } else if (step.method) {
                console.log(`🔧 Executing method: ${step.method}`);
                const result = await this[step.method]();
                
                this.results.completed.push({
                    step: step.name,
                    result: result,
                    timestamp: new Date().toISOString()
                });
                
                return { success: true, result };
            }
            
        } catch (error) {
            console.error(`❌ Step failed: ${error.message}`);
            this.results.failed.push({
                step: step.name,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            if (step.required) {
                throw new Error(`Required step failed: ${step.name}`);
            }
            
            return { success: false, error: error.message };
        }
    }

    async validateTestResults() {
        console.log('🔍 Validating test results...');
        
        try {
            const testFilePath = path.join(this.workingDir, '../test_hawks_result.json');
            const fs = require('fs');
            
            if (!fs.existsSync(testFilePath)) {
                throw new Error('Test results file not found');
            }
            
            const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
            this.results.testResults = testData;
            
            const validation = {
                hasPlayers: (testData.players?.length || 0) > 0,
                hasExceptions: (testData.tradeExceptions?.length || 0) > 0,
                hasCapData: !!testData.capSpace,
                playerCount: testData.players?.length || 0,
                exceptionCount: testData.tradeExceptions?.length || 0
            };
            
            console.log(`✅ Players found: ${validation.playerCount}`);
            console.log(`✅ Trade exceptions: ${validation.exceptionCount}`);
            console.log(`✅ Cap data: ${validation.hasCapData ? 'Yes' : 'No'}`);
            
            if (validation.playerCount < 10) {
                console.warn('⚠️  Low player count - may need scraper adjustments');
            }
            
            return validation;
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            throw error;
        }
    }

    async generateMigrationPlan() {
        console.log('📋 Generating complete migration plan...');
        
        const plan = {
            overview: {
                title: 'SalarySwish Migration Plan',
                createdAt: new Date().toISOString(),
                status: 'Ready for Implementation'
            },
            dataComparison: {
                spotrac: {
                    endpoints: 2,
                    requests: 60, // 2 per team × 30 teams
                    dataGaps: ['Limited multi-year contracts', 'Missing exception data'],
                    reliability: 'Moderate'
                },
                salaryswish: {
                    endpoints: 1,
                    requests: 30, // 1 per team × 30 teams
                    dataCompleteness: 'Comprehensive',
                    reliability: 'High'
                }
            },
            implementation: {
                phases: [
                    {
                        phase: 1,
                        name: 'Single Team Validation',
                        duration: '1-2 days',
                        tasks: [
                            'Test scraper with Hawks (✅ Complete)',
                            'Validate data accuracy against known values',
                            'Adjust parsing logic if needed',
                            'Performance optimization'
                        ],
                        deliverable: 'Validated single-team scraper'
                    },
                    {
                        phase: 2,
                        name: 'Multi-Team Testing',
                        duration: '2-3 days',
                        tasks: [
                            'Test with 5 diverse teams',
                            'Handle edge cases and data variations',
                            'Rate limiting and error handling',
                            'Data consistency validation'
                        ],
                        deliverable: 'Robust multi-team scraper'
                    },
                    {
                        phase: 3,
                        name: 'Full Pipeline Integration',
                        duration: '3-5 days',
                        tasks: [
                            'Replace Spotrac endpoints in existing pipeline',
                            'Update Firebase schema if needed',
                            'Data transformation compatibility',
                            'End-to-end testing'
                        ],
                        deliverable: 'Complete SalarySwish pipeline'
                    },
                    {
                        phase: 4,
                        name: 'Production Deployment',
                        duration: '1-2 days',
                        tasks: [
                            'Schedule cutover from Spotrac',
                            'Monitor initial production runs',
                            'Performance and reliability validation',
                            'Documentation updates'
                        ],
                        deliverable: 'Live SalarySwish integration'
                    }
                ]
            },
            dataMapping: {
                players: {
                    source: 'Main roster table (Table 2)',
                    fields: ['name', 'position', 'age', 'multi-year salaries', 'contract options', 'free agency status'],
                    transformation: 'Parse complex salary strings, normalize player names'
                },
                exceptions: {
                    trade: {
                        source: 'Trade exceptions table (Table 0)',
                        fields: ['player', 'amount', 'used', 'remaining', 'dates']
                    },
                    signing: {
                        source: 'Page sections',
                        fields: ['MLE', 'BAE', 'other exceptions']
                    }
                },
                capSpace: {
                    source: 'Cap statistics sections',
                    fields: ['cap hit', 'cap room', 'luxury tax', 'aprons', 'hard cap']
                }
            },
            benefits: [
                'Single request per team (vs 2+ with Spotrac)',
                'Complete multi-year contract data through 2030-31',
                'Trade exception amounts and expiration dates',
                'Signing exception details (MLE, BAE, etc.)',
                'Hard cap and apron calculations',
                'Better data reliability and consistency'
            ],
            risks: [
                'New data source dependency',
                'Potential rate limiting or blocking',
                'Data format changes over time'
            ],
            mitigation: [
                'Implement robust error handling',
                'Add request throttling and retries',
                'Monitor for structural changes',
                'Maintain fallback to alternative sources'
            ]
        };

        // Save migration plan
        const fs = require('fs');
        const planPath = path.join(this.workingDir, '../SALARYSWISH_MIGRATION_PLAN.json');
        fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
        console.log(`📄 Migration plan saved: ${planPath}`);
        
        return plan;
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🏀 SALARYSWISH MIGRATION WORKFLOW COMPLETE');
        console.log('='.repeat(60));
        
        console.log(`\n✅ COMPLETED STEPS: ${this.results.completed.length}`);
        this.results.completed.forEach(step => {
            console.log(`   • ${step.step}`);
        });
        
        if (this.results.failed.length > 0) {
            console.log(`\n❌ FAILED STEPS: ${this.results.failed.length}`);
            this.results.failed.forEach(step => {
                console.log(`   • ${step.step}: ${step.error}`);
            });
        }
        
        if (this.results.testResults) {
            console.log('\n📊 TEST VALIDATION:');
            console.log(`   Players extracted: ${this.results.testResults.players?.length || 0}`);
            console.log(`   Trade exceptions: ${this.results.testResults.tradeExceptions?.length || 0}`);
            console.log(`   Cap data available: ${this.results.testResults.capSpace ? 'Yes' : 'No'}`);
        }
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Review generated migration plan');
        console.log('2. Test scraper with additional teams');
        console.log('3. Integrate with existing pipeline');
        console.log('4. Schedule production deployment');
        
        console.log('\n📁 Generated Files:');
        console.log('   • hawks_data_analysis.json - Data structure analysis');
        console.log('   • targeted_salaryswish_scraper.js - Production scraper');
        console.log('   • test_hawks_result.json - Single team test results');
        console.log('   • SALARYSWISH_MIGRATION_PLAN.json - Complete migration roadmap');
    }

    async run() {
        console.log('🌟 SALARYSWISH COMPLETE MIGRATION WORKFLOW');
        console.log('='.repeat(60));
        console.log('Transitioning from Spotrac to SalarySwish for comprehensive NBA salary data');
        console.log('');
        
        const startTime = Date.now();
        
        try {
            for (const step of this.steps) {
                await this.executeStep(step);
            }
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`\n⏱️  Total execution time: ${duration.toFixed(1)} seconds`);
            
            this.displayResults();
            
            return {
                success: true,
                results: this.results,
                duration: duration
            };
            
        } catch (error) {
            console.error(`\n💥 Workflow failed: ${error.message}`);
            this.displayResults();
            
            return {
                success: false,
                error: error.message,
                results: this.results
            };
        }
    }
}

// Run workflow if called directly
if (require.main === module) {
    const workflow = new SalarySwishMigrationWorkflow();
    
    workflow.run().then(result => {
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('Workflow execution failed:', error);
        process.exit(1);
    });
}

module.exports = SalarySwishMigrationWorkflow;