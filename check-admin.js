const admin = require('firebase-admin');

// Initialize with your service account or use emulator
async function checkSuperAdmin() {
    const db = admin.firestore();
    const doc = await db.collection('meta').doc('superadmin').get();
    if (doc.exists) {
        console.log('SuperAdmin exists:', doc.data());
    } else {
        console.log('No SuperAdmin. Creating with password "admin123"...');
        await db.collection('meta').doc('superadmin').set({
            password: 'admin123',
            createdAt: new Date().toISOString()
        });
        console.log('Created SuperAdmin with password: admin123');
    }
}

checkSuperAdmin().catch(console.error);
