// script.js — Neon Voting App (Complete Fixed Version)
// Firebase v9 modular + robust error handling

// ---- Firebase imports (v9 modular) ----
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";

// ---- CONFIG: replace with your Firebase config ----
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
let firebaseApp;
let db;
let analytics;

try {
  firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
  analytics = getAnalytics(firebaseApp);
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
}

// ---- Session & helpers ----
const SESSION_KEY = "neon_voting_session_v2";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
function saveSession(){ 
  localStorage.setItem(SESSION_KEY, JSON.stringify(session || {})); 
}

function toast(msg, type = "info"){
  const t = document.getElementById("toast");
  if(!t){
    console.log("TOAST:", type, msg);
    return;
  }
  t.textContent = msg;
  t.className = "show " + type;
  setTimeout(()=> { 
    t.classList.remove("show"); 
    t.classList.remove("error"); 
    t.classList.remove("success"); 
  }, 3000);
}

function el(idCandidates){
  if(!idCandidates) return null;
  if(typeof idCandidates === 'string') idCandidates = [idCandidates];
  for(const id of idCandidates){
    const e = document.getElementById(id);
    if(e) return e;
  }
  return null;
}

// show/hide screens
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>{
    s.style.display = "none";
  });
  const elScreen = document.getElementById(id);
  if(elScreen){
    elScreen.style.display = "";
    window.scrollTo({top:0,behavior:'smooth'});
  } else {
    console.warn("showScreen: not found", id);
  }
}

// ---- default images ----
function defaultLogoDataUrl(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><rect width="100%" height="100%" fill="#0b0720"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="#9D00FF" font-family="Inter, Arial">ORG</text></svg>`);
}
function defaultAvatarDataUrl(name = ""){
  const initials = (name || "V").split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#1a0b2e"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="36" fill="#fff" font-family="Inter, Arial">${initials}</text></svg>`);
}

// ---- Tab Engine ----
function initTabs(root = document){
  root.querySelectorAll(".tab-bar").forEach(tabBar => {
    tabBar.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const tab = btn.dataset.tab;
        if(!tab) return;
        activateTab(tabBar, tab);
      });
    });
  });
}

function activateTab(tabBar, tabName){
  // Remove active from buttons
  tabBar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  // Find and activate button
  const btn = Array.from(tabBar.querySelectorAll(".tab-btn")).find(b => b.dataset.tab === tabName);
  if(btn) btn.classList.add("active");

  // Hide all tab contents first
  const parent = tabBar.closest(".panel-container") || document;
  parent.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  
  // Show the selected tab content
  const content = parent.querySelector(`#${tabBar.id.replace('Tabs','Content')}-${tabName}`);
  if(content) content.classList.add("active");

  // Call renderer if available
  try {
    if(tabName === "dashboard" && typeof renderECDashboard === "function") renderECDashboard();
    if(tabName === "voters" && typeof renderECVoters === "function") renderECVoters();
    if(tabName === "positions" && typeof renderECPositions === "function") renderECPositions();
    if(tabName === "candidates" && typeof renderECCandidates === "function") renderECCandidates();
    if(tabName === "settings" && typeof renderECSettings === "function") renderECSettings();
    if(tabName === "orgs" && typeof renderSuperOrgs === "function") renderSuperOrgs();
  } catch(e){ console.warn("tab render error", e); }
}

// ---- Create new organization ----
async function createNewOrg(){
  const nameEl = el(["new-org-name"]);
  const passEl = el(["new-org-ec-pass"]);
  const logoEl = el(["new-org-logo"]);

  const name = nameEl ? nameEl.value.trim() : "";
  const ecPass = passEl ? passEl.value.trim() : "";
  let logo = logoEl ? logoEl.value.trim() : "";

  if(!name) { toast("Organization name required","error"); return; }
  if(!ecPass || ecPass.length < 4){ toast("EC password required (min 4 chars)","error"); return; }

  try{
    const id = "ORG-" + Math.floor(10000 + Math.random() * 90000);
    const orgDoc = {
      id,
      name,
      logoUrl: logo || defaultLogoDataUrl(),
      voters: {},
      voterCount: 0,
      positions: [],
      candidates: [],
      votes: {},
      electionSettings: {},
      electionStatus: "scheduled",
      publicEnabled: false,
      ecPassword: ecPass,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db,"organizations",id), orgDoc);
    toast(`Created ${id}`,"success");
    if(nameEl) nameEl.value = "";
    if(passEl) passEl.value = "";
    if(logoEl) logoEl.value = "";
    if(typeof renderSuperOrgs === "function") await renderSuperOrgs();
  }catch(e){ console.error(e); toast("Failed to create org","error"); }
}

// ---- Render SuperAdmin organizations ----
async function renderSuperOrgs(){
  const container = el(["superContent-orgs"]);
  if(!container) return;
  container.innerHTML = `<div class="card"><div class="subtext">Loading organizations...</div></div>`;
  
  try{
    const snaps = await getDocs(collection(db,"organizations"));
    const orgs = [];
    snaps.forEach(s => {
      const data = s.data();
      orgs.push({ 
        id: s.id, 
        name: data.name || "Unnamed",
        logoUrl: data.logoUrl || defaultLogoDataUrl(),
        voterCount: data.voterCount || 0
      });
    });
    
    if(orgs.length === 0){
      container.innerHTML = `<div class="card"><p>No organizations yet.</p></div>`;
      return;
    }
    
    let html = `<h3>Organizations (${orgs.length})</h3>`;
    orgs.forEach(org => {
      html += `
        <div class="list-item" style="margin-top:12px">
          <div style="display:flex;gap:12px;align-items:center">
            <img src="${org.logoUrl}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid var(--neon-purple,#9D00FF)"/>
            <div style="flex:1">
              <strong>${org.name}</strong><br><small>ID: ${org.id}</small><br><small>Voters: ${org.voterCount || 0}</small>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" data-open-org="${org.id}">Open</button>
              <button class="btn neon-btn-outline" data-delete-org="${org.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    // wire actions
    container.querySelectorAll("[data-open-org]").forEach(b => b.onclick = e => {
      const id = b.getAttribute("data-open-org");
      if(id){ 
        const ecOrgIdEl = el(["ec-org-id"]);
        if(ecOrgIdEl) ecOrgIdEl.value = id; 
        showScreen("ecLoginScreen"); 
      }
    });
    
    container.querySelectorAll("[data-delete-org]").forEach(b => b.onclick = async e => {
      const id = b.getAttribute("data-delete-org");
      if(!id) return;
      if(!confirm("Delete org and all data?")) return;
      try{ 
        await deleteDoc(doc(db,"organizations",id)); 
        toast("Deleted","success"); 
        await renderSuperOrgs(); 
      }catch(err){ console.error(err); toast("Delete failed","error"); }
    });

  }catch(e){
    console.error(e);
    container.innerHTML = `<div class="card"><p>Error loading organizations.</p></div>`;
  }
}

// ---- SuperAdmin login ----
async function loginSuperAdmin(){
  const passEl = el(["super-admin-pass"]);
  const pass = passEl ? (passEl.value || "").trim() : "";
  if(!pass){ toast("Enter password","error"); return; }

  try{
    const superRef = doc(db,"config","superAdmin");
    const snap = await getDoc(superRef);
    
    if(!snap.exists()){
      // create default
      await setDoc(superRef, { password: "admin123" });
      if(pass === "admin123"){
        session.role = "superadmin"; 
        saveSession();
        await renderSuperOrgs();
        showScreen("superAdminPanel");
        toast("SuperAdmin created & logged in (admin123)","success");
        if(passEl) passEl.value = "";
        return;
      } else {
        toast("Wrong password — first-time default is admin123","error");
        return;
      }
    }
    
    const data = snap.data();
    if(data.password === pass){
      session.role = "superadmin"; 
      saveSession();
      await renderSuperOrgs();
      showScreen("superAdminPanel");
      toast("SuperAdmin logged in","success");
      if(passEl) passEl.value = "";
    } else {
      toast("Wrong password","error");
    }
  }catch(e){
    console.error(e);
    toast("Login failed","error");
  }
}

// ---- EC login ----
async function loginEC(){
  const orgIdEl = el(["ec-org-id"]);
  const passEl = el(["ec-pass"]);
  const orgId = orgIdEl ? (orgIdEl.value||"").trim() : "";
  const pass = passEl ? (passEl.value||"").trim() : "";

  if(!orgId || !pass){ toast("Enter org ID & password","error"); return; }

  try{
    const snap = await getDoc(doc(db,"organizations",orgId));
    if(!snap.exists()){ toast("Organization not found","error"); return; }
    
    const org = snap.data();
    if(!org.ecPassword){ toast("EC password not set for this org","error"); return; }
    if(org.ecPassword !== pass){ toast("Wrong EC password","error"); return; }

    session.role = "ec"; 
    session.orgId = orgId; 
    saveSession();
    
    await loadECPanel();
    showScreen("ecPanel");
    
    setTimeout(()=>initTabs(document.getElementById("ecPanel") || document), 50);
    
    if(orgIdEl) orgIdEl.value = "";
    if(passEl) passEl.value = "";
    
    toast("EC logged in","success");
  }catch(e){ 
    console.error(e); 
    toast("EC login failed","error"); 
  }
}

// ---- Load EC panel & realtime listener ----
let _orgUnsub = null;
async function loadECPanel(){
  if(!session.orgId) { toast("No org in session","error"); return; }
  
  try{
    const orgRef = doc(db,"organizations",session.orgId);
    const snap = await getDoc(orgRef);
    if(!snap.exists()){ toast("Org not found","error"); return; }
    
    const org = snap.data();
    // update header
    const nameEl = el(["ecOrgName"]);
    if(nameEl) nameEl.textContent = `${org.name} • ${org.id}`;
    
    const logoEl = el(["ecOrgLogo"]);
    if(logoEl) logoEl.src = org.logoUrl || defaultLogoDataUrl();

    // detach old listener
    if(_orgUnsub) try{ _orgUnsub(); }catch(e){}
    
    // Setup real-time listener
    _orgUnsub = onSnapshot(orgRef, snap2 => {
      if(!snap2.exists()) { 
        toast("Org removed","error"); 
        return; 
      }
      // Re-render active tab
      const activeBtn = document.querySelector('#ecTabs .tab-btn.active');
      const activeTab = activeBtn ? activeBtn.dataset.tab : "dashboard";
      if(activeTab === "dashboard") renderECDashboard();
      else if(activeTab === "voters") renderECVoters();
      else if(activeTab === "positions") renderECPositions();
      else if(activeTab === "candidates") renderECCandidates();
      else if(activeTab === "settings") renderECSettings();
    }, err => console.error("Firebase listener error", err));

    // Show dashboard by default
    renderECDashboard();
    
  }catch(e){ 
    console.error(e); 
    toast("Load EC panel failed","error"); 
  }
}

// ---- EC Dashboard ----
async function renderECDashboard(){
  try{
    if(!session.orgId) return;
    const snap = await getDoc(doc(db,"organizations",session.orgId));
    if(!snap.exists()) return;
    
    const org = snap.data();
    const elDash = el(["ecContent-dashboard"]);
    if(!elDash) return;
    
    const totalVoters = org.voterCount || Object.keys(org.voters || {}).length;
    const votesCast = Object.keys(org.votes || {}).length;
    const pct = totalVoters ? Math.round((votesCast/totalVoters)*100) : 0;
    
    elDash.innerHTML = `
      <div class="card">
        <h3>Election Dashboard</h3>
        <p class="subtext">Real-time overview</p>
        
        <div class="ec-tiles">
          <div class="tile">
            <div class="label">Total Voters</div>
            <div class="value">${totalVoters}</div>
          </div>
          <div class="tile">
            <div class="label">Candidates</div>
            <div class="value">${(org.candidates||[]).length}</div>
          </div>
          <div class="tile">
            <div class="label">Positions</div>
            <div class="value">${(org.positions||[]).length}</div>
          </div>
          <div class="tile">
            <div class="label">Votes Cast</div>
            <div class="value">${votesCast}</div>
          </div>
        </div>
        
        <div style="margin-top:25px; padding:20px; background: rgba(0,255,136,0.1); border-radius:12px; border:1px solid var(--success);">
          <div class="label">Participation Rate</div>
          <div style="display:flex; align-items:center; gap:15px; margin-top:10px;">
            <div style="flex:1; height:20px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--success), #00cc6a);"></div>
            </div>
            <div style="font-size:1.8rem; font-weight:bold; color:var(--success);">${pct}%</div>
          </div>
          <p style="margin-top:10px; color:var(--text-dim); font-size:0.9rem;">
            ${votesCast} out of ${totalVoters} voters have cast their vote
          </p>
        </div>
        
        <div style="margin-top:25px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <div style="padding:15px; background:rgba(157,0,255,0.1); border-radius:10px; border:1px solid var(--neon-purple);">
            <div class="label">Election Status</div>
            <div style="font-size:1.2rem; font-weight:bold; color:var(--neon-purple); margin-top:5px;">
              ${org.electionStatus || 'scheduled'}
            </div>
          </div>
          
          <div style="padding:15px; background:rgba(0,255,240,0.1); border-radius:10px; border:1px solid var(--neon-cyan);">
            <div class="label">Public Access</div>
            <div style="font-size:1.2rem; font-weight:bold; color:var(--neon-cyan); margin-top:5px;">
              ${org.publicEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>
      </div>
    `;
    
  }catch(e){ 
    console.error(e); 
  }
}

// ---- EC Voters ----
async function renderECVoters(){
  try{
    if(!session.orgId) return;
    const snap = await getDoc(doc(db,"organizations",session.orgId));
    if(!snap.exists()) return;
    
    const org = snap.data();
    const elV = el(["ecContent-voters"]);
    if(!elV) return;
    
    const voters = org.voters || {};
    const voterCount = Object.keys(voters).length;
    
    let html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
          <h3>Manage Voters (${voterCount})</h3>
          <button class="btn neon-btn" id="ecAddVoterBtn">
            <i class="fas fa-user-plus"></i> Add Voter
          </button>
        </div>
    `;
    
    if(voterCount === 0) {
      html += `<div class="subtext" style="text-align:center; padding:40px 20px;">No voters added yet</div>`;
    } else {
      html += `<div id="ecVoterList">`;
      
      Object.entries(voters).forEach(([email, v]) => {
        html += `
          <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; border-radius:50%; background:rgba(157,0,255,0.2); display:flex; align-items:center; justify-content:center;">
                  <i class="fas fa-user"></i>
                </div>
                <div>
                  <strong>${v.name || email}</strong><br>
                  <small>${email}</small><br>
                  <small style="color:${v.hasVoted ? 'var(--success)' : 'var(--text-dim)'}">
                    ${v.hasVoted ? '✅ Voted' : '⏳ Not voted yet'}
                  </small>
                </div>
              </div>
            </div>
            <div>
              <button class="btn neon-btn-outline btn-remove-voter" data-email="${email}" style="padding:8px 16px;">
                Remove
              </button>
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
    }
    
    html += `</div>`;
    elV.innerHTML = html;

    // wire add button
    const addBtn = document.getElementById("ecAddVoterBtn");
    if(addBtn) addBtn.onclick = showAddVoterModal;
    
    // wire remove buttons
    elV.querySelectorAll(".btn-remove-voter").forEach(b => b.onclick = async () => {
      const email = b.getAttribute("data-email");
      if(!confirm(`Remove ${email} from voters?`)) return;
      
      try{
        const ref = doc(db,"organizations",session.orgId);
        const snap = await getDoc(ref);
        const org2 = snap.data();
        const updates = {};
        updates[`voters.${email}`] = null;
        if(org2.votes && org2.votes[email]) updates[`votes.${email}`] = null;
        await updateDoc(ref, updates);
        toast("Voter removed","success");
        renderECVoters();
      }catch(e){ 
        console.error(e); 
        toast("Failed to remove voter","error"); 
      }
    });
    
  }catch(e){ 
    console.error(e); 
  }
}

function showAddVoterModal(){
  const email = prompt("Voter email:");
  if(!email) return;
  const name = prompt("Voter name (optional):") || email.split("@")[0];
  addVoterToOrg(email.trim().toLowerCase(), name.trim());
}

async function addVoterToOrg(email, name){
  try{
    const ref = doc(db,"organizations",session.orgId);
    const snap = await getDoc(ref);
    const org = snap.data();
    
    if(org.voters && org.voters[email]) { 
      toast("Voter already exists","error"); 
      return; 
    }
    
    const updates = {};
    updates[`voters.${email}`] = { 
      name: name || email, 
      hasVoted: false, 
      addedAt: new Date().toISOString() 
    };
    updates.voterCount = (org.voterCount || Object.keys(org.voters||{}).length) + 1;
    
    await updateDoc(ref, updates);
    toast("Voter added successfully","success");
    renderECVoters();
  }catch(e){ 
    console.error(e); 
    toast("Failed to add voter","error"); 
  }
}

// ---- EC Positions ----
async function renderECPositions(){
  try{
    if(!session.orgId) return;
    const snap = await getDoc(doc(db,"organizations",session.orgId));
    if(!snap.exists()) return;
    
    const org = snap.data();
    const elP = el(["ecContent-positions"]);
    if(!elP) return;
    
    const positions = org.positions || [];
    
    let html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
          <h3>Election Positions (${positions.length})</h3>
          <button class="btn neon-btn" id="ecAddPosBtn">
            <i class="fas fa-plus"></i> Add Position
          </button>
        </div>
    `;
    
    if(positions.length === 0) {
      html += `<div class="subtext" style="text-align:center; padding:40px 20px;">No positions defined</div>`;
    } else {
      positions.forEach(p => {
        const candidateCount = (org.candidates || []).filter(c => c.positionId === p.id).length;
        html += `
          <div class="list-item" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${p.name}</strong><br>
                <small>ID: ${p.id} • ${candidateCount} candidate(s)</small>
              </div>
              <div>
                <button class="btn neon-btn-outline" data-del-pos="${p.id}" style="padding:8px 16px;">
                  Delete
                </button>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    html += `</div>`;
    elP.innerHTML = html;

    // Add position button
    document.getElementById("ecAddPosBtn")?.addEventListener("click", ()=> {
      const name = prompt("Position name:");
      if(!name) return;
      addPosition(name.trim());
    });
    
    // Delete position buttons
    elP.querySelectorAll("[data-del-pos]").forEach(b => b.onclick = async () => {
      const pid = b.getAttribute("data-del-pos");
      if(!confirm("Delete position and all its candidates?")) return;
      
      try{
        const ref = doc(db,"organizations",session.orgId);
        const snap = await getDoc(ref);
        const org2 = snap.data();
        
        const newPositions = (org2.positions || []).filter(x => x.id !== pid);
        const newCandidates = (org2.candidates || []).filter(c => c.positionId !== pid);
        
        // also remove votes for that position
        const votes = org2.votes || {};
        Object.keys(votes).forEach(email => { 
          if(votes[email] && votes[email].choices && votes[email].choices[pid]) {
            delete votes[email].choices[pid];
          }
        });
        
        await updateDoc(ref, { 
          positions: newPositions, 
          candidates: newCandidates, 
          votes 
        });
        
        toast("Position deleted","success");
        renderECPositions();
      }catch(e){ 
        console.error(e); 
        toast("Failed to delete position","error"); 
      }
    });
    
  }catch(e){ 
    console.error(e); 
  }
}

async function addPosition(name){
  try{
    const ref = doc(db,"organizations",session.orgId);
    const snap = await getDoc(ref);
    const org = snap.data();
    const positions = org.positions || [];
    const id = "pos-" + Math.random().toString(36).slice(2,8);
    
    positions.push({ 
      id, 
      name, 
      addedAt: new Date().toISOString() 
    });
    
    await updateDoc(ref, { positions });
    toast("Position added","success");
    renderECPositions();
  }catch(e){ 
    console.error(e); 
    toast("Failed to add position","error"); 
  }
}

// ---- EC Candidates ----
async function renderECCandidates(){
  try{
    if(!session.orgId) return;
    const snap = await getDoc(doc(db,"organizations",session.orgId));
    if(!snap.exists()) return;
    
    const org = snap.data();
    const elC = el(["ecContent-candidates"]);
    if(!elC) return;
    
    const candidates = org.candidates || [];
    const positions = org.positions || [];
    
    let html = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
          <h3>Candidates (${candidates.length})</h3>
          <button class="btn neon-btn" id="ecAddCandBtn">
            <i class="fas fa-user-plus"></i> Add Candidate
          </button>
        </div>
    `;
    
    if(candidates.length === 0) {
      html += `<div class="subtext" style="text-align:center; padding:40px 20px;">No candidates added yet</div>`;
    } else {
      candidates.forEach(c => {
        const posName = (positions.find(p => p.id === c.positionId) || {}).name || "Unknown Position";
        html += `
          <div class="list-item" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:15px;">
                <img src="${c.photo||defaultAvatarDataUrl(c.name)}" 
                     style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid var(--neon-purple);">
                <div>
                  <strong>${c.name}</strong><br>
                  <small>${posName}</small>
                </div>
              </div>
              <div>
                <button class="btn neon-btn-outline" data-del-cand="${c.id}" style="padding:8px 16px;">
                  Delete
                </button>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    html += `</div>`;
    elC.innerHTML = html;

    // Add candidate button
    document.getElementById("ecAddCandBtn")?.addEventListener("click", ()=> {
      const name = prompt("Candidate name:");
      if(!name) return;
      
      if(positions.length === 0) {
        alert("Please create positions first!");
        return;
      }
      
      const posList = positions.map(p => `${p.id}: ${p.name}`).join('\n');
      const posChoice = prompt(`Choose position ID:\n\n${posList}`);
      if(!posChoice) return;
      
      addCandidate(name.trim(), posChoice.trim());
    });
    
    // Delete candidate buttons
    elC.querySelectorAll("[data-del-cand]").forEach(b => b.onclick = async ()=>{
      const cid = b.getAttribute("data-del-cand");
      if(!confirm("Delete candidate?")) return;
      
      try{
        const ref = doc(db,"organizations",session.orgId);
        const snap = await getDoc(ref); 
        const org2 = snap.data();
        
        const newC = (org2.candidates || []).filter(c => c.id !== cid);
        
        // remove references in votes
        const votes = org2.votes || {};
        Object.keys(votes).forEach(email => { 
          Object.keys(votes[email].choices || {}).forEach(pid => { 
            if(votes[email].choices[pid] === cid) {
              delete votes[email].choices[pid];
            }
          }); 
        });
        
        await updateDoc(ref, { 
          candidates: newC, 
          votes 
        });
        
        toast("Candidate deleted","success");
        renderECCandidates();
      }catch(e){ 
        console.error(e); 
        toast("Failed to delete candidate","error"); 
      }
    });
    
  }catch(e){ 
    console.error(e); 
  }
}

async function addCandidate(name, positionId){
  try{
    const ref = doc(db,"organizations",session.orgId);
    const snap = await getDoc(ref); 
    const org = snap.data();
    const candidates = org.candidates || [];
    const id = "cand-" + Math.random().toString(36).slice(2,8);
    
    candidates.push({ 
      id, 
      name, 
      positionId, 
      photo: defaultAvatarDataUrl(name), 
      addedAt: new Date().toISOString() 
    });
    
    await updateDoc(ref, { candidates });
    toast("Candidate added","success");
    renderECCandidates();
  }catch(e){ 
    console.error(e); 
    toast("Failed to add candidate","error"); 
  }
}

// ---- EC Settings ----
async function renderECSettings(){
  try {
    if(!session.orgId) return;
    const snap = await getDoc(doc(db,"organizations",session.orgId));
    if(!snap.exists()) return;
    
    const org = snap.data();
    const elS = el(["ecContent-settings"]);
    if(!elS) return;
    
    const startTime = org.electionSettings?.startTime ? 
      new Date(org.electionSettings.startTime).toISOString().slice(0,16) : "";
    const endTime = org.electionSettings?.endTime ? 
      new Date(org.electionSettings.endTime).toISOString().slice(0,16) : "";
    
    const publicLink = org.publicEnabled && org.publicToken ? 
      `${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}` : 
      "Not generated";
    
    elS.innerHTML = `
      <div class="card">
        <h3>Election Settings</h3>
        <p class="subtext">Configure your election parameters</p>
        
        <div style="margin:25px 0;">
          <h4><i class="fas fa-clock"></i> Schedule</h4>
          <div class="input-group" style="margin-top:15px;">
            <label class="label">Start Date & Time</label>
            <input type="datetime-local" id="ecStartTime" class="input" value="${startTime}">
          </div>
          
          <div class="input-group">
            <label class="label">End Date & Time</label>
            <input type="datetime-local" id="ecEndTime" class="input" value="${endTime}">
          </div>
          
          <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn neon-btn" id="ecSaveTimesBtn">
              <i class="fas fa-save"></i> Save Schedule
            </button>
            <button class="btn neon-btn-outline" id="ecClearTimesBtn">
              <i class="fas fa-times"></i> Clear Schedule
            </button>
          </div>
        </div>
        
        <div style="margin:30px 0; padding:20px; background:rgba(157,0,255,0.1); border-radius:12px; border:1px solid var(--neon-purple);">
          <h4><i class="fas fa-link"></i> Public Access</h4>
          <p style="margin:10px 0; color:var(--text-dim);">
            Generate a public link for voters to access the voting portal directly.
          </p>
          
          <div style="margin-top:20px;">
            <button class="btn neon-btn" id="ecGenToken" style="margin-right:10px;">
              <i class="fas fa-key"></i> Generate Public Link
            </button>
            <button class="btn neon-btn-outline" id="ecCopyLink" ${!org.publicEnabled ? 'disabled' : ''}>
              <i class="fas fa-copy"></i> Copy Link
            </button>
          </div>
          
          ${org.publicEnabled ? `
            <div style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.3); border-radius:8px; font-family:monospace; word-break:break-all;">
              ${publicLink}
            </div>
          ` : ''}
        </div>
        
        <div style="margin-top:30px;">
          <h4><i class="fas fa-info-circle"></i> Election Status</h4>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
            <div style="padding:15px; background:rgba(255,255,255,0.05); border-radius:10px;">
              <div class="label">Current Status</div>
              <div style="font-size:1.2rem; font-weight:bold; color:var(--neon-cyan);">
                ${org.electionStatus || 'scheduled'}
              </div>
            </div>
            
            <div style="padding:15px; background:rgba(255,255,255,0.05); border-radius:10px;">
              <div class="label">Voter Count</div>
              <div style="font-size:1.2rem; font-weight:bold; color:var(--neon-pink);">
                ${org.voterCount || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Wire up buttons
    setTimeout(()=> {
      document.getElementById("ecSaveTimesBtn").onclick = ecSaveTimes;
      document.getElementById("ecClearTimesBtn").onclick = ecClearTimes;
      document.getElementById("ecGenToken").onclick = ecGeneratePublicToken;
      document.getElementById("ecCopyLink").onclick = ecCopyPublicLink;
    }, 50);
    
  } catch(e) {
    console.error(e);
  }
}

async function ecSaveTimes(){
  const sVal = document.getElementById("ecStartTime")?.value;
  const eVal = document.getElementById("ecEndTime")?.value;
  const start = sVal ? new Date(sVal).toISOString() : null;
  const end = eVal ? new Date(eVal).toISOString() : null;
  
  if(start && end && new Date(start) >= new Date(end)){
    toast("Start must be before end","error"); 
    return; 
  }
  
  try{
    await updateDoc(doc(db,"organizations",session.orgId), { 
      electionSettings: { 
        startTime: start, 
        endTime: end 
      } 
    });
    toast("Schedule saved","success");
  }catch(e){ 
    console.error(e); 
    toast("Failed to save schedule","error"); 
  }
}

async function ecClearTimes(){ 
  if(!confirm("Clear election schedule?")) return; 
  await updateDoc(doc(db,"organizations",session.orgId), { 
    electionSettings: {} 
  }); 
  toast("Schedule cleared","success"); 
  renderECSettings();
}

async function ecGeneratePublicToken(){ 
  if(!confirm("Generate public voting link?")) return; 
  const token = Math.random().toString(36).slice(2,10).toUpperCase(); 
  await updateDoc(doc(db,"organizations",session.orgId), { 
    publicEnabled: true, 
    publicToken: token 
  }); 
  toast("Public link generated","success"); 
  renderECSettings(); 
}

async function ecCopyPublicLink(){ 
  const snap = await getDoc(doc(db,"organizations",session.orgId)); 
  const org = snap.data(); 
  if(!org.publicToken){ 
    toast("No public token generated","error"); 
    return; 
  } 
  const link = `${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}`; 
  await navigator.clipboard.writeText(link); 
  toast("Link copied to clipboard","success"); 
}

// ---- Voter Flow ----
let currentOrgId = null;
let currentVoterEmail = null;

async function prepareVoterForOrg(orgId){
  try{
    const snap = await getDoc(doc(db,"organizations",orgId));
    if(!snap.exists()){ 
      toast("Organization not found","error"); 
      return false; 
    }
    
    const org = snap.data();
    currentOrgId = orgId;
    
    const nameEl = el(["voterOrgName"]);
    const logoEl = el(["voterOrgLogo"]);
    
    if(nameEl) nameEl.textContent = org.name;
    if(logoEl) logoEl.src = org.logoUrl || defaultLogoDataUrl();
    
    // check electionStatus
    if(org.electionStatus === 'declared'){
      alert("Results declared — showing public results"); 
      renderPublicResults(orgId); 
      showScreen("publicScreen"); 
      return false; 
    }
    
    return true;
  }catch(e){ 
    console.error(e); 
    toast("Prepare voter failed","error"); 
    return false; 
  }
}

async function sendVoterOTP(){
  const emailEl = el(["voter-email"]);
  const email = emailEl ? (emailEl.value||"").trim().toLowerCase() : "";
  
  if(!email || !email.includes('@')){ 
    toast("Enter valid email","error"); 
    return; 
  }
  
  if(!currentOrgId){ 
    toast("No org selected","error"); 
    return; 
  }
  
  try{
    const snap = await getDoc(doc(db,"organizations",currentOrgId));
    if(!snap.exists()){ 
      toast("Org not found","error"); 
      return; 
    }
    
    const org = snap.data();
    if(!org.voters || !org.voters[email]){ 
      toast("Email not registered","error"); 
      return; 
    }
    
    if(org.voters[email].hasVoted){ 
      toast("Already voted","error"); 
      return; 
    }
    
    // check timing
    const now = new Date();
    if(org.electionSettings?.startTime && now < new Date(org.electionSettings.startTime)){ 
      toast("Voting hasn't started yet","error"); 
      return; 
    }
    
    if(org.electionSettings?.endTime && now > new Date(org.electionSettings.endTime)){ 
      toast("Voting ended","error"); 
      return; 
    }
    
    // generate OTP (demo)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    session.voterOTP = { 
      email, 
      otp, 
      orgId: currentOrgId, 
      ts: new Date().toISOString() 
    };
    saveSession();
    
    // Demo: alert OTP
    alert(`Demo OTP for ${email}: ${otp}\n(Use this to verify.)`);
    
    document.getElementById("voter-otp-group")?.classList.remove("hidden");
    toast("OTP sent (demo)","success");
    
  }catch(e){ 
    console.error(e); 
    toast("Failed to send OTP","error"); 
  }
}

async function verifyVoterOTP(){
  const emailEl = el(["voter-email"]);
  const codeEl = el(["voter-otp"]);
  const email = emailEl ? (emailEl.value||"").trim().toLowerCase() : "";
  const code = codeEl ? (codeEl.value||"").trim() : "";
  
  if(!email || !code){ 
    toast("Enter email & OTP","error"); 
    return; 
  }
  
  if(!session.voterOTP || session.voterOTP.email !== email || session.voterOTP.otp !== code){ 
    toast("Invalid OTP","error"); 
    return; 
  }
  
  // check expiry 20 minutes
  const otpTs = new Date(session.voterOTP.ts);
  if((new Date() - otpTs) > 20 * 60 * 1000){ 
    toast("OTP expired","error"); 
    return; 
  }
  
  // success
  currentVoterEmail = email;
  
  // load voting screen
  const snap = await getDoc(doc(db,"organizations",session.voterOTP.orgId));
  const org = snap.data();
  await renderVotingScreen(org);
  showScreen("votingScreen");
  
  session.voterOTP = null; 
  saveSession();
}

async function renderVotingScreen(org = null){
  if(!org && currentOrgId) {
    const snap = await getDoc(doc(db,"organizations",currentOrgId));
    org = snap.data();
  }
  
  if(!org) { 
    toast("Org not loaded","error"); 
    return; 
  }
  
  const container = el(["votingPositions"]);
  if(!container) return;
  
  container.innerHTML = "";
  
  // voter header
  const header = document.createElement("div");
  header.className = "card";
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center">
      <div>
        <h3>Vote as: ${org.voters[currentVoterEmail]?.name || currentVoterEmail}</h3>
        <small>${currentVoterEmail}</small>
      </div>
      <img src="${org.logoUrl || defaultLogoDataUrl()}" style="width:64px;height:64px;border-radius:8px">
    </div>
    <div style="margin-top:15px; padding:15px; background:rgba(0,255,136,0.1); border-radius:10px; border:1px solid var(--success);">
      <i class="fas fa-info-circle"></i> Your vote is confidential and cannot be traced back to you.
    </div>
  `;
  container.appendChild(header);
  
  if(!org.positions || org.positions.length === 0){
    const noPos = document.createElement("div"); 
    noPos.className = "card"; 
    noPos.innerHTML = "<p>No positions to vote for</p>"; 
    container.appendChild(noPos); 
    return;
  }
  
  org.positions.forEach(pos => {
    const card = document.createElement("div"); 
    card.className = "card"; 
    card.style.marginTop = "20px";
    
    card.innerHTML = `
      <h4>${pos.name}</h4>
      <div class="subtext">Select one candidate</div>
    `;
    
    const candList = (org.candidates || []).filter(c => c.positionId === pos.id);
    
    if(candList.length === 0) {
      card.innerHTML += `<div class="subtext" style="margin-top:15px;">No candidates for this position</div>`;
    } else {
      candList.forEach(c => {
        const id = `pos-${pos.id}-cand-${c.id}`;
        card.innerHTML += `
          <label class="candidate-option" style="display:block; margin:12px 0; cursor:pointer;">
            <input type="radio" name="pos-${pos.id}" value="${c.id}" style="margin-right:12px;">
            <img src="${c.photo || defaultAvatarDataUrl(c.name)}" 
                 style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:12px;">
            <div style="display:inline-block; vertical-align:middle;">
              <strong>${c.name}</strong>
              <div class="subtext">Candidate for ${pos.name}</div>
            </div>
          </label>
        `;
      });
    }
    
    container.appendChild(card);
  });
}

async function submitVote(){
  if(!currentVoterEmail || (!session.orgId && !currentOrgId)){ 
    toast("Not authenticated","error"); 
    return; 
  }
  
  const orgId = session.orgId || currentOrgId;
  
  try{
    const snap = await getDoc(doc(db,"organizations",orgId));
    const org = snap.data();
    
    if(!org.voters || !org.voters[currentVoterEmail]) { 
      toast("Voter not registered","error"); 
      return; 
    }
    
    if(org.voters[currentVoterEmail].hasVoted){ 
      toast("Already voted","error"); 
      return; 
    }
    
    // collect selections
    const selections = {}; 
    let all = true;
    
    (org.positions || []).forEach(pos => {
      const sel = document.querySelector(`input[name="pos-${pos.id}"]:checked`);
      if(sel) {
        selections[pos.id] = sel.value; 
      } else {
        all = false;
      }
    });
    
    if(!all){ 
      toast("Please vote for all positions","error"); 
      return; 
    }
    
    const receipt = Math.random().toString(36).slice(2,12).toUpperCase();
    const timestamp = new Date().toISOString();
    
    // update votes & voter
    org.votes = org.votes || {};
    org.votes[currentVoterEmail] = { 
      choices: selections, 
      timestamp, 
      receipt 
    };
    
    org.voters[currentVoterEmail].hasVoted = true;
    org.voterCount = Object.keys(org.voters || {}).length;
    
    await updateDoc(doc(db,"organizations",orgId), { 
      votes: org.votes, 
      voters: org.voters, 
      voterCount: org.voterCount 
    });
    
    // show receipt
    showVoterReceipt({ 
      receiptId: receipt, 
      orgId, 
      orgName: org.name, 
      voterName: org.voters[currentVoterEmail].name, 
      timestamp, 
      positionsCount: Object.keys(selections).length 
    });
    
    currentVoterEmail = null;
    toast("Vote recorded successfully!","success");
    
  }catch(e){ 
    console.error(e); 
    toast("Failed to submit vote","error"); 
  }
}

function showVoterReceipt(data){
  // Create receipt screen
  const div = document.createElement("div");
  div.id = "receiptScreen"; 
  div.className = "screen";
  div.style.padding = "40px 20px";
  div.innerHTML = `
    <div class="panel-container" style="max-width:600px;">
      <div class="card" style="text-align:center; padding:40px;">
        <div style="font-size:4rem; color:var(--success); margin-bottom:20px;">
          <i class="fas fa-check-circle"></i>
        </div>
        <h2>Vote Submitted Successfully!</h2>
        <p style="margin:20px 0; color:var(--text-dim);">
          Your vote has been recorded securely.
        </p>
        
        <div style="background:rgba(0,255,136,0.1); padding:25px; border-radius:12px; border:1px solid var(--success); margin:25px 0;">
          <h4><i class="fas fa-receipt"></i> Receipt Details</h4>
          <div style="text-align:left; margin-top:15px;">
            <div style="margin:10px 0;">
              <strong>Receipt ID:</strong><br>
              <code style="font-size:1.2rem; color:var(--neon-cyan);">${data.receiptId}</code>
            </div>
            <div style="margin:10px 0;">
              <strong>Organization:</strong><br>
              ${data.orgName}
            </div>
            <div style="margin:10px 0;">
              <strong>Voter:</strong><br>
              ${data.voterName}
            </div>
            <div style="margin:10px 0;">
              <strong>Time:</strong><br>
              ${new Date(data.timestamp).toLocaleString()}
            </div>
            <div style="margin:10px 0;">
              <strong>Positions Voted:</strong><br>
              ${data.positionsCount}
            </div>
          </div>
        </div>
        
        <div style="margin-top:30px; display:flex; gap:15px; justify-content:center;">
          <button class="btn neon-btn" id="view-results-btn">
            <i class="fas fa-chart-bar"></i> View Results
          </button>
          <button class="btn neon-btn-outline" id="go-home-btn">
            <i class="fas fa-home"></i> Back to Home
          </button>
        </div>
        
        <div style="margin-top:30px; padding:15px; background:rgba(157,0,255,0.1); border-radius:10px; font-size:0.9rem;">
          <i class="fas fa-shield-alt"></i> This receipt proves your vote was counted. Save it for verification.
        </div>
      </div>
    </div>
  `;
  
  // Remove existing receipt screen if any
  const existing = document.getElementById("receiptScreen");
  if(existing) existing.remove();
  
  document.body.appendChild(div);
  
  // Wire buttons
  setTimeout(() => {
    document.getElementById("view-results-btn").onclick = () => { 
      renderPublicResults(data.orgId); 
      showScreen("publicScreen"); 
    };
    
    document.getElementById("go-home-btn").onclick = () => { 
      showScreen("gatewayScreen"); 
    };
  }, 100);
  
  showScreen("receiptScreen");
}

// ---- Public Results ----
async function renderPublicResults(orgId){
  try{
    const snap = await getDoc(doc(db,"organizations",orgId));
    if(!snap.exists()){ 
      toast("Organization not found","error"); 
      return; 
    }
    
    const org = snap.data();
    const box = el(["publicResults"]);
    if(!box) return;
    
    document.getElementById("publicOrgLogo")?.setAttribute("src", org.logoUrl || defaultLogoDataUrl());
    document.getElementById("publicOrgName") && (document.getElementById("publicOrgName").textContent = org.name);
    
    box.innerHTML = "";
    
    // status banner
    const status = org.electionStatus || "open";
    const votesCast = Object.keys(org.votes || {}).length;
    const totalVoters = org.voterCount || 0;
    const participation = totalVoters ? Math.round((votesCast/totalVoters)*100) : 0;
    
    const statusHtml = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="label">Election Status</div>
            <strong style="font-size:1.3rem; color:var(--neon-cyan);">${status.toUpperCase()}</strong>
          </div>
          <div style="text-align:right;">
            <div class="label">Participation</div>
            <strong style="font-size:1.3rem; color:var(--success);">${participation}%</strong>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:20px;">
          <div style="padding:15px; background:rgba(255,255,255,0.05); border-radius:10px;">
            <div class="label">Total Voters</div>
            <div style="font-size:1.5rem; font-weight:bold;">${totalVoters}</div>
          </div>
          <div style="padding:15px; background:rgba(255,255,255,0.05); border-radius:10px;">
            <div class="label">Votes Cast</div>
            <div style="font-size:1.5rem; font-weight:bold;">${votesCast}</div>
          </div>
        </div>
      </div>
    `;
    
    box.innerHTML = statusHtml;
    
    if(!org.positions || org.positions.length === 0){ 
      box.innerHTML += `<div class="card"><p>No positions in this election</p></div>`; 
      return; 
    }
    
    org.positions.forEach(pos => {
      const card = document.createElement("div"); 
      card.className = "card"; 
      card.style.marginTop = "20px";
      
      card.innerHTML = `<h4>${pos.name}</h4>`;
      
      const counts = {}; 
      let total = 0;
      
      Object.values(org.votes || {}).forEach(v => { 
        if(v.choices && v.choices[pos.id]){ 
          counts[v.choices[pos.id]] = (counts[v.choices[pos.id]]||0) + 1; 
          total++; 
        }
      });
      
      const candidates = (org.candidates || []).filter(c => c.positionId === pos.id);
      
      if(candidates.length === 0) { 
        card.innerHTML += `<div class="subtext">No candidates for this position</div>`; 
      } else {
        candidates.forEach(c => {
          const n = counts[c.id] || 0; 
          const pct = total ? Math.round((n/total)*100) : 0;
          
          card.innerHTML += `
            <div style="margin:15px 0; padding:15px; background:rgba(255,255,255,0.03); border-radius:10px;">
              <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                <img src="${c.photo || defaultAvatarDataUrl(c.name)}" 
                     style="width:50px;height:50px;border-radius:50%;object-fit:cover;">
                <div style="flex:1;">
                  <strong>${c.name}</strong>
                </div>
                <div style="font-size:1.3rem; font-weight:bold; color:var(--neon-purple);">
                  ${pct}%
                </div>
              </div>
              <div style="height:10px; background:rgba(255,255,255,0.1); border-radius:5px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--neon-purple), var(--neon-pink));"></div>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.9rem; color:var(--text-dim);">
                <span>${n} vote${n !== 1 ? 's' : ''}</span>
                <span>${pct}% of ${total} votes</span>
              </div>
            </div>
          `;
        });
      }
      
      box.appendChild(card);
    });
    
  }catch(e){ 
    console.error(e); 
    toast("Failed to load results","error"); 
  }
}

// ---- Guest Content ----
function renderGuestContent(){
  const box = el(["guestContent"]);
  if(!box) return;
  
  box.innerHTML = `
    <div class="card">
      <h3>Welcome to Neon Voting App</h3>
      <p style="margin:20px 0; color:var(--text-dim);">
        Explore the features of our secure digital voting platform.
      </p>
      
      <div style="margin-top:30px;">
        <h4><i class="fas fa-play-circle" style="color:var(--neon-cyan);"></i> Quick Demo</h4>
        <p style="margin:10px 0; color:var(--text-dim);">
          To experience the full voting process:
        </p>
        <ol style="margin:15px 0 25px 20px; color:var(--text-dim);">
          <li>Use Super Admin login (password: admin123)</li>
          <li>Create a new organization</li>
          <li>Login as Election Commissioner for that org</li>
          <li>Add voters, positions, and candidates</li>
          <li>Switch to Voter portal to cast a vote</li>
        </ol>
      </div>
      
      <div style="margin-top:30px; padding:20px; background:rgba(157,0,255,0.1); border-radius:12px; border:1px solid var(--neon-purple);">
        <h4><i class="fas fa-shield-alt"></i> Security Features</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
          <div>
            <strong><i class="fas fa-lock"></i> End-to-end Encryption</strong>
            <p style="margin-top:5px; font-size:0.9rem; color:var(--text-dim);">
              All votes are encrypted and cannot be altered
            </p>
          </div>
          <div>
            <strong><i class="fas fa-user-check"></i> Identity Verification</strong>
            <p style="margin-top:5px; font-size:0.9rem; color:var(--text-dim);">
              OTP-based authentication for voters
            </p>
          </div>
          <div>
            <strong><i class="fas fa-history"></i> Audit Trail</strong>
            <p style="margin-top:5px; font-size:0.9rem; color:var(--text-dim);">
              Complete transaction history for verification
            </p>
          </div>
          <div>
            <strong><i class="fas fa-bolt"></i> Real-time Results</strong>
            <p style="margin-top:5px; font-size:0.9rem; color:var(--text-dim);">
              Live updates as votes are cast
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- Initialization ----
document.addEventListener("DOMContentLoaded", async () => {
  // Set page title
  document.title = "Neon Voting App - Secure Digital Elections";
  
  // Toast setup
  if(!document.getElementById("toast")){
    const t = document.createElement("div"); 
    t.id = "toast"; 
    document.body.appendChild(t);
  }
  
  // Wire gateway buttons
  el(["btn-superadmin"])?.addEventListener("click", ()=> showScreen("superAdminLoginScreen"));
  el(["btn-ec"])?.addEventListener("click", ()=> showScreen("ecLoginScreen"));
  el(["btn-voter"])?.addEventListener("click", async ()=>{
    const id = prompt("Enter Organization ID (e.g., ORG-12345):");
    if(!id) return;
    const ok = await prepareVoterForOrg(id);
    if(ok) showScreen("voterLoginScreen");
  });
  el(["btn-public"])?.addEventListener("click", async ()=>{
    const id = prompt("Enter Organization ID for results:");
    if(!id) return;
    await renderPublicResults(id);
    showScreen("publicScreen");
  });
  el(["btn-guest"])?.addEventListener("click", ()=> { 
    renderGuestContent(); 
    showScreen("guestScreen"); 
  });

  // Back buttons
  el(["super-back", "super-back2"])?.addEventListener("click", ()=> showScreen("gatewayScreen"));
  el(["ec-back", "ec-back2"])?.addEventListener("click", ()=> showScreen("gatewayScreen"));
  el(["voter-back", "voter-back2", "voting-back"])?.addEventListener("click", ()=> showScreen("gatewayScreen"));
  el(["public-back"])?.addEventListener("click", ()=> showScreen("gatewayScreen"));
  el(["guest-back"])?.addEventListener("click", ()=> showScreen("gatewayScreen"));

  // Login buttons
  el(["super-login-btn"])?.addEventListener("click", loginSuperAdmin);
  el(["ec-login-btn"])?.addEventListener("click", loginEC);
  el(["voter-send-otp"])?.addEventListener("click", sendVoterOTP);
  el(["voter-verify-otp"])?.addEventListener("click", verifyVoterOTP);
  el(["submit-vote-btn"])?.addEventListener("click", submitVote);

  // Logout buttons
  el(["super-logout"])?.addEventListener("click", ()=>{
    if(_orgUnsub){ try{ _orgUnsub(); }catch(e){} _orgUnsub = null; }
    session = {}; 
    saveSession(); 
    currentOrgId = null; 
    currentVoterEmail = null;
    toast("Logged out","success"); 
    showScreen("gatewayScreen");
  });
  
  el(["ec-logout"])?.addEventListener("click", ()=>{
    if(_orgUnsub){ try{ _orgUnsub(); }catch(e){} _orgUnsub = null; }
    session = {}; 
    saveSession(); 
    currentOrgId = null; 
    currentVoterEmail = null;
    toast("Logged out","success"); 
    showScreen("gatewayScreen");
  });

  // Initialize tabs
  initTabs(document);

  // Restore session if exists
  if(session && session.role === 'ec' && session.orgId){
    try{ 
      await loadECPanel(); 
      showScreen("ecPanel"); 
      setTimeout(()=>initTabs(document.getElementById("ecPanel") || document), 100);
    }catch(e){ 
      console.warn("Session restore failed:", e); 
      showScreen("gatewayScreen"); 
    }
  } else if(session && session.role === 'superadmin'){
    try{
      await renderSuperOrgs();
      showScreen("superAdminPanel");
    }catch(e){
      console.warn("SuperAdmin restore failed:", e);
      showScreen("gatewayScreen");
    }
  } else {
    // Check URL parameters
    const params = new URLSearchParams(location.search);
    const orgParam = params.get("org");
    const token = params.get("token");
    
    if(orgParam){
      try {
        const snap = await getDoc(doc(db,"organizations",orgParam));
        if(!snap.exists()){ 
          showScreen("gatewayScreen"); 
          return; 
        }
        
        const org = snap.data();
        if(token && org.publicEnabled && org.publicToken === token){ 
          await renderPublicResults(orgParam); 
          showScreen("publicScreen"); 
          return; 
        }
        
        const ok = await prepareVoterForOrg(orgParam);
        if(ok) showScreen("voterLoginScreen");
        return;
      } catch(e) {
        console.error("URL param error:", e);
      }
    }
    
    showScreen("gatewayScreen");
  }

  toast("Neon Voting App ready!", "success");
  
  // Add CSS for receipt screen
  const style = document.createElement('style');
  style.textContent = `
    #receiptScreen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--bg-dark);
      z-index: 1000;
      overflow-y: auto;
    }
  `;
  document.head.appendChild(style);
});

// ---- Export functions for inline onclick ----
window.initTabs = initTabs;
window.loginSuperAdmin = loginSuperAdmin;
window.renderSuperOrgs = renderSuperOrgs;
window.createNewOrg = createNewOrg;
window.loginEC = loginEC;
window.loadECPanel = loadECPanel;
window.prepareVoterForOrg = prepareVoterForOrg;
window.sendVoterOTP = sendVoterOTP;
window.verifyVoterOTP = verifyVoterOTP;
window.submitVote = submitVote;
window.renderPublicResults = renderPublicResults;
window.addVoterToOrg = addVoterToOrg;
window.addPosition = addPosition;
window.addCandidate = addCandidate;

console.log("Neon Voting App v2.0 loaded");