/**
 * TEST SCRIPT for HAWKS Targeted Extractor
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
        const { AtlantaHawksTargetedExtractor } = await import(`./targeted_hawks_extractor.js`);
        
        const extractor = new AtlantaHawksTargetedExtractor();
        
        console.log('📋 Target tables: [2, 9, 10, 4, 8, 11, 3, 7, 0, 6]');
        console.log('🚀 Starting extraction test...');
        console.log('');
        
        const results = await extractor.extract();
        
        console.log('');
        console.log('✅ TEST RESULTS');
        console.log('===============');
        console.log(`📊 Tables processed: ${results.metadata.tablesExtracted}`);
        console.log(`⏰ Extracted at: ${results.metadata.extractedAt}`);
        console.log('');
        
        // Show sample data from each table
        Object.entries(results.extractedData).forEach(([tableKey, tableData]) => {
            console.log(`📋 ${tableKey.toUpperCase()}:`);
            console.log(`   📏 Rows: ${tableData.data.length}`);
            console.log(`   🏗️  Structure: ${Object.keys(tableData.data[0] || {}).join(', ')}`);
            
            // Show first row as sample
            if (tableData.data.length > 0) {
                console.log(`   📝 Sample: ${JSON.stringify(tableData.data[0], null, 6).substring(0, 200)}...`);
            }
            console.log('');
        });
        
        // Save test results
        const testResultsPath = path.join(__dirname, `test_results_hawks_${Date.now()}.json`);
        fs.writeFileSync(testResultsPath, JSON.stringify(results, null, 2));
        
        console.log(`💾 Test results saved: ${testResultsPath}`);
        console.log('🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    testExtractor();
}

export { testExtractor };