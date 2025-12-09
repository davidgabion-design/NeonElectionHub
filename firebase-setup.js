// Run this once in browser console to set up Firebase collections

const firebaseConfig = {
    apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
    authDomain: "neon-voting-app.firebaseapp.com",
    projectId: "neon-voting-app",
    storageBucket: "neon-voting-app.firebasestorage.app",
    messagingSenderId: "406871836482",
    appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
    measurementId: "G-VGW2Z3FR8M"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Create super admin
async function setupSuperAdmin() {
    try {
        await db.collection("meta").doc("superAdmin").set({
            password: "admin123",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            email: "superadmin@system.local"
        });
        console.log("✅ Super Admin created with password: admin123");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

// Create test organization
async function createTestOrg() {
    try {
        const orgId = "test-election-" + Date.now().toString(36).substr(2, 8);
        
        await db.collection("organizations").doc(orgId).set({
            id: orgId,
            name: "Test University Elections 2024",
            description: "Annual student council elections",
            ecPassword: "test123",
            voterCount: 0,
            voteCount: 0,
            electionStatus: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: 'superadmin'
        });
        
        console.log(`✅ Test organization created: ${orgId}`);
        console.log(`🔑 EC Password: test123`);
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

// Run setup
setupSuperAdmin();
createTestOrg();