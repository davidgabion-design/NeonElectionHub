const admin = require("firebase-admin");
const path = require("path");

// ------------- CONFIG: EDIT THIS -------------
// Put the EXACT orgId you use to log in as EC (the one in the organizations collection)
const ORG_ID = "YOUR_ORG_ID_HERE";   // <-- CHANGE THIS
// ---------------------------------------------

// Load service account file from same folder
const serviceAccount = require(path.join(__dirname, "service-account.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migratePositionsForOrg(orgId) {
  console.log(`\n=== Migrating org: ${orgId} ===`);

  const orgRef = db.collection("organizations").doc(orgId);

  // --- 1) Load positions and build map by title ---
  const positionsSnap = await orgRef.collection("positions").get();
  if (positionsSnap.empty) {
    console.log("No positions found.");
    return;
  }

  const positionsByTitle = new Map();  // "president" -> "pos-abc123"
  const positionsById = new Map();     // "pos-abc123" -> {id, title}

  positionsSnap.forEach(doc => {
    const data = doc.data();
    const title = (data.title || "").trim();
    const id = doc.id;

    if (title) {
      positionsByTitle.set(title.toLowerCase(), id);
    }
    positionsById.set(id, { id, title, candidatesCount: 0 });
  });

  console.log(`Loaded ${positionsById.size} positions`);

  // --- 2) Load all candidates ---
  const candidatesSnap = await orgRef.collection("candidates").get();
  if (candidatesSnap.empty) {
    console.log("No candidates found.");
    return;
  }

  console.log(`Loaded ${candidatesSnap.size} candidates`);
  const batch = db.batch();
  let updatedCandidates = 0;

  candidatesSnap.forEach(doc => {
    const data = doc.data();

    // Already has positionId? just count it and skip changing
    if (data.positionId) {
      const posInfo = positionsById.get(data.positionId);
      if (posInfo) {
        posInfo.candidatesCount++;
      }
      return;
    }

    // Old fields we can use
    const rawPos =
      (data.positionName ||
       data.positionTitle ||
       data.position ||
       "").trim();

    if (!rawPos) {
      console.log(`- Candidate ${doc.id} has no position text – leaving unassigned`);
      return;
    }

    const key = rawPos.toLowerCase();
    const matchedId = positionsByTitle.get(key);

    if (!matchedId) {
      console.log(`- Candidate ${doc.id}: could NOT match position "${rawPos}" to any title`);
      return;
    }

    // Update candidate with new positionId + keep readable name
    batch.update(doc.ref, {
      positionId: matchedId,
      positionName: rawPos
    });

    const posInfo = positionsById.get(matchedId);
    if (posInfo) {
      posInfo.candidatesCount++;
    }
    updatedCandidates++;
  });

  // --- 3) Write candidatesCount back to positions ---
  positionsById.forEach((pos, id) => {
    const ref = orgRef.collection("positions").doc(id);
    batch.update(ref, { candidatesCount: pos.candidatesCount });
  });

  console.log(`Updating ${updatedCandidates} candidates + all positions with new counts...`);
  await batch.commit();
  console.log("? Migration batch committed!");

  // --- 4) Summary ---
  console.log("\nFinal candidatesCount per position:");
  positionsById.forEach((pos, id) => {
    console.log(`- ${pos.title || id}: ${pos.candidatesCount} candidates`);
  });
}

(async () => {
  try {
    if (!ORG_ID || ORG_ID === "YOUR_ORG_ID_HERE") {
      throw new Error("Please set ORG_ID at top of migrate-positions.js");
    }
    await migratePositionsForOrg(ORG_ID);
    console.log("\n?? Done.");
    process.exit(0);
  } catch (err) {
    console.error("? Migration error:", err);
    process.exit(1);
  }
})();
