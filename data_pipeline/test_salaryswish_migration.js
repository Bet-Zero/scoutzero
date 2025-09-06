#!/usr/bin/env node

/**
 * SalarySwish Migration Test Suite
 * 
 * Simple script to test the complete SalarySwish migration system step by step.
 * This helps validate that all components are working correctly.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class MigrationTester {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toLocaleTimeString();
        const icon = type === 'SUCCESS' ? '✅' : type === 'ERROR' ? '❌' : type === 'WARNING' ? '⚠️' : 'ℹ️';
        console.log(`[${timestamp}] ${icon} ${message}`);
    }

    async runCommand(command, description) {
        this.log(`Testing: ${description}`, 'INFO');
        this.log(`Command: ${command}`, 'INFO');
        
        return new Promise((resolve) => {
            const [cmd, ...args] = command.split(' ');
            const process = spawn(cmd, args, { 
                stdio: 'pipe',
                cwd: path.join(__dirname)
            });

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                const result = {
                    description,
                    command,
                    exitCode: code,
                    success: code === 0,
                    output: output.substring(0, 500), // Truncate for readability
                    error: errorOutput.substring(0, 500)
                };

                this.testResults.push(result);
                
                if (code === 0) {
                    this.log(`✅ PASSED: ${description}`, 'SUCCESS');
                } else {
                    this.log(`❌ FAILED: ${description} (Exit code: ${code})`, 'ERROR');
                    if (errorOutput) {
                        this.log(`Error: ${errorOutput.substring(0, 200)}...`, 'ERROR');
                    }
                }

                resolve(result);
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                process.kill('SIGTERM');
                this.log(`⚠️ TIMEOUT: ${description} (30s limit)`, 'WARNING');
                resolve({
                    description,
                    command,
                    success: false,
                    error: 'Timeout after 30 seconds'
                });
            }, 30000);
        });
    }

    async checkFile(filePath, description) {
        this.log(`Checking: ${description}`, 'INFO');
        
        try {
            const stats = fs.statSync(filePath);
            this.log(`✅ FOUND: ${description} (${(stats.size / 1024).toFixed(1)}KB)`, 'SUCCESS');
            return true;
        } catch (error) {
            this.log(`❌ MISSING: ${description}`, 'ERROR');
            return false;
        }
    }

    async runTests() {
        this.log('🧪 STARTING SALARYSWISH MIGRATION TESTS', 'INFO');
        this.log('=' .repeat(60), 'INFO');

        // Test 1: Check if comprehensive Hawks data exists
        this.log('\n📋 STEP 1: CHECKING DATA FILES', 'INFO');
        this.log('-' .repeat(40), 'INFO');
        
        await this.checkFile(
            path.join(__dirname, 'salaryswish_analysis/hawks_comprehensive_data.json'),
            'Hawks comprehensive data file'
        );
        
        await this.checkFile(
            path.join(__dirname, 'salaryswish_analysis/hawks_data_analysis.json'),
            'Hawks analysis results file'
        );

        // Test 2: Run data analysis
        this.log('\n🔍 STEP 2: TESTING DATA ANALYSIS', 'INFO');
        this.log('-' .repeat(40), 'INFO');
        
        await this.runCommand(
            'node salaryswish_analysis/analyze_salaryswish_data.cjs',
            'Data analysis script'
        );

        // Test 3: Run scraper generation
        this.log('\n⚙️ STEP 3: TESTING SCRAPER GENERATION', 'INFO');
        this.log('-' .repeat(40), 'INFO');
        
        await this.runCommand(
            'node salaryswish_analysis/generate_targeted_salaryswish_scraper.cjs',
            'Scraper generation script'
        );

        // Test 4: Check if targeted scraper was created
        this.log('\n📄 STEP 4: CHECKING GENERATED FILES', 'INFO');
        this.log('-' .repeat(40), 'INFO');
        
        await this.checkFile(
            path.join(__dirname, 'targeted_salaryswish_scraper.js'),
            'Generated targeted scraper'
        );

        // Test 5: Test scraper with Hawks (if network access works)
        this.log('\n🎯 STEP 5: TESTING TARGETED SCRAPER', 'INFO');
        this.log('-' .repeat(40), 'INFO');
        this.log('⚠️ This test may fail due to network restrictions', 'WARNING');
        
        await this.runCommand(
            'node targeted_salaryswish_scraper.js --team hawks --test',
            'Hawks targeted scraper test'
        );

        // Generate summary
        this.generateSummary();
    }

    generateSummary() {
        this.log('\n📊 TEST SUMMARY', 'INFO');
        this.log('=' .repeat(60), 'INFO');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.success).length;
        const failedTests = totalTests - passedTests;
        
        this.log(`Total Tests: ${totalTests}`, 'INFO');
        this.log(`Passed: ${passedTests}`, passedTests === totalTests ? 'SUCCESS' : 'INFO');
        this.log(`Failed: ${failedTests}`, failedTests === 0 ? 'SUCCESS' : 'ERROR');
        
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
        this.log(`Duration: ${duration}s`, 'INFO');

        if (failedTests > 0) {
            this.log('\n❌ FAILED TESTS:', 'ERROR');
            this.testResults
                .filter(t => !t.success)
                .forEach(test => {
                    this.log(`   • ${test.description}: ${test.error || 'Unknown error'}`, 'ERROR');
                });
        }

        if (passedTests === totalTests) {
            this.log('\n🎉 ALL TESTS PASSED! SalarySwish migration system is working correctly.', 'SUCCESS');
            this.log('Next steps:', 'INFO');
            this.log('   1. Run: node targeted_salaryswish_scraper.js --team hawks', 'INFO');
            this.log('   2. Test with more teams: --teams hawks,celtics,warriors', 'INFO');
            this.log('   3. Full deployment: --all', 'INFO');
        } else {
            this.log('\n⚠️ SOME TESTS FAILED. Check the errors above and fix issues before proceeding.', 'WARNING');
        }
    }
}

// Run tests
const tester = new MigrationTester();
tester.runTests().catch(console.error);