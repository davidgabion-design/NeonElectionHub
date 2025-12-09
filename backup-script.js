// backup-data.js - Run in browser console
async function backupFirestoreData() {
    const orgs = await getAllOrganizations();
    const backup = {
        timestamp: new Date().toISOString(),
        organizations: orgs
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firestore-backup-${Date.now()}.json`;
    a.click();
    
    console.log("✅ Backup completed:", backup.organizations.length, "organizations");
}
