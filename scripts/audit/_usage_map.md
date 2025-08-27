# Usage Map

## Firestore

- [READ] ./scripts/audit/firestore_schema_audit.mjs:38:  const snap = await db.collection(id).limit(sampleSize).get();
- [READ] ./scripts/audit/firestore_schema_audit.mjs:54:  const snap = await db.collectionGroup(id).limit(sampleSize).get();
- [READ] ./scripts/bootstrap-atlas-any.cjs:561:function limit(set, max=12){
- [READ] ./scripts/bootstrap-atlas-any.cjs:580:  const {kept, more} = limit(nodesByBucket[bucket]);
- [WRITE] ./scripts/capsheets/generateCapSheets.js:103:    await setDoc(doc(db, 'teams', teamId), { capSheet }, { merge: true });
- [READ] ./scripts/capsheets/generateCapSheets.js:7:  const playerSnap = await getDocs(collection(db, 'players'));
- [READ] ./scripts/generate-mermaid.cjs:59:function limit(set, max=12){
- [READ] ./scripts/generate-mermaid.cjs:78:  const {kept, more} = limit(nodesByBucket[bucket]);
- [READ] ./scripts/migrateFreeAgents.mjs:26:    const metaRef = doc(db, 'meta', 'freeAgents');
- [READ] ./scripts/migrateFreeAgents.mjs:39:      const newDocRef = doc(db, 'freeAgents', id);
- [READ] ./scripts/upload/firebaseHelpers.node.js:17:    const docRef = doc(db, 'players', playerId);
- [READ] ./scripts/upload/firebaseHelpers.node.js:36:    const snapshot = await getDocs(collection(db, 'players'));
- [WRITE] ./scripts/upload/firebaseHelpers.node.js:7:    await setDoc(doc(db, 'players', playerId), playerData, { merge: true });
- [WRITE] ./scripts/upload/generateFreeAgents.js:40:  await setDoc(doc(db, 'meta', 'freeAgents'), {
- [READ] ./scripts/upload/generateFreeAgents.js:9:  const teamsSnap = await getDocs(collection(db, 'teams'));
- [WRITE] ./scripts/upload/push_bio_and_contract.py:25:        db.collection("players").document(player_id).set(update_data, merge=True)
- [READ] ./scripts/upload/push_stat_data.py:22:        doc_ref = db.collection("players").document(player_id)
- [READ] ./scripts/utils/dumpFieldStructure.js:20:  const playersCol = collection(db, 'players');
- [READ] ./scripts/utils/dumpTeamFieldStructure.js:20:  const teamsCol = collection(db, 'teams'); // ✅ CHANGED from 'players' to 'teams'
- [READ] ./scripts/utils/scan_malformed_players.js:15:  const snapshot = await db.collection("players").get();
- [READ] ./src/features/lists/AddToListButton/AddToListModal.jsx:22:      const snapshot = await getDocs(collection(db, 'lists'));
- [WRITE] ./src/features/lists/AddToListButton/AddToListModal.jsx:39:        await setDoc(doc(db, 'lists', listId), {
- [READ] ./src/features/lists/AddToListButton/AddToListModal.jsx:53:        const listRef = doc(db, 'lists', selectedList);
- [READ] ./src/firebase/listHelpers.js:16:const listsRef = collection(db, 'lists');
- [READ] ./src/firebase/listHelpers.js:17:const tierListsRef = collection(db, 'tierLists');
- [READ] ./src/firebase/listHelpers.js:27:  const q = query(listsRef, where('name', '==', name));
- [READ] ./src/firebase/listHelpers.js:41:  const docRef = doc(db, 'lists', id);
- [READ] ./src/firebase/listHelpers.js:47:  const docRef = doc(db, 'lists', id);
- [READ] ./src/firebase/listHelpers.js:58:  const q = query(tierListsRef, where('name', '==', name));
- [READ] ./src/firebase/listHelpers.js:74:  const docRef = doc(db, 'tierLists', id);
- [READ] ./src/firebase/listHelpers.js:79:  const docRef = doc(db, 'tierLists', id);
- [READ] ./src/firebase/listHelpers.js:83:  const docRef = doc(db, 'tierLists', id);
- [READ] ./src/firebase/listHelpers.js:89:  const docRef = doc(db, 'tierLists', id);
- [READ] ./src/firebase/rosterHelpers.js:14:const rosterProjectsRef = collection(db, 'rosterProjects');
- [READ] ./src/firebase/rosterHelpers.js:46:  const docRef = doc(db, 'rosterProjects', id);
- [READ] ./src/firebase/rosterHelpers.js:59:  const docRef = doc(db, 'rosterProjects', id);
- [READ] ./src/firebase/rosterHelpers.js:70:  const docRef = doc(db, 'rosterProjects', id);
- [READ] ./src/firebase/rosterHelpers.js:76:  const docRef = doc(db, 'rosterProjects', id);
- [READ] ./src/firebaseHelpers.js:17:    const docRef = doc(db, 'players', playerId);
- [READ] ./src/firebaseHelpers.js:36:    const snapshot = await getDocs(collection(db, 'players'));
- [WRITE] ./src/firebaseHelpers.js:7:    await setDoc(doc(db, 'players', playerId), playerData, { merge: true });
- [READ] ./src/firebase_helpers.py:18:    doc_ref = db.collection("players").document(player_id)
- [READ] ./src/hooks/useFirebaseQuery.js:14:        const snap = await getDocs(collection(db, collectionName));
- [WRITE] ./src/pages/ListManager.jsx:133:      await updateDoc(doc(db, 'lists', listId), {
- [READ] ./src/pages/ListManager.jsx:61:        const listRef = doc(db, 'lists', listId);
- [READ] ./src/pages/ListsHome.jsx:44:    const snapshot = await getDocs(collection(db, 'lists'));
- [WRITE] ./src/pages/ListsHome.jsx:59:    await updateDoc(doc(db, 'lists', renamingListId), {
- [WRITE] ./src/pages/ListsHome.jsx:68:    await deleteDoc(doc(db, 'lists', deletingListId));
- [READ] ./src/pages/RostersHome.jsx:50:    const snapshot = await getDocs(collection(db, 'rosterProjects'));
- [WRITE] ./src/pages/RostersHome.jsx:62:    await updateDoc(doc(db, 'rosterProjects', renamingId), {
- [WRITE] ./src/pages/RostersHome.jsx:71:    await deleteDoc(doc(db, 'rosterProjects', deletingId));
- [READ] ./src/pages/TierListsHome.jsx:47:    const snapshot = await getDocs(collection(db, 'tierLists'));
- [WRITE] ./src/pages/TierListsHome.jsx:59:    await updateDoc(doc(db, 'tierLists', renamingId), {
- [WRITE] ./src/pages/TierListsHome.jsx:68:    await deleteDoc(doc(db, 'tierLists', deletingId));
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:107:    const plansRef = collection(db, 'teamPlans', planId, 'namedPlans');
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:128:    const ref = doc(db, 'teamPlans', planId, 'namedPlans', name);
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:145:    const ref = doc(db, 'teamPlans', planId, 'namedPlans', name);
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:162:      const agentRef = doc(db, 'freeAgents', agent.id || agent.name);
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:176:    const snap = await getDocs(collection(db, 'freeAgents'));
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:34:    const docSnap = await getDoc(doc(db, 'teams', teamId));
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:51:    const snapshot = await getDocs(collection(db, 'teams'));
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:75:    const planRef = doc(db, 'teamPlans', planId);
- [READ] ./src/utils/architect/firebaseTeamPlanHelpers.js:91:    const planRef = doc(db, 'teamPlans', planId);
- [READ] ./tools/checkBrokenPlayers.js:14:  const snapshot = await getDocs(collection(db, "players"));
- [READ] ./tools/migratePlayerMatchingValue.js:45:  const snap = await db.collection(target).get();
- [WRITE] ./uploadPlayersToFirebase.js:37:        await db.collection('players').doc(playerId).set(player, { merge: true });

## Storage

_No storage refs found (or scan not run)._
