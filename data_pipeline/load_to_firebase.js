/**
 * LOAD TO FIREBASE - SEPARATED SCHEMA UPLOADER
 * ============================================
 * 
 * This script loads the processed separated schema data to Firebase.
 * Run after migrate_and_structure.js has created the JSON files.
 */

const fs = require('fs');
const path = require('path');

// Firebase setup
let admin;
try {
    admin = require('firebase-admin');
    const serviceAccount = require('../serviceAccountKey.json');
    
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (error) {
    console.error('❌ Firebase setup failed. Ensure serviceAccountKey.json exists.');
    console.error('   Run this script from your local environment with Firebase access.');
    process.exit(1);
}

const INPUT_DIR = path.join(__dirname, 'output', 'separated_schema');

// Progress logging
function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Upload collection data to Firebase in batches
 */
async function uploadCollection(collectionName, data, db) {
    const dataArray = Object.entries(data);
    const batchSize = 500; // Firestore batch limit
    
    logProgress(`📤 Uploading ${dataArray.length} records to ${collectionName}...`);
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
        const batch = db.batch();
        const currentBatch = dataArray.slice(i, i + batchSize);
        
        currentBatch.forEach(([docId, docData]) => {
            const docRef = db.collection(collectionName).doc(docId);
            batch.set(docRef, docData);
        });
        
        await batch.commit();
        
        const processed = Math.min(i + batchSize, dataArray.length);
        logProgress(`  ✅ Uploaded ${processed}/${dataArray.length} records`);
    }
    
    return dataArray.length;
}

/**
 * Load and validate input files
 */
function loadInputFiles() {
    const requiredFiles = [
        'nba_players.json',
        'player_contracts.json', 
        'player_evaluations.json',
        'team_caps.json'
    ];
    
    const data = {};
    
    requiredFiles.forEach(filename => {
        const filepath = path.join(INPUT_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
            throw new Error(`Required file not found: ${filename}. Run migrate_and_structure.js first.`);
        }
        
        try {
            data[filename.replace('.json', '')] = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            logProgress(`✅ Loaded ${filename}`);
        } catch (error) {
            throw new Error(`Failed to parse ${filename}: ${error.message}`);
        }
    });
    
    return data;
}

/**
 * Create backup of existing data (optional safety measure)
 */
async function createBackup(db, collectionNames) {
    logProgress('🛡️  Creating backup of existing collections...');
    
    const backupDir = path.join(__dirname, 'output', 'backups', Date.now().toString());
    fs.mkdirSync(backupDir, { recursive: true });
    
    for (const collectionName of collectionNames) {
        try {
            const snapshot = await db.collection(collectionName).get();
            const backup = {};
            
            snapshot.forEach(doc => {
                backup[doc.id] = doc.data();
            });
            
            const backupFile = path.join(backupDir, `${collectionName}_backup.json`);
            fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
            
            logProgress(`  ✅ Backed up ${collectionName} (${snapshot.size} docs)`);
        } catch (error) {
            logProgress(`  ⚠️  Could not backup ${collectionName}: ${error.message}`);
        }
    }
    
    logProgress(`🛡️  Backups saved to: ${backupDir}`);
}

/**
 * Main upload function
 */
async function loadToFirebase() {
    logProgress('🚀 LOAD TO FIREBASE - SEPARATED SCHEMA');
    logProgress('=====================================');
    logProgress('📤 Uploading processed data to Firebase collections');
    logProgress('');
    
    try {
        const db = admin.firestore();
        
        // Step 1: Load processed data files
        logProgress('📂 Step 1: Loading Processed Data Files...');
        const data = loadInputFiles();
        
        // Step 2: Create backup (optional but recommended)
        logProgress('');
        logProgress('🛡️  Step 2: Creating Backup...');
        const collectionNames = ['nba_players', 'player_contracts', 'player_evaluations', 'team_caps'];
        await createBackup(db, collectionNames);
        
        // Step 3: Upload to Firebase collections
        logProgress('');
        logProgress('📤 Step 3: Uploading to Firebase...');
        
        const results = {};
        
        // Upload each collection
        results.nba_players = await uploadCollection('nba_players', data.nba_players, db);
        results.player_contracts = await uploadCollection('player_contracts', data.player_contracts, db);
        results.player_evaluations = await uploadCollection('player_evaluations', data.player_evaluations, db);
        results.team_caps = await uploadCollection('team_caps', data.team_caps, db);
        
        // Step 4: Verify uploads
        logProgress('');
        logProgress('✅ Step 4: Verifying Uploads...');
        
        for (const collectionName of collectionNames) {
            const snapshot = await db.collection(collectionName).limit(1).get();
            if (snapshot.empty) {
                throw new Error(`Collection ${collectionName} appears to be empty after upload`);
            }
            logProgress(`  ✅ Verified ${collectionName} collection`);
        }
        
        // Final results
        logProgress('');
        logProgress('🎉 FIREBASE UPLOAD COMPLETE!');
        logProgress('============================');
        logProgress(`🏀 NBA Players: ${results.nba_players} uploaded`);
        logProgress(`💰 Player Contracts: ${results.player_contracts} uploaded`);
        logProgress(`👤 Player Evaluations: ${results.player_evaluations} uploaded`);
        logProgress(`📊 Team Caps: ${results.team_caps} uploaded`);
        logProgress('');
        logProgress('✅ Your new separated schema is now live in Firebase!');
        logProgress('✅ Update your frontend to use the new collections');
        
        return results;
        
    } catch (error) {
        logProgress(`❌ Error: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    loadToFirebase().catch(error => {
        logProgress(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { loadToFirebase };