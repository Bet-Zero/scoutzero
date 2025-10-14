import admin from 'firebase-admin';
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// TEST MODE - set to false to update real data
const TEST_MODE = true;
const TEST_PLAYERS = ['lebron_james']; // Start with just LeBron since he worked
const USE_SHADOW_COLLECTION = true; // Save to contracts_test instead of real contracts

function parseMoneyString(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[$,]/g, '').split('(')[0].trim()) || 0;
}

function cleanText(str) {
  return str ? str.trim().replace(/\s+/g, ' ') : '';
}

async function scrapePlayerContract(playerSlug, playerName, playerId) {
  const url = `https://www.salaryswish.com/players/${playerSlug}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping: ${playerName}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await page.waitForSelector('body', { timeout: 10000 });

    // Extract all contract data
    const contractsData = await page.evaluate(() => {
      const contracts = [];

      // Find the "CURRENT CONTRACT" section
      const headings = Array.from(document.querySelectorAll('h4, h6'));
      const currentContractIndex = headings.findIndex(
        (h) => h.textContent.trim() === 'CURRENT CONTRACT'
      );

      if (currentContractIndex === -1) {
        return { error: 'Could not find CURRENT CONTRACT section' };
      }

      // Get the contract type (next H6 after CURRENT CONTRACT)
      let contractType = 'Unknown';
      for (let i = currentContractIndex + 1; i < headings.length; i++) {
        if (
          headings[i].tagName === 'H6' &&
          !headings[i].textContent.includes('▴') &&
          !headings[i].textContent.includes('▾')
        ) {
          contractType = headings[i].textContent.trim();
          break;
        }
      }

      // Find the contract details section (the text block before the table)
      const currentContractH4 = headings[currentContractIndex];
      let detailsElement = currentContractH4.nextElementSibling;

      // Skip the H6 contract type heading
      while (detailsElement && detailsElement.tagName === 'H6') {
        detailsElement = detailsElement.nextElementSibling;
      }

      // Extract contract metadata from the details section
      let contractDetails = {};
      if (
        detailsElement &&
        detailsElement.classList.contains('playerContract_details')
      ) {
        const detailsText = detailsElement.textContent;
        contractDetails = {
          rawText: detailsText,
          contractType: contractType,
        };

        // Parse specific fields
        const signedMatch = detailsText.match(/Signed\s+(\w+\s+\d+,\s+\d+)/);
        const teamMatch = detailsText.match(/Team:\s*([^•]+)/);
        const exceptionMatch = detailsText.match(/Method:\s*([^•]+)/);
        const yearsMatch = detailsText.match(/Years:\s*(\d+)/);
        const valueMatch = detailsText.match(/Value:\s*\$?([\d,]+)/);

        if (signedMatch) contractDetails.signedDate = signedMatch[1].trim();
        if (teamMatch) contractDetails.team = teamMatch[1].trim();
        if (exceptionMatch)
          contractDetails.exception = exceptionMatch[1].trim();
        if (yearsMatch) contractDetails.years = parseInt(yearsMatch[1]);
        if (valueMatch)
          contractDetails.totalValue = parseFloat(
            valueMatch[1].replace(/,/g, '')
          );
      }

      // Find the first table (current contract table)
      const tables = document.querySelectorAll('table.sw_table__default');
      if (tables.length === 0) {
        return { error: 'No tables found' };
      }

      const firstTable = tables[0];
      const rows = firstTable.querySelectorAll('tbody tr');

      const yearlyData = [];
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
          const season = cells[0].textContent.trim();
          const optionCell = cells[1].textContent.trim();
          const capHit = cells[3].textContent.trim();
          const baseSalary = cells[4].textContent.trim();
          const guaranteed = cells[5].textContent.trim();
          const likelyIncentives = cells[6]
            ? cells[6].textContent.trim()
            : '$0';
          const unlikelyIncentives = cells[7]
            ? cells[7].textContent.trim()
            : '$0';

          yearlyData.push({
            season,
            option: optionCell,
            capHit,
            baseSalary,
            guaranteed,
            likelyIncentives,
            unlikelyIncentives,
          });
        }
      });

      return {
        contractDetails,
        yearlyData,
        success: true,
      };
    });

    if (contractsData.error) {
      console.log('❌ Error:', contractsData.error);
      return { success: false, error: contractsData.error };
    }

    console.log('\n--- CONTRACT DETAILS ---');
    console.log(JSON.stringify(contractsData.contractDetails, null, 2));

    console.log('\n--- YEARLY BREAKDOWN ---');
    contractsData.yearlyData.forEach((year) => {
      console.log(
        `${year.season}: ${year.baseSalary} base, ${year.capHit} cap hit`
      );
    });

    // Format data for Firestore
    const formattedContracts = contractsData.yearlyData.map((year) => {
      const yearNum = parseInt(year.season.split('-')[0]);

      return {
        year: yearNum,
        season: year.season,
        salary: parseMoneyString(year.capHit),
        baseSalary: parseMoneyString(year.baseSalary),
        incentives: {
          likely: parseMoneyString(year.likelyIncentives),
          unlikely: parseMoneyString(year.unlikelyIncentives),
          total:
            parseMoneyString(year.likelyIncentives) +
            parseMoneyString(year.unlikelyIncentives),
        },
        guaranteed: parseMoneyString(year.guaranteed),
        capHit: parseMoneyString(year.capHit),

        // Contract metadata (same for all years in this contract)
        contractType: contractsData.contractDetails.contractType || null,
        signingDate: contractsData.contractDetails.signedDate || null,
        signingTeam: contractsData.contractDetails.team || null,
        signedUsing: contractsData.contractDetails.exception || null,

        // Fields we'll fill in later or leave null
        option: year.option || null,
        yearsOfService: null,
        capPercentage: null,
        noTradeClause: null,
        tradeKicker: null,
        birdRights: null,
        capHold: null,
      };
    });

    console.log('\n--- FORMATTED FOR FIRESTORE ---');
    console.log(JSON.stringify(formattedContracts[0], null, 2));
    console.log(`... (${formattedContracts.length} total years)`);

    // Save to Firestore
    if (TEST_MODE && USE_SHADOW_COLLECTION) {
      console.log('\n💾 Saving to test collection...');
      const testCollection = db.collection('contracts_test');

      for (const contract of formattedContracts) {
        const docId = `${playerId}_${contract.year}`;
        await testCollection.doc(docId).set(contract);
      }

      console.log(
        `✅ Saved ${formattedContracts.length} contract years to contracts_test`
      );
    } else if (!TEST_MODE) {
      console.log('\n💾 Saving to player contracts subcollection...');
      const contractsRef = db
        .collection('players_v2')
        .doc(playerId)
        .collection('contracts');

      for (const contract of formattedContracts) {
        const docId = contract.year.toString();
        await contractsRef.doc(docId).set(contract);
      }

      console.log(`✅ Saved ${formattedContracts.length} contract years`);
    } else {
      console.log('\n⚠️  Test mode - no data saved');
    }

    return {
      success: true,
      contractCount: formattedContracts.length,
    };
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n🏀 SalarySwish Contract Scraper\n');
  console.log(`Mode: ${TEST_MODE ? 'TEST' : 'PRODUCTION'}`);
  console.log(
    `Destination: ${USE_SHADOW_COLLECTION ? 'contracts_test collection' : 'player subcollections'}\n`
  );

  try {
    const playersSnapshot = await db.collection('players_v2').get();
    const testPlayers = [];

    playersSnapshot.forEach((doc) => {
      const data = doc.data();

      if (TEST_PLAYERS.includes(doc.id)) {
        testPlayers.push({
          id: doc.id,
          name: data.bio?.name || doc.id,
          slug: data.bio?.slug || doc.id,
        });
      }
    });

    if (testPlayers.length === 0) {
      console.log('❌ No test players found!');
      process.exit(0);
    }

    console.log(`Found ${testPlayers.length} players to scrape\n`);

    let successCount = 0;
    let failCount = 0;

    for (const player of testPlayers) {
      const result = await scrapePlayerContract(
        player.slug,
        player.name,
        player.id
      );

      if (result.success) {
        successCount++;
        console.log(
          `\n✅ Success: ${player.name} (${result.contractCount} years)`
        );
      } else {
        failCount++;
        console.log(`\n❌ Failed: ${player.name}`);
      }

      // Wait between requests
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Total: ${testPlayers.length}`);

    if (USE_SHADOW_COLLECTION) {
      console.log('\n💡 Check Firebase Console -> contracts_test collection');
    }
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    process.exit(0);
  }
}

main();
