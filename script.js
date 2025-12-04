// script.js — polished Firebase modular build (FIXED EC DASHBOARD)
// Usage: include <script type="module" src="script.js"></script> in index.html

// ---------------- Firebase imports ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// ---------------- Firebase config (use your project values) ----------------
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
const SESSION_KEY = "neon_voting_session_v3";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
function saveSession(){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

function toast(msg, type="info"){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = msg;
  t.style.background = type === "error" ? "#2b0000" : type === "success" ? "linear-gradient(90deg,#00C851,#007E33)" : "linear-gradient(90deg,#9D00FF,#00C3FF)";
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 3000);
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => { s.classList.remove("active"); s.setAttribute("aria-hidden","true"); });
  const el = document.getElementById(id);
  if(el){ el.classList.add("active"); el.setAttribute("aria-hidden","false"); window.scrollTo({top:0,behavior:'smooth'}); }
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

// ---------------- Email service (demo) ----------------
class EmailService {
  static async sendReceipt(email, data){
    console.log("Mock email receipt to", email, data);
    setTimeout(()=> alert(`Receipt (demo): ${data.receiptId} sent to ${email}`), 400);
    return { success: true };
  }
  static async sendResults(email, data){
    console.log("Mock email results to", email, data);
    setTimeout(()=> alert(`Results (demo) for ${data.orgName} sent to ${email}`), 400);
    return { success: true };
  }
}

// ---------------- SuperAdmin ----------------
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
  el.innerHTML = `<div class="card"><p class="subtext">Loading organizations...</p></div>`;
  try{
    const snaps = await getDocs(collection(db,"organizations"));
    const orgs = []; snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    if(orgs.length === 0){ el.innerHTML = `<div class="card"><p>No organizations yet.</p></div>`; return; }
    let html = `<div style="display:flex;gap:12px;flex-wrap:wrap">`;
    orgs.forEach(org => {
      html += `<div class="org-card">
        <div style="display:flex;gap:10px;align-items:center">
          <img src="${org.logoUrl || defaultLogoDataUrl()}" style="width:56px;height:56px;border-radius:8px;object-fit:cover">
          <div style="flex:1"><strong>${org.name}</strong><br><small class="subtext">ID: ${org.id}</small></div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;justify-content:space-between">
          <button class="btn neon-btn-outline" onclick="openOrgAsEC('${org.id}')">Open EC</button>
          <button class="btn neon-btn-outline" onclick="openOrgForVoter('${org.id}')">Open Voter</button>
          <button class="btn neon-btn-outline" onclick="deleteOrgConfirm('${org.id}','${org.name}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;
  }catch(e){ console.error(e); el.innerHTML = `<div class="card"><p>Error loading orgs</p></div>`; }
}

async function renderSuperSettings(){
  const el = document.getElementById("superContent-settings");
  el.innerHTML = `
    <div class="card">
      <h3>SuperAdmin Settings</h3>
      <label class="subtext">Change SuperAdmin Password</label>
      <input id="new-super-pass" class="input" placeholder="New password">
      <div style="margin-top:10px"><button class="btn neon-btn" onclick="changeSuperPassword()">Change Password</button></div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Create Organization</h3>
      <label class="subtext">Organization Name</label>
      <input id="new-org-name" class="input" placeholder="Name">
      <label class="subtext">EC Password</label>
      <input id="new-org-ec-pass" class="input" placeholder="EC password">
      <label class="subtext">Logo Image (optional)</label>
      <input id="new-org-logo-file" type="file" accept="image/*" class="input">
      <div style="margin-top:10px"><button class="btn neon-btn" onclick="createNewOrg()">Create Organization</button></div>
    </div>
  `;
}

async function changeSuperPassword(){
  const np = document.getElementById("new-super-pass").value.trim();
  if(!np || np.length < 6){ toast("Password >= 6 chars","error"); return; }
  try{ await setDoc(doc(db,"meta","superAdmin"), { password: np }, { merge: true }); document.getElementById("new-super-pass").value=""; toast("Password changed","success"); }
  catch(e){ console.error(e); toast("Change failed","error"); }
}

async function createNewOrg(){
  const name = (document.getElementById("new-org-name").value || "").trim();
  const ecPass = (document.getElementById("new-org-ec-pass").value || "").trim();
  const file = document.getElementById("new-org-logo-file").files?.[0];
  if(!name){ toast("Name required","error"); return; }
  if(!ecPass || ecPass.length < 6){ toast("EC password >=6 chars","error"); return; }
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
    const meta = { id, name, logoUrl: logoUrl || defaultLogoDataUrl(), createdAt: new Date().toISOString(), voterCount: 0, electionStatus: 'scheduled', electionSettings: {}, publicEnabled:false, publicToken:null, ecPassword: ecPass };
    await setDoc(orgRef, meta);
    document.getElementById("new-org-name").value = "";
    document.getElementById("new-org-ec-pass").value = "";
    document.getElementById("new-org-logo-file").value = "";
    toast(`Created org ${name}`,"success");
    await renderSuperOrgs();
  }catch(e){ console.error(e); toast("Create org failed","error"); }
}

function deleteOrgConfirm(orgId, orgName){
  if(!confirm(`Delete org "${orgName}" and all its data? This is permanent.`)) return;
  deleteDoc(doc(db,"organizations",orgId)).then(()=>{ toast("Organization metadata removed","success"); renderSuperOrgs(); }).catch(e=>{ console.error(e); toast("Delete failed","error"); });
}

// ---------------- EC flows ----------------
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
    currentOrgData = org; // Store org data globally
    document.getElementById("ecOrgName").textContent = org.name;
    document.getElementById("ecOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    const statusBadge = document.getElementById("ecStatusBadge");
    if(statusBadge){ 
      statusBadge.textContent = (org.electionStatus || 'active'); 
      statusBadge.style.color = org.electionStatus === 'declared' ? '#00ffaa' : '#00c3ff'; 
    }
    
    // Update active tab content
    const activeTab = document.querySelector('#ecTabs .tab-btn.active')?.getAttribute('data-ec-tab') || 'voters';
    showECTab(activeTab, org);
    
  }, err => console.error("onSnapshot org err", err));
  
  // Initial load
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
  // Use passed orgData or current global data
  const dataToUse = orgData || currentOrgData;
  if(!dataToUse && currentOrgId) {
    // Try to fetch if not available
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
  
  document.querySelectorAll('#ecPanel .tab-content').forEach(c => 
    c.classList.toggle('active', c.id === 'ecContent-'+tabName)
  );
  
  // Load appropriate content
  if(tabName === 'voters') renderECVoters(dataToUse);
  else if(tabName === 'positions') renderECPositions(dataToUse);
  else if(tabName === 'candidates') renderECCandidates(dataToUse);
  else if(tabName === 'settings') renderECSettings(dataToUse);
}

// Voters tab — using subcollection organizations/{orgId}/voters
async function renderECVoters(org){
  const el = document.getElementById("ecContent-voters");
  el.innerHTML = `<div class="card"><p class="subtext">Loading voters...</p></div>`;
  try{
    const snap = await getDocs(collection(db,"organizations",org.id,"voters"));
    const voters = []; snap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3>Voters (${voters.length})</h3>
      <div style="display:flex;gap:8px"><button class="btn neon-btn" onclick="showAddVoterModal()">Add Voter</button>
      <button class="btn neon-btn-outline" onclick="downloadVoterCSV('${org.id}')"><i class="fas fa-download"></i> Export CSV</button></div></div>`;
    if(voters.length===0) html += `<div class="card"><p>No voters yet.</p></div>`;
    else {
      voters.forEach(v => {
        const email = decodeURIComponent(v.id);
        html += `<div class="list-item"><div style="display:flex;gap:10px;align-items:center"><img src="${defaultAvatar(v.name||email)}" style="width:44px;height:44px;border-radius:8px">
          <div><strong>${v.name||email}</strong><br><small class="subtext">${email}</small><br><small class="subtext">Added: ${v.addedAt? new Date(v.addedAt).toLocaleDateString() : 'N/A'}</small></div></div>
          <div style="display:flex;gap:8px;align-items:center"><span class="subtext" style="padding:6px;border-radius:6px;background:${v.hasVoted?'rgba(0,200,81,0.08)':'rgba(255,193,7,0.06)'}">${v.hasVoted? '✅ Voted': '⏳ Pending'}</span>
          <button class="btn neon-btn-outline" onclick="removeVoter('${org.id}','${v.id}')"><i class="fas fa-trash"></i></button></div></div>`;
      });
    }
    el.innerHTML = html;
  }catch(e){ console.error(e); el.innerHTML = `<div class="card"><p>Error loading voters</p></div>`; }
}

function showAddVoterModal(){
  const modal = document.createElement('div'); modal.id = 'addVoterModal'; modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3>Add Voter</h3>
    <button class="btn neon-btn-outline" onclick="closeModal('addVoterModal')"><i class="fas fa-times"></i></button></div>
    <label class="subtext">Email</label><input id="newVoterEmail" class="input" placeholder="voter@example.com">
    <label class="subtext">Full name</label><input id="newVoterName" class="input" placeholder="John Doe">
    <div style="display:flex;gap:8px;margin-top:16px"><button class="btn neon-btn" onclick="addVoter()">Add Voter</button>
    <button class="btn neon-btn-outline" onclick="closeModal('addVoterModal')">Cancel</button></div></div>`;
  document.body.appendChild(modal);
}

function closeModal(id){ const el = document.getElementById(id); if(el) el.remove(); }

async function addVoter(){
  const email = (document.getElementById('newVoterEmail').value||"").trim().toLowerCase();
  const name = (document.getElementById('newVoterName').value||"").trim() || email.split('@')[0];
  if(!email || !email.includes('@')){ toast("Enter valid email","error"); return; }
  try{
    const vRef = doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(email));
    const snap = await getDoc(vRef);
    if(snap.exists()){ toast("Voter exists","error"); return; }
    await setDoc(vRef, { name, hasVoted:false, addedAt:new Date().toISOString() });
    // increment count
    const orgRef = doc(db,"organizations",currentOrgId);
    const metaSnap = await getDoc(orgRef); const meta = metaSnap.data();
    await updateDoc(orgRef, { voterCount: (meta.voterCount||0) + 1 });
    closeModal('addVoterModal'); toast("Voter added","success");
    renderECVoters(meta);
  }catch(e){ console.error(e); toast("Add voter failed","error"); }
}

async function removeVoter(orgId, voterId){
  if(!confirm("Remove voter and their vote?")) return;
  try{
    await deleteDoc(doc(db,"organizations",orgId,"voters", voterId));
    // remove vote doc if exists
    try{ await deleteDoc(doc(db,"organizations",orgId,"votes", voterId)); } catch(e){}
    const orgRef = doc(db,"organizations",orgId);
    const metaSnap = await getDoc(orgRef); const meta = metaSnap.data();
    await updateDoc(orgRef, { voterCount: Math.max(0,(meta.voterCount||0)-1) });
    toast("Voter removed","success"); renderECVoters(meta);
  }catch(e){ console.error(e); toast("Remove failed","error"); }
}

async function downloadVoterCSV(orgId){
  try{
    const snap = await getDocs(collection(db,"organizations",orgId,"voters"));
    let csv = "email,name,hasVoted,addedAt\n";
    snap.forEach(s => { const v = s.data(); csv += `"${decodeURIComponent(s.id)}","${v.name||''}","${v.hasVoted? 'Voted':'Pending'}","${v.addedAt||''}"\n`; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `voters-${orgId}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast("CSV downloaded","success");
  }catch(e){ console.error(e); toast("Export failed","error"); }
}

// Positions tab (subcollection orgs/{orgId}/positions)
async function renderECPositions(org){
  const el = document.getElementById("ecContent-positions");
  el.innerHTML = `<div class="card"><p class="subtext">Loading positions...</p></div>`;
  try{
    const snap = await getDocs(collection(db,"organizations",org.id,"positions"));
    const positions = []; snap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3>Positions (${positions.length})</h3>
      <button class="btn neon-btn" onclick="showAddPositionModal()">Add Position</button></div>`;
    if(positions.length===0) html += `<div class="card"><p>No positions yet.</p></div>`;
    else positions.forEach(p => { html += `<div class="list-item"><div><strong>${p.name}</strong><br><small class="subtext">ID: ${p.id}</small></div>
      <div style="display:flex;gap:8px"><button class="btn neon-btn-outline" onclick="deletePosition('${org.id}','${p.id}')"><i class="fas fa-trash"></i></button></div></div>`; });
    el.innerHTML = html;
  }catch(e){ console.error(e); el.innerHTML = `<div class="card"><p>Error loading positions</p></div>`; }
}

function showAddPositionModal(){
  const modal = document.createElement('div'); modal.id='addPositionModal'; modal.className='modal-overlay';
  modal.innerHTML = `<div class="modal-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3>Add Position</h3>
    <button class="btn neon-btn-outline" onclick="closeModal('addPositionModal')"><i class="fas fa-times"></i></button></div>
    <label class="subtext">Position name</label><input id="newPositionName" class="input" placeholder="e.g., President">
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn neon-btn" onclick="addPosition()">Add Position</button><button class="btn neon-btn-outline" onclick="closeModal('addPositionModal')">Cancel</button></div></div>`;
  document.body.appendChild(modal);
}

async function addPosition(){
  const name = (document.getElementById("newPositionName").value||"").trim();
  if(!name){ toast("Enter position name","error"); return; }
  try{
    const id = 'pos-' + Math.random().toString(36).slice(2,8);
    await setDoc(doc(db,"organizations",currentOrgId,"positions", id), { name, addedAt: new Date().toISOString() });
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
    candSnap.forEach(c => { if(c.data().positionId === posId) delOps.push(deleteDoc(doc(db,"organizations",orgId,"candidates", c.id))); });
    await Promise.all(delOps);
    toast("Position removed","success"); 
    const meta = (await getDoc(doc(db,"organizations",orgId))).data(); 
    renderECPositions(meta);
  }catch(e){ console.error(e); toast("Delete failed","error"); }
}

// Candidates tab (subcollection orgs/{orgId}/candidates)
async function renderECCandidates(org){
  const el = document.getElementById("ecContent-candidates");
  el.innerHTML = `<div class="card"><p class="subtext">Loading candidates...</p></div>`;
  try{
    const candSnap = await getDocs(collection(db,"organizations",org.id,"candidates"));
    const cands = []; candSnap.forEach(s => cands.push({ id:s.id, ...s.data() }));
    const posSnap = await getDocs(collection(db,"organizations",org.id,"positions"));
    const positions = []; posSnap.forEach(s => positions.push({ id:s.id, ...s.data() }));
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3>Candidates (${cands.length})</h3>
      <button class="btn neon-btn" onclick="showAddCandidateModal()">Add Candidate</button></div>`;
    if(cands.length===0) html += `<div class="card"><p>No candidates yet.</p></div>`;
    else {
      // group by position
      const grouped = {};
      cands.forEach(c => { grouped[c.positionId] = grouped[c.positionId] || []; grouped[c.positionId].push(c); });
      for(const posId in grouped){
        const posName = (positions.find(p=>p.id===posId)||{name:'Unknown'}).name;
        html += `<div class="card"><h4>${posName}</h4>`;
        grouped[posId].forEach(c => {
          html += `<div class="list-item" style="margin-top:8px"><div style="display:flex;gap:10px;align-items:center"><img src="${c.photo||defaultAvatar(c.name)}" class="candidate-photo">
            <div><strong>${c.name}</strong><br><small class="subtext">${c.tagline||''}</small></div></div>
            <div style="display:flex;gap:8px"><button class="btn neon-btn-outline" onclick="deleteCandidate('${org.id}','${c.id}')"><i class="fas fa-trash"></i></button></div></div>`;
        });
        html += `</div>`;
      }
    }
    el.innerHTML = html;
  }catch(e){ console.error(e); el.innerHTML = `<div class="card"><p>Error loading candidates</p></div>`; }
}

function showAddCandidateModal(){
  const modal = document.createElement('div'); modal.id='addCandidateModal'; modal.className='modal-overlay';
  modal.innerHTML = `<div class="modal-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3>Add Candidate</h3>
    <button class="btn neon-btn-outline" onclick="closeModal('addCandidateModal')"><i class="fas fa-times"></i></button></div>
    <label class="subtext">Name</label><input id="newCandidateName" class="input" placeholder="Full name">
    <label class="subtext">Tagline</label><input id="newCandidateTagline" class="input" placeholder="Slogan">
    <label class="subtext">Position</label><select id="newCandidatePosition" class="input"><option value=''>Loading positions...</option></select>
    <label class="subtext">Photo (optional)</label><input id="newCandidatePhotoFile" type="file" accept="image/*" class="input">
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn neon-btn" onclick="addCandidate()">Add</button><button class="btn neon-btn-outline" onclick="closeModal('addCandidateModal')">Cancel</button></div></div>`;
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
  }catch(e){ console.error(e); sel.innerHTML = '<option value="">Error loading positions</option>'; }
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

// EC Settings - FIXED VERSION
async function renderECSettings(org){
  const el = document.getElementById("ecContent-settings");
  if(!el) return;
  
  const s = org.electionSettings?.startTime ? new Date(org.electionSettings.startTime).toISOString().slice(0,16) : '';
  const e = org.electionSettings?.endTime ? new Date(org.electionSettings.endTime).toISOString().slice(0,16) : '';
  const declared = org.electionStatus === 'declared';
  
  el.innerHTML = `
    <div class="card">
      <h3>Election Settings</h3>
      <label class="subtext">Start Date & Time</label>
      <input id="ecStartTime" type="datetime-local" class="input" value="${s}">
      <label class="subtext">End Date & Time</label>
      <input id="ecEndTime" type="datetime-local" class="input" value="${e}">
      <div style="margin-top:10px;display:flex;gap:8px">
        <button id="ecSaveTimesBtn" class="btn neon-btn">Save Schedule</button>
        <button id="ecClearTimesBtn" class="btn neon-btn-outline">Clear</button>
      </div>
    </div>
    
    <div class="card" style="margin-top:12px">
      <h3>Public Results</h3>
      <p class="subtext">Generate a public link for results</p>
      <div style="display:flex;gap:8px">
        <button id="ecGenTokenBtn" class="btn neon-btn">${org.publicEnabled ? 'Regenerate Link' : 'Generate Link'}</button>
        <button id="ecCopyLinkBtn" class="btn neon-btn-outline" ${org.publicEnabled && org.publicToken ? '' : 'disabled'}>Copy Link</button>
      </div>
      ${org.publicEnabled && org.publicToken ? 
        `<div style="margin-top:12px;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;word-break:break-all">
          <code>${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}</code>
        </div>` : 
        ''}
    </div>
    
    <div class="card" style="margin-top:12px">
      <h3>Declare Results</h3>
      <p class="subtext">Declare final results (locks voting)</p>
      <button id="ecDeclareBtn" class="btn neon-btn" ${declared ? 'disabled' : ''}>
        ${declared ? 'Declared' : 'Declare Final Results'}
      </button>
      ${declared ? 
        `<div class="subtext" style="margin-top:8px">
          Declared at: ${org.resultsDeclaredAt ? new Date(org.resultsDeclaredAt).toLocaleString() : 'N/A'}
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
      EmailService.sendResults(email, { 
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

// ---------------- Voter flow ----------------
let currentVoterEmail = null;

async function prepareVoterForOrg(orgId){
  try{
    const snap = await getDoc(doc(db,"organizations",orgId));
    if(!snap.exists()){ toast("Organization not found","error"); return false; }
    const org = snap.data();
    if(org.electionStatus === 'declared'){ 
      toast("Results declared — opening public view","info"); 
      renderPublicResults(orgId); 
      showScreen("publicScreen"); 
      return false; 
    }
    currentOrgId = orgId;
    document.getElementById("voterOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    document.getElementById("voterOrgName").textContent = org.name;
    document.getElementById("voter-otp-group").classList.add("hidden");
    return true;
  }catch(e){ console.error(e); toast("Prepare failed","error"); return false; }
}

async function sendVoterOTP(){
  const email = (document.getElementById("voter-email").value||"").trim().toLowerCase();
  if(!email || !email.includes('@')){ toast("Enter valid email","error"); return; }
  if(!currentOrgId){ toast("Select organization first","error"); return; }
  try{
    const vSnap = await getDoc(doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(email)));
    if(!vSnap.exists()){ toast("Email not registered","error"); return; }
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
    alert(`Demo OTP for ${email}: ${otp}\n(This is a demo — in production use email service.)`);
    toast("OTP generated (demo)","success");
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
  await renderVotingScreen(orgMeta);
  showScreen("votingScreen");
  session.voterOTP = null; 
  saveSession();
}

async function renderVotingScreen(org){
  const box = document.getElementById("votingContent"); 
  box.innerHTML = "";
  const voterSnap = await getDoc(doc(db,"organizations",org.id,"voters", encodeURIComponent(currentVoterEmail)));
  const voter = voterSnap.data();
  const info = document.createElement("div"); 
  info.className = "card";
  info.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <strong>Voting as ${voter.name||currentVoterEmail}</strong>
      <div class="subtext">${currentVoterEmail}</div>
      <div class="subtext" style="margin-top:6px">Select one candidate per position</div>
    </div>
    <img src="${org.logoUrl||defaultLogoDataUrl()}" style="width:60px;height:60px;border-radius:10px">
  </div>`;
  box.appendChild(info);
  
  const posSnap = await getDocs(collection(db,"organizations",org.id,"positions")); 
  const positions = []; 
  posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
  
  for(const pos of positions){
    const card = document.createElement('div'); 
    card.className = 'card'; 
    card.style.marginTop = '12px';
    card.innerHTML = `<h4>${pos.name}</h4><div class="subtext">Select one candidate</div>`;
    
    const candsSnap = await getDocs(collection(db,"organizations",org.id,"candidates")); 
    const cands = [];
    candsSnap.forEach(s => { 
      if(s.data().positionId === pos.id) cands.push({ id:s.id, ...s.data() }); 
    });
    
    if(cands.length === 0) {
      card.innerHTML += `<div class="subtext" style="padding:12px">No candidates</div>`;
    } else {
      cands.forEach(c => { 
        card.innerHTML += `
          <label style="display:block;margin-top:10px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);cursor:pointer">
            <input type="radio" name="pos-${pos.id}" value="${c.id}" style="margin-right:8px">
            <strong>${c.name}</strong> 
            ${c.tagline? `<br><small class="subtext">${c.tagline}</small>`: ''}
          </label>
        `; 
      });
    }
    box.appendChild(card);
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
    
    EmailService.sendReceipt(currentVoterEmail, { 
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
    document.getElementById("publicOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    document.getElementById("publicOrgName").textContent = org.name;
    const box = document.getElementById("publicResults"); 
    box.innerHTML = "";
    
    const votesSnap = await getDocs(collection(db,"organizations",orgId,"votes")); 
    const votes = []; 
    votesSnap.forEach(s=>votes.push(s.data()));
    
    const posSnap = await getDocs(collection(db,"organizations",orgId,"positions")); 
    const positions = []; 
    posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    box.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:20px">
          <div><div class="label">Total Voters</div><div style="font-weight:bold;font-size:24px;color:#00eaff">${org.voterCount||0}</div></div>
          <div><div class="label">Votes Cast</div><div style="font-weight:bold;font-size:24px;color:#00eaff">${votes.length}</div></div>
          <div><div class="label">Participation</div><div style="font-weight:bold;font-size:24px;color:#00eaff">${org.voterCount ? Math.round((votes.length/org.voterCount)*100) : 0}%</div></div>
        </div>
      </div>
    `;
    
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
      
      const card = document.createElement('div'); 
      card.className='card'; 
      card.style.marginTop='12px'; 
      card.innerHTML = `<h4>${pos.name}</h4>`;
      
      if(cands.length===0) {
        card.innerHTML += `<div class="subtext" style="padding:10px">No candidates</div>`;
      } else {
        cands.forEach(c => {
          const n = counts[c.id] || 0; 
          const pct = total ? Math.round((n/total)*100) : 0;
          card.innerHTML += `
            <div style="display:flex;align-items:center;gap:12px;margin-top:12px;padding:12px;border-radius:8px;background:rgba(255,255,255,0.02)">
              <img src="${c.photo||defaultAvatar(c.name)}" style="width:60px;height:60px;border-radius:8px">
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
            </div>
          `;
        });
      }
      box.appendChild(card);
    }
  }catch(e){ console.error(e); toast("Load results failed","error"); }
}

// ---------------- UI wiring & tab fix ----------------
function initializeTabs(){
  // Super admin tabs
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
    };
  });
  
  // EC tabs - FIXED
  document.querySelectorAll('[data-ec-tab]').forEach(btn => {
    btn.onclick = () => {
      const t = btn.getAttribute('data-ec-tab');
      showECTab(t);
    };
  });
}

// ---------------- DOMContentLoaded ----------------
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Neon Voting System Initializing...");
  
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
    renderGuestContent(); 
    showScreen("guestScreen"); 
  };
  
  // Back buttons
  document.getElementById("super-back").onclick = () => showScreen("gatewayScreen");
  document.getElementById("ec-back").onclick = () => showScreen("gatewayScreen");
  if(document.getElementById("voter-back")) {
    document.getElementById("voter-back").addEventListener('click', () => showScreen("gatewayScreen"));
  }
  if(document.getElementById("public-back")) {
    document.getElementById("public-back").addEventListener('click', () => showScreen("gatewayScreen"));
  }
  if(document.getElementById("guest-back")) {
    document.getElementById("guest-back").addEventListener('click', () => showScreen("gatewayScreen"));
  }

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

  // Restore session for EC if present
  if(session && session.role === 'ec' && session.orgId){
    try{ 
      await openECPanel(session.orgId); 
      showScreen("ecPanel"); 
    } catch(e){ 
      console.warn("Session restore failed", e); 
      showScreen("gatewayScreen"); 
    }
  } else {
    showScreen("gatewayScreen");
  }

  toast("Neon Voting System Ready!", "success");
});

// ---------------- Helpers exposed to HTML ----------------
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
window.showAddVoterModal = showAddVoterModal;
window.addVoter = addVoter;
window.closeModal = closeModal;
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

// ---------------- Guest content ----------------
function renderGuestContent(){
  const el = document.getElementById("guestContent");
  if(!el) return;
  el.innerHTML = `
    <div class="card">
      <h3>Neon Voting System</h3>
      <p class="subtext">Secure voting with Firestore subcollections per organization.</p>
    </div>
    <div class="card" style="margin-top:12px">
      <h4>How it works</h4>
      <ol style="padding-left:18px;margin-top:12px">
        <li>SuperAdmin creates organizations</li>
        <li>EC manages voters, positions & candidates</li>
        <li>Voters receive OTP & vote</li>
        <li>Results are published & declared</li>
      </ol>
    </div>
  `;
}