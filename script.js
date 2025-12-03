// script.js (Enterprise subcollections) — type=module
// COMPLETE FIXED VERSION WITH WORKING TABS

// Firebase imports (modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";

/* ---------- Your Firebase config ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

/* ---------- Initialize Firebase ---------- */
const firebaseApp = initializeApp(firebaseConfig);
try { getAnalytics(firebaseApp); } catch(e){ /* optional */ }
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

/* ---------- Helpers & Session ---------- */
const SESSION_KEY = "neon_enterprise_session_v1";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
function saveSession(){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

function toast(msg, type="info"){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = msg;
  t.style.background = type === "error" ? "#ff4444" : type === "success" ? "#00C851" : "linear-gradient(90deg,#9D00FF,#00C3FF)";
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 3000);
}

/* ---------- Small UI helpers ---------- */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => { 
    s.classList.remove("active"); 
    s.setAttribute("aria-hidden","true"); 
  });
  const el = document.getElementById(id);
  if(el){ 
    el.classList.add("active"); 
    el.setAttribute("aria-hidden","false"); 
    window.scrollTo({top:0,behavior:'smooth'}); 
  }
}

/* ---------- Default images ---------- */
function defaultLogoDataUrl(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#08102a"/><text x="50%" y="55%" font-size="26" text-anchor="middle" fill="#9D00FF" font-family="Inter, Arial">NEON</text></svg>`);
}
function defaultAvatar(name){
  const initials = (name || "User").split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#07233b"/><text x="50%" y="55%" font-size="60" text-anchor="middle" fill="#9beaff" font-family="Inter, Arial">${initials}</text></svg>`);
}

/* ---------- Utility for file upload ---------- */
function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ---------- SuperAdmin flows ---------- */
async function loginSuperAdmin(){
  const pass = document.getElementById("super-admin-pass").value.trim();
  if(!pass){ toast("Enter password","error"); return; }
  try{
    const ref = doc(db, "meta", "superadmin");
    const snap = await getDoc(ref);
    if(!snap.exists()){
      // create initial admin password if none
      const defaultPass = "admin123";
      await setDoc(ref, { password: defaultPass });
      if(pass === defaultPass){
        session.role = "superadmin"; saveSession();
        await renderSuperOrgs();
        showScreen("superAdminPanel");
        toast("SuperAdmin created and logged in (admin123)", "success");
        document.getElementById("super-admin-pass").value = "";
        return;
      } else {
        toast("Wrong password for first-login. Try 'admin123'","error");
        return;
      }
    }
    const cfg = snap.data();
    if(cfg.password === pass){
      session.role = "superadmin"; saveSession();
      await renderSuperOrgs();
      showScreen("superAdminPanel");
      toast("SuperAdmin logged in", "success");
      document.getElementById("super-admin-pass").value = "";
    } else {
      toast("Wrong password","error");
    }
  }catch(e){
    console.error(e); toast("SuperAdmin login error","error");
  }
}

async function renderSuperOrgs(){
  const el = document.getElementById("superContent-orgs");
  el.innerHTML = `<div class="card"><p class="subtext">Loading organizations...</p></div>`;
  try{
    const snaps = await getDocs(collection(db,"organizations"));
    const orgs = [];
    snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    if(orgs.length === 0){
      el.innerHTML = `<div class="card"><p>No organizations yet.</p></div>`;
      return;
    }
    let html = `<div style="display:flex;gap:12px;flex-wrap:wrap">`;
    orgs.forEach(org => {
      html += `
        <div class="org-card">
          <div style="display:flex;gap:10px;align-items:center">
            <img src="${org.logoUrl || defaultLogoDataUrl()}" style="width:56px;height:56px;border-radius:8px;object-fit:cover" alt="${org.name}">
            <div style="flex:1">
              <strong>${org.name}</strong><br><small class="subtext">ID: ${org.id}</small>
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;justify-content:space-between">
            <button class="btn neon-btn-outline" onclick="openOrgAsEC('${org.id}')">Open EC</button>
            <button class="btn neon-btn-outline" onclick="deleteOrgConfirm('${org.id}','${org.name}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    el.innerHTML = html;
  }catch(e){
    console.error(e); el.innerHTML = `<div class="card"><p>Error loading orgs</p></div>`;
  }
}

async function renderSuperSettings(){
  const el = document.getElementById("superContent-settings");
  el.innerHTML = `
    <div class="card">
      <h3>SuperAdmin Settings</h3>
      <label class="subtext">Change SuperAdmin Password</label>
      <input id="new-super-pass" class="input" type="password" placeholder="New password">
      <div style="margin-top:8px"><button class="btn neon-btn" onclick="changeSuperPassword()">Change Password</button></div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Create Organization</h3>
      <label class="subtext">Name</label>
      <input id="new-org-name" class="input" placeholder="Organization name">
      <label class="subtext" style="margin-top:8px">EC Password</label>
      <input id="new-org-ec-pass" class="input" placeholder="EC password (min 6 chars)">
      <label class="subtext" style="margin-top:8px">Logo (file)</label>
      <input id="new-org-logo-file" type="file" accept="image/*" class="input">
      <div style="margin-top:10px"><button class="btn neon-btn" onclick="createNewOrg()">Create Organization</button></div>
    </div>
  `;
}

async function changeSuperPassword(){
  const np = document.getElementById("new-super-pass").value.trim();
  if(!np || np.length < 6){ toast("Password should be >=6 chars","error"); return; }
  try{
    await setDoc(doc(db,"meta","superadmin"), { password: np }, { merge:true });
    document.getElementById("new-super-pass").value = "";
    toast("SuperAdmin password changed","success");
  }catch(e){ console.error(e); toast("Failed to change password","error"); }
}

async function createNewOrg(){
  const name = document.getElementById("new-org-name").value.trim();
  const ecPass = document.getElementById("new-org-ec-pass").value.trim();
  const file = document.getElementById("new-org-logo-file").files?.[0];

  if(!name){ toast("Org name required","error"); return; }
  if(!ecPass || ecPass.length < 6){ toast("EC password >=6 chars","error"); return; }

  try{
    const id = name.toLowerCase().replace(/[^a-z0-9\-]/g,'-') + '-' + Math.random().toString(36).slice(2,6);
    const orgRef = doc(db,"organizations", id);

    let logoUrl = "";
    if(file){
      const data = await fileToDataUrl(file);
      const sref = storageRef(storage, `orgs/${id}/logo.png`);
      await uploadString(sref, data, 'data_url');
      logoUrl = await getDownloadURL(sref);
    }

    const meta = {
      id, name, logoUrl: logoUrl || defaultLogoDataUrl(), createdAt: new Date().toISOString(),
      voterCount: 0, electionStatus: 'scheduled', electionSettings: {}, publicEnabled: false, publicToken: null,
      ecPassword: ecPass
    };
    await setDoc(orgRef, meta);
    toast(`Created org ${name} (ID: ${id})`,"success");
    document.getElementById("new-org-name").value = "";
    document.getElementById("new-org-ec-pass").value = "";
    document.getElementById("new-org-logo-file").value = "";
    await renderSuperOrgs();
  }catch(e){ console.error(e); toast("Failed to create org","error"); }
}

function deleteOrgConfirm(orgId, orgName){
  if(!confirm(`Delete org "${orgName}" and ALL its subcollections? This is permanent.`)) return;
  deleteOrg(orgId);
}
async function deleteOrg(orgId){
  try{
    await deleteDoc(doc(db,"organizations",orgId));
    toast("Organization metadata removed.","success");
    await renderSuperOrgs();
  }catch(e){ console.error(e); toast("Failed to delete org","error"); }
}

/* ---------- EC flows ---------- */
let currentOrgId = null;
let currentOrgUnsub = null;

async function loginEC(){
  const id = document.getElementById("ec-org-id").value.trim();
  const pass = document.getElementById("ec-pass").value.trim();
  if(!id || !pass){ toast("Enter org ID and password","error"); return; }
  try{
    const ref = doc(db,"organizations",id);
    const snap = await getDoc(ref);
    if(!snap.exists()){ toast("Organization not found","error"); return; }
    const org = snap.data();
    if(org.ecPassword !== pass){ toast("Wrong EC password","error"); return; }
    // set session and load panel
    session.role = "ec"; session.orgId = id; saveSession();
    await openECPanel(id);
    document.getElementById("ec-org-id").value = ""; 
    document.getElementById("ec-pass").value = "";
    showScreen("ecPanel"); 
    toast("EC logged in","success");
  }catch(e){ console.error(e); toast("EC login failed","error"); }
}

async function openECPanel(orgId){
  currentOrgId = orgId;
  // detach previous listener
  if(currentOrgUnsub) { 
    try { currentOrgUnsub(); } catch(e) {} 
    currentOrgUnsub = null; 
  }
  
  const metaRef = doc(db,"organizations",orgId);
  currentOrgUnsub = onSnapshot(metaRef, snap => {
    if(!snap.exists()){ 
      toast("Org removed","error"); 
      showScreen("gatewayScreen"); 
      return; 
    }
    const org = snap.data();
    document.getElementById("ecOrgName").textContent = org.name;
    document.getElementById("ecOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    
    // Update status badge
    const statusBadge = document.getElementById("ecStatusBadge");
    if(statusBadge){
      statusBadge.textContent = org.electionStatus || 'active';
      statusBadge.style.background = org.electionStatus === 'declared' ? 'rgba(0,255,170,0.1)' : 
                                    org.electionStatus === 'active' ? 'rgba(0,195,255,0.1)' : 
                                    'rgba(157,0,255,0.1)';
      statusBadge.style.color = org.electionStatus === 'declared' ? '#00ffaa' : 
                               org.electionStatus === 'active' ? '#00c3ff' : 
                               '#9d00ff';
    }
    
    // Refresh current tab content
    const activeTab = document.querySelector('#ecTabs .tab-btn.active')?.getAttribute('data-ec-tab') || 'voters';
    showECTab(activeTab, org);
  }, err => console.error("org meta onSnapshot err", err));
  
  // Initial load
  const metaSnap = await getDoc(metaRef);
  if(metaSnap.exists()) {
    const org = metaSnap.data();
    document.getElementById("ecOrgName").textContent = org.name;
    document.getElementById("ecOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    showECTab('voters', org);
  }
}

function showECTab(tabName, orgData){
  // Highlight tab
  document.querySelectorAll('#ecTabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-ec-tab') === tabName);
  });
  
  // Show content
  document.querySelectorAll('#ecPanel .tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'ecContent-' + tabName);
  });
  
  // Load content
  if(tabName === 'voters') renderECVoters(orgData);
  if(tabName === 'positions') renderECPositions(orgData);
  if(tabName === 'candidates') renderECCandidates(orgData);
  if(tabName === 'settings') renderECSettings(orgData);
}

/* --- Voters Tab --- */
async function renderECVoters(org){
  const el = document.getElementById("ecContent-voters");
  el.innerHTML = `<div class="card"><p class="subtext">Loading voters...</p></div>`;
  
  try{
    const votersSnap = await getDocs(collection(db,"organizations",org.id,"voters"));
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3>Voters (${voters.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddVoterModal()">
            <i class="fas fa-plus"></i> Add Voter
          </button>
          <button class="btn neon-btn-outline" onclick="downloadVoterCSV('${org.id}')">
            <i class="fas fa-download"></i> Export CSV
          </button>
        </div>
      </div>
    `;
    
    if(voters.length === 0) {
      html += `<div class="card"><p>No voters registered yet.</p></div>`;
    } else {
      voters.forEach(v => {
        const email = decodeURIComponent(v.id);
        html += `
          <div class="list-item">
            <div style="display:flex;gap:10px;align-items:center">
              <img src="${defaultAvatar(v.name || email)}" style="width:44px;height:44px;border-radius:8px;object-fit:cover">
              <div>
                <strong>${v.name || email}</strong><br>
                <small class="subtext">${email}</small><br>
                <small class="subtext">Added: ${new Date(v.addedAt).toLocaleDateString()}</small>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="subtext" style="padding:4px 8px;border-radius:6px;background:${
                v.hasVoted ? 'rgba(0,200,81,0.1)' : 'rgba(255,193,7,0.1)'
              }">
                ${v.hasVoted ? '✅ Voted' : '⏳ Pending'}
              </span>
              <button class="btn neon-btn-outline" onclick="removeVoter('${org.id}','${v.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    
    el.innerHTML = html;
  } catch(e) {
    console.error(e); 
    el.innerHTML = `<div class="card"><p class="subtext">Error loading voters</p></div>`;
  }
}

function showAddVoterModal(){
  const modal = document.createElement('div');
  modal.id = 'addVoterModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3>Add Voter</h3>
        <button class="btn neon-btn-outline" onclick="closeModal('addVoterModal')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <label class="subtext">Email</label>
      <input id="newVoterEmail" class="input" placeholder="voter@example.com">
      <label class="subtext" style="margin-top:8px">Full name</label>
      <input id="newVoterName" class="input" placeholder="John Doe">
      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn neon-btn" onclick="addVoter()">Add Voter</button>
        <button class="btn neon-btn-outline" onclick="closeModal('addVoterModal')">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeModal(id){ 
  const el = document.getElementById(id); 
  if(el) el.remove(); 
}

async function addVoter(){
  const email = (document.getElementById('newVoterEmail').value || "").trim().toLowerCase();
  const name = (document.getElementById('newVoterName').value || "").trim() || email.split('@')[0];
  
  if(!email || !email.includes('@')) { 
    toast("Enter valid email","error"); 
    return; 
  }
  
  try{
    const votersRef = doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(email));
    const snap = await getDoc(votersRef);
    if(snap.exists()){
      toast("Voter already exists","error"); 
      return; 
    }
    
    await setDoc(votersRef, { 
      name, 
      hasVoted: false, 
      addedAt: new Date().toISOString() 
    });
    
    // Update voter count
    const orgRef = doc(db,"organizations",currentOrgId);
    const metaSnap = await getDoc(orgRef); 
    const meta = metaSnap.data();
    await updateDoc(orgRef, { 
      voterCount: (meta.voterCount || 0) + 1 
    });
    
    closeModal('addVoterModal'); 
    toast("Voter added successfully","success");
    
    // Refresh voters list
    renderECVoters(meta);
  } catch(e) { 
    console.error(e); 
    toast("Failed to add voter","error"); 
  }
}

async function removeVoter(orgId, voterIdEncoded){
  if(!confirm("Remove voter (and their vote if present)?")) return;
  try{
    // Remove voter doc
    await deleteDoc(doc(db,"organizations",orgId,"voters", voterIdEncoded));
    
    // Remove vote doc if exists
    try {
      await deleteDoc(doc(db,"organizations",orgId,"votes", voterIdEncoded));
    } catch(e) { /* Vote may not exist */ }
    
    // Update voter count
    const orgRef = doc(db,"organizations",orgId);
    const metaSnap = await getDoc(orgRef); 
    const meta = metaSnap.data();
    await updateDoc(orgRef, { 
      voterCount: Math.max(0,(meta.voterCount||0)-1) 
    });
    
    toast("Voter removed","success");
    renderECVoters(meta);
  } catch(e) { 
    console.error(e); 
    toast("Failed to remove voter","error"); 
  }
}

async function downloadVoterCSV(orgId){
  try{
    const votersSnap = await getDocs(collection(db,"organizations",orgId,"voters"));
    let csv = "email,name,hasVoted,addedAt\n";
    votersSnap.forEach(s => {
      const v = s.data();
      csv += `"${decodeURIComponent(s.id)}","${v.name || ''}","${v.hasVoted ? 'Voted' : 'Pending'}","${v.addedAt||''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `voters-${orgId}.csv`; 
    document.body.appendChild(a); 
    a.click(); 
    a.remove(); 
    URL.revokeObjectURL(url);
    toast("CSV downloaded","success");
  } catch(e) { 
    console.error(e); 
    toast("Export failed","error"); 
  }
}

/* --- Positions Tab --- */
async function renderECPositions(org){
  const el = document.getElementById("ecContent-positions");
  el.innerHTML = `<div class="card"><p class="subtext">Loading positions...</p></div>`;
  
  try{
    const snap = await getDocs(collection(db,"organizations",org.id,"positions"));
    const positions = []; 
    snap.forEach(s => positions.push({ id:s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3>Positions (${positions.length})</h3>
        <button class="btn neon-btn" onclick="showAddPositionModal()">
          <i class="fas fa-plus"></i> Add Position
        </button>
      </div>
    `;
    
    if(positions.length === 0) {
      html += `<div class="card"><p>No positions yet. Add positions for candidates to run.</p></div>`;
    } else {
      positions.forEach(p => {
        html += `
          <div class="list-item">
            <div>
              <strong>${p.name}</strong><br>
              <small class="subtext">ID: ${p.id}</small>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="deletePosition('${org.id}','${p.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    el.innerHTML = html;
  } catch(e) {
    console.error(e); 
    el.innerHTML = `<div class="card"><p class="subtext">Error loading positions</p></div>`;
  }
}

function showAddPositionModal(){
  const modal = document.createElement('div'); 
  modal.id = 'addPositionModal'; 
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3>Add Position</h3>
        <button class="btn neon-btn-outline" onclick="closeModal('addPositionModal')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <label class="subtext">Position name</label>
      <input id="newPositionName" class="input" placeholder="e.g., President, Treasurer">
      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn neon-btn" onclick="addPosition()">Add Position</button>
        <button class="btn neon-btn-outline" onclick="closeModal('addPositionModal')">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function addPosition(){
  const name = (document.getElementById('newPositionName').value || "").trim();
  if(!name){ 
    toast("Enter position name","error"); 
    return; 
  }
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
  } catch(e) { 
    console.error(e); 
    toast("Failed to add position","error"); 
  }
}

async function deletePosition(orgId, posId){
  if(!confirm("Delete position and all its candidates? This will also remove votes for this position.")) return;
  try{
    // Remove position doc
    await deleteDoc(doc(db,"organizations",orgId,"positions", posId));
    
    // Remove candidates with this positionId
    const candSnap = await getDocs(collection(db,"organizations",orgId,"candidates"));
    const toDelete = [];
    candSnap.forEach(c => { 
      if(c.data().positionId === posId) {
        toDelete.push(deleteDoc(doc(db,"organizations",orgId,"candidates", c.id)));
      }
    });
    await Promise.all(toDelete);
    
    toast("Position removed","success");
    const meta = (await getDoc(doc(db,"organizations",orgId))).data();
    renderECPositions(meta);
  } catch(e) { 
    console.error(e); 
    toast("Failed to delete position","error"); 
  }
}

/* --- Candidates Tab --- */
async function renderECCandidates(org){
  const el = document.getElementById("ecContent-candidates");
  el.innerHTML = `<div class="card"><p class="subtext">Loading candidates...</p></div>`;
  
  try{
    const candSnap = await getDocs(collection(db,"organizations",org.id,"candidates"));
    const cands = []; 
    candSnap.forEach(s=> cands.push({ id:s.id, ...s.data() }));
    
    const posSnap = await getDocs(collection(db,"organizations",org.id,"positions"));
    const positions = []; 
    posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3>Candidates (${cands.length})</h3>
        <button class="btn neon-btn" onclick="showAddCandidateModal()">
          <i class="fas fa-plus"></i> Add Candidate
        </button>
      </div>
    `;
    
    if(cands.length === 0) {
      html += `<div class="card"><p>No candidates yet. Add candidates for each position.</p></div>`;
    } else {
      // Group by position
      const grouped = {};
      cands.forEach(c => {
        grouped[c.positionId] = grouped[c.positionId] || [];
        grouped[c.positionId].push(c);
      });
      
      Object.entries(grouped).forEach(([posId, list]) => {
        const posName = (positions.find(p=>p.id===posId)||{name:'Unknown'}).name;
        html += `<div class="card" style="margin-bottom:16px"><h4>${posName}</h4>`;
        list.forEach(c => {
          html += `
            <div class="list-item" style="margin-top:8px">
              <div style="display:flex;gap:10px;align-items:center">
                <img src="${c.photo||defaultAvatar(c.name)}" class="candidate-photo">
                <div>
                  <strong>${c.name}</strong><br>
                  <small class="subtext">${c.tagline||''}</small>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn neon-btn-outline" onclick="deleteCandidate('${org.id}','${c.id}')">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      });
    }
    el.innerHTML = html;
  } catch(e) { 
    console.error(e); 
    el.innerHTML = `<div class="card"><p class="subtext">Error loading candidates</p></div>`;
  }
}

function showAddCandidateModal(){
  const modal = document.createElement('div'); 
  modal.id = 'addCandidateModal'; 
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3>Add Candidate</h3>
        <button class="btn neon-btn-outline" onclick="closeModal('addCandidateModal')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <label class="subtext">Name</label>
      <input id="newCandidateName" class="input" placeholder="Candidate full name">
      <label class="subtext" style="margin-top:8px">Tagline</label>
      <input id="newCandidateTagline" class="input" placeholder="Brief description or slogan">
      <label class="subtext" style="margin-top:8px">Position</label>
      <select id="newCandidatePosition" class="input">
        <option value="">Loading positions...</option>
      </select>
      <label class="subtext" style="margin-top:8px">Photo (optional)</label>
      <input id="newCandidatePhotoFile" type="file" accept="image/*" class="input">
      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn neon-btn" onclick="addCandidate()">Add Candidate</button>
        <button class="btn neon-btn-outline" onclick="closeModal('addCandidateModal')">Cancel</button>
      </div>
    </div>
  `;
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
  } catch(e) {
    console.error(e);
    sel.innerHTML = '<option value="">Error loading positions</option>';
  }
}

async function addCandidate(){
  const name = (document.getElementById('newCandidateName').value||"").trim();
  const tagline = (document.getElementById('newCandidateTagline').value||"").trim();
  const positionId = document.getElementById('newCandidatePosition').value;
  const file = document.getElementById('newCandidatePhotoFile').files?.[0];
  
  if(!name || !positionId){ 
    toast("Enter name & select position","error"); 
    return; 
  }
  
  try{
    const id = 'cand-' + Math.random().toString(36).slice(2,8);
    let photo = "";
    if(file){
      const data = await fileToDataUrl(file);
      const sref = storageRef(storage, `orgs/${currentOrgId}/candidates/${id}.png`);
      await uploadString(sref, data, 'data_url');
      photo = await getDownloadURL(sref);
    }
    
    await setDoc(doc(db,"organizations",currentOrgId,"candidates", id), { 
      id, 
      name, 
      tagline, 
      positionId, 
      photo: photo || defaultAvatar(name), 
      addedAt: new Date().toISOString() 
    });
    
    closeModal('addCandidateModal');
    const meta = (await getDoc(doc(db,"organizations",currentOrgId))).data();
    renderECCandidates(meta);
    toast("Candidate added","success");
  } catch(e) { 
    console.error(e); 
    toast("Failed to add candidate","error"); 
  }
}

async function deleteCandidate(orgId, candId){
  if(!confirm("Delete this candidate?")) return;
  try{
    await deleteDoc(doc(db,"organizations",orgId,"candidates", candId));
    toast("Candidate removed","success");
    const meta = (await getDoc(doc(db,"organizations",orgId))).data();
    renderECCandidates(meta);
  } catch(e) { 
    console.error(e); 
    toast("Delete failed","error"); 
  }
}

/* --- EC Settings Tab --- */
async function renderECSettings(org){
  const el = document.getElementById("ecContent-settings");
  
  const startTime = org.electionSettings?.startTime ? 
    new Date(org.electionSettings.startTime).toISOString().slice(0,16) : '';
  const endTime = org.electionSettings?.endTime ? 
    new Date(org.electionSettings.endTime).toISOString().slice(0,16) : '';
  const declared = org.electionStatus === 'declared';
  
  el.innerHTML = `
    <div class="card">
      <h3>Election Settings</h3>
      <label class="subtext">Start Date & Time (local)</label>
      <input id="ecStartTime" type="datetime-local" class="input" value="${startTime}">
      <label class="subtext" style="margin-top:8px">End Date & Time (local)</label>
      <input id="ecEndTime" type="datetime-local" class="input" value="${endTime}">
      <div style="display:flex;gap:8px;margin-top:15px">
        <button class="btn neon-btn" id="ecSaveTimesBtn">Save Schedule</button>
        <button class="btn neon-btn-outline" id="ecClearTimesBtn">Clear Schedule</button>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Public Results</h3>
      <p class="subtext" style="margin-bottom:12px">Generate a shareable link for public results</p>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn neon-btn" id="ecGenTokenBtn">
          ${org.publicEnabled ? 'Regenerate Link' : 'Generate Link'}
        </button>
        <button class="btn neon-btn-outline" id="ecCopyLinkBtn" 
                ${org.publicEnabled && org.publicToken ? '' : 'disabled'}>
          Copy Link
        </button>
      </div>
      ${org.publicEnabled && org.publicToken ? 
        `<div style="margin-top:12px;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px">
          <code style="font-size:12px">${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}</code>
        </div>` : 
        ''}
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Declare Results</h3>
      <p class="subtext" style="margin-bottom:12px">Once declared, no more votes can be cast</p>
      <button class="btn neon-btn" id="ecDeclareBtn" ${declared ? 'disabled' : ''}>
        ${declared ? 'Results Already Declared' : 'Declare Final Results'}
      </button>
      ${declared ? 
        `<div class="subtext" style="margin-top:12px">
          Declared at: ${org.resultsDeclaredAt ? new Date(org.resultsDeclaredAt).toLocaleString() : 'N/A'}
        </div>` : 
        ''}
    </div>
  `;
  
  // Wire up buttons
  setTimeout(() => {
    document.getElementById("ecSaveTimesBtn").onclick = () => ecSaveTimes(org.id);
    document.getElementById("ecClearTimesBtn").onclick = () => ecClearTimes(org.id);
    document.getElementById("ecGenTokenBtn").onclick = () => ecGeneratePublicToken(org.id);
    document.getElementById("ecCopyLinkBtn").onclick = () => ecCopyPublicLink(org.id);
    document.getElementById("ecDeclareBtn").onclick = () => ecDeclareResults(org.id);
  }, 50);
}

async function ecSaveTimes(orgId){
  try{
    const s = document.getElementById("ecStartTime").value;
    const e = document.getElementById("ecEndTime").value;
    const startTime = s ? new Date(s).toISOString() : null;
    const endTime = e ? new Date(e).toISOString() : null;
    
    if(startTime && endTime && new Date(startTime) >= new Date(endTime)){
      toast("Start time must be before end time","error"); 
      return; 
    }
    
    const status = (startTime && new Date() < new Date(startTime)) ? 'scheduled' : 'active';
    await updateDoc(doc(db,"organizations",orgId), { 
      electionSettings: { startTime, endTime }, 
      electionStatus: status 
    });
    
    toast("Schedule saved","success");
  } catch(e) { 
    console.error(e); 
    toast("Save failed","error"); 
  }
}

async function ecClearTimes(orgId){
  if(!confirm("Clear election schedule?")) return;
  try{ 
    await updateDoc(doc(db,"organizations",orgId), { 
      electionSettings: {}, 
      electionStatus: 'active' 
    }); 
    toast("Schedule cleared","success");
    const meta = (await getDoc(doc(db,"organizations",orgId))).data();
    renderECSettings(meta);
  } catch(e) { 
    console.error(e); 
    toast("Clear failed","error"); 
  }
}

async function ecGeneratePublicToken(orgId){
  if(!confirm("Generate public link? Anyone with this link can view results.")) return;
  try{
    const token = Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,6);
    await updateDoc(doc(db,"organizations",orgId), { 
      publicEnabled: true, 
      publicToken: token 
    });
    
    toast("Public link generated","success");
    const meta = (await getDoc(doc(db,"organizations",orgId))).data();
    renderECSettings(meta);
  } catch(e) { 
    console.error(e); 
    toast("Failed to generate link","error"); 
  }
}

async function ecCopyPublicLink(orgId){
  try{
    const meta = (await getDoc(doc(db,"organizations",orgId))).data();
    if(!meta.publicToken){ 
      toast("No public link","error"); 
      return; 
    }
    const link = `${window.location.origin}${window.location.pathname}?org=${orgId}&token=${meta.publicToken}`;
    await navigator.clipboard.writeText(link);
    toast("Link copied to clipboard","success");
  } catch(e) { 
    console.error(e); 
    toast("Copy failed","error"); 
  }
}

async function ecDeclareResults(orgId){
  if(!confirm("Declare final results? This marks the election as declared and prevents further voting.")) return;
  try{
    await updateDoc(doc(db,"organizations",orgId), { 
      electionStatus: 'declared', 
      resultsDeclaredAt: new Date().toISOString() 
    });
    
    toast("Results declared successfully","success");
    const meta = (await getDoc(doc(db,"organizations",orgId))).data();
    renderECSettings(meta);
  } catch(e) { 
    console.error(e); 
    toast("Failed to declare results","error"); 
  }
}

/* ---------- Voter flow ---------- */
let currentVoterEmail = null;

async function prepareVoterForOrg(orgId){
  try{
    const snap = await getDoc(doc(db,"organizations",orgId));
    if(!snap.exists()){ 
      toast("Organization not found","error"); 
      return false; 
    }
    const org = snap.data();
    
    // If results declared, show public results
    if(org.electionStatus === 'declared'){
      toast("Results already declared — opening public view","info"); 
      renderPublicResults(orgId); 
      showScreen("publicScreen"); 
      return false; 
    }
    
    currentOrgId = orgId;
    document.getElementById("voterOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    document.getElementById("voterOrgName").textContent = org.name;
    return true;
  } catch(e) { 
    console.error(e); 
    toast("Error preparing organization","error"); 
    return false; 
  }
}

async function sendVoterOTP(){
  const email = (document.getElementById("voter-email").value || "").trim().toLowerCase();
  if(!email || !email.includes('@')){ 
    toast("Enter valid email","error"); 
    return; 
  }
  if(!currentOrgId){ 
    toast("Select organization first","error"); 
    return; 
  }
  
  try{
    const vSnap = await getDoc(doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(email)));
    if(!vSnap.exists()){ 
      toast("Email not registered as voter","error"); 
      return; 
    }
    const v = vSnap.data();
    if(v.hasVoted){ 
      toast("You have already voted","error"); 
      return; 
    }
    
    // Check election schedule
    const meta = (await getDoc(doc(db,"organizations",currentOrgId))).data();
    const now = new Date();
    if(meta.electionSettings?.startTime && now < new Date(meta.electionSettings.startTime)){
      toast("Voting hasn't started yet","error"); 
      return; 
    }
    if(meta.electionSettings?.endTime && now > new Date(meta.electionSettings.endTime)){
      toast("Voting has ended","error"); 
      return; 
    }
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random()*900000).toString();
    session.voterOTP = { 
      orgId: currentOrgId, 
      email, 
      otp, 
      ts: new Date().toISOString() 
    };
    saveSession();
    
    document.getElementById("voter-otp-group").classList.remove("hidden");
    toast("OTP generated (demo). Check prompt.","success");
    
    // Demo: Show OTP in alert (in production, send via email/SMS)
    alert(`Demo OTP for ${email}: ${otp}\n\nIn production this would be delivered via email/SMS.`);
  } catch(e) { 
    console.error(e); 
    toast("Failed to send OTP","error"); 
  }
}

async function verifyVoterOTP(){
  const email = (document.getElementById("voter-email").value || "").trim().toLowerCase();
  const otp = (document.getElementById("voter-otp").value || "").trim();
  
  if(!email || !otp){ 
    toast("Enter email and OTP","error"); 
    return; 
  }
  
  if(!session.voterOTP || session.voterOTP.email !== email || session.voterOTP.otp !== otp){ 
    toast("Invalid OTP","error"); 
    return; 
  }
  
  // Check OTP expiry (15 minutes)
  if((new Date() - new Date(session.voterOTP.ts)) > (15*60*1000)){ 
    toast("OTP expired","error"); 
    session.voterOTP = null; 
    saveSession(); 
    return; 
  }
  
  // Success
  currentVoterEmail = email;
  
  // Load voting screen
  const orgMeta = (await getDoc(doc(db,"organizations",currentOrgId))).data();
  await renderVotingScreen(orgMeta);
  showScreen("votingScreen");
  
  // Clean up OTP
  session.voterOTP = null; 
  saveSession();
}

async function renderVotingScreen(org){
  const box = document.getElementById("votingContent");
  box.innerHTML = "";
  
  // Voter info
  const voterSnap = await getDoc(doc(db,"organizations",org.id,"voters", encodeURIComponent(currentVoterEmail)));
  const voter = voterSnap.data();
  
  const info = document.createElement("div"); 
  info.className = "card";
  info.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <strong>Voting as ${voter.name || currentVoterEmail}</strong>
        <div class="subtext">${currentVoterEmail}</div>
        <div class="subtext" style="margin-top:4px">Select one candidate for each position</div>
      </div>
      <img src="${org.logoUrl||defaultLogoDataUrl()}" style="width:50px;height:50px;border-radius:8px">
    </div>
  `;
  box.appendChild(info);
  
  // Positions and candidates
  const posSnap = await getDocs(collection(db,"organizations",org.id,"positions"));
  const positions = []; 
  posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
  
  for(const pos of positions){
    const card = document.createElement('div'); 
    card.className = "card";
    card.style.marginTop = "16px";
    card.innerHTML = `<h4>${pos.name}</h4><div class="subtext">Select one candidate</div>`;
    
    const candsSnap = await getDocs(collection(db,"organizations",org.id,"candidates"));
    const cands = []; 
    candsSnap.forEach(s=>{ 
      if(s.data().positionId === pos.id) cands.push({ id:s.id, ...s.data() }); 
    });
    
    if(cands.length === 0) {
      card.innerHTML += `<div style="padding:10px" class="subtext">No candidates for this position</div>`;
    } else {
      cands.forEach(c => {
        const id = `pos-${pos.id}`;
        card.innerHTML += `
          <label style="display:block;margin-top:10px;padding:10px;border:1px solid rgba(0,255,255,0.1);border-radius:8px;cursor:pointer">
            <input type="radio" name="${id}" value="${c.id}" style="margin-right:8px">
            <strong>${c.name}</strong>
            ${c.tagline ? `<br><small class="subtext">${c.tagline}</small>` : ''}
          </label>
        `;
      });
    }
    box.appendChild(card);
  }
}

async function submitVote(){
  if(!currentVoterEmail || !currentOrgId){ 
    toast("Not authenticated","error"); 
    return; 
  }
  
  try{
    const metaRef = doc(db,"organizations",currentOrgId);
    const metaSnap = await getDoc(metaRef);
    const org = metaSnap.data();
    
    // Check if voting is allowed
    if(org.electionStatus === 'declared'){
      toast("Voting has ended - results declared","error");
      return;
    }
    
    // Collect selections
    const positionsSnap = await getDocs(collection(db,"organizations",currentOrgId,"positions"));
    const positions = []; 
    positionsSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    const choices = {};
    let allSelected = true;
    
    for(const pos of positions){
      const sel = document.querySelector(`input[name="pos-${pos.id}"]:checked`);
      if(sel) {
        choices[pos.id] = sel.value; 
      } else {
        allSelected = false;
        break;
      }
    }
    
    if(!allSelected){ 
      toast("Please vote for all positions","error"); 
      return; 
    }
    
    // Create vote document
    const voteRef = doc(db,"organizations",currentOrgId,"votes", encodeURIComponent(currentVoterEmail));
    const receipt = Math.random().toString(36).slice(2,12).toUpperCase();
    
    await setDoc(voteRef, { 
      choices, 
      timestamp: new Date().toISOString(), 
      receipt 
    });
    
    // Mark voter as voted
    await updateDoc(doc(db,"organizations",currentOrgId,"voters", encodeURIComponent(currentVoterEmail)), { 
      hasVoted: true 
    });
    
    // Show receipt
    toast("Vote recorded successfully!","success");
    
    alert(`
      ✅ Vote Recorded Successfully!
      
      Organization: ${org.name}
      Voter: ${currentVoterEmail}
      Receipt: ${receipt}
      Time: ${new Date().toLocaleString()}
      
      Thank you for voting!
    `);
    
    // Return to gateway
    currentVoterEmail = null;
    showScreen("gatewayScreen");
    
  } catch(e) { 
    console.error(e); 
    toast("Failed to submit vote","error"); 
  }
}

/* ---------- Public results ---------- */
async function renderPublicResults(orgId){
  try{
    const metaSnap = await getDoc(doc(db,"organizations",orgId));
    if(!metaSnap.exists()){ 
      toast("Organization not found","error"); 
      return; 
    }
    
    const org = metaSnap.data();
    document.getElementById("publicOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    document.getElementById("publicOrgName").textContent = org.name;
    
    const box = document.getElementById("publicResults"); 
    box.innerHTML = "";
    
    // Get votes
    const votesSnap = await getDocs(collection(db,"organizations",orgId,"votes"));
    const votes = []; 
    votesSnap.forEach(s=>votes.push(s.data()));
    const votesCount = votes.length;
    
    // Get positions
    const posSnap = await getDocs(collection(db,"organizations",orgId,"positions"));
    const positions = []; 
    posSnap.forEach(s=>positions.push({ id:s.id, ...s.data() }));
    
    // Summary card
    box.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div>
            <div class="label">Total Voters</div>
            <div style="font-weight:bold;font-size:24px;color:#00eaff">${org.voterCount||0}</div>
          </div>
          <div>
            <div class="label">Votes Cast</div>
            <div style="font-weight:bold;font-size:24px;color:#00eaff">${votesCount}</div>
          </div>
          <div>
            <div class="label">Participation</div>
            <div style="font-weight:bold;font-size:24px;color:#00eaff">
              ${org.voterCount ? Math.round((votesCount/org.voterCount)*100) : 0}%
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Results by position
    for(const pos of positions){
      // Tally votes for this position
      const counts = {};
      let total = 0;
      votes.forEach(v => { 
        if(v.choices && v.choices[pos.id]) { 
          counts[v.choices[pos.id]] = (counts[v.choices[pos.id]]||0) + 1; 
          total++; 
        } 
      });
      
      // Get candidates for this position
      const candSnap = await getDocs(collection(db,"organizations",orgId,"candidates"));
      const cands = []; 
      candSnap.forEach(s=> { 
        if(s.data().positionId === pos.id) cands.push({ id:s.id, ...s.data() }); 
      });
      
      const card = document.createElement('div'); 
      card.className = 'card'; 
      card.style.marginTop = '16px';
      card.innerHTML = `<h4>${pos.name}</h4>`;
      
      if(cands.length === 0){
        card.innerHTML += `<div class="subtext" style="padding:10px">No candidates</div>`;
      } else {
        cands.forEach(c => {
          const n = counts[c.id] || 0;
          const pct = total ? Math.round((n/total)*100) : 0;
          card.innerHTML += `
            <div style="display:flex;align-items:center;gap:12px;margin-top:12px;padding:12px;border-radius:8px;background:rgba(255,255,255,0.03)">
              <img src="${c.photo||defaultAvatar(c.name)}" style="width:60px;height:60px;border-radius:8px">
              <div style="flex:1">
                <strong>${c.name}</strong>
                ${c.tagline ? `<div class="subtext">${c.tagline}</div>` : ''}
                <div class="subtext" style="margin-top:4px">${n} votes • ${pct}%</div>
              </div>
              <div style="width:120px">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg, #9D00FF, #00C3FF)"></div>
                </div>
              </div>
            </div>
          `;
        });
      }
      box.appendChild(card);
    }
    
  } catch(e) { 
    console.error(e); 
    toast("Failed to load results","error"); 
  }
}

/* ---------- Guest content ---------- */
function renderGuestContent(){
  const el = document.getElementById("guestContent");
  if(!el) return;
  el.innerHTML = `
    <div class="card">
      <h3>Neon Voting System</h3>
      <p class="subtext">Secure voting with enterprise-grade Firestore subcollections.</p>
    </div>
    <div class="card" style="margin-top:16px">
      <h4>How it works</h4>
      <ol style="padding-left:18px;margin-top:12px">
        <li><strong>SuperAdmin</strong> creates organizations</li>
        <li><strong>EC (Election Commission)</strong> manages voters, positions & candidates</li>
        <li><strong>Voters</strong> receive OTP and cast votes securely</li>
        <li><strong>Results</strong> are published and can be declared final</li>
      </ol>
    </div>
  `;
}

/* ---------- Wire up UI on DOMContentLoaded ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  // Gateway buttons
  document.getElementById("btn-superadmin").onclick = ()=> showScreen("superAdminLoginScreen");
  document.getElementById("btn-ec").onclick = ()=> showScreen("ecLoginScreen");
  document.getElementById("btn-voter").onclick = async ()=> {
    const id = prompt("Enter Organization ID:");
    if(!id) return;
    if(await prepareVoterForOrg(id)) showScreen("voterLoginScreen");
  };
  document.getElementById("btn-public").onclick = async ()=> {
    const id = prompt("Enter Organization ID for public results:");
    if(!id) return;
    await renderPublicResults(id);
    showScreen("publicScreen");
  };
  document.getElementById("btn-guest").onclick = ()=> { 
    renderGuestContent(); 
    showScreen("guestScreen"); 
  };
  
  // Back buttons
  document.getElementById("super-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("ec-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("voter-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("public-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("guest-back").onclick = ()=> showScreen("gatewayScreen");
  
  // Login buttons
  document.getElementById("super-login-btn").onclick = loginSuperAdmin;
  document.getElementById("ec-login-btn").onclick = loginEC;
  document.getElementById("voter-send-otp").onclick = sendVoterOTP;
  document.getElementById("voter-verify-otp").onclick = verifyVoterOTP;
  document.getElementById("submit-vote-btn").onclick = submitVote;
  
  // Logout buttons
  document.querySelectorAll(".logout-btn").forEach(b => b.onclick = ()=> {
    if(currentOrgUnsub) { 
      try{ currentOrgUnsub(); } catch(e){} 
      currentOrgUnsub = null; 
    }
    session = {}; 
    saveSession(); 
    currentOrgId = null; 
    currentVoterEmail = null;
    toast("Logged out","success"); 
    showScreen("gatewayScreen");
  });
  
  // Superadmin tab wiring
  document.querySelectorAll(".tab-btn[data-super-tab]").forEach(b => {
    b.onclick = ()=> {
      document.querySelectorAll(".tab-btn[data-super-tab]").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      const t = b.getAttribute("data-super-tab");
      document.querySelectorAll("#superAdminPanel .tab-content").forEach(c => {
        c.classList.remove("active");
        if(c.id === "superContent-" + t) c.classList.add("active");
      });
      if(t === 'orgs') renderSuperOrgs(); 
      else renderSuperSettings();
    };
  });
  
  // EC tab wiring
  document.querySelectorAll("#ecTabs .tab-btn").forEach(b => {
    b.onclick = (e) => {
      const tab = b.getAttribute("data-ec-tab");
      showECTab(tab);
    };
  });
  
  // Restore session if available
  if(session && session.role === 'ec' && session.orgId){
    try { 
      await openECPanel(session.orgId); 
      showScreen("ecPanel"); 
    } catch(e) { 
      console.warn("Session restore failed:", e); 
      showScreen("gatewayScreen"); 
    }
  } else {
    showScreen("gatewayScreen");
  }
  
  toast("Neon Voting App ready!", "success");
});

/* ---------- Expose functions for onclick attributes ---------- */
window.openOrgAsEC = function(orgId){ 
  document.getElementById("ec-org-id").value = orgId; 
  showScreen("ecLoginScreen"); 
};

window.openOrgForVoter = function(orgId){ 
  (async()=>{ 
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
// Replace your email function with something like:
async function sendEmail(data) {
    // Use Formspree or similar service
    const response = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}
// Example using Formspree
const formspreeEndpoint = 'https://formspree.io/f/YOUR_FORM_ID';

async function submitVote(email, candidate) {
    const response = await fetch(formspreeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            _replyto: email,
            _subject: `New Vote for ${candidate}`,
            message: `User voted for ${candidate}`,
            candidate: candidate,
            timestamp: new Date().toISOString()
        })
    });
    return response;
}
// ============================================
// SIMPLE CLIENT-SIDE ADMIN FOR NETLIFY
// ============================================

// Simple admin check (for demo - change password!)
const ADMIN_PASSWORD = "vote2024"; // CHANGE THIS!
const ADMIN_KEY = "voting_admin_auth";

function checkAdminAccess() {
    return localStorage.getItem(ADMIN_KEY) === "true";
}

function showAdminLogin() {
    const password = prompt("?? Enter SuperAdmin password:");
    if (password === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_KEY, "true");
        alert("? Admin access granted!");
        showAdminPanel();
        return true;
    } else {
        alert("? Invalid password!");
        return false;
    }
}

function showAdminPanel() {
    // Create or show admin panel
    let panel = document.getElementById("admin-panel");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "admin-panel";
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        `;
        panel.innerHTML = `
            <h3 style="margin:0 0 10px 0;">?? Admin Panel</h3>
            <button onclick="viewResults()" style="margin:5px;padding:8px;">View Results</button>
            <button onclick="exportData()" style="margin:5px;padding:8px;">Export Data</button>
            <button onclick="adminLogout()" style="margin:5px;padding:8px;">Logout</button>
        `;
        document.body.appendChild(panel);
    }
    panel.style.display = "block";
}

function adminLogout() {
    localStorage.removeItem(ADMIN_KEY);
    const panel = document.getElementById("admin-panel");
    if (panel) panel.style.display = "none";
    alert("Logged out from admin panel");
}

function viewResults() {
    alert("?? Admin stats would appear here");
    // Implement with Firebase data
}

function exportData() {
    alert("?? Exporting voting data...");
    // Implement data export
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
    // Check URL for admin access
    if (window.location.hash === "#admin") {
        if (!checkAdminAccess()) {
            showAdminLogin();
        } else {
            showAdminPanel();
        }
    }
    
    // Add admin login link if not present
    if (!document.querySelector(".admin-login")) {
        const adminLink = document.createElement("a");
        adminLink.href = "#admin";
        adminLink.className = "admin-login";
        adminLink.textContent = "Admin";
        adminLink.style.cssText = "position:fixed;bottom:10px;right:10px;padding:5px 10px;background:#333;color:white;text-decoration:none;";
        document.body.appendChild(adminLink);
    }
});

// ============================================
// TAB EVENT BINDING - FIX FOR NON-RESPONSIVE TABS
// ============================================

function initializeTabs() {
    console.log('Initializing tabs...');
    
    // 1. SuperAdmin Tabs
    const superTabButtons = document.querySelectorAll('[data-super-tab]');
    if (superTabButtons.length > 0) {
        console.log('Found SuperAdmin tabs:', superTabButtons.length);
        superTabButtons.forEach(button => {
            // Remove existing listeners to avoid duplicates
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function() {
                const tabName = this.getAttribute('data-super-tab');
                console.log('SuperAdmin tab clicked:', tabName);
                
                // Remove active class from all super tabs
                document.querySelectorAll('[data-super-tab]').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelectorAll('[id^="superContent-"]').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Add active to clicked tab
                this.classList.add('active');
                const contentId = 'superContent-' + tabName;
                const contentElement = document.getElementById(contentId);
                if (contentElement) {
                    contentElement.classList.add('active');
                } else {
                    console.error('Tab content not found:', contentId);
                }
                
                // Call existing function if it exists
                if (typeof showSuperTab === 'function') {
                    showSuperTab(tabName);
                }
            });
        });
    }
    
    // 2. EC (Election Commission) Tabs
    const ecTabButtons = document.querySelectorAll('[data-ec-tab]');
    if (ecTabButtons.length > 0) {
        console.log('Found EC tabs:', ecTabButtons.length);
        ecTabButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function() {
                const tabName = this.getAttribute('data-ec-tab');
                console.log('EC tab clicked:', tabName);
                
                // Remove active class from all EC tabs
                document.querySelectorAll('[data-ec-tab]').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelectorAll('[id^="ecContent-"]').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Add active to clicked tab
                this.classList.add('active');
                const contentId = 'ecContent-' + tabName;
                const contentElement = document.getElementById(contentId);
                if (contentElement) {
                    contentElement.classList.add('active');
                }
                
                // Get current org and call existing function
                const orgId = document.getElementById('ecOrgId')?.value || 
                             localStorage.getItem('currentOrgId');
                if (orgId && typeof showECTab === 'function') {
                    showECTab(tabName, { id: orgId });
                } else if (typeof showECTab === 'function') {
                    showECTab(tabName);
                }
            });
        });
    }
    
    // 3. Initialize first active tabs
    if (superTabButtons.length > 0) {
        const firstSuperTab = document.querySelector('[data-super-tab].active') || 
                             document.querySelector('[data-super-tab]');
        if (firstSuperTab) firstSuperTab.click();
    }
    
    if (ecTabButtons.length > 0) {
        const firstEcTab = document.querySelector('[data-ec-tab].active') || 
                          document.querySelector('[data-ec-tab]');
        if (firstEcTab) firstEcTab.click();
    }
}

// Initialize tabs when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTabs);
} else {
    initializeTabs();
}

// Also re-initialize tabs when screens change
const originalShowScreen = window.showScreen;
if (originalShowScreen) {
    window.showScreen = function(id) {
        originalShowScreen(id);
        // Re-initialize tabs after a short delay (for dynamic content)
        setTimeout(initializeTabs, 100);
    };
}
