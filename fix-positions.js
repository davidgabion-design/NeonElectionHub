import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ✅ REPLACE WITH YOUR REAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ REPLACE WITH YOUR REAL ORG ID (the one in script.js)
const ORG_ID = "REPLACE_WITH_YOUR_ORG_ID";

(async function () {

  console.log("🔄 Loading positions...");
  const posSnap = await getDocs(collection(db, "organizations", ORG_ID, "positions"));
  const positions = {};

  posSnap.forEach(d => {
    const data = d.data();
    if (data.title) positions[data.title.trim()] = d.id;
    if (data.name)  positions[data.name.trim()]  = d.id;
  });

  console.log("✅ Positions map:", positions);

  console.log("🔄 Loading candidates...");
  const candSnap = await getDocs(collection(db, "organizations", ORG_ID, "candidates"));

  for (const c of candSnap.docs) {
    const data = c.data();
    const fixedId = positions[data.position];

    if (fixedId) {
      console.log("✅ Fixing:", data.name, "→", fixedId);

      await updateDoc(
        doc(db, "organizations", ORG_ID, "candidates", c.id),
        {
          positionId: fixedId
        }
      );
    } else {
      console.warn("⚠️ Skipped (no match):", data.name, data.position);
    }
  }

  console.log("✅✅ ALL CANDIDATES FIXED SUCCESSFULLY");
})();
