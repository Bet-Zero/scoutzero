#!/usr/bin/env node
/**
 * MASTER SETUP SCRIPT
 * Single command to implement new data architecture with fresh scraping
 */

import CompleteDataMigration from './complete_data_migration.js';

async function masterSetup() {
  console.log('🚀 SCOUTZERO NEW DATA ARCHITECTURE SETUP');
  console.log('========================================');
  console.log('✅ Fresh NBA data scraping from live sources');
  console.log('✅ User evaluation migration from Firebase');
  console.log('✅ New separated schema implementation');
  console.log('✅ Frontend integration with new structure');
  console.log();

  try {
    const migration = new CompleteDataMigration();
    const results = await migration.runCompleteMigration();
    
    console.log('\n🎉 SETUP COMPLETE!');
    console.log('==================');
    console.log();
    console.log('🧪 TEST YOUR NEW SYSTEM:');
    console.log('   cd ..');
    console.log('   npm run dev');
    console.log('   # Open http://localhost:5173/');
    console.log();
    console.log('✅ What to verify:');
    console.log('   • ALL players show up (not just 15)');
    console.log('   • Your personal grades/roles are preserved');
    console.log('   • Trade Machine works with individual contracts');
    console.log('   • Data is fresh (recent last_updated timestamps)');
    console.log();
    console.log('📊 Results Summary:');
    console.log(`   • Fresh data scraped: ${results.freshDataScraped} players`);
    console.log(`   • User evaluations migrated: ${results.evaluationsMigrated}`);
    console.log(`   • Collections created: ${results.collectionsCreated.join(', ')}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Warnings:');
      results.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    console.log('\n🎯 You now have:');
    console.log('   • Fresh NBA data from live scraping');
    console.log('   • Separated schema (nba_players, player_contracts, player_evaluations)');
    console.log('   • Your evaluations preserved and migrated');
    console.log('   • Frontend using new architecture exclusively');
    
  } catch (error) {
    console.error('\n❌ SETUP FAILED:');
    console.error(error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   • Check Firebase credentials (serviceAccountKey.json)');
    console.log('   • Verify internet connection for data scraping');
    console.log('   • Check that existing player data exists');
    process.exit(1);
  }
}

masterSetup();