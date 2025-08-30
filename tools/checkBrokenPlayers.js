
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import firebaseConfig from "../src/firebaseConfig.js";
import { getApps } from "firebase/app";

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

const db = getFirestore(app);

const checkPlayersForMissingFields = async () => {
  const snapshot = await getDocs(collection(db, "players"));
  const brokenPlayers = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const id = doc.id;

    const hasBio = !!data.bio;
    const hasStats = !!data.stats;
    const hasContract = !!data.contract;

    if (!hasBio || !hasStats || !hasContract) {
      brokenPlayers.push({
        id,
        hasBio,
        hasStats,
        hasContract
      });
    }
  });

  console.log("🔍 Players with missing data:");
  brokenPlayers.forEach(player => {
    console.log(`- ${player.id}: bio=${player.hasBio}, stats=${player.hasStats}, contract=${player.hasContract}`);
  });

  console.log(`\nTotal broken: ${brokenPlayers.length}`);
};

checkPlayersForMissingFields();