// script.js — Enhanced Neon Voting System with Material You Style
// Matches the updated index.html with top navigation design

// ---------------- Firebase imports ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// ---------------- Firebase config ----------------
const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch(e){}
const db = getFirestore(app);
const storage = getStorage(app);

// ---------------- Globals & session ----------------
const SESSION_KEY = "neon_voting_session_v5";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
function saveSession(){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

function toast(msg, type="info"){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = msg;
  t.style.background = type === "error" ? "#2b0000" : type === "success" ? "linear-gradient(90deg,#00C851,#007E33)" : "linear-gradient(90deg,#9D00FF,#00C3FF)";
  t.style.border = type === "error" ? "1px solid rgba(255,68,68,0.3)" : "1px solid rgba(0,255,255,0.2)";
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 3000);
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => { s.classList.remove("active"); });
  const el = document.getElementById(id);
  if(el){ 
    el.classList.add("active"); 
    window.scrollTo({top:0,behavior:'smooth'}); 
    
    // Update top navigation title based on screen
    updateTopNavForScreen(id);
  }
}

function updateTopNavForScreen(screenId){
  const titleEl = document.querySelector('.app-title');
  const subtitleEl = document.querySelector('.app-subtext');
  
  if(!titleEl || !subtitleEl) return;
  
  switch(screenId){
    case 'gatewayScreen':
      titleEl.innerHTML = 'Neon Voting System <span class="enhanced-badge">ENHANCED</span>';
      subtitleEl.textContent = 'Secure • Modern • Efficient';
      break;
    case 'superAdminLoginScreen':
      titleEl.textContent = 'Super Admin Login';
      subtitleEl.textContent = 'Full system administrator access';
      break;
    case 'superAdminPanel':
      titleEl.textContent = 'Super Admin Panel';
      subtitleEl.textContent = 'Manage organizations, passwords, and system settings';
      break;
    case 'ecLoginScreen':
      titleEl.textContent = 'EC Login';
      subtitleEl.textContent = 'Election Commissioner access';
      break;
    case 'ecPanel':
      titleEl.textContent = document.getElementById('ecOrgName')?.textContent || 'Organization Name';
      subtitleEl.textContent = 'Election Commissioner Dashboard';
      break;
    case 'voterLoginScreen':
      titleEl.textContent = document.getElementById('voterOrgName')?.textContent || 'Organization Name';
      subtitleEl.textContent = 'Voter Login Portal';
      break;
    case 'votingScreen':
      titleEl.textContent = document.getElementById('votingOrgName')?.textContent || 'Organization Name';
      subtitleEl.textContent = 'Cast Your Vote Securely';
      break;
    case 'publicScreen':
      titleEl.textContent = document.getElementById('publicOrgName')?.textContent || 'Organization Name';
      subtitleEl.textContent = 'Election Results - Public View';
      break;
    case 'guestScreen':
      titleEl.textContent = 'Guest Information';
      subtitleEl.textContent = 'Learn about the Enhanced Neon Voting System';
      break;
  }
}

// ---------------- Default image helpers ----------------
function defaultLogoDataUrl(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#08102a"/><text x="50%" y="55%" font-size="26" text-anchor="middle" fill="#9D00FF" font-family="Inter, Arial">NEON</text></svg>`);
}

function defaultAvatar(name = 'User'){
  const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#07233b"/><text x="50%" y="55%" font-size="60" text-anchor="middle" fill="#9beaff" font-family="Inter, Arial">${initials}</text></svg>`);
}

function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ---------------- Enhanced Email/SMS Service ----------------
class NotificationService {
  static async sendVoterInvite(email, phone, orgName, orgId, voterId, voterName = ""){
    const votingLink = `${window.location.origin}${window.location.pathname}?org=${orgId}&voter=${voterId}`;
    const message = `Hello ${voterName || 'Voter'},\n\nYou have been invited to vote in ${orgName} election.\nVoting Link: ${votingLink}\n\nThank you!`;
    
    console.log("📧 SENDING INVITATION:");
    console.log("To:", email || phone);
    console.log("Org:", orgName);
    console.log("Link:", votingLink);
    
    // Demo alert
    setTimeout(() => {
      alert(`📨 Invitation sent to ${email || phone}:\n\n${message}`);
    }, 500);
    
    return { success: true, link: votingLink };
  }
  
  static async sendECCredentials(email, phone, orgName, orgId, ecPassword){
    const ecLink = `${window.location.origin}${window.location.pathname}?org=${orgId}&role=ec`;
    const message = `Hello EC Admin,\n\nYou are the Election Commissioner for ${orgName}.\nEC Login Link: ${ecLink}\nPassword: ${ecPassword}\n\nKeep this password secure!`;
    
    console.log("🔑 SENDING EC CREDENTIALS:");
    console.log("To:", email || phone);
    console.log("Password:", ecPassword);
    
    setTimeout(() => {
      alert(`🔑 EC Credentials for ${orgName}:\n\n${message}`);
    }, 500);
    
    return { success: true, link: ecLink, password: ecPassword };
  }
  
  static async sendResults(email, data){
    console.log("📊 SENDING RESULTS TO:", email);
    console.log("Results data:", data);
    // Demo alert
    setTimeout(() => {
      alert(`📊 Results sent to ${email}\n\n${data.resultsSummary}`);
    }, 500);
  }
  
  static async sendReceipt(email, data){
    console.log("🎫 SENDING RECEIPT TO:", email);
    console.log("Receipt data:", data);
    // Demo alert
    setTimeout(() => {
      alert(`🎫 Voting receipt sent to ${email}\nReceipt ID: ${data.receiptId}`);
    }, 500);
  }
}

// ---------------- Phone number validation ----------------
function validatePhoneNumber(phone) {
  if (!phone) return false;
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  // Check if it's a Ghanaian number (starts with 0, 233, or +233)
  if (cleanPhone.match(/^(0|233|\+233)\d{9}$/)) {
    // Convert to standard format: 233XXXXXXXXX
    return cleanPhone.replace(/^(0|\+233)/, '233');
  }
  // Check if it's international number (at least 8 digits)
  if (cleanPhone.length >= 8 && cleanPhone.length <= 15) {
    return cleanPhone;
  }
  return false;
}

function formatPhoneForDisplay(phone) {
  if (!phone) return "";
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('233') && clean.length === 12) {
    return `+${clean}`;
  }
  if (clean.length === 10 && clean.startsWith('0')) {
    return `+233${clean.substring(1)}`;
  }
  return `+${clean}`;
}

// ---------------- SuperAdmin - Enhanced with Delete Tab & Password View ----------------
async function loginSuperAdmin(){
  const pass = document.getElementById("super-admin-pass").value.trim();
  if(!pass){ toast("Enter password","error"); return; }
  try{
    const ref = doc(db,"meta","superAdmin");
    const snap = await getDoc(ref);
    if(!snap.exists()){
      const defaultPass = "admin123";
      await setDoc(ref, { password: defaultPass });
      if(pass === defaultPass){
        session.role = 'superadmin'; saveSession();
        await renderSuperOrgs();
        showScreen("superAdminPanel");
        document.getElementById("super-admin-pass").value = "";
        toast("SuperAdmin created & logged in (admin123)", "success");
        return;
      } else {
        toast("Wrong password. Try admin123 for first-time", "error"); return;
      }
    } else {
      const cfg = snap.data();
      if(cfg.password === pass){
        session.role = 'superadmin'; saveSession();
        await renderSuperOrgs();
        showScreen("superAdminPanel");
        document.getElementById("super-admin-pass").value = "";
        toast("SuperAdmin logged in", "success");
      } else toast("Wrong password","error");
    }
  }catch(e){ console.error(e); toast("Login error","error"); }
}

async function renderSuperOrgs(){
  const el = document.getElementById("superContent-orgs");
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading Organizations...</h3></div>`;
  try{
    const snaps = await getDocs(collection(db,"organizations"));
    const orgs = []; snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    if(orgs.length === 0){ 
      el.innerHTML = `<div class="card"><p class="subtext">No organizations yet. Create your first organization in the Settings tab.</p></div>`; 
      return; 
    }
    
    let html = `<div style="display:flex;flex-wrap:wrap;gap:20px;margin-top:20px">`;
    orgs.forEach(org => {
      const ecPasswordMasked = org.ecPassword ? '••••••••' : 'Not set';
      const voterCount = org.voterCount || 0;
      const statusColor = org.electionStatus === 'declared' ? '#9D00FF' : 
                         org.electionStatus === 'scheduled' ? '#ffc107' : '#00ffaa';
      
      html += `<div class="org-card">
        <div style="display:flex;gap:15px;align-items:center">
          <img src="${org.logoUrl || defaultLogoDataUrl()}" style="width:70px;height:70px;border-radius:12px;object-fit:cover">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <strong style="font-size:18px">${org.name}</strong>
                <div class="subtext" style="margin-top:4px">ID: ${org.id}</div>
                <div class="subtext" style="margin-top:2px">EC Password: ${ecPasswordMasked}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
                <span style="font-size:11px;padding:4px 8px;border-radius:10px;background:${statusColor}20;color:${statusColor}">
                  ${org.electionStatus || 'active'}
                </span>
                <span class="subtext">${voterCount} voters</span>
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:15px;justify-content:space-between">
          <button class="btn neon-btn-outline" onclick="openOrgAsEC('${org.id}')" style="flex:1">
            <i class="fas fa-user-tie"></i> EC
          </button>
          <button class="btn neon-btn-outline" onclick="openOrgForVoter('${org.id}')" style="flex:1">
            <i class="fas fa-user-check"></i> Voter
          </button>
          <button class="btn neon-btn-outline" onclick="editOrgModal('${org.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn neon-btn-outline" onclick="revealPassword('${org.id}', '${org.ecPassword}')" title="View Password">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;
  }catch(e){ 
    console.error(e); 
    el.innerHTML = `<div class="card"><p class="subtext" style="color:#ff4444">Error loading organizations</p></div>`; 
  }
}

// NEW: Delete Tab for SuperAdmin
async function renderSuperDelete(){
  const el = document.getElementById("superContent-delete");
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading organizations for deletion...</h3></div>`;
  try{
    const snaps = await getDocs(collection(db,"organizations"));
    const orgs = []; snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    if(orgs.length === 0){ 
      el.innerHTML = `<div class="card"><p class="subtext">No organizations to delete.</p></div>`; 
      return; 
    }
    
    let html = `<div class="danger-zone" style="padding:20px;border-radius:16px;margin-bottom:20px">
      <h3 style="color:#ff4444;margin-bottom:10px"><i class="fas fa-exclamation-triangle"></i> Delete Organizations</h3>
      <p class="subtext" style="color:#ff9999">Warning: This will permanently delete ALL data for the organization.</p>
    </div>`;
    
    orgs.forEach(org => {
      const voterCount = org.voterCount || 0;
      const date = org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'Unknown';
      
      html += `<div class="list-item" style="border-left:4px solid #ff4444;align-items:center">
        <div style="flex:1">
          <div style="display:flex;gap:10px;align-items:center">
            <img src="${org.logoUrl || defaultLogoDataUrl()}" style="width:50px;height:50px;border-radius:10px;object-fit:cover">
            <div>
              <strong>${org.name}</strong>
              <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
              <div class="subtext" style="margin-top:2px">${voterCount} voters • Created: ${date}</div>
            </div>
          </div>
        </div>
        <div>
          <button class="btn btn-danger" onclick="deleteOrgConfirm('${org.id}','${org.name}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>`;
    });
    el.innerHTML = html;
  }catch(e){ 
    console.error(e); 
    el.innerHTML = `<div class="card danger-zone"><p class="subtext">Error loading delete list</p></div>`; 
  }
}

// NEW: Reveal EC Password
function revealPassword(orgId, password){
  if(!password){
    toast("No password set for this organization", "error");
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'revealPasswordModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="color:#00eaff"><i class="fas fa-key"></i> EC Password</h3>
        <button class="btn neon-btn-outline" onclick="closeModal('revealPasswordModal')"><i class="fas fa-times"></i></button>
      </div>
      <p class="subtext">Organization: ${orgId}</p>
      <div style="background:rgba(0,0,0,0.3);padding:16px;border-radius:12px;margin:12px 0;border:1px solid rgba(0,255,255,0.1)">
        <code style="font-size:18px;letter-spacing:2px;color:#00ffaa">${password}</code>
      </div>
      <button class="btn neon-btn" onclick="copyToClipboard('${password}')" style="width:100%">
        <i class="fas fa-copy"></i> Copy Password
      </button>
      <div style="margin-top:12px;color:#ff4444;font-size:12px;padding:8px;border-radius:8px;background:rgba(255,68,68,0.1)">
        <i class="fas fa-exclamation-triangle"></i> Keep this password secure!
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// NEW: Edit Organization Modal
async function editOrgModal(orgId){
  try{
    const snap = await getDoc(doc(db, "organizations", orgId));
    if(!snap.exists()){ toast("Organization not found", "error"); return; }
    const org = snap.data();
    
    const modal = document.createElement('div');
    modal.id = 'editOrgModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:500px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="color:#00eaff"><i class="fas fa-edit"></i> Edit Organization</h3>
          <button class="btn neon-btn-outline" onclick="closeModal('editOrgModal')"><i class="fas fa-times"></i></button>
        </div>
        
        <label class="label">Organization Name</label>
        <input id="editOrgName" class="input" value="${org.name}" placeholder="Organization name">
        
        <label class="label">EC Password (leave blank to keep current)</label>
        <input id="editOrgPassword" class="input" placeholder="New EC password" type="password">
        
        <label class="label">Current Logo</label>
        <div style="text-align:center;margin:10px 0">
          <img id="currentLogoPreview" src="${org.logoUrl || defaultLogoDataUrl()}" style="width:100px;height:100px;border-radius:12px;object-fit:cover;border:2px solid rgba(0,255,255,0.1)">
        </div>
        
        <label class="label">Change Logo (optional)</label>
        <input id="editOrgLogoFile" type="file" accept="image/*" class="input" onchange="previewLogoEdit(event)">
        
        <div style="margin-top:20px;display:flex;gap:8px">
          <button class="btn neon-btn" onclick="saveOrgChanges('${orgId}')" style="flex:1">
            <i class="fas fa-save"></i> Save Changes
          </button>
          <button class="btn neon-btn-outline" onclick="closeModal('editOrgModal')" style="flex:1">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }catch(e){ console.error(e); toast("Error loading organization", "error"); }
}

function previewLogoEdit(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    document.getElementById('currentLogoPreview').src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveOrgChanges(orgId){
  const name = document.getElementById('editOrgName').value.trim();
  const newPassword = document.getElementById('editOrgPassword').value.trim();
  const file = document.getElementById('editOrgLogoFile').files?.[0];
  
  if(!name){ toast("Organization name is required", "error"); return; }
  
  try{
    const updates = { name };
    
    // Update password if provided
    if(newPassword){
      if(newPassword.length < 6){ toast("Password must be at least 6 characters", "error"); return; }
      updates.ecPassword = newPassword;
      // Send notification if password changed
      const orgSnap = await getDoc(doc(db, "organizations", orgId));
      const org = orgSnap.data();
      if(org.ecPassword !== newPassword){
        NotificationService.sendECCredentials(null, null, name, orgId, newPassword);
      }
    }
    
    // Update logo if new file selected
    if(file){
      const data = await fileToDataUrl(file);
      const sref = storageRef(storage, `orgs/${orgId}/logo.png`);
      await uploadString(sref, data, 'data_url');
      updates.logoUrl = await getDownloadURL(sref);
    }
    
    await updateDoc(doc(db, "organizations", orgId), updates);
    closeModal('editOrgModal');
    toast("Organization updated successfully", "success");
    renderSuperOrgs();
  }catch(e){ console.error(e); toast("Error updating organization", "error"); }
}

async function renderSuperSettings(){
  const el = document.getElementById("superContent-settings");
  el.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-user-shield"></i> SuperAdmin Settings</h3>
      <label class="label">Change SuperAdmin Password</label>
      <input id="new-super-pass" class="input" placeholder="New password" type="password">
      <div style="margin-top:10px">
        <button class="btn neon-btn" onclick="changeSuperPassword()">
          <i class="fas fa-key"></i> Change Password
        </button>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-building"></i> Create Organization</h3>
      <label class="label">Organization Name</label>
      <input id="new-org-name" class="input" placeholder="Name">
      
      <label class="label">EC Password</label>
      <input id="new-org-ec-pass" class="input" placeholder="EC password (min 6 chars)" type="password">
      
      <label class="label">EC Contact Email (optional)</label>
      <input id="new-org-ec-email" class="input" placeholder="ec@example.com" type="email">
      
      <label class="label">EC Contact Phone (optional)</label>
      <input id="new-org-ec-phone" class="input" placeholder="+233XXXXXXXXX">
      
      <label class="label">Logo Image (optional)</label>
      <input id="new-org-logo-file" type="file" accept="image/*" class="input">
      
      <div style="margin-top:10px">
        <button class="btn neon-btn" onclick="createNewOrg()">
          <i class="fas fa-plus-circle"></i> Create Organization
        </button>
      </div>
    </div>
  `;
}

async function createNewOrg(){
  const name = document.getElementById("new-org-name").value.trim();
  const ecPass = document.getElementById("new-org-ec-pass").value.trim();
  const ecEmail = document.getElementById("new-org-ec-email").value.trim();
  const ecPhone = document.getElementById("new-org-ec-phone").value.trim();
  const file = document.getElementById("new-org-logo-file").files?.[0];
  
  if(!name){ toast("Name required","error"); return; }
  if(!ecPass || ecPass.length < 6){ toast("EC password >=6 chars","error"); return; }
  
  // Validate phone if provided
  let validatedPhone = null;
  if(ecPhone){
    validatedPhone = validatePhoneNumber(ecPhone);
    if(!validatedPhone){ toast("Invalid phone number format","error"); return; }
  }
  
  try{
    const id = name.toLowerCase().replace(/[^a-z0-9\-]/g,'-') + '-' + Math.random().toString(36).slice(2,6);
    const orgRef = doc(db,"organizations",id);
    let logoUrl = "";
    
    if(file){
      const data = await fileToDataUrl(file);
      const sref = storageRef(storage, `orgs/${id}/logo.png`);
      await uploadString(sref, data, 'data_url');
      logoUrl = await getDownloadURL(sref);
    }
    
    const meta = { 
      id, 
      name, 
      logoUrl: logoUrl || defaultLogoDataUrl(), 
      createdAt: new Date().toISOString(), 
      voterCount: 0, 
      electionStatus: 'scheduled', 
      electionSettings: {}, 
      publicEnabled: false, 
      publicToken: null, 
      ecPassword: ecPass,
      ecEmail: ecEmail || null,
      ecPhone: validatedPhone || null
    };
    
    await setDoc(orgRef, meta);
    
    // Clear form
    document.getElementById("new-org-name").value = "";
    document.getElementById("new-org-ec-pass").value = "";
    document.getElementById("new-org-ec-email").value = "";
    document.getElementById("new-org-ec-phone").value = "";
    document.getElementById("new-org-logo-file").value = "";
    
    // Send credentials to EC
    if(ecEmail || validatedPhone){
      await NotificationService.sendECCredentials(ecEmail, validatedPhone, name, id, ecPass);
    }
    
    toast(`Organization "${name}" created successfully`,"success");
    await renderSuperOrgs();
    
  }catch(e){ console.error(e); toast("Create org failed","error"); }
}

function deleteOrgConfirm(orgId, orgName){
  if(!confirm(`PERMANENTLY DELETE "${orgName}"?\n\nThis will delete:\n• All voter data\n• All votes\n• All candidates\n• All positions\n• Organization settings\n\nThis action cannot be undone!`)) return;
  
  // Show loading
  toast("Deleting organization...", "info");
  
  deleteDoc(doc(db,"organizations",orgId))
    .then(async () => {
      // Also delete subcollections
      try {
        // Delete voters
        const votersSnap = await getDocs(collection(db, "organizations", orgId, "voters"));
        const voterDeletes = [];
        votersSnap.forEach(doc => voterDeletes.push(deleteDoc(doc.ref)));
        await Promise.all(voterDeletes);
        
        // Delete votes
        const votesSnap = await getDocs(collection(db, "organizations", orgId, "votes"));
        const voteDeletes = [];
        votesSnap.forEach(doc => voteDeletes.push(deleteDoc(doc.ref)));
        await Promise.all(voteDeletes);
        
        // Delete positions
        const positionsSnap = await getDocs(collection(db, "organizations", orgId, "positions"));
        const positionDeletes = [];
        positionsSnap.forEach(doc => positionDeletes.push(deleteDoc(doc.ref)));
        await Promise.all(positionDeletes);
        
        // Delete candidates
        const candidatesSnap = await getDocs(collection(db, "organizations", orgId, "candidates"));
        const candidateDeletes = [];
        candidatesSnap.forEach(doc => candidateDeletes.push(deleteDoc(doc.ref)));
        await Promise.all(candidateDeletes);
        
      } catch(e) { console.error("Error deleting subcollections:", e); }
      
      toast("Organization and all data permanently deleted","success");
      renderSuperOrgs();
      renderSuperDelete();
    })
    .catch(e => { 
      console.error(e); 
      toast("Delete failed","error"); 
    });
}

// ---------------- EC flows - Enhanced with Phone Numbers ----------------
let currentOrgId = null;
let currentOrgUnsub = null;
let currentOrgData = null;

async function loginEC(){
  const id = (document.getElementById("ec-org-id").value || "").trim();
  const pass = (document.getElementById("ec-pass").value || "").trim();
  if(!id || !pass){ toast("Enter org ID & password","error"); return; }
  try{
    const ref = doc(db,"organizations",id);
    const snap = await getDoc(ref);
    if(!snap.exists()){ toast("Organization not found","error"); return; }
    const org = snap.data();
    if(org.ecPassword !== pass){ toast("Wrong EC password","error"); return; }
    session.role = 'ec'; session.orgId = id; saveSession();
    await openECPanel(id);
    document.getElementById("ec-org-id").value=""; document.getElementById("ec-pass").value="";
    showScreen("ecPanel"); toast("EC logged in","success");
  }catch(e){ console.error(e); toast("EC login failed","error"); }
}

async function openECPanel(orgId){
  currentOrgId = orgId;
  if(currentOrgUnsub){ try{ currentOrgUnsub(); } catch(e){} currentOrgUnsub = null; }
  
  const metaRef = doc(db,"organizations",orgId);
  currentOrgUnsub = onSnapshot(metaRef, snap => {
    if(!snap.exists()){ 
      toast("Organization removed","error"); 
      showScreen("gatewayScreen"); 
      return; 
    }
    const org = snap.data();
    currentOrgData = org;
    
    // Update UI elements
    const orgNameEl = document.getElementById('ecOrgName');
    const orgIdEl = document.getElementById('ecOrgIdDisplay');
    const appTitle = document.querySelector('#ecPanel .app-title');
    
    if(orgNameEl) orgNameEl.textContent = org.name;
    if(orgIdEl) orgIdEl.textContent = `ID: ${org.id}`;
    if(appTitle) appTitle.textContent = org.name;
    
    const statusColor = org.electionStatus === 'declared' ? '#9D00FF' : 
                       org.electionStatus === 'scheduled' ? '#ffc107' : '#00ffaa';
    const statusText = document.querySelector('#ecPanel .app-subtext');
    if(statusText) {
      statusText.innerHTML = `Status: <span style="color:${statusColor}">${org.electionStatus || 'active'}</span>`;
    }
    
    const activeTab = document.querySelector('#ecTabs .tab-btn.active')?.getAttribute('data-ec-tab') || 'voters';
    showECTab(activeTab, org);
    
  }, err => console.error("onSnapshot org err", err));
  
  try {
    const metaSnap = await getDoc(metaRef);
    if(metaSnap.exists()) {
      currentOrgData = metaSnap.data();
      showECTab('voters', currentOrgData);
    }
  } catch(e) {
    console.error("Initial load error:", e);
  }
}

function showECTab(tabName, orgData = null){
  const dataToUse = orgData || currentOrgData;
  if(!dataToUse && currentOrgId) {
    getDoc(doc(db,"organizations",currentOrgId)).then(snap => {
      if(snap.exists()) {
        currentOrgData = snap.data();
        showECTab(tabName, currentOrgData);
      }
    });
    return;
  }
  
  // Update tab UI
  document.querySelectorAll('#ecTabs .tab-btn').forEach(b => 
    b.classList.toggle('active', b.getAttribute('data-ec-tab') === tabName)
  );
  
  // Hide all tab contents
  document.querySelectorAll('#ecPanel .tab-content').forEach(c => {
    c.classList.remove('active');
  });
  
  // Show the active tab content
  const activeTabContent = document.getElementById('ecContent-' + tabName);
  if(activeTabContent) {
    activeTabContent.classList.add('active');
  }
  
  // Load appropriate content
  if(tabName === 'voters') renderECVoters(dataToUse);
  else if(tabName === 'positions') renderECPositions(dataToUse);
  else if(tabName === 'candidates') renderECCandidates(dataToUse);
  else if(tabName === 'outcomes') {
    renderECOutcomes(dataToUse);
    startOutcomesAutoRefresh(dataToUse.id);
  }
  else if(tabName === 'settings') renderECSettings(dataToUse);
}

// ENHANCED: Voters tab with phone numbers
async function renderECVoters(org){
  const el = document.getElementById("ecContent-voters");
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading voters...</h3></div>`;
  try{
    const snap = await getDocs(collection(db,"organizations",org.id,"voters"));
    const voters = []; snap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3><i class="fas fa-users"></i> Voters (${voters.length})</h3>
      <div style="display:flex;gap:8px">
        <button class="btn neon-btn" onclick="showAddVoterModal()">
          <i class="fas fa-user-plus"></i> Add Voter
        </button>
        <button class="btn neon-btn-outline" onclick="showBulkAddModal()">
          <i class="fas fa-users"></i> Bulk Add
        </button>
      </div>
    </div>`;
    
    if(voters.length===0) {
      html += `<div class="card"><p class="subtext">No voters yet. Add voters using the buttons above.</p></div>`;
    } else {
      voters.forEach(v => {
        const email = decodeURIComponent(v.id);
        const phoneDisplay = v.phone ? formatPhoneForDisplay(v.phone) : 'No phone';
        const hasLink = v.votingLink ? '🔗' : '';
        const votedStatus = v.hasVoted ? 
          '<span style="color:#00ffaa;background:rgba(0,255,170,0.1);padding:4px 8px;border-radius:8px;font-size:12px">✅ Voted</span>' :
          '<span style="color:#ffc107;background:rgba(255,193,7,0.1);padding:4px 8px;border-radius:8px;font-size:12px">⏳ Pending</span>';
        
        html += `<div class="list-item">
          <div style="display:flex;gap:12px;align-items:center">
            <img src="${defaultAvatar(v.name||email)}" style="width:50px;height:50px;border-radius:10px">
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <strong>${v.name||email} ${hasLink}</strong>
                  <div class="subtext" style="margin-top:2px">${email}</div>
                  <div class="subtext" style="margin-top:2px"><i class="fas fa-phone"></i> ${phoneDisplay}</div>
                </div>
                ${votedStatus}
              </div>
              <div class="subtext" style="margin-top:4px">Added: ${v.addedAt? new Date(v.addedAt).toLocaleDateString() : 'N/A'}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            ${v.votingLink ? `<button class="btn neon-btn-outline" onclick="copyVoterLink('${v.votingLink}')" title="Copy voting link"><i class="fas fa-link"></i></button>` : ''}
            <button class="btn neon-btn-outline" onclick="removeVoter('${org.id}','${v.id}')" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
      });
      
      // Add export button
      html += `<div style="margin-top:20px">
        <button class="btn neon-btn-outline" onclick="downloadVoterCSV('${org.id}')" style="width:100%">
          <i class="fas fa-download"></i> Export Voters as CSV
        </button>
      </div>`;
    }
    
    el.innerHTML = html;
  }catch(e){ 
    console.error(e); 
    el.innerHTML = `<div class="card"><p class="subtext" style="color:#ff4444">Error loading voters</p></div>`; 
  }
}

// ENHANCED: Add voter with phone number
function showAddVoterModal(){
  const modal = document.createElement('div'); 
  modal.id = 'addVoterModal'; 
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:500px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="color:#00eaff"><i class="fas fa-user-plus"></i> Add Voter</h3>
        <button class="btn neon-btn-outline" onclick="closeModal('addVoterModal')"><i class="fas fa-times"></i></button>
      </div>
      
      <label class="label">Email Address</label>
      <input id="newVoterEmail" class="input" placeholder="voter@example.com" type="email">
      
      <label class="label">Full Name</label>
      <input id="newVoterName" class="input" placeholder="John Doe">
      
      <label class="label">Phone Number (optional)</label>
      <input id="newVoterPhone" class="input" placeholder="+233XXXXXXXXX or 0XXXXXXXXX">
      <small class="subtext">Format: Ghanaian (+233...) or international</small>
      
      <div style="margin-top:16px">
        <label class="label" style="display:flex;align-items:center;gap:8px">
          <input id="sendInviteCheckbox" type="checkbox" checked> Send voting link via email/SMS
        </label>
      </div>
      
      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn neon-btn" onclick="addVoter()" style="flex:1">
          <i class="fas fa-user-plus"></i> Add Voter
        </button>
        <button class="btn neon-btn-outline" onclick="closeModal('addVoterModal')" style="flex:1">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// NEW: Bulk add voters modal
function showBulkAddModal(){
  const modal = document.createElement('div'); 
  modal.id = 'bulkAddModal'; 
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:600px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="color:#00eaff"><i class="fas fa-users"></i> Bulk Add Voters</h3>
        <button class="btn neon-btn-outline" onclick="closeModal('bulkAddModal')"><i class="fas fa-times"></i></button>
      </div>
      
      <p class="subtext">Add multiple voters at once (one per line):</p>
      <textarea id="bulkVotersText" class="input bulk-textarea" placeholder="Format:
email@example.com, John Doe, +233XXXXXXXXX
another@example.com, Jane Smith, 0XXXXXXXXX
third@example.com, Bob Johnson"></textarea>
      
      <small class="subtext">Format: email, name, phone (optional) - Separate with commas</small>
      
      <div style="margin-top:16px">
        <label class="label" style="display:flex;align-items:center;gap:8px">
          <input id="bulkSendInvites" type="checkbox" checked> Send voting links
        </label>
      </div>
      
      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn neon-btn" onclick="bulkAddVoters()" style="flex:1">
          <i class="fas fa-users"></i> Add All Voters
        </button>
        <button class="btn neon-btn-outline" onclick="closeModal('bulkAddModal')" style="flex:1">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function bulkAddVoters(){
  const text = document.getElementById('bulkVotersText').value.trim();
  const sendInvites = document.getElementById('bulkSendInvites').checked;
  
  if(!text){ toast("Enter voter data", "error"); return; }
  
  const lines = text.split('\n').filter(line => line.trim());
  const voters = [];
  
  // Parse each line
  for(const line of lines){
    const parts = line.split(',').map(p => p.trim());
    if(parts.length < 2) continue;
    
    const email = parts[0].toLowerCase();
    const name = parts[1];
    const phone = parts[2] ? validatePhoneNumber(parts[2]) : null;
    
    if(email && email.includes('@')){
      voters.push({ email, name, phone });
    }
  }
  
  if(voters.length === 0){ toast("No valid voters found", "error"); return; }
  
  try {
    let addedCount = 0;
    let linkCount = 0;
    
    for(const voter of voters){
      try {
        const vRef = doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(voter.email));
        const snap = await getDoc(vRef);
        
        if(snap.exists()) continue; // Skip existing
        
        const votingLink = `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&voter=${encodeURIComponent(voter.email)}`;
        
        await setDoc(vRef, { 
          name: voter.name, 
          phone: voter.phone || null,
          hasVoted: false, 
          addedAt: new Date().toISOString(),
          votingLink: votingLink
        });
        
        addedCount++;
        
        // Send invite if requested
        if(sendInvites){
          await NotificationService.sendVoterInvite(
            voter.email, 
            voter.phone, 
            currentOrgData.name, 
            currentOrgId, 
            encodeURIComponent(voter.email),
            voter.name
          );
          linkCount++;
        }
        
      } catch(e){ console.error(`Error adding ${voter.email}:`, e); }
    }
    
    // Update voter count
    const orgRef = doc(db,"organizations",currentOrgId);
    const metaSnap = await getDoc(orgRef); 
    const meta = metaSnap.data();
    await updateDoc(orgRef, { voterCount: (meta.voterCount||0) + addedCount });
    
    closeModal('bulkAddModal');
    toast(`Added ${addedCount} voters${sendInvites ? `, sent ${linkCount} invites` : ''}`, "success");
    renderECVoters(meta);
    
  } catch(e){ console.error(e); toast("Bulk add failed", "error"); }
}

async function addVoter(){
  const email = (document.getElementById('newVoterEmail').value||"").trim().toLowerCase();
  const name = (document.getElementById('newVoterName').value||"").trim() || email.split('@')[0];
  const phoneInput = (document.getElementById('newVoterPhone').value||"").trim();
  const sendInvite = document.getElementById('sendInviteCheckbox')?.checked || true;
  
  if(!email || !email.includes('@')){ toast("Enter valid email","error"); return; }
  
  // Validate phone if provided
  let phone = null;
  if(phoneInput){
    phone = validatePhoneNumber(phoneInput);
    if(!phone){ toast("Invalid phone number format","error"); return; }
  }
  
  try{
    const vRef = doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(email));
    const snap = await getDoc(vRef);
    if(snap.exists()){ toast("Voter already exists","error"); return; }
    
    const votingLink = `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&voter=${encodeURIComponent(email)}`;
    
    await setDoc(vRef, { 
      name, 
      phone,
      hasVoted: false, 
      addedAt: new Date().toISOString(),
      votingLink: votingLink
    });
    
    // Update voter count
    const orgRef = doc(db,"organizations",currentOrgId);
    const metaSnap = await getDoc(orgRef); 
    const meta = metaSnap.data();
    await updateDoc(orgRef, { voterCount: (meta.voterCount||0) + 1 });
    
    // Send invitation
    if(sendInvite){
      await NotificationService.sendVoterInvite(email, phone, meta.name, currentOrgId, encodeURIComponent(email), name);
    }
    
    closeModal('addVoterModal'); 
    toast(`Voter added${sendInvite ? ' & invitation sent' : ''}`,"success");
    renderECVoters(meta);
    
  }catch(e){ console.error(e); toast("Add voter failed","error"); }
}

async function removeVoter(orgId, voterId){
  if(!confirm("Remove voter and their vote?")) return;
  try{
    await deleteDoc(doc(db,"organizations",orgId,"voters", voterId));
    try{ await deleteDoc(doc(db,"organizations",orgId,"votes", voterId)); } catch(e){}
    const orgRef = doc(db,"organizations",orgId);
    const metaSnap = await getDoc(orgRef); const meta = metaSnap.data();
    await updateDoc(orgRef, { voterCount: Math.max(0,(meta.voterCount||0)-1) });
    toast("Voter removed","success"); renderECVoters(meta);
  }catch(e){ console.error(e); toast("Remove failed","error"); }
}

function copyVoterLink(link){
  navigator.clipboard.writeText(link)
    .then(() => toast("Voting link copied to clipboard", "success"))
    .catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast("Link copied", "success");
    });
}

async function downloadVoterCSV(orgId){
  try{
    const snap = await getDocs(collection(db,"organizations",orgId,"voters"));
    let csv = "email,name,phone,hasVoted,addedAt,votingLink\n";
    snap.forEach(s => { 
      const v = s.data();
      const email = decodeURIComponent(s.id);
      const phoneDisplay = v.phone ? formatPhoneForDisplay(v.phone) : '';
      const link = v.votingLink || '';
      csv += `"${email}","${v.name||''}","${phoneDisplay}","${v.hasVoted? 'Voted':'Pending'}","${v.addedAt||''}","${link}"\n`; 
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `voters-${orgId}-${new Date().toISOString().slice(0,10)}.csv`; 
    document.body.appendChild(a); 
    a.click(); 
    a.remove(); 
    URL.revokeObjectURL(url);
    toast("CSV downloaded","success");
  }catch(e){ console.error(e); toast("Export failed","error"); }
}

// Positions tab (subcollection orgs/{orgId}/positions)
async function renderECPositions(org){
  const el = document.getElementById("ecContent-positions");
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading positions...</h3></div>`;
  try{
    const snap = await getDocs(collection(db,"organizations",org.id,"positions"));
    const positions = []; snap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3><i class="fas fa-list-ol"></i> Positions (${positions.length})</h3>
      <button class="btn neon-btn" onclick="showAddPositionModal()">
        <i class="fas fa-plus-circle"></i> Add Position
      </button>
    </div>`;
    
    if(positions.length===0) {
      html += `<div class="card"><p class="subtext">No positions yet. Add positions to organize your election.</p></div>`;
    } else {
      positions.forEach(p => { 
        html += `<div class="list-item">
          <div>
            <strong>${p.name}</strong>
            <div class="subtext" style="margin-top:4px">ID: ${p.id}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn neon-btn-outline" onclick="deletePosition('${org.id}','${p.id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`; 
      });
    }
    
    el.innerHTML = html;
  }catch(e){ 
    console.error(e); 
    el.innerHTML = `<div class="card"><p class="subtext" style="color:#ff4444">Error loading positions</p></div>`; 
  }
}

function showAddPositionModal(){
  const modal = document.createElement('div'); modal.id='addPositionModal'; modal.className='modal-overlay';
  modal.innerHTML = `<div class="modal-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="color:#00eaff"><i class="fas fa-plus-circle"></i> Add Position</h3>
      <button class="btn neon-btn-outline" onclick="closeModal('addPositionModal')"><i class="fas fa-times"></i></button>
    </div>
    <label class="label">Position name</label>
    <input id="newPositionName" class="input" placeholder="e.g., President">
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn neon-btn" onclick="addPosition()" style="flex:1">Add Position</button>
      <button class="btn neon-btn-outline" onclick="closeModal('addPositionModal')" style="flex:1">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function addPosition(){
  const name = (document.getElementById("newPositionName").value||"").trim();
  if(!name){ toast("Enter position name","error"); return; }
  try{
    const id = 'pos-' + Math.random().toString(36).slice(2,8);
    await setDoc(doc(db,"organizations",currentOrgId,"positions", id), { 
      name, 
      addedAt: new Date().toISOString() 
    });
    closeModal('addPositionModal'); 
    const meta = (await getDoc(doc(db,"organizations",currentOrgId))).data(); 
    renderECPositions(meta); 
    toast("Position added","success");
  }catch(e){ console.error(e); toast("Add failed","error"); }
}

async function deletePosition(orgId, posId){
  if(!confirm("Delete position and its candidates?")) return;
  try{
    await deleteDoc(doc(db,"organizations",orgId,"positions", posId));
    // delete candidates tied to this position
    const candSnap = await getDocs(collection(db,"organizations",orgId,"candidates"));
    const delOps = [];
    candSnap.forEach(c => { 
      if(c.data().positionId === posId) delOps.push(deleteDoc(doc(db,"organizations",orgId,"candidates", c.id))); 
    });
    await Promise.all(delOps);
    toast("Position removed","success"); 
    const meta = (await getDoc(doc(db,"organizations",orgId))).data(); 
    renderECPositions(meta);
  }catch(e){ console.error(e); toast("Delete failed","error"); }
}

// Candidates tab (subcollection orgs/{orgId}/candidates)
async function renderECCandidates(org){
  const el = document.getElementById("ecContent-candidates");
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading candidates...</h3></div>`;
  try{
    const candSnap = await getDocs(collection(db,"organizations",org.id,"candidates"));
    const cands = []; candSnap.forEach(s => cands.push({ id:s.id, ...s.data() }));
    const posSnap = await getDocs(collection(db,"organizations",org.id,"positions"));
    const positions = []; posSnap.forEach(s => positions.push({ id:s.id, ...s.data() }));
    
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3><i class="fas fa-user-friends"></i> Candidates (${cands.length})</h3>
      <button class="btn neon-btn" onclick="showAddCandidateModal()">
        <i class="fas fa-user-plus"></i> Add Candidate
      </button>
    </div>`;
    
    if(cands.length===0) {
      html += `<div class="card"><p class="subtext">No candidates yet. Add candidates for each position.</p></div>`;
    } else {
      // group by position
      const grouped = {};
      cands.forEach(c => { 
        grouped[c.positionId] = grouped[c.positionId] || []; 
        grouped[c.positionId].push(c); 
      });
      
      for(const posId in grouped){
        const posName = (positions.find(p=>p.id===posId)||{name:'Unknown'}).name;
        html += `<div class="card" style="margin-bottom:20px">
          <h4 style="color:#00eaff;margin-bottom:15px"><i class="fas fa-users"></i> ${posName}</h4>`;
        
        grouped[posId].forEach(c => {
          html += `<div class="list-item" style="margin-top:10px;align-items:center">
            <div style="display:flex;gap:12px;align-items:center">
              <img src="${c.photo||defaultAvatar(c.name)}" class="candidate-photo">
              <div style="flex:1">
                <strong>${c.name}</strong>
                ${c.tagline ? `<div class="subtext" style="margin-top:2px">${c.tagline}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="deleteCandidate('${org.id}','${c.id}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>`;
        });
        html += `</div>`;
      }
    }
    
    el.innerHTML = html;
  }catch(e){ 
    console.error(e); 
    el.innerHTML = `<div class="card"><p class="subtext" style="color:#ff4444">Error loading candidates</p></div>`; 
  }
}

function showAddCandidateModal(){
  const modal = document.createElement('div'); modal.id='addCandidateModal'; modal.className='modal-overlay';
  modal.innerHTML = `<div class="modal-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="color:#00eaff"><i class="fas fa-user-plus"></i> Add Candidate</h3>
      <button class="btn neon-btn-outline" onclick="closeModal('addCandidateModal')"><i class="fas fa-times"></i></button>
    </div>
    <label class="label">Name</label><input id="newCandidateName" class="input" placeholder="Full name">
    <label class="label">Tagline</label><input id="newCandidateTagline" class="input" placeholder="Slogan">
    <label class="label">Position</label>
    <select id="newCandidatePosition" class="input"><option value=''>Loading positions...</option></select>
    <label class="label">Photo (optional)</label>
    <input id="newCandidatePhotoFile" type="file" accept="image/*" class="input">
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn neon-btn" onclick="addCandidate()" style="flex:1">Add</button>
      <button class="btn neon-btn-outline" onclick="closeModal('addCandidateModal')" style="flex:1">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  populatePositionsForCandidate();
}

async function populatePositionsForCandidate(){
  const sel = document.getElementById('newCandidatePosition');
  sel.innerHTML = '<option value="">Select position...</option>';
  try{
    const snap = await getDocs(collection(db,"organizations",currentOrgId,"positions"));
    snap.forEach(s => { 
      const p = s.data(); 
      const opt = document.createElement('option'); 
      opt.value = s.id; 
      opt.textContent = p.name; 
      sel.appendChild(opt); 
    });
  }catch(e){ 
    console.error(e); 
    sel.innerHTML = '<option value="">Error loading positions</option>'; 
  }
}

async function addCandidate(){
  const name = (document.getElementById('newCandidateName').value||"").trim();
  const tagline = (document.getElementById('newCandidateTagline').value||"").trim();
  const positionId = document.getElementById('newCandidatePosition').value;
  const file = document.getElementById('newCandidatePhotoFile').files?.[0];
  if(!name || !positionId){ toast("Enter name & position","error"); return; }
  try{
    const id = 'cand-' + Math.random().toString(36).slice(2,8);
    let photoUrl = "";
    if(file){ 
      const data = await fileToDataUrl(file); 
      const sref = storageRef(storage, `orgs/${currentOrgId}/candidates/${id}.png`); 
      await uploadString(sref, data, 'data_url'); 
      photoUrl = await getDownloadURL(sref); 
    }
    await setDoc(doc(db,"organizations",currentOrgId,"candidates", id), { 
      id, name, tagline, positionId, 
      photo: photoUrl || defaultAvatar(name), 
      addedAt: new Date().toISOString() 
    });
    closeModal('addCandidateModal'); 
    const meta = (await getDoc(doc(db,"organizations",currentOrgId))).data(); 
    renderECCandidates(meta); 
    toast("Candidate added","success");
  }catch(e){ console.error(e); toast("Add candidate failed","error"); }
}

async function deleteCandidate(orgId, candId){
  if(!confirm("Delete candidate?")) return;
  try{ 
    await deleteDoc(doc(db,"organizations",orgId,"candidates", candId)); 
    toast("Candidate deleted","success"); 
    const meta = (await getDoc(doc(db,"organizations",orgId))).data(); 
    renderECCandidates(meta); 
  } catch(e){ console.error(e); toast("Delete failed","error"); }
}

// Outcomes Tab - Live voting results
async function renderECOutcomes(org) {
  const el = document.getElementById("ecContent-outcomes");
  if (!el) return;
  
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading voting outcomes...</h3></div>`;
  
  try {
    // Get all votes
    const votesSnap = await getDocs(collection(db, "organizations", org.id, "votes"));
    const votes = []; 
    votesSnap.forEach(s => votes.push(s.data()));
    
    // Get all positions
    const posSnap = await getDocs(collection(db, "organizations", org.id, "positions"));
    const positions = []; 
    posSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    // Get all candidates
    const candSnap = await getDocs(collection(db, "organizations", org.id, "candidates"));
    const candidates = []; 
    candSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    // Get total voters
    const totalVoters = org.voterCount || 0;
    const votesCast = votes.length;
    const participationRate = totalVoters ? Math.round((votesCast / totalVoters) * 100) : 0;
    
    let html = `<div class="card info-card" style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-around;text-align:center;gap:20px">
        <div>
          <div class="label">Total Voters</div>
          <div style="font-weight:bold;font-size:28px;color:#00eaff">${totalVoters}</div>
        </div>
        <div>
          <div class="label">Votes Cast</div>
          <div style="font-weight:bold;font-size:28px;color:#00eaff">${votesCast}</div>
        </div>
        <div>
          <div class="label">Participation</div>
          <div style="font-weight:bold;font-size:28px;color:#00eaff">${participationRate}%</div>
        </div>
      </div>
    </div>`;
    
    if (positions.length === 0) {
      html += `<div class="card"><p class="subtext">No positions created yet.</p></div>`;
    } else {
      // For each position, show voting outcomes
      for (const pos of positions) {
        const counts = {};
        let positionVotes = 0;
        
        // Count votes for this position
        votes.forEach(v => {
          if (v.choices && v.choices[pos.id]) {
            const candId = v.choices[pos.id];
            counts[candId] = (counts[candId] || 0) + 1;
            positionVotes++;
          }
        });
        
        // Get candidates for this position
        const posCandidates = candidates.filter(c => c.positionId === pos.id);
        
        html += `<div class="card" style="margin-bottom:20px">
          <h4 style="color:#00eaff;margin-bottom:15px">
            <i class="fas fa-chart-bar"></i> ${pos.name}
            <span class="subtext" style="margin-left:10px">(${positionVotes} votes)</span>
          </h4>`;
        
        if (posCandidates.length === 0) {
          html += `<div class="subtext" style="padding:10px">No candidates for this position</div>`;
        } else if (posCandidates.length === 1) {
          // Single candidate - show Yes/No voting
          const candidate = posCandidates[0];
          const yesVotes = counts[candidate.id] || 0;
          const noVotes = positionVotes - yesVotes;
          const yesPercentage = positionVotes ? Math.round((yesVotes / positionVotes) * 100) : 0;
          const noPercentage = positionVotes ? Math.round((noVotes / positionVotes) * 100) : 0;
          
          html += `<div style="margin-bottom:15px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:15px">
              <img src="${candidate.photo || defaultAvatar(candidate.name)}" style="width:50px;height:50px;border-radius:8px">
              <div style="flex:1">
                <strong>${candidate.name}</strong>
                ${candidate.tagline ? `<div class="subtext">${candidate.tagline}</div>` : ''}
              </div>
            </div>
            
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span>✅ Yes</span>
                <span>${yesVotes} votes (${yesPercentage}%)</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${yesPercentage}%;background:linear-gradient(90deg,#00C851,#007E33)"></div>
              </div>
            </div>
            
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span>❌ No</span>
                <span>${noVotes} votes (${noPercentage}%)</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${noPercentage}%;background:linear-gradient(90deg,#ff4444,#cc0000)"></div>
              </div>
            </div>
            
            ${positionVotes > 0 ? `
              <div style="display:flex;justify-content:center;gap:20px;margin-top:15px">
                <div style="text-align:center">
                  <div class="label">For</div>
                  <div style="font-size:24px;color:#00ffaa">${yesVotes}</div>
                </div>
                <div style="text-align:center">
                  <div class="label">Against</div>
                  <div style="font-size:24px;color:#ff4444">${noVotes}</div>
                </div>
                <div style="text-align:center">
                  <div class="label">Result</div>
                  <div style="font-size:24px;color:${yesVotes > noVotes ? '#00ffaa' : yesVotes < noVotes ? '#ff4444' : '#ffc107'}">
                    ${yesVotes > noVotes ? 'PASSING' : yesVotes < noVotes ? 'FAILING' : 'TIED'}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>`;
        } else {
          // Multiple candidates - show regular voting
          html += `<div style="margin-bottom:15px">`;
          
          // Sort candidates by vote count (descending)
          const sortedCandidates = [...posCandidates].sort((a, b) => {
            const votesA = counts[a.id] || 0;
            const votesB = counts[b.id] || 0;
            return votesB - votesA;
          });
          
          sortedCandidates.forEach((candidate, index) => {
            const candidateVotes = counts[candidate.id] || 0;
            const percentage = positionVotes ? Math.round((candidateVotes / positionVotes) * 100) : 0;
            const isLeading = index === 0 && candidateVotes > 0;
            
            html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;padding:12px;border-radius:8px;background:${isLeading ? 'rgba(0,255,170,0.1)' : 'rgba(255,255,255,0.02)'}">
              <div style="display:flex;align-items:center;gap:10px">
                ${isLeading ? '<span style="color:#00ffaa;font-size:18px">🏆</span>' : `<span style="color:#888;font-size:14px">#${index + 1}</span>`}
                <img src="${candidate.photo || defaultAvatar(candidate.name)}" style="width:50px;height:50px;border-radius:8px">
              </div>
              <div style="flex:1">
                <strong>${candidate.name}</strong>
                ${candidate.tagline ? `<div class="subtext">${candidate.tagline}</div>` : ''}
                <div class="subtext" style="margin-top:4px">${candidateVotes} votes • ${percentage}%</div>
              </div>
              <div style="width:120px">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${percentage}%"></div>
                </div>
              </div>
            </div>`;
          });
          
          // Show leading candidate if there are votes
          if (positionVotes > 0) {
            const leadingCandidate = sortedCandidates[0];
            const leadingVotes = counts[leadingCandidate.id] || 0;
            const secondCandidate = sortedCandidates[1];
            const secondVotes = counts[secondCandidate?.id] || 0;
            const lead = leadingVotes - secondVotes;
            
            html += `<div style="margin-top:15px;padding:12px;border-radius:8px;background:rgba(0,255,255,0.05);border:1px solid rgba(0,255,255,0.1)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <strong style="color:#00eaff">Current Leader:</strong>
                  <div style="margin-top:4px">${leadingCandidate.name}</div>
                  <div class="subtext">${leadingVotes} votes</div>
                </div>
                ${lead > 0 ? `<div style="color:#00ffaa;font-weight:bold">+${lead} vote${lead === 1 ? '' : 's'}</div>` : ''}
              </div>
            </div>`;
          }
          
          html += `</div>`;
        }
        
        html += `</div>`;
      }
    }
    
    // Add auto-refresh button
    html += `<div class="card" style="margin-top:20px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>Live Updates</strong>
          <div class="subtext" style="margin-top:4px">Results update automatically every 30 seconds</div>
        </div>
        <button class="btn neon-btn-outline" onclick="refreshOutcomes('${org.id}')">
          <i class="fas fa-sync-alt"></i> Refresh Now
        </button>
      </div>
    </div>`;
    
    el.innerHTML = html;
    
  } catch (e) {
    console.error("Error loading outcomes:", e);
    el.innerHTML = `<div class="card"><p class="subtext" style="color:#ff4444">Error loading voting outcomes</p></div>`;
  }
}

// Refresh outcomes function
async function refreshOutcomes(orgId) {
  try {
    const snap = await getDoc(doc(db, "organizations", orgId));
    if (snap.exists()) {
      const org = snap.data();
      await renderECOutcomes(org);
      toast("Outcomes refreshed", "success");
    }
  } catch (e) {
    console.error("Error refreshing outcomes:", e);
    toast("Refresh failed", "error");
  }
}

// Auto-refresh for outcomes tab
let outcomesRefreshInterval = null;

function startOutcomesAutoRefresh(orgId) {
  if (outcomesRefreshInterval) {
    clearInterval(outcomesRefreshInterval);
  }
  
  // Refresh every 30 seconds
  outcomesRefreshInterval = setInterval(async () => {
    if (document.querySelector('#ecContent-outcomes.active')) {
      try {
        const snap = await getDoc(doc(db, "organizations", orgId));
        if (snap.exists()) {
          const org = snap.data();
          await renderECOutcomes(org);
        }
      } catch (e) {
        console.error("Auto-refresh error:", e);
      }
    }
  }, 30000); // 30 seconds
}

// EC Settings - FIXED VERSION
async function renderECSettings(org){
  const el = document.getElementById("ecContent-settings");
  if(!el) return;
  
  const s = org.electionSettings?.startTime ? new Date(org.electionSettings.startTime).toISOString().slice(0,16) : '';
  const e = org.electionSettings?.endTime ? new Date(org.electionSettings.endTime).toISOString().slice(0,16) : '';
  const declared = org.electionStatus === 'declared';
  
  el.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-calendar-alt"></i> Election Settings</h3>
      <label class="label">Start Date & Time</label>
      <input id="ecStartTime" type="datetime-local" class="input" value="${s}">
      <label class="label">End Date & Time</label>
      <input id="ecEndTime" type="datetime-local" class="input" value="${e}">
      <div style="margin-top:10px;display:flex;gap:8px">
        <button id="ecSaveTimesBtn" class="btn neon-btn" style="flex:1">Save Schedule</button>
        <button id="ecClearTimesBtn" class="btn neon-btn-outline" style="flex:1">Clear</button>
      </div>
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-share-alt"></i> Public Results</h3>
      <p class="subtext">Generate a public link for results</p>
      <div style="display:flex;gap:8px">
        <button id="ecGenTokenBtn" class="btn neon-btn" style="flex:1">
          ${org.publicEnabled ? 'Regenerate Link' : 'Generate Link'}
        </button>
        <button id="ecCopyLinkBtn" class="btn neon-btn-outline" style="flex:1" ${org.publicEnabled && org.publicToken ? '' : 'disabled'}>
          Copy Link
        </button>
      </div>
      ${org.publicEnabled && org.publicToken ? 
        `<div class="link-box" style="margin-top:12px">
          <code>${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}</code>
        </div>` : 
        ''}
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-flag-checkered"></i> Declare Results</h3>
      <p class="subtext">Declare final results (locks voting)</p>
      <button id="ecDeclareBtn" class="btn neon-btn" ${declared ? 'disabled' : ''} style="width:100%">
        ${declared ? '<i class="fas fa-check-circle"></i> Declared' : '<i class="fas fa-flag"></i> Declare Final Results'}
      </button>
      ${declared ? 
        `<div class="subtext" style="margin-top:8px;padding:8px;background:rgba(157,0,255,0.1);border-radius:8px">
          <i class="fas fa-clock"></i> Declared at: ${org.resultsDeclaredAt ? new Date(org.resultsDeclaredAt).toLocaleString() : 'N/A'}
        </div>` : 
        ''}
    </div>`;
  
  // Attach event handlers
  setTimeout(() => {
    const saveBtn = document.getElementById("ecSaveTimesBtn");
    const clearBtn = document.getElementById("ecClearTimesBtn");
    const genBtn = document.getElementById("ecGenTokenBtn");
    const copyBtn = document.getElementById("ecCopyLinkBtn");
    const declareBtn = document.getElementById("ecDeclareBtn");
    
    if(saveBtn) saveBtn.onclick = () => ecSaveTimes(org.id);
    if(clearBtn) clearBtn.onclick = () => ecClearTimes(org.id);
    if(genBtn) genBtn.onclick = () => ecGeneratePublicToken(org.id);
    if(copyBtn) copyBtn.onclick = () => ecCopyPublicLink(org.id);
    if(declareBtn) declareBtn.onclick = () => ecDeclareResults(org.id);
  }, 50);
}

async function ecSaveTimes(orgId){
  const s = document.getElementById("ecStartTime").value;
  const e = document.getElementById("ecEndTime").value;
  const startTime = s ? new Date(s).toISOString() : null;
  const endTime = e ? new Date(e).toISOString() : null;
  
  if(startTime && endTime && new Date(startTime) >= new Date(endTime)){
    toast("Start must be before end","error"); 
    return; 
  }
  
  const status = (startTime && new Date() < new Date(startTime)) ? 'scheduled' : 'active';
  
  try{ 
    await updateDoc(doc(db,"organizations",orgId), { 
      electionSettings: { startTime, endTime }, 
      electionStatus: status 
    }); 
    toast("Schedule saved","success"); 
  } catch(e){ 
    console.error(e); 
    toast("Save failed","error"); 
  }
}

async function ecClearTimes(orgId){
  if(!confirm("Clear schedule?")) return;
  try{ 
    await updateDoc(doc(db,"organizations",orgId), { 
      electionSettings: {}, 
      electionStatus: 'active' 
    }); 
    toast("Schedule cleared","success"); 
    // Refresh settings tab
    const meta = (await getDoc(doc(db,"organizations",orgId))).data(); 
    renderECSettings(meta); 
  } catch(e){ 
    console.error(e); 
    toast("Clear failed","error"); 
  }
}

async function ecGeneratePublicToken(orgId){
  if(!confirm("Generate public results link?")) return;
  try{ 
    const token = Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,6); 
    await updateDoc(doc(db,"organizations",orgId), { 
      publicEnabled: true, 
      publicToken: token 
    }); 
    toast("Public link generated","success"); 
    // Refresh settings tab
    const meta = (await getDoc(doc(db,"organizations",orgId))).data(); 
    renderECSettings(meta); 
  } catch(e){ 
    console.error(e); 
    toast("Generate failed","error"); 
  }
}

async function ecCopyPublicLink(orgId){
  try{ 
    const meta = (await getDoc(doc(db,"organizations",orgId))).data(); 
    if(!meta.publicToken){ 
      toast("No public link generated yet","error"); 
      return; 
    } 
    const link = `${window.location.origin}${window.location.pathname}?org=${orgId}&token=${meta.publicToken}`; 
    await navigator.clipboard.writeText(link); 
    toast("Link copied to clipboard","success"); 
  } catch(e){ 
    console.error(e); 
    toast("Copy failed","error"); 
  }
}

async function ecDeclareResults(orgId){
  if(!confirm("Declare final results? This will lock voting permanently.")) return;
  try{ 
    await updateDoc(doc(db,"organizations",orgId), { 
      electionStatus: 'declared', 
      resultsDeclaredAt: new Date().toISOString() 
    }); 
    toast("Results declared! Voting is now locked.","success"); 
    // Refresh settings tab
    const meta = (await getDoc(doc(db,"organizations",orgId))).data(); 
    renderECSettings(meta); 
    // Optionally send emails
    await sendResultsToAll(orgId);
  } catch(e){ 
    console.error(e); 
    toast("Declare failed","error"); 
  }
}

async function sendResultsToAll(orgId){
  try {
    const meta = (await getDoc(doc(db,"organizations",orgId))).data();
    const votersSnap = await getDocs(collection(db,"organizations",orgId,"voters"));
    const votesSnap = await getDocs(collection(db,"organizations",orgId,"votes"));
    const votes = []; votesSnap.forEach(s => votes.push(s.data()));
    
    // Build summary
    let summary = `Results for ${meta.name}:\n`;
    summary += `Total Voters: ${meta.voterCount || 0}\n`;
    summary += `Votes Cast: ${votes.length}\n`;
    summary += `Participation: ${meta.voterCount ? Math.round((votes.length/meta.voterCount)*100) : 0}%\n\n`;
    
    // Send to each voter (demo)
    votersSnap.forEach(v => {
      const email = decodeURIComponent(v.id);
      NotificationService.sendResults(email, { 
        orgName: meta.name, 
        voterName: v.data()?.name || '', 
        resultsSummary: summary, 
        totalVotes: votes.length, 
        totalVoters: meta.voterCount || 0, 
        participationRate: meta.voterCount ? Math.round((votes.length/meta.voterCount)*100) : 0, 
        resultsLink: `${window.location.origin}${window.location.pathname}?org=${orgId}`
      });
    });
    
    console.log("Results sent to all voters");
  } catch(e) {
    console.error("Error sending results:", e);
  }
}

// ---------------- Voter flow - Enhanced with direct links ----------------
let currentVoterEmail = null;

async function prepareVoterForOrg(orgId){
  try{
    const snap = await getDoc(doc(db,"organizations",orgId));
    if(!snap.exists()){ toast("Organization not found","error"); return false; }
    const org = snap.data();
    
    // Check for voter parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const voterParam = urlParams.get('voter');
    
    if(voterParam){
      // Direct link access
      const voterEmail = decodeURIComponent(voterParam);
      const vSnap = await getDoc(doc(db,"organizations",orgId,"voters", encodeURIComponent(voterEmail)));
      
      if(vSnap.exists()){
        const voter = vSnap.data();
        if(voter.hasVoted){
          toast("You have already voted","error");
          return false;
        }
        
        currentVoterEmail = voterEmail;
        currentOrgId = orgId;
        
        // Update top navigation for direct link
        document.querySelector('#votingScreen .app-title').textContent = org.name;
        document.querySelector('#votingScreen .app-subtext').textContent = 'Direct Voting Link';
        
        await renderVotingScreen(org);
        showScreen("votingScreen");
        return false; // Don't show voter login screen
      }
    }
    
    if(org.electionStatus === 'declared'){ 
      toast("Results declared — opening public view","info"); 
      renderPublicResults(orgId); 
      showScreen("publicScreen"); 
      return false; 
    }
    
    currentOrgId = orgId;
    // Update top navigation for voter login
    document.querySelector('#voterLoginScreen .app-title').textContent = org.name;
    document.querySelector('#voterLoginScreen .app-subtext').textContent = 'Voter Login Portal';
    
    return true;
    
  }catch(e){ console.error(e); toast("Prepare failed","error"); return false; }
}

// Modified sendVoterOTP to work with phone numbers
async function sendVoterOTP(){
  const email = (document.getElementById("voter-email").value||"").trim().toLowerCase();
  if(!email){ toast("Enter email","error"); return; }
  if(!currentOrgId){ toast("Select organization first","error"); return; }
  
  try{
    const vSnap = await getDoc(doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(email)));
    if(!vSnap.exists()){ 
      // Try searching by phone
      const votersSnap = await getDocs(collection(db,"organizations",currentOrgId,"voters"));
      let foundVoter = null;
      votersSnap.forEach(doc => {
        if(doc.data().phone && validatePhoneNumber(email) === doc.data().phone){
          foundVoter = { id: doc.id, ...doc.data() };
        }
      });
      
      if(!foundVoter){ toast("Email/Phone not registered","error"); return; }
      
      // Found by phone
      if(foundVoter.hasVoted){ toast("You have already voted","error"); return; }
      
      const meta = (await getDoc(doc(db,"organizations",currentOrgId))).data();
      const now = new Date();
      if(meta.electionSettings?.startTime && now < new Date(meta.electionSettings.startTime)){ 
        toast("Voting hasn't started","error"); 
        return; 
      }
      if(meta.electionSettings?.endTime && now > new Date(meta.electionSettings.endTime)){ 
        toast("Voting ended","error"); 
        return; 
      }
      
      const otp = Math.floor(100000 + Math.random()*900000).toString();
      session.voterOTP = { 
        orgId: currentOrgId, 
        email: foundVoter.id, 
        otp, 
        ts: new Date().toISOString() 
      }; 
      saveSession();
      
      document.getElementById("voter-otp-group").classList.remove("hidden"); 
      document.getElementById("voter-send-otp").textContent = "Resend OTP";
      
      // Send OTP via SMS (demo)
      const phoneDisplay = formatPhoneForDisplay(foundVoter.phone);
      alert(`📱 SMS OTP to ${phoneDisplay}: ${otp}\n(This is a demo — in production use SMS service.)`);
      toast("OTP sent to your phone (demo)","success");
      return;
    }
    
    const v = vSnap.data();
    if(v.hasVoted){ toast("You have already voted","error"); return; }
    const meta = (await getDoc(doc(db,"organizations",currentOrgId))).data();
    const now = new Date();
    if(meta.electionSettings?.startTime && now < new Date(meta.electionSettings.startTime)){ 
      toast("Voting hasn't started","error"); 
      return; 
    }
    if(meta.electionSettings?.endTime && now > new Date(meta.electionSettings.endTime)){ 
      toast("Voting ended","error"); 
      return; 
    }
    
    const otp = Math.floor(100000 + Math.random()*900000).toString();
    session.voterOTP = { orgId: currentOrgId, email, otp, ts: new Date().toISOString() }; 
    saveSession();
    
    document.getElementById("voter-otp-group").classList.remove("hidden"); 
    document.getElementById("voter-send-otp").textContent = "Resend OTP";
    
    // Send OTP via email (demo)
    alert(`📧 Email OTP to ${email}: ${otp}\n(This is a demo — in production use email service.)`);
    toast("OTP sent to your email (demo)","success");
    
  }catch(e){ console.error(e); toast("OTP failed","error"); }
}

async function verifyVoterOTP(){
  const email = (document.getElementById("voter-email").value||"").trim().toLowerCase();
  const otp = (document.getElementById("voter-otp").value||"").trim();
  if(!email || !otp){ toast("Enter email & OTP","error"); return; }
  if(!session.voterOTP || session.voterOTP.email !== email || session.voterOTP.otp !== otp){ 
    toast("Invalid OTP","error"); 
    return; 
  }
  if((new Date() - new Date(session.voterOTP.ts)) > (15*60*1000)){ 
    toast("OTP expired","error"); 
    session.voterOTP = null; 
    saveSession(); 
    return; 
  }
  currentVoterEmail = email;
  const orgMeta = (await getDoc(doc(db,"organizations",currentOrgId))).data();
  
  // Update top navigation
  document.querySelector('#votingScreen .app-title').textContent = orgMeta.name;
  document.querySelector('#votingScreen .app-subtext').textContent = 'Voting Session';
  
  await renderVotingScreen(orgMeta);
  showScreen("votingScreen");
  session.voterOTP = null; 
  saveSession();
}

async function renderVotingScreen(org){
  const box = document.getElementById("votingContent"); 
  box.innerHTML = `<div class="empty-state"><div class="spinner"></div><h3>Loading Voting Ballot...</h3></div>`;
  
  try {
    const voterSnap = await getDoc(doc(db,"organizations",org.id,"voters", encodeURIComponent(currentVoterEmail)));
    const voter = voterSnap.data();
    
    let html = `<div class="card" style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>Voting as ${voter.name||currentVoterEmail}</strong>
          <div class="subtext" style="margin-top:4px">${currentVoterEmail}</div>
          <div class="subtext" style="margin-top:8px"><i class="fas fa-info-circle"></i> Select one candidate per position</div>
        </div>
        <img src="${org.logoUrl||defaultLogoDataUrl()}" style="width:60px;height:60px;border-radius:10px">
      </div>
    </div>`;
    
    const posSnap = await getDocs(collection(db,"organizations",org.id,"positions")); 
    const positions = []; 
    posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    if(positions.length === 0) {
      html += `<div class="card"><p class="subtext">No positions available for voting.</p></div>`;
    } else {
      for(const pos of positions){
        html += `<div class="voting-card">
          <h4 style="color:#00eaff;margin-bottom:10px">${pos.name}</h4>
          <div class="subtext" style="margin-bottom:15px">Select one candidate</div>`;
        
        const candsSnap = await getDocs(collection(db,"organizations",org.id,"candidates")); 
        const cands = [];
        candsSnap.forEach(s => { 
          if(s.data().positionId === pos.id) cands.push({ id:s.id, ...s.data() }); 
        });
        
        if(cands.length === 0) {
          html += `<div class="subtext" style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px">No candidates for this position</div>`;
        } else {
          cands.forEach(c => { 
            html += `<label style="display:block;margin-top:10px;padding:12px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(0,255,255,0.06);cursor:pointer;transition:all 0.3s">
              <input type="radio" name="pos-${pos.id}" value="${c.id}" style="margin-right:8px">
              <strong>${c.name}</strong> 
              ${c.tagline? `<div class="subtext" style="margin-top:4px">${c.tagline}</div>`: ''}
            </label>`; 
          });
        }
        html += `</div>`;
      }
    }
    
    box.innerHTML = html;
  } catch(e) {
    console.error(e);
    box.innerHTML = `<div class="card"><p class="subtext" style="color:#ff4444">Error loading voting ballot</p></div>`;
  }
}

async function submitVote(){
  if(!currentVoterEmail || !currentOrgId){ toast("Not authenticated","error"); return; }
  try{
    const metaRef = doc(db,"organizations",currentOrgId); 
    const metaSnap = await getDoc(metaRef); 
    const org = metaSnap.data();
    
    if(org.electionStatus === 'declared'){ toast("Voting closed","error"); return; }
    
    const posSnap = await getDocs(collection(db,"organizations",currentOrgId,"positions")); 
    const positions = []; 
    posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    const choices = {}; 
    let allSelected = true;
    for(const pos of positions){
      const sel = document.querySelector(`input[name="pos-${pos.id}"]:checked`);
      if(sel) choices[pos.id] = sel.value; 
      else { allSelected=false; break; }
    }
    
    if(!allSelected){ toast("Please vote for all positions","error"); return; }
    
    const voteRef = doc(db,"organizations",currentOrgId,"votes", encodeURIComponent(currentVoterEmail));
    const receipt = Math.random().toString(36).slice(2,12).toUpperCase();
    await setDoc(voteRef, { 
      choices, 
      timestamp: new Date().toISOString(), 
      receipt 
    });
    
    await updateDoc(doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(currentVoterEmail)), { 
      hasVoted: true 
    });
    
    toast("Vote recorded","success");
    
    NotificationService.sendReceipt(currentVoterEmail, { 
      receiptId: receipt, 
      orgName: org.name, 
      voterName: (await getDoc(doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(currentVoterEmail)))).data().name, 
      timestamp: new Date().toISOString(), 
      positionsCount: Object.keys(choices).length, 
      resultsLink: `${window.location.origin}${window.location.pathname}?org=${currentOrgId}` 
    }).catch(e=>console.error(e));
    
    alert(`✅ Vote recorded!\nReceipt: ${receipt}\nThank you.`);
    currentVoterEmail = null; 
    showScreen("gatewayScreen");
    
  }catch(e){ console.error(e); toast("Submit failed","error"); }
}

// Public results
async function renderPublicResults(orgId){
  try{
    const metaSnap = await getDoc(doc(db,"organizations",orgId));
    if(!metaSnap.exists()){ toast("Organization not found","error"); return; }
    const org = metaSnap.data();
    
    // Update top navigation
    document.querySelector('#publicScreen .app-title').textContent = org.name;
    document.querySelector('#publicScreen .app-subtext').textContent = 'Election Results - Public View';
    
    const box = document.getElementById("publicResults"); 
    box.innerHTML = `<div class="empty-state"><div class="spinner"></div><h3>Loading election results...</h3></div>`;
    
    const votesSnap = await getDocs(collection(db,"organizations",orgId,"votes")); 
    const votes = []; 
    votesSnap.forEach(s=>votes.push(s.data()));
    
    const posSnap = await getDocs(collection(db,"organizations",orgId,"positions")); 
    const positions = []; 
    posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    const totalVoters = org.voterCount || 0;
    const votesCast = votes.length;
    const participation = totalVoters ? Math.round((votesCast/totalVoters)*100) : 0;
    
    let html = `<div class="card" style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-around;text-align:center;gap:20px">
        <div>
          <div class="label">Total Voters</div>
          <div style="font-weight:bold;font-size:32px;color:#00eaff">${totalVoters}</div>
        </div>
        <div>
          <div class="label">Votes Cast</div>
          <div style="font-weight:bold;font-size:32px;color:#00eaff">${votesCast}</div>
        </div>
        <div>
          <div class="label">Participation</div>
          <div style="font-weight:bold;font-size:32px;color:#00eaff">${participation}%</div>
        </div>
      </div>
    </div>`;
    
    if(positions.length === 0) {
      html += `<div class="card"><p class="subtext">No positions in this election.</p></div>`;
    } else {
      for(const pos of positions){
        const counts = {}; 
        let total = 0; 
        votes.forEach(v => { 
          if(v.choices && v.choices[pos.id]){
            counts[v.choices[pos.id]] = (counts[v.choices[pos.id]]||0)+1; 
            total++; 
          } 
        });
        
        const candSnap = await getDocs(collection(db,"organizations",orgId,"candidates")); 
        const cands = []; 
        candSnap.forEach(s=>{ 
          if(s.data().positionId === pos.id) cands.push({ id:s.id, ...s.data() }); 
        });
        
        html += `<div class="card" style="margin-bottom:20px">
          <h4 style="color:#00eaff;margin-bottom:15px">${pos.name}</h4>`;
        
        if(cands.length===0) {
          html += `<div class="subtext" style="padding:10px">No candidates</div>`;
        } else {
          cands.forEach(c => {
            const n = counts[c.id] || 0; 
            const pct = total ? Math.round((n/total)*100) : 0;
            html += `<div style="display:flex;align-items:center;gap:12px;margin-top:12px;padding:12px;border-radius:8px;background:rgba(255,255,255,0.02)">
              <img src="${c.photo||defaultAvatar(c.name)}" style="width:50px;height:50px;border-radius:8px">
              <div style="flex:1">
                <strong>${c.name}</strong>
                ${c.tagline?`<div class="subtext">${c.tagline}</div>`:''}
                <div class="subtext" style="margin-top:6px">${n} votes • ${pct}%</div>
              </div>
              <div style="width:120px">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${pct}%"></div>
                </div>
              </div>
            </div>`;
          });
        }
        html += `</div>`;
      }
    }
    box.innerHTML = html;
  }catch(e){ console.error(e); toast("Load results failed","error"); }
}

// ---------------- UI wiring & initialization ----------------
function initializeTabs(){
  // Super admin tabs (now with Delete tab)
  document.querySelectorAll('[data-super-tab]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-super-tab]').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.getAttribute('data-super-tab');
      document.querySelectorAll('#superAdminPanel .tab-content').forEach(c => 
        c.classList.toggle('active', c.id === 'superContent-'+t)
      );
      if(t === 'orgs') renderSuperOrgs(); 
      else if(t === 'settings') renderSuperSettings();
      else if(t === 'delete') renderSuperDelete();
    };
  });
}

// ---------------- DOMContentLoaded - Enhanced ----------------
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Enhanced Neon Voting System with Material You Style Initializing...");
  
  // Wire gateway buttons
  document.getElementById("btn-superadmin").onclick = () => showScreen("superAdminLoginScreen");
  document.getElementById("btn-ec").onclick = () => showScreen("ecLoginScreen");
  document.getElementById("btn-voter").onclick = async () => { 
    const id = prompt("Organization ID:"); 
    if(!id) return; 
    const ok = await prepareVoterForOrg(id); 
    if(ok) showScreen("voterLoginScreen"); 
  };
  document.getElementById("btn-public").onclick = async () => { 
    const id = prompt("Org ID for results:"); 
    if(!id) return; 
    await renderPublicResults(id); 
    showScreen("publicScreen"); 
  };
  document.getElementById("btn-guest").onclick = () => { 
    showScreen("guestScreen"); 
  };
  
  // Back buttons
  document.getElementById("super-back").onclick = () => showScreen("gatewayScreen");
  document.getElementById("ec-back").onclick = () => showScreen("gatewayScreen");
  document.getElementById("voter-back").onclick = () => showScreen("gatewayScreen");
  document.getElementById("public-back").onclick = () => showScreen("gatewayScreen");
  document.getElementById("guest-back").onclick = () => showScreen("gatewayScreen");

  // Login buttons
  document.getElementById("super-login-btn").onclick = loginSuperAdmin;
  document.getElementById("ec-login-btn").onclick = loginEC;
  document.getElementById("voter-send-otp").onclick = sendVoterOTP;
  document.getElementById("voter-verify-otp").onclick = verifyVoterOTP;
  document.getElementById("submit-vote-btn").onclick = submitVote;

  // Logout buttons
  document.querySelectorAll(".logout-btn").forEach(b => {
    b.onclick = () => {
      if(currentOrgUnsub){ 
        try{ currentOrgUnsub(); } catch(e){} 
        currentOrgUnsub = null; 
      }
      // Clear auto-refresh interval
      if (outcomesRefreshInterval) {
        clearInterval(outcomesRefreshInterval);
        outcomesRefreshInterval = null;
      }
      
      session = {}; 
      saveSession(); 
      currentOrgId = null; 
      currentVoterEmail = null;
      currentOrgData = null;
      
      toast("Logged out","success"); 
      showScreen("gatewayScreen");
    };
  });

  initializeTabs();

  // Add click handlers for EC tabs
  document.querySelectorAll('#ecTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabName = this.getAttribute('data-ec-tab');
      
      // Start/stop auto-refresh based on tab
      if (tabName === 'outcomes' && currentOrgId) {
        startOutcomesAutoRefresh(currentOrgId);
      } else if (outcomesRefreshInterval) {
        clearInterval(outcomesRefreshInterval);
        outcomesRefreshInterval = null;
      }
      
      showECTab(tabName);
    });
  });

  // Check URL parameters for direct access
  const urlParams = new URLSearchParams(window.location.search);
  const orgParam = urlParams.get('org');
  const voterParam = urlParams.get('voter');
  const tokenParam = urlParams.get('token');
  const roleParam = urlParams.get('role');
  
  // Direct voter link
  if(orgParam && voterParam){
    const ok = await prepareVoterForOrg(orgParam);
    if(ok) showScreen("voterLoginScreen");
    return;
  }
  
  // Direct EC link
  if(orgParam && roleParam === 'ec'){
    document.getElementById("ec-org-id").value = orgParam;
    showScreen("ecLoginScreen");
    return;
  }
  
  // Public results link
  if(orgParam && tokenParam){
    try{
      const snap = await getDoc(doc(db, "organizations", orgParam));
      if(snap.exists()){
        const org = snap.data();
        if(org.publicEnabled && org.publicToken === tokenParam){
          await renderPublicResults(orgParam);
          showScreen("publicScreen");
          return;
        }
      }
    }catch(e){ console.error(e); }
  }
  
  // Restore session
  if(session && session.role === 'ec' && session.orgId){
    try{ 
      await openECPanel(session.orgId); 
      showScreen("ecPanel"); 
    } catch(e){ 
      console.warn("Session restore failed", e); 
      showScreen("gatewayScreen"); 
    }
  } else if(session && session.role === 'superadmin'){
    await renderSuperOrgs();
    showScreen("superAdminPanel");
  } else {
    showScreen("gatewayScreen");
  }

  toast("Enhanced Neon Voting System Ready!", "success");
});

// ---------------- Utility functions ----------------
function copyToClipboard(text){
  navigator.clipboard.writeText(text)
    .then(() => toast("Copied to clipboard", "success"))
    .catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast("Copied", "success");
    });
}

function closeModal(id){ 
  const el = document.getElementById(id); 
  if(el) el.remove(); 
}

// ---------------- Expose functions to window ----------------
window.openOrgAsEC = function(orgId){ 
  document.getElementById("ec-org-id").value = orgId; 
  showScreen("ecLoginScreen"); 
};

window.openOrgForVoter = function(orgId){ 
  (async () => { 
    if(await prepareVoterForOrg(orgId)) showScreen("voterLoginScreen"); 
  })(); 
};

window.renderPublicResults = renderPublicResults;
window.createNewOrg = createNewOrg;
window.changeSuperPassword = changeSuperPassword;
window.deleteOrgConfirm = deleteOrgConfirm;
window.revealPassword = revealPassword;
window.editOrgModal = editOrgModal;
window.saveOrgChanges = saveOrgChanges;
window.previewLogoEdit = previewLogoEdit;
window.showAddVoterModal = showAddVoterModal;
window.showBulkAddModal = showBulkAddModal;
window.bulkAddVoters = bulkAddVoters;
window.addVoter = addVoter;
window.closeModal = closeModal;
window.copyVoterLink = copyVoterLink;
window.removeVoter = removeVoter;
window.downloadVoterCSV = downloadVoterCSV;
window.showAddPositionModal = showAddPositionModal;
window.addPosition = addPosition;
window.deletePosition = deletePosition;
window.showAddCandidateModal = showAddCandidateModal;
window.addCandidate = addCandidate;
window.deleteCandidate = deleteCandidate;
window.ecSaveTimes = ecSaveTimes;
window.ecClearTimes = ecClearTimes;
window.ecGeneratePublicToken = ecGeneratePublicToken;
window.ecCopyPublicLink = ecCopyPublicLink;
window.ecDeclareResults = ecDeclareResults;
window.copyToClipboard = copyToClipboard;
window.showScreen = showScreen;
window.refreshOutcomes = refreshOutcomes;

// Missing function - changeSuperPassword
async function changeSuperPassword(){
  const np = document.getElementById("new-super-pass").value.trim();
  if(!np || np.length < 6){ toast("Password >= 6 chars","error"); return; }
  try{ 
    await setDoc(doc(db,"meta","superAdmin"), { password: np }, { merge: true }); 
    document.getElementById("new-super-pass").value=""; 
    toast("Password changed","success"); 
  } catch(e){ 
    console.error(e); 
    toast("Change failed","error"); 
  }
}