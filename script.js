// script.js (type=module) — Firebase Real-time Cloud version
// Uses Firestore + Storage. Exposes necessary UI handlers to window.

// ----------------- FIREBASE CONFIG (paste provided config) -----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, addDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

/* ---------- Replace with your Firebase web config (you gave this earlier) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

const firebaseApp = initializeApp(firebaseConfig);
try { getAnalytics(firebaseApp); } catch(e){ /* analytics optional */ }

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const auth = getAuth(firebaseApp);

// ----------------- Lightweight helpers & session -----------------
const SESSION_KEY = "neon_voting_session_v2";

let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
function saveSession(){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

function toast(msg){ const t = document.getElementById("toast"); if(!t) return; t.textContent = msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 3000); }

// screen helper — ensures only one active screen (no split)
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.setAttribute("aria-hidden","true");
  });
  const el = document.getElementById(id);
  if(el){ el.classList.add("active"); el.setAttribute("aria-hidden","false"); window.scrollTo({top:0,behavior:'smooth'}); }
}

/* ----------------- SUPERADMIN flows -----------------
   Superadmin credentials are stored server-side in Firestore doc "meta/superadmin".
   On first run we create a demo password ("superadmin123") if not present.
------------------------------------------------------------------*/
async function loginSuperAdmin(){
  const pw = document.getElementById("superAdminPassword").value || "";
  const metaRef = doc(db, "meta", "superadmin");
  try {
    const snap = await getDoc(metaRef);
    if (!snap.exists()){
      await setDoc(metaRef, { password: "superadmin123" });
      toast("Demo superadmin created: superadmin123");
      session.role = "owner"; saveSession(); renderSuperOrgs(); showScreen("superAdminPanel");
      return;
    }
    const data = snap.data();
    if (pw !== data.password) return toast("Wrong password");
    session.role = "owner"; saveSession(); renderSuperOrgs(); showScreen("superAdminPanel");
  } catch(err){ console.error(err); toast("SuperAdmin login error"); }
}

// Render organizations for superadmin
async function renderSuperOrgs(){
  const container = document.getElementById("superContent-orgs");
  container.innerHTML = `<div class="subtext">Loading...</div>`;
  try {
    const col = collection(db, "organizations");
    const snaps = await getDocs(col);
    let html = `<div class="card"><h3>Create Organization</h3>
      <input id="ownerNewOrgName" class="input" placeholder="Organization name">
      <input id="ownerNewOrgPass" class="input" placeholder="EC password (optional)">
      <input id="ownerNewOrgLogo" type="file" accept="image/*" class="input">
      <div style="margin-top:8px"><button class="btn neon-btn" id="ownerCreateBtn">Create</button></div></div>`;
    html += `<h3 style="margin-top:12px">Existing Organizations</h3>`;
    snaps.forEach(s => {
      const org = s.data();
      html += `<div class="list-item"><div><strong>${org.name}</strong><br><small>${s.id}</small><br><small>Voters: ${org.voterCount || 0}</small></div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-owner-open="${s.id}">Open</button><button class="btn neon-btn-outline" data-owner-public="${s.id}">${org.publicEnabled ? 'Disable Public' : 'Enable Public'}</button><button class="btn neon-btn-outline" data-owner-delete="${s.id}">Delete</button></div></div>`;
    });
    html += `<div style="margin-top:12px"><button class="btn neon-btn-outline" id="ownerShowPasswords">Show Org Passwords</button><button class="btn neon-btn-outline" id="ownerResetAll" style="margin-left:8px">Reset ALL Data</button></div>`;
    container.innerHTML = html;

    // wire create
    document.getElementById("ownerCreateBtn").onclick = ownerCreateOrg;
    document.querySelectorAll("[data-owner-open]").forEach(b => b.onclick = ()=>ownerOpenEc(b.getAttribute("data-owner-open")));
    document.querySelectorAll("[data-owner-public]").forEach(b => b.onclick = ()=>ownerTogglePublic(b.getAttribute("data-owner-public")));
    document.querySelectorAll("[data-owner-delete]").forEach(b => b.onclick = ()=>ownerDeleteOrg(b.getAttribute("data-owner-delete")));
    document.getElementById("ownerShowPasswords").onclick = ownerShowPasswords;
    document.getElementById("ownerResetAll").onclick = ownerResetAllData;

  } catch(err){ console.error(err); container.innerHTML = `<div class="subtext">Failed to load orgs</div>`; }
}

async function ownerCreateOrg(){
  const name = document.getElementById("ownerNewOrgName").value?.trim();
  let pass = document.getElementById("ownerNewOrgPass").value?.trim();
  const file = document.getElementById("ownerNewOrgLogo").files[0];
  if (!name) return toast("Name required");
  if (!pass) pass = generateStrongPassword();
  const id = "ORG-" + Math.floor(10000 + Math.random() * 90000);
  const orgRef = doc(db, "organizations", id);
  try {
    let logoUrl = "";
    if (file){
      const data = await fileToDataUrl(file);
      const sRef = storageRef(storage, `orgs/${id}/logo.png`);
      await uploadString(sRef, data, 'data_url');
      logoUrl = await getDownloadURL(sRef);
    }
    await setDoc(orgRef, {
      id, name, logoUrl, ecPassword: pass, publicEnabled: false, publicToken: null,
      voters: {}, positions: [], candidates: [], votes: {}, electionSettings: { startTime: null, endTime: null }, electionStatus: "scheduled", voterCount: 0
    });
    toast(`Created ${id}. EC pass: ${pass}`);
    renderSuperOrgs();
  } catch(err){ console.error(err); toast("Create org failed"); }
}

async function ownerOpenEc(id){ document.getElementById("ecOrgId").value = id; showScreen("ecLoginScreen"); }
async function ownerTogglePublic(id){
  const ref = doc(db, "organizations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return toast("Org gone");
  const org = snap.data();
  const updates = { publicEnabled: !org.publicEnabled };
  if (!org.publicToken) updates.publicToken = (Math.random().toString(36).slice(2,12)).toUpperCase();
  await updateDoc(ref, updates);
  toast(updates.publicEnabled ? "Public enabled" : "Public disabled");
  renderSuperOrgs();
}
async function ownerDeleteOrg(id){
  if(!confirm("Delete organization and ALL its data? (Firestore console recommended for complete removal)")) return;
  try {
    await setDoc(doc(db,"organizations",id), {}); // mark empty — full deletion to be performed in console/admin
    toast("Marked org removed (console cleanup may be required)");
    renderSuperOrgs();
  } catch(e){ console.error(e); toast("Delete failed"); }
}
async function ownerShowPasswords(){
  const snaps = await getDocs(collection(db,"organizations"));
  let msg = "Org passwords:\n\n";
  snaps.forEach(s => { const o = s.data(); msg += `${o.name} (${s.id}) -> ${o.ecPassword}\n`; });
  alert(msg);
}
async function ownerResetAllData(){
  if(!confirm("Reset ALL data? This will not fully delete Firestore - use console for full deletion. Continue?")) return;
  // Demo: set a version marker doc
  await setDoc(doc(db,"meta","reset_marker"), { ts: new Date().toISOString() });
  toast("Marked reset (use Firebase console to purge actual collections)");
}

// ----------------- EC flows (Firestore-backed) -----------------
async function loginEC(){
  const id = document.getElementById("ecOrgId").value?.trim();
  const pw = document.getElementById("ecPassword").value || "";
  if (!id) return toast("Enter org id");
  const ref = doc(db,"organizations",id);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return toast("Org not found");
    const org = snap.data();
    if (org.ecPassword !== pw) return toast("Wrong password");
    session.role = "ec"; session.orgId = id; saveSession();
    loadECPanel();
    showScreen("ecPanel");
  } catch(e){ console.error(e); toast("Login failed"); }
}

let _orgUnsub = null;
async function loadECPanel(){
  const orgId = session.orgId;
  if (!orgId) return toast("No org in session");
  const ref = doc(db, "organizations", orgId);
  // detach previous listener
  if (_orgUnsub) { try { _orgUnsub(); } catch(e){} _orgUnsub = null; }
  // subscribe to org doc
  _orgUnsub = onSnapshot(ref, snap => {
    if (!snap.exists()) return toast("Org removed");
    const org = snap.data();
    document.getElementById("ecOrgName").textContent = `${org.name} • ${org.id}`;
    document.getElementById("ecOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    applyOrgNeonPalette(org.logoUrl || defaultLogoDataUrl());
    // render active tab content
    const active = document.querySelector("#ecTabs .tab-btn.active")?.getAttribute("data-ec-tab");
    if (active === "dashboard") renderECDashboard(org);
    if (active === "voters") renderECVoters(org);
    if (active === "positions") renderECPositions(org);
    if (active === "candidates") renderECCandidates(org);
    if (active === "settings") renderECSettings(org);
  }, err => console.error("org onSnapshot err", err));
  showECTab("dashboard");
}

function showECTab(tab){
  document.querySelectorAll("#ecTabs .tab-btn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`#ecTabs .tab-btn[data-ec-tab="${tab}"]`);
  if (btn) btn.classList.add("active");
  document.querySelectorAll("[id^='ecContent-']").forEach(c => c.classList.remove("active"));
  const content = document.getElementById("ecContent-" + tab);
  if (content) content.classList.add("active");
  // trigger render now (pull fresh doc)
  getDoc(doc(db,"organizations",session.orgId)).then(snap => {
    if (!snap.exists()) return;
    const org = snap.data();
    if (tab === "dashboard") renderECDashboard(org);
    if (tab === "voters") renderECVoters(org);
    if (tab === "positions") renderECPositions(org);
    if (tab === "candidates") renderECCandidates(org);
    if (tab === "settings") renderECSettings(org);
  }).catch(err => console.error(err));
}

// EC Dashboard
function renderECDashboard(org){
  const el = document.getElementById("ecContent-dashboard");
  const totalVoters = org.voterCount || Object.keys(org.voters || {}).length;
  const totalCandidates = (org.candidates || []).length;
  const totalPositions = (org.positions || []).length;
  const votesCast = Object.keys(org.votes || {}).length;
  const pct = totalVoters ? Math.round((votesCast / totalVoters) * 100) : 0;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="ec-tiles">
        <div class="tile"><div class="label">Total Voters</div><div class="value">${totalVoters}</div></div>
        <div class="tile"><div class="label">Candidates</div><div class="value">${totalCandidates}</div></div>
        <div class="tile"><div class="label">Positions</div><div class="value">${totalPositions}</div></div>
        <div class="tile"><div class="label">Votes Cast</div><div class="value">${votesCast}</div></div>
      </div>
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1">
          <div class="tile">
            <div class="label">Participation</div>
            <div class="progress-row"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></div>
            <div class="subtext">${pct}% participation</div>
          </div>
        </div>
        <div style="min-width:220px">
          <div class="tile">
            <div class="label">Quick Actions</div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
              <button class="btn neon-btn" id="quick-voters">Manage Voters</button>
              <button class="btn neon-btn-outline" id="quick-positions">Manage Positions</button>
              <button class="btn neon-btn-outline" id="quick-candidates">Manage Candidates</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("quick-voters").onclick = ()=> showECTab("voters");
  document.getElementById("quick-positions").onclick = ()=> showECTab("positions");
  document.getElementById("quick-candidates").onclick = ()=> showECTab("candidates");
}

// EC Voters (add/delete/import)
async function renderECVoters(org){
  const el = document.getElementById("ecContent-voters");
  el.innerHTML = `<div class="card"><h3>Add Voter (Email)</h3><input id="ecVoterName" class="input" placeholder="Name (optional)"><input id="ecVoterEmail" class="input" placeholder="Email (required)"><div style="margin-top:8px"><button class="btn neon-btn" id="ecAddBtn">Add</button></div><div style="margin-top:8px"><label class="btn neon-btn-outline">Import Excel<input id="ecVoterExcel" type="file" accept=".xlsx,.xls" style="display:none"></label></div></div><div class="card"><h4>Voters</h4><div id="ecVoterList"></div></div>`;
  document.getElementById("ecAddBtn").onclick = ecAddVoter;
  document.getElementById("ecVoterExcel").onchange = handleECVoterExcel;
  renderECVoterList(org);
}

async function ecAddVoter(){
  const name = document.getElementById("ecVoterName").value.trim();
  const email = (document.getElementById("ecVoterEmail").value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter valid email");
  const orgRef = doc(db,"organizations",session.orgId);
  const snap = await getDoc(orgRef);
  const org = snap.data();
  org.voters = org.voters || {};
  if (org.voters[email]) return toast("Already exists");
  org.voters[email] = { name: name || email.split("@")[0], hasVoted: false };
  org.voterCount = Object.keys(org.voters).length;
  await updateDoc(orgRef, { voters: org.voters, voterCount: org.voterCount });
  document.getElementById("ecVoterName").value = ""; document.getElementById("ecVoterEmail").value = "";
  renderECVoterList(org);
  toast("Voter added");
}

async function renderECVoterList(org){
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const node = document.getElementById("ecVoterList");
  const html = Object.entries(data.voters || {}).map(([e,v]) => `<div class="list-item"><div><strong>${v.name}</strong><br><small>${e}</small><br><small>${v.hasVoted ? 'Voted' : 'Not Voted'}</small></div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-ec-del="${e}">Delete</button></div></div>`).join('') || `<div class="subtext">No voters</div>`;
  node.innerHTML = html;
  node.querySelectorAll("[data-ec-del]").forEach(b => b.onclick = ()=> ecDeleteVoter(b.getAttribute("data-ec-del")));
}

async function ecDeleteVoter(email){
  if (!confirm("Delete voter?")) return;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();
  if (org.votes && org.votes[email]) delete org.votes[email];
  if (org.voters && org.voters[email]) delete org.voters[email];
  org.voterCount = Object.keys(org.voters || {}).length;
  await updateDoc(ref, { voters: org.voters || {}, votes: org.votes || {}, voterCount: org.voterCount });
  renderECVoterList(org);
  toast("Deleted");
}

function handleECVoterExcel(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async evt => {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const ref = doc(db,"organizations",session.orgId);
      const snap = await getDoc(ref);
      const org = snap.data();
      let added = 0, skipped = 0;
      rows.forEach(r => {
        const emailKey = Object.keys(r).find(k => k.toLowerCase() === "email");
        const nameKey = Object.keys(r).find(k => k.toLowerCase() === "name");
        if (!emailKey) { skipped++; return; }
        const email = String(r[emailKey]).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; return; }
        const name = nameKey ? String(r[nameKey]).trim() : email.split("@")[0];
        org.voters = org.voters || {};
        if (org.voters[email]) { skipped++; return; }
        org.voters[email] = { name, hasVoted: false }; added++;
      });
      org.voterCount = Object.keys(org.voters || {}).length;
      await updateDoc(ref, { voters: org.voters, voterCount: org.voterCount });
      renderECVoterList(org);
      toast(`Imported ${added}, skipped ${skipped}`);
      e.target.value = "";
    } catch(err){ console.error(err); toast("Import failed"); }
  };
  reader.readAsArrayBuffer(file);
}

// EC Positions
async function renderECPositions(org){
  const el = document.getElementById("ecContent-positions");
  el.innerHTML = `<div class="card"><h3>Add Position</h3><input id="ecPosName" class="input" placeholder="Position name"><div style="margin-top:8px"><button class="btn neon-btn" id="ecAddPosBtn">Add</button></div></div><div class="card"><h4>Positions</h4><div id="ecPosList"></div></div>`;
  document.getElementById("ecAddPosBtn").onclick = ecAddPosition;
  renderECPositionsList(org);
}
async function ecAddPosition(){
  const name = document.getElementById("ecPosName").value.trim();
  if (!name) return toast("Enter name");
  const id = "pos" + Date.now();
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.positions = org.positions || []; org.positions.push({ id, name });
  await updateDoc(ref, { positions: org.positions });
  document.getElementById("ecPosName").value = ""; renderECPositionsList(org);
}
async function renderECPositionsList(org){
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); org = snap.data();
  const node = document.getElementById("ecPosList");
  const html = (org.positions || []).map(p => `<div class="list-item"><div>${p.name}</div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-pos-del="${p.id}">Delete</button></div></div>`).join('') || `<div class="subtext">No positions</div>`;
  node.innerHTML = html;
  node.querySelectorAll("[data-pos-del]").forEach(b=> b.onclick = ()=> ecDeletePosition(b.getAttribute("data-pos-del")));
}
async function ecDeletePosition(id){
  if (!confirm("Delete position and its candidates?")) return;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.positions = (org.positions || []).filter(p => p.id !== id);
  org.candidates = (org.candidates || []).filter(c => c.positionId !== id);
  Object.keys(org.votes || {}).forEach(email => { if (org.votes[email] && org.votes[email][id]) delete org.votes[email][id]; });
  await updateDoc(ref, { positions: org.positions, candidates: org.candidates, votes: org.votes || {} });
  renderECPositionsList(org); renderECCandidates(org);
}

// EC Candidates w/photo upload
async function renderECCandidates(org){
  const el = document.getElementById("ecContent-candidates");
  const posOptions = (org.positions || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  el.innerHTML = `<div class="card"><h3>Add Candidate</h3><input id="ecCandName" class="input" placeholder="Name"><select id="ecCandPos" class="input">${posOptions}</select><input id="ecCandPhoto" type="file" accept="image/*" class="input"><div style="margin-top:8px"><button class="btn neon-btn" id="ecAddCandBtn">Add</button></div></div><div class="card"><h4>Candidates</h4><div id="ecCandList"></div></div>`;
  document.getElementById("ecAddCandBtn").onclick = ecAddCandidate;
  renderECCandidatesList(org);
}
async function ecAddCandidate(){
  const name = document.getElementById("ecCandName").value.trim();
  const pos = document.getElementById("ecCandPos").value;
  const file = document.getElementById("ecCandPhoto").files[0];
  if (!name || !pos) return toast("Fill required");
  const id = "c" + Date.now();
  let photoUrl = "";
  if (file){
    const data = await fileToDataUrl(file);
    const sRef = storageRef(storage, `orgs/${session.orgId}/candidates/${id}.png`);
    await uploadString(sRef, data, 'data_url');
    photoUrl = await getDownloadURL(sRef);
  }
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.candidates = org.candidates || []; org.candidates.push({ id, name, positionId: pos, photo: photoUrl });
  await updateDoc(ref, { candidates: org.candidates });
  document.getElementById("ecCandName").value = ""; document.getElementById("ecCandPhoto").value = "";
  renderECCandidatesList(org);
  toast("Candidate added");
}
async function renderECCandidatesList(org){
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); org = snap.data();
  const node = document.getElementById("ecCandList");
  const html = (org.candidates || []).map(c => `<div class="list-item"><div style="display:flex;gap:10px;align-items:center"><img src="${c.photo || defaultLogoDataUrl()}" class="candidate-photo"><div><strong>${c.name}</strong><br><small>${(org.positions||[]).find(p=>p.id===c.positionId)?.name||'Unknown'}</small></div></div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-cand-del="${c.id}">Delete</button></div></div>`).join('') || `<div class="subtext">No candidates</div>`;
  node.innerHTML = html;
  node.querySelectorAll("[data-cand-del]").forEach(b=> b.onclick = ()=> ecDeleteCandidate(b.getAttribute("data-cand-del")));
}
async function ecDeleteCandidate(id){
  if (!confirm("Delete candidate?")) return;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.candidates = (org.candidates || []).filter(c => c.id !== id);
  Object.keys(org.votes || {}).forEach(email => { Object.keys(org.votes[email] || {}).forEach(pid => { if (org.votes[email][pid] === id) delete org.votes[email][pid]; }); });
  await updateDoc(ref, { candidates: org.candidates, votes: org.votes || {} });
  renderECCandidatesList(org); toast("Deleted");
}

// EC Settings (start/end times, public link)
async function renderECSettings(org){
  const el = document.getElementById("ecContent-settings");
  const s = org.electionSettings && org.electionSettings.startTime ? new Date(org.electionSettings.startTime).toISOString().slice(0,16) : '';
  const e = org.electionSettings && org.electionSettings.endTime ? new Date(org.electionSettings.endTime).toISOString().slice(0,16) : '';
  el.innerHTML = `<div class="card"><h3>Election Settings</h3>
    <label class="subtext">Start (local)</label><input id="ecStartTime" type="datetime-local" class="input" value="${s}">
    <label class="subtext">End (local)</label><input id="ecEndTime" type="datetime-local" class="input" value="${e}">
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn neon-btn" id="ecSaveTimesBtn">Save Times</button><button class="btn neon-btn-outline" id="ecClearTimesBtn">Clear</button></div>
    <div style="margin-top:12px"><h4>Public Link</h4><button class="btn neon-btn" id="ecGenToken">Generate Token</button> <button class="btn neon-btn-outline" id="ecCopyLink" ${org.publicEnabled && org.publicToken ? '' : 'disabled'}>Copy Public Link</button></div></div>`;
  document.getElementById("ecSaveTimesBtn").onclick = ecSaveTimes;
  document.getElementById("ecClearTimesBtn").onclick = ecClearTimes;
  document.getElementById("ecGenToken").onclick = ecGeneratePublicToken;
  document.getElementById("ecCopyLink").onclick = ecCopyPublicLink;
  // status card
  const status = getOrgStatus(org);
  el.innerHTML += `<div style="margin-top:12px" class="card"><div class="label">Status</div><div>${status.text} • Starts: ${status.startDisplay || '—'} • Ends: ${status.endDisplay || '—'}</div></div>`;
}

async function ecSaveTimes(){
  const s = document.getElementById("ecStartTime").value;
  const e = document.getElementById("ecEndTime").value;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.electionSettings = { startTime: s ? new Date(s).toISOString() : null, endTime: e ? new Date(e).toISOString() : null };
  const now = new Date();
  if (org.electionSettings.startTime && new Date(org.electionSettings.startTime) > now) org.electionStatus = "scheduled";
  else if (org.electionSettings.endTime && new Date(org.electionSettings.endTime) < now) org.electionStatus = "closed";
  else org.electionStatus = "open";
  await updateDoc(ref, { electionSettings: org.electionSettings, electionStatus: org.electionStatus });
  toast("Times saved");
  renderECSettings(org);
}
async function ecClearTimes(){ const ref = doc(db,"organizations",session.orgId); await updateDoc(ref, { electionSettings: { startTime: null, endTime: null }, electionStatus: "open" }); toast("Times cleared"); }
async function ecGeneratePublicToken(){ const ref = doc(db,"organizations",session.orgId); const snap = await getDoc(ref); const org = snap.data(); if (!org.publicToken) org.publicToken = Math.random().toString(36).slice(2,12).toUpperCase(); org.publicEnabled = true; await updateDoc(ref, { publicToken: org.publicToken, publicEnabled: true }); toast("Public token ready"); }
async function ecCopyPublicLink(){ const snap = await getDoc(doc(db,"organizations",session.orgId)); const org = snap.data(); if (!org.publicEnabled || !org.publicToken) return toast("Enable public first"); const link = `${location.origin}${location.pathname}?org=${encodeURIComponent(org.id)}&token=${encodeURIComponent(org.publicToken)}`; await navigator.clipboard.writeText(link); toast("Copied public link"); }

// ----------------- VOTER flow -----------------
let currentOrgId = null, currentVoterEmail = null;

async function prepareVoterForOrg(orgId){
  const snap = await getDoc(doc(db,"organizations",orgId));
  if (!snap.exists()) return toast("Org not found");
  const org = snap.data();
  currentOrgId = orgId;
  document.getElementById("voterOrgName").textContent = `${org.name} • ${orgId}`;
  document.getElementById("voterOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
  applyOrgNeonPalette(org.logoUrl || defaultLogoDataUrl());
  document.getElementById("voterEmail").value = "";
  document.getElementById("voterOTP").value = "";
  document.getElementById("voterOTPSection").classList.add("hidden");
}

async function sendVoterOTP(){
  const email = (document.getElementById("voterEmail").value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter valid email");
  if (!currentOrgId) return toast("No org selected");
  const snap = await getDoc(doc(db,"organizations",currentOrgId));
  const org = snap.data();
  if (!org.voters || !org.voters[email]) return toast("Email not registered");
  if (org.voters[email].hasVoted) return toast("You already voted");
  const status = getOrgStatus(org);
  if (status.text !== "Active") return toast("Voting not active");
  // Demo OTP — production: send via email/SMS provider
  const otp = "123456";
  session.pendingVoter = { orgId: currentOrgId, email, otp }; saveSession();
  document.getElementById("voterOTPSection").classList.remove("hidden");
  toast("OTP (demo) sent: 123456");
}

async function verifyVoterOTP(){
  const code = (document.getElementById("voterOTP").value || "").trim();
  if (!session.pendingVoter) return toast("No pending login");
  if (code !== session.pendingVoter.otp) return toast("Invalid OTP");
  currentOrgId = session.pendingVoter.orgId;
  currentVoterEmail = session.pendingVoter.email;
  delete session.pendingVoter; saveSession();
  const snap = await getDoc(doc(db,"organizations",currentOrgId));
  const org = snap.data();
  document.getElementById("voterNameLabel").textContent = org.voters[currentVoterEmail].name;
  loadVotingScreen();
  showScreen("votingScreen");
}

async function loadVotingScreen(){
  const snap = await getDoc(doc(db,"organizations",currentOrgId));
  const org = snap.data();
  const container = document.getElementById("votingPositions"); container.innerHTML = "";
  (org.positions || []).forEach(pos => {
    const card = document.createElement("div"); card.className = "list-item";
    const title = document.createElement("div"); title.innerHTML = `<strong>${pos.name}</strong>`;
    const options = document.createElement("div"); options.style.flex = "1";
    const candList = (org.candidates || []).filter(c => c.positionId === pos.id);
    if (candList.length === 1) {
      const c = candList[0];
      options.innerHTML = `<label style="display:flex;align-items:center;gap:10px"><input type="radio" name="pos-${pos.id}" value="${c.id}"> YES — ${c.name}</label>
                           <label style="display:flex;align-items:center;gap:10px;margin-top:6px"><input type="radio" name="pos-${pos.id}" value="__NO__"> NO</label>`;
    } else {
      candList.forEach(c => {
        const label = document.createElement("label");
        label.style.display = "flex"; label.style.justifyContent = "space-between"; label.style.alignItems = "center"; label.style.marginBottom = "8px";
        label.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><img src="${c.photo || defaultLogoDataUrl()}" class="candidate-photo"><div><strong>${c.name}</strong></div></div><input type="radio" name="pos-${pos.id}" value="${c.id}">`;
        options.appendChild(label);
      });
    }
    card.appendChild(title); card.appendChild(options); container.appendChild(card);
  });
}

async function submitVote(){
  if (!currentVoterEmail || !currentOrgId) return toast("Not authenticated");
  const ref = doc(db,"organizations",currentOrgId);
  const snap = await getDoc(ref); const org = snap.data();
  const status = getOrgStatus(org); if (status.text !== "Active") return toast("Voting not active");
  const selections = {}; let all = true;
  (org.positions || []).forEach(pos => {
    const sel = document.querySelector(`input[name="pos-${pos.id}"]:checked`);
    if (sel) selections[pos.id] = sel.value; else all = false;
  });
  if (!all) return toast("Please vote for all positions");
  const receipt = Math.random().toString(36).slice(2,12).toUpperCase();
  org.votes = org.votes || {};
  org.votes[currentVoterEmail] = { choices: selections, timestamp: new Date().toISOString(), receipt };
  org.voters[currentVoterEmail].hasVoted = true;
  org.voterCount = Object.keys(org.voters || {}).length;
  await updateDoc(ref, { votes: org.votes, voters: org.voters, voterCount: org.voterCount });
  toast("Vote recorded");
  currentVoterEmail = null;
  setTimeout(()=> showScreen("gatewayScreen"), 900);
}

// Public results — read-only
async function renderPublicResults(orgId){
  const snap = await getDoc(doc(db,"organizations",orgId));
  if (!snap.exists()) return toast("Org not found");
  const org = snap.data();
  document.getElementById("publicOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
  document.getElementById("publicOrgName").textContent = org.name;
  const box = document.getElementById("publicResults"); box.innerHTML = "";
  (org.positions || []).forEach(pos => {
    const card = document.createElement("div"); card.className = "list-item";
    card.innerHTML = `<h4>${pos.name}</h4>`;
    const counts = {}; let total = 0;
    Object.values(org.votes || {}).forEach(v => { if (v.choices && v.choices[pos.id]) { counts[v.choices[pos.id]] = (counts[v.choices[pos.id]] || 0) + 1; total++; }});
    (org.candidates || []).filter(c=>c.positionId===pos.id).forEach(c=>{
      const n = counts[c.id]||0; const pct = total?Math.round((n/total)*100):0;
      const row = document.createElement("div"); row.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${c.name}</strong><div class="subtext">${n} votes</div></div><div>${pct}%</div></div>`;
      card.appendChild(row);
    });
    if (counts['__NO__']) { const no = counts['__NO__']||0; const pctNo = total?Math.round((no/total)*100):0; const row = document.createElement("div"); row.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>NO</strong><div class="subtext">${no} votes</div></div><div>${pctNo}%</div></div>`; card.appendChild(row); }
    box.appendChild(card);
  });
}

// Guest portal
function renderGuestContent(){
  const box = document.getElementById("guestContent");
  box.innerHTML = `<div class="card"><h3>Guest Portal</h3><p>Use demo public link or ask org EC for their public token to view results.</p></div>`;
}

/* ----------------- Utilities ----------------- */
function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = e=> res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function defaultLogoDataUrl(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#0b0720"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="#9D00FF" font-family="Inter, Arial">ORG</text></svg>`);
}
function getDominantColorFromImage(dataUrl, cb){
  if (!dataUrl) return cb({r:157,g:0,b:255});
  const img = new Image(); img.crossOrigin="Anonymous"; img.src = dataUrl;
  img.onload = ()=>{
    const canvas = document.createElement("canvas"); canvas.width=80; canvas.height=80;
    const ctx = canvas.getContext("2d"); ctx.drawImage(img,0,0,80,80);
    const d = ctx.getImageData(0,0,80,80).data;
    let r=0,g=0,b=0,c=0;
    for (let i=0;i<d.length;i+=4){ const a=d[i+3]; if (a<128) continue; r+=d[i]; g+=d[i+1]; b+=d[i+2]; c++; }
    if (!c) return cb({r:157,g:0,b:255}); cb({r:Math.round(r/c), g:Math.round(g/c), b:Math.round(b/c)});
  };
  img.onerror = ()=> cb({r:157,g:0,b:255});
}
function rgbToNeonHex({r,g,b}){ r=Math.min(255,r+40); g=Math.min(255,g+10); b=Math.min(255,b+80); return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1); }
function applyOrgNeonPalette(dataUrl){ getDominantColorFromImage(dataUrl, rgb => { const neon = rgbToNeonHex(rgb); document.documentElement.style.setProperty('--dynamic-neon', neon); }); }
function generateStrongPassword(){ const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?"; let p=""; for (let i=0;i<10;i++) p+=chars[Math.floor(Math.random()*chars.length)]; return p; }

function getOrgStatus(org){
  const s = org.electionSettings && org.electionSettings.startTime ? new Date(org.electionSettings.startTime) : null;
  const e = org.electionSettings && org.electionSettings.endTime ? new Date(org.electionSettings.endTime) : null;
  const now = new Date();
  if (org.electionStatus === 'declared') return { text: 'Declared', startDisplay: s ? s.toLocaleString() : null, endDisplay: e ? e.toLocaleString() : null };
  if (org.electionStatus === 'closed') return { text: 'Closed', startDisplay: s ? s.toLocaleString() : null, endDisplay: e ? e.toLocaleString() : null };
  if (s && now < s) return { text: 'Scheduled', startDisplay: s.toLocaleString(), endDisplay: e ? e.toLocaleString() : null };
  if (e && now > e) return { text: 'Ended', startDisplay: s ? s.toLocaleString() : null, endDisplay: e.toLocaleString() };
  return { text: 'Active', startDisplay: s ? s.toLocaleString() : null, endDisplay: e ? e.toLocaleString() : null };
}

/* ----------------- Logout (robust) ----------------- */
async function logout(){
  try {
    if (_orgUnsub) { try { _orgUnsub(); } catch(e){} _orgUnsub = null; }
    // firebase auth sign out if used
    try { await signOut(auth).catch(()=>{}); } catch(e){}
    session = {}; saveSession();
    currentOrgId = null; currentVoterEmail = null;
    history.replaceState({}, "", location.pathname);
    showScreen("gatewayScreen");
    toast("Logged out");
  } catch(err){ console.error(err); toast("Logout failed"); }
}

/* ----------------- Init: wire UI + restore session ----------------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  // wire gateway buttons
  document.getElementById("btn-superadmin").onclick = ()=> showScreen("superAdminLoginScreen");
  document.getElementById("btn-ec").onclick = ()=> showScreen("ecLoginScreen");
  document.getElementById("btn-voter").onclick = async ()=>{
    const id = prompt("Organization ID (e.g. ORG-10001)");
    if (!id) return;
    try {
      const snap = await getDoc(doc(db,"organizations",id));
      if (!snap.exists()) { toast("Org not found"); return; }
      const org = snap.data();
      await prepareVoterForOrg(id);
      showScreen("voterLoginScreen");
      history.replaceState({}, "", `${location.pathname}?org=${encodeURIComponent(id)}`);
    } catch(e){ console.error(e); toast("Error"); }
  };
  document.getElementById("btn-public").onclick = async ()=>{
    const id = prompt("Organization ID for public results");
    if (!id) return;
    await renderPublicResults(id); showScreen("publicScreen");
  };
  document.getElementById("btn-guest").onclick = ()=> { renderGuestContent(); showScreen("guestScreen"); };

  // wire back buttons & login buttons
  document.getElementById("super-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("ec-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("voter-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("public-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("guest-back").onclick = ()=> showScreen("gatewayScreen");

  document.getElementById("super-login-btn").onclick = loginSuperAdmin;
  document.getElementById("ec-login-btn").onclick = loginEC;
  document.getElementById("voter-send-otp").onclick = sendVoterOTP;
  document.getElementById("voter-verify-otp").onclick = verifyVoterOTP;
  document.getElementById("submit-vote-btn").onclick = submitVote;

  // logout buttons
  document.querySelectorAll(".logout-btn").forEach(b => b.onclick = logout);

  // superadmin tabs
  document.querySelectorAll(".tab-btn[data-super-tab]").forEach(b => b.onclick = ()=> {
    document.querySelectorAll(".tab-btn[data-super-tab]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.getAttribute("data-super-tab");
    document.querySelectorAll("#superAdminPanel .tab-content").forEach(c => c.classList.remove("active"));
    document.getElementById("superContent-" + tab).classList.add("active");
    if (tab === "orgs") renderSuperOrgs(); else renderSuperSettings();
  });

  // ec tabs (wire)
  document.querySelectorAll("#ecTabs .tab-btn").forEach(b => {
    b.onclick = ()=> { document.querySelectorAll("#ecTabs .tab-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active"); showECTab(b.getAttribute("data-ec-tab")); };
  });

  // quick restore session: if EC session exists, load panel
  if (session && session.role === 'ec' && session.orgId){
    try { loadECPanel(); showScreen("ecPanel"); } catch(e){ console.warn(e); showScreen("gatewayScreen"); }
  } else {
    // if ?org=... in url, auto-open voter flow (public token handled)
    const params = new URLSearchParams(location.search);
    const orgParam = params.get("org");
    const token = params.get("token");
    if (orgParam) {
      const snap = await getDoc(doc(db,"organizations",orgParam));
      if (!snap.exists()) { showScreen("gatewayScreen"); return; }
      const org = snap.data();
      if (token && org.publicEnabled && org.publicToken === token) { await renderPublicResults(orgParam); showScreen("publicScreen"); return; }
      await prepareVoterForOrg(orgParam);
      showScreen("voterLoginScreen");
      return;
    }
    showScreen("gatewayScreen");
  }

  // expose for debugging convenience
  window.logout = logout;
  window.ownerCreateOrg = ownerCreateOrg;
  window.renderSuperOrgs = renderSuperOrgs;
  window.renderPublicResults = renderPublicResults;
});

// save session on unload
window.addEventListener("beforeunload", ()=> saveSession());
// script.js (type=module) — Firebase Real-time Cloud version
// Uses Firestore + Storage. Exposes necessary UI handlers to window.

// ----------------- FIREBASE CONFIG (paste provided config) -----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, addDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

/* ---------- Replace with your Firebase web config (you gave this earlier) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

const firebaseApp = initializeApp(firebaseConfig);
try { getAnalytics(firebaseApp); } catch(e){ /* analytics optional */ }

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const auth = getAuth(firebaseApp);

// ----------------- Lightweight helpers & session -----------------
const SESSION_KEY = "neon_voting_session_v2";

let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
function saveSession(){ localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

function toast(msg){ const t = document.getElementById("toast"); if(!t) return; t.textContent = msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 3000); }

// screen helper — ensures only one active screen (no split)
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.setAttribute("aria-hidden","true");
  });
  const el = document.getElementById(id);
  if(el){ el.classList.add("active"); el.setAttribute("aria-hidden","false"); window.scrollTo({top:0,behavior:'smooth'}); }
}

/* ----------------- SUPERADMIN flows -----------------
   Superadmin credentials are stored server-side in Firestore doc "meta/superadmin".
   On first run we create a demo password ("superadmin123") if not present.
------------------------------------------------------------------*/
async function loginSuperAdmin(){
  const pw = document.getElementById("superAdminPassword").value || "";
  const metaRef = doc(db, "meta", "superadmin");
  try {
    const snap = await getDoc(metaRef);
    if (!snap.exists()){
      await setDoc(metaRef, { password: "superadmin123" });
      toast("Demo superadmin created: superadmin123");
      session.role = "owner"; saveSession(); renderSuperOrgs(); showScreen("superAdminPanel");
      return;
    }
    const data = snap.data();
    if (pw !== data.password) return toast("Wrong password");
    session.role = "owner"; saveSession(); renderSuperOrgs(); showScreen("superAdminPanel");
  } catch(err){ console.error(err); toast("SuperAdmin login error"); }
}

// Render organizations for superadmin
async function renderSuperOrgs(){
  const container = document.getElementById("superContent-orgs");
  container.innerHTML = `<div class="subtext">Loading...</div>`;
  try {
    const col = collection(db, "organizations");
    const snaps = await getDocs(col);
    let html = `<div class="card"><h3>Create Organization</h3>
      <input id="ownerNewOrgName" class="input" placeholder="Organization name">
      <input id="ownerNewOrgPass" class="input" placeholder="EC password (optional)">
      <input id="ownerNewOrgLogo" type="file" accept="image/*" class="input">
      <div style="margin-top:8px"><button class="btn neon-btn" id="ownerCreateBtn">Create</button></div></div>`;
    html += `<h3 style="margin-top:12px">Existing Organizations</h3>`;
    snaps.forEach(s => {
      const org = s.data();
      html += `<div class="list-item"><div><strong>${org.name}</strong><br><small>${s.id}</small><br><small>Voters: ${org.voterCount || 0}</small></div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-owner-open="${s.id}">Open</button><button class="btn neon-btn-outline" data-owner-public="${s.id}">${org.publicEnabled ? 'Disable Public' : 'Enable Public'}</button><button class="btn neon-btn-outline" data-owner-delete="${s.id}">Delete</button></div></div>`;
    });
    html += `<div style="margin-top:12px"><button class="btn neon-btn-outline" id="ownerShowPasswords">Show Org Passwords</button><button class="btn neon-btn-outline" id="ownerResetAll" style="margin-left:8px">Reset ALL Data</button></div>`;
    container.innerHTML = html;

    // wire create
    document.getElementById("ownerCreateBtn").onclick = ownerCreateOrg;
    document.querySelectorAll("[data-owner-open]").forEach(b => b.onclick = ()=>ownerOpenEc(b.getAttribute("data-owner-open")));
    document.querySelectorAll("[data-owner-public]").forEach(b => b.onclick = ()=>ownerTogglePublic(b.getAttribute("data-owner-public")));
    document.querySelectorAll("[data-owner-delete]").forEach(b => b.onclick = ()=>ownerDeleteOrg(b.getAttribute("data-owner-delete")));
    document.getElementById("ownerShowPasswords").onclick = ownerShowPasswords;
    document.getElementById("ownerResetAll").onclick = ownerResetAllData;

  } catch(err){ console.error(err); container.innerHTML = `<div class="subtext">Failed to load orgs</div>`; }
}

async function ownerCreateOrg(){
  const name = document.getElementById("ownerNewOrgName").value?.trim();
  let pass = document.getElementById("ownerNewOrgPass").value?.trim();
  const file = document.getElementById("ownerNewOrgLogo").files[0];
  if (!name) return toast("Name required");
  if (!pass) pass = generateStrongPassword();
  const id = "ORG-" + Math.floor(10000 + Math.random() * 90000);
  const orgRef = doc(db, "organizations", id);
  try {
    let logoUrl = "";
    if (file){
      const data = await fileToDataUrl(file);
      const sRef = storageRef(storage, `orgs/${id}/logo.png`);
      await uploadString(sRef, data, 'data_url');
      logoUrl = await getDownloadURL(sRef);
    }
    await setDoc(orgRef, {
      id, name, logoUrl, ecPassword: pass, publicEnabled: false, publicToken: null,
      voters: {}, positions: [], candidates: [], votes: {}, electionSettings: { startTime: null, endTime: null }, electionStatus: "scheduled", voterCount: 0
    });
    toast(`Created ${id}. EC pass: ${pass}`);
    renderSuperOrgs();
  } catch(err){ console.error(err); toast("Create org failed"); }
}

async function ownerOpenEc(id){ document.getElementById("ecOrgId").value = id; showScreen("ecLoginScreen"); }
async function ownerTogglePublic(id){
  const ref = doc(db, "organizations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return toast("Org gone");
  const org = snap.data();
  const updates = { publicEnabled: !org.publicEnabled };
  if (!org.publicToken) updates.publicToken = (Math.random().toString(36).slice(2,12)).toUpperCase();
  await updateDoc(ref, updates);
  toast(updates.publicEnabled ? "Public enabled" : "Public disabled");
  renderSuperOrgs();
}
async function ownerDeleteOrg(id){
  if(!confirm("Delete organization and ALL its data? (Firestore console recommended for complete removal)")) return;
  try {
    await setDoc(doc(db,"organizations",id), {}); // mark empty — full deletion to be performed in console/admin
    toast("Marked org removed (console cleanup may be required)");
    renderSuperOrgs();
  } catch(e){ console.error(e); toast("Delete failed"); }
}
async function ownerShowPasswords(){
  const snaps = await getDocs(collection(db,"organizations"));
  let msg = "Org passwords:\n\n";
  snaps.forEach(s => { const o = s.data(); msg += `${o.name} (${s.id}) -> ${o.ecPassword}\n`; });
  alert(msg);
}
async function ownerResetAllData(){
  if(!confirm("Reset ALL data? This will not fully delete Firestore - use console for full deletion. Continue?")) return;
  // Demo: set a version marker doc
  await setDoc(doc(db,"meta","reset_marker"), { ts: new Date().toISOString() });
  toast("Marked reset (use Firebase console to purge actual collections)");
}

// ----------------- EC flows (Firestore-backed) -----------------
async function loginEC(){
  const id = document.getElementById("ecOrgId").value?.trim();
  const pw = document.getElementById("ecPassword").value || "";
  if (!id) return toast("Enter org id");
  const ref = doc(db,"organizations",id);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return toast("Org not found");
    const org = snap.data();
    if (org.ecPassword !== pw) return toast("Wrong password");
    session.role = "ec"; session.orgId = id; saveSession();
    loadECPanel();
    showScreen("ecPanel");
  } catch(e){ console.error(e); toast("Login failed"); }
}

let _orgUnsub = null;
async function loadECPanel(){
  const orgId = session.orgId;
  if (!orgId) return toast("No org in session");
  const ref = doc(db, "organizations", orgId);
  // detach previous listener
  if (_orgUnsub) { try { _orgUnsub(); } catch(e){} _orgUnsub = null; }
  // subscribe to org doc
  _orgUnsub = onSnapshot(ref, snap => {
    if (!snap.exists()) return toast("Org removed");
    const org = snap.data();
    document.getElementById("ecOrgName").textContent = `${org.name} • ${org.id}`;
    document.getElementById("ecOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
    applyOrgNeonPalette(org.logoUrl || defaultLogoDataUrl());
    // render active tab content
    const active = document.querySelector("#ecTabs .tab-btn.active")?.getAttribute("data-ec-tab");
    if (active === "dashboard") renderECDashboard(org);
    if (active === "voters") renderECVoters(org);
    if (active === "positions") renderECPositions(org);
    if (active === "candidates") renderECCandidates(org);
    if (active === "settings") renderECSettings(org);
  }, err => console.error("org onSnapshot err", err));
  showECTab("dashboard");
}

function showECTab(tab){
  document.querySelectorAll("#ecTabs .tab-btn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`#ecTabs .tab-btn[data-ec-tab="${tab}"]`);
  if (btn) btn.classList.add("active");
  document.querySelectorAll("[id^='ecContent-']").forEach(c => c.classList.remove("active"));
  const content = document.getElementById("ecContent-" + tab);
  if (content) content.classList.add("active");
  // trigger render now (pull fresh doc)
  getDoc(doc(db,"organizations",session.orgId)).then(snap => {
    if (!snap.exists()) return;
    const org = snap.data();
    if (tab === "dashboard") renderECDashboard(org);
    if (tab === "voters") renderECVoters(org);
    if (tab === "positions") renderECPositions(org);
    if (tab === "candidates") renderECCandidates(org);
    if (tab === "settings") renderECSettings(org);
  }).catch(err => console.error(err));
}

// EC Dashboard
function renderECDashboard(org){
  const el = document.getElementById("ecContent-dashboard");
  const totalVoters = org.voterCount || Object.keys(org.voters || {}).length;
  const totalCandidates = (org.candidates || []).length;
  const totalPositions = (org.positions || []).length;
  const votesCast = Object.keys(org.votes || {}).length;
  const pct = totalVoters ? Math.round((votesCast / totalVoters) * 100) : 0;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="ec-tiles">
        <div class="tile"><div class="label">Total Voters</div><div class="value">${totalVoters}</div></div>
        <div class="tile"><div class="label">Candidates</div><div class="value">${totalCandidates}</div></div>
        <div class="tile"><div class="label">Positions</div><div class="value">${totalPositions}</div></div>
        <div class="tile"><div class="label">Votes Cast</div><div class="value">${votesCast}</div></div>
      </div>
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1">
          <div class="tile">
            <div class="label">Participation</div>
            <div class="progress-row"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></div>
            <div class="subtext">${pct}% participation</div>
          </div>
        </div>
        <div style="min-width:220px">
          <div class="tile">
            <div class="label">Quick Actions</div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
              <button class="btn neon-btn" id="quick-voters">Manage Voters</button>
              <button class="btn neon-btn-outline" id="quick-positions">Manage Positions</button>
              <button class="btn neon-btn-outline" id="quick-candidates">Manage Candidates</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("quick-voters").onclick = ()=> showECTab("voters");
  document.getElementById("quick-positions").onclick = ()=> showECTab("positions");
  document.getElementById("quick-candidates").onclick = ()=> showECTab("candidates");
}

// EC Voters (add/delete/import)
async function renderECVoters(org){
  const el = document.getElementById("ecContent-voters");
  el.innerHTML = `<div class="card"><h3>Add Voter (Email)</h3><input id="ecVoterName" class="input" placeholder="Name (optional)"><input id="ecVoterEmail" class="input" placeholder="Email (required)"><div style="margin-top:8px"><button class="btn neon-btn" id="ecAddBtn">Add</button></div><div style="margin-top:8px"><label class="btn neon-btn-outline">Import Excel<input id="ecVoterExcel" type="file" accept=".xlsx,.xls" style="display:none"></label></div></div><div class="card"><h4>Voters</h4><div id="ecVoterList"></div></div>`;
  document.getElementById("ecAddBtn").onclick = ecAddVoter;
  document.getElementById("ecVoterExcel").onchange = handleECVoterExcel;
  renderECVoterList(org);
}

async function ecAddVoter(){
  const name = document.getElementById("ecVoterName").value.trim();
  const email = (document.getElementById("ecVoterEmail").value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter valid email");
  const orgRef = doc(db,"organizations",session.orgId);
  const snap = await getDoc(orgRef);
  const org = snap.data();
  org.voters = org.voters || {};
  if (org.voters[email]) return toast("Already exists");
  org.voters[email] = { name: name || email.split("@")[0], hasVoted: false };
  org.voterCount = Object.keys(org.voters).length;
  await updateDoc(orgRef, { voters: org.voters, voterCount: org.voterCount });
  document.getElementById("ecVoterName").value = ""; document.getElementById("ecVoterEmail").value = "";
  renderECVoterList(org);
  toast("Voter added");
}

async function renderECVoterList(org){
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const node = document.getElementById("ecVoterList");
  const html = Object.entries(data.voters || {}).map(([e,v]) => `<div class="list-item"><div><strong>${v.name}</strong><br><small>${e}</small><br><small>${v.hasVoted ? 'Voted' : 'Not Voted'}</small></div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-ec-del="${e}">Delete</button></div></div>`).join('') || `<div class="subtext">No voters</div>`;
  node.innerHTML = html;
  node.querySelectorAll("[data-ec-del]").forEach(b => b.onclick = ()=> ecDeleteVoter(b.getAttribute("data-ec-del")));
}

async function ecDeleteVoter(email){
  if (!confirm("Delete voter?")) return;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();
  if (org.votes && org.votes[email]) delete org.votes[email];
  if (org.voters && org.voters[email]) delete org.voters[email];
  org.voterCount = Object.keys(org.voters || {}).length;
  await updateDoc(ref, { voters: org.voters || {}, votes: org.votes || {}, voterCount: org.voterCount });
  renderECVoterList(org);
  toast("Deleted");
}

function handleECVoterExcel(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async evt => {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const ref = doc(db,"organizations",session.orgId);
      const snap = await getDoc(ref);
      const org = snap.data();
      let added = 0, skipped = 0;
      rows.forEach(r => {
        const emailKey = Object.keys(r).find(k => k.toLowerCase() === "email");
        const nameKey = Object.keys(r).find(k => k.toLowerCase() === "name");
        if (!emailKey) { skipped++; return; }
        const email = String(r[emailKey]).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; return; }
        const name = nameKey ? String(r[nameKey]).trim() : email.split("@")[0];
        org.voters = org.voters || {};
        if (org.voters[email]) { skipped++; return; }
        org.voters[email] = { name, hasVoted: false }; added++;
      });
      org.voterCount = Object.keys(org.voters || {}).length;
      await updateDoc(ref, { voters: org.voters, voterCount: org.voterCount });
      renderECVoterList(org);
      toast(`Imported ${added}, skipped ${skipped}`);
      e.target.value = "";
    } catch(err){ console.error(err); toast("Import failed"); }
  };
  reader.readAsArrayBuffer(file);
}

// EC Positions
async function renderECPositions(org){
  const el = document.getElementById("ecContent-positions");
  el.innerHTML = `<div class="card"><h3>Add Position</h3><input id="ecPosName" class="input" placeholder="Position name"><div style="margin-top:8px"><button class="btn neon-btn" id="ecAddPosBtn">Add</button></div></div><div class="card"><h4>Positions</h4><div id="ecPosList"></div></div>`;
  document.getElementById("ecAddPosBtn").onclick = ecAddPosition;
  renderECPositionsList(org);
}
async function ecAddPosition(){
  const name = document.getElementById("ecPosName").value.trim();
  if (!name) return toast("Enter name");
  const id = "pos" + Date.now();
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.positions = org.positions || []; org.positions.push({ id, name });
  await updateDoc(ref, { positions: org.positions });
  document.getElementById("ecPosName").value = ""; renderECPositionsList(org);
}
async function renderECPositionsList(org){
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); org = snap.data();
  const node = document.getElementById("ecPosList");
  const html = (org.positions || []).map(p => `<div class="list-item"><div>${p.name}</div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-pos-del="${p.id}">Delete</button></div></div>`).join('') || `<div class="subtext">No positions</div>`;
  node.innerHTML = html;
  node.querySelectorAll("[data-pos-del]").forEach(b=> b.onclick = ()=> ecDeletePosition(b.getAttribute("data-pos-del")));
}
async function ecDeletePosition(id){
  if (!confirm("Delete position and its candidates?")) return;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.positions = (org.positions || []).filter(p => p.id !== id);
  org.candidates = (org.candidates || []).filter(c => c.positionId !== id);
  Object.keys(org.votes || {}).forEach(email => { if (org.votes[email] && org.votes[email][id]) delete org.votes[email][id]; });
  await updateDoc(ref, { positions: org.positions, candidates: org.candidates, votes: org.votes || {} });
  renderECPositionsList(org); renderECCandidates(org);
}

// EC Candidates w/photo upload
async function renderECCandidates(org){
  const el = document.getElementById("ecContent-candidates");
  const posOptions = (org.positions || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  el.innerHTML = `<div class="card"><h3>Add Candidate</h3><input id="ecCandName" class="input" placeholder="Name"><select id="ecCandPos" class="input">${posOptions}</select><input id="ecCandPhoto" type="file" accept="image/*" class="input"><div style="margin-top:8px"><button class="btn neon-btn" id="ecAddCandBtn">Add</button></div></div><div class="card"><h4>Candidates</h4><div id="ecCandList"></div></div>`;
  document.getElementById("ecAddCandBtn").onclick = ecAddCandidate;
  renderECCandidatesList(org);
}
async function ecAddCandidate(){
  const name = document.getElementById("ecCandName").value.trim();
  const pos = document.getElementById("ecCandPos").value;
  const file = document.getElementById("ecCandPhoto").files[0];
  if (!name || !pos) return toast("Fill required");
  const id = "c" + Date.now();
  let photoUrl = "";
  if (file){
    const data = await fileToDataUrl(file);
    const sRef = storageRef(storage, `orgs/${session.orgId}/candidates/${id}.png`);
    await uploadString(sRef, data, 'data_url');
    photoUrl = await getDownloadURL(sRef);
  }
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.candidates = org.candidates || []; org.candidates.push({ id, name, positionId: pos, photo: photoUrl });
  await updateDoc(ref, { candidates: org.candidates });
  document.getElementById("ecCandName").value = ""; document.getElementById("ecCandPhoto").value = "";
  renderECCandidatesList(org);
  toast("Candidate added");
}
async function renderECCandidatesList(org){
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); org = snap.data();
  const node = document.getElementById("ecCandList");
  const html = (org.candidates || []).map(c => `<div class="list-item"><div style="display:flex;gap:10px;align-items:center"><img src="${c.photo || defaultLogoDataUrl()}" class="candidate-photo"><div><strong>${c.name}</strong><br><small>${(org.positions||[]).find(p=>p.id===c.positionId)?.name||'Unknown'}</small></div></div><div style="display:flex;gap:8px"><button class="btn neon-btn-outline" data-cand-del="${c.id}">Delete</button></div></div>`).join('') || `<div class="subtext">No candidates</div>`;
  node.innerHTML = html;
  node.querySelectorAll("[data-cand-del]").forEach(b=> b.onclick = ()=> ecDeleteCandidate(b.getAttribute("data-cand-del")));
}
async function ecDeleteCandidate(id){
  if (!confirm("Delete candidate?")) return;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.candidates = (org.candidates || []).filter(c => c.id !== id);
  Object.keys(org.votes || {}).forEach(email => { Object.keys(org.votes[email] || {}).forEach(pid => { if (org.votes[email][pid] === id) delete org.votes[email][pid]; }); });
  await updateDoc(ref, { candidates: org.candidates, votes: org.votes || {} });
  renderECCandidatesList(org); toast("Deleted");
}

// EC Settings (start/end times, public link)
async function renderECSettings(org){
  const el = document.getElementById("ecContent-settings");
  const s = org.electionSettings && org.electionSettings.startTime ? new Date(org.electionSettings.startTime).toISOString().slice(0,16) : '';
  const e = org.electionSettings && org.electionSettings.endTime ? new Date(org.electionSettings.endTime).toISOString().slice(0,16) : '';
  el.innerHTML = `<div class="card"><h3>Election Settings</h3>
    <label class="subtext">Start (local)</label><input id="ecStartTime" type="datetime-local" class="input" value="${s}">
    <label class="subtext">End (local)</label><input id="ecEndTime" type="datetime-local" class="input" value="${e}">
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn neon-btn" id="ecSaveTimesBtn">Save Times</button><button class="btn neon-btn-outline" id="ecClearTimesBtn">Clear</button></div>
    <div style="margin-top:12px"><h4>Public Link</h4><button class="btn neon-btn" id="ecGenToken">Generate Token</button> <button class="btn neon-btn-outline" id="ecCopyLink" ${org.publicEnabled && org.publicToken ? '' : 'disabled'}>Copy Public Link</button></div></div>`;
  document.getElementById("ecSaveTimesBtn").onclick = ecSaveTimes;
  document.getElementById("ecClearTimesBtn").onclick = ecClearTimes;
  document.getElementById("ecGenToken").onclick = ecGeneratePublicToken;
  document.getElementById("ecCopyLink").onclick = ecCopyPublicLink;
  // status card
  const status = getOrgStatus(org);
  el.innerHTML += `<div style="margin-top:12px" class="card"><div class="label">Status</div><div>${status.text} • Starts: ${status.startDisplay || '—'} • Ends: ${status.endDisplay || '—'}</div></div>`;
}

async function ecSaveTimes(){
  const s = document.getElementById("ecStartTime").value;
  const e = document.getElementById("ecEndTime").value;
  const ref = doc(db,"organizations",session.orgId);
  const snap = await getDoc(ref); const org = snap.data();
  org.electionSettings = { startTime: s ? new Date(s).toISOString() : null, endTime: e ? new Date(e).toISOString() : null };
  const now = new Date();
  if (org.electionSettings.startTime && new Date(org.electionSettings.startTime) > now) org.electionStatus = "scheduled";
  else if (org.electionSettings.endTime && new Date(org.electionSettings.endTime) < now) org.electionStatus = "closed";
  else org.electionStatus = "open";
  await updateDoc(ref, { electionSettings: org.electionSettings, electionStatus: org.electionStatus });
  toast("Times saved");
  renderECSettings(org);
}
async function ecClearTimes(){ const ref = doc(db,"organizations",session.orgId); await updateDoc(ref, { electionSettings: { startTime: null, endTime: null }, electionStatus: "open" }); toast("Times cleared"); }
async function ecGeneratePublicToken(){ const ref = doc(db,"organizations",session.orgId); const snap = await getDoc(ref); const org = snap.data(); if (!org.publicToken) org.publicToken = Math.random().toString(36).slice(2,12).toUpperCase(); org.publicEnabled = true; await updateDoc(ref, { publicToken: org.publicToken, publicEnabled: true }); toast("Public token ready"); }
async function ecCopyPublicLink(){ const snap = await getDoc(doc(db,"organizations",session.orgId)); const org = snap.data(); if (!org.publicEnabled || !org.publicToken) return toast("Enable public first"); const link = `${location.origin}${location.pathname}?org=${encodeURIComponent(org.id)}&token=${encodeURIComponent(org.publicToken)}`; await navigator.clipboard.writeText(link); toast("Copied public link"); }

// ----------------- VOTER flow -----------------
let currentOrgId = null, currentVoterEmail = null;

async function prepareVoterForOrg(orgId){
  const snap = await getDoc(doc(db,"organizations",orgId));
  if (!snap.exists()) return toast("Org not found");
  const org = snap.data();
  currentOrgId = orgId;
  document.getElementById("voterOrgName").textContent = `${org.name} • ${orgId}`;
  document.getElementById("voterOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
  applyOrgNeonPalette(org.logoUrl || defaultLogoDataUrl());
  document.getElementById("voterEmail").value = "";
  document.getElementById("voterOTP").value = "";
  document.getElementById("voterOTPSection").classList.add("hidden");
}

async function sendVoterOTP(){
  const email = (document.getElementById("voterEmail").value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter valid email");
  if (!currentOrgId) return toast("No org selected");
  const snap = await getDoc(doc(db,"organizations",currentOrgId));
  const org = snap.data();
  if (!org.voters || !org.voters[email]) return toast("Email not registered");
  if (org.voters[email].hasVoted) return toast("You already voted");
  const status = getOrgStatus(org);
  if (status.text !== "Active") return toast("Voting not active");
  // Demo OTP — production: send via email/SMS provider
  const otp = "123456";
  session.pendingVoter = { orgId: currentOrgId, email, otp }; saveSession();
  document.getElementById("voterOTPSection").classList.remove("hidden");
  toast("OTP (demo) sent: 123456");
}

async function verifyVoterOTP(){
  const code = (document.getElementById("voterOTP").value || "").trim();
  if (!session.pendingVoter) return toast("No pending login");
  if (code !== session.pendingVoter.otp) return toast("Invalid OTP");
  currentOrgId = session.pendingVoter.orgId;
  currentVoterEmail = session.pendingVoter.email;
  delete session.pendingVoter; saveSession();
  const snap = await getDoc(doc(db,"organizations",currentOrgId));
  const org = snap.data();
  document.getElementById("voterNameLabel").textContent = org.voters[currentVoterEmail].name;
  loadVotingScreen();
  showScreen("votingScreen");
}

async function loadVotingScreen(){
  const snap = await getDoc(doc(db,"organizations",currentOrgId));
  const org = snap.data();
  const container = document.getElementById("votingPositions"); container.innerHTML = "";
  (org.positions || []).forEach(pos => {
    const card = document.createElement("div"); card.className = "list-item";
    const title = document.createElement("div"); title.innerHTML = `<strong>${pos.name}</strong>`;
    const options = document.createElement("div"); options.style.flex = "1";
    const candList = (org.candidates || []).filter(c => c.positionId === pos.id);
    if (candList.length === 1) {
      const c = candList[0];
      options.innerHTML = `<label style="display:flex;align-items:center;gap:10px"><input type="radio" name="pos-${pos.id}" value="${c.id}"> YES — ${c.name}</label>
                           <label style="display:flex;align-items:center;gap:10px;margin-top:6px"><input type="radio" name="pos-${pos.id}" value="__NO__"> NO</label>`;
    } else {
      candList.forEach(c => {
        const label = document.createElement("label");
        label.style.display = "flex"; label.style.justifyContent = "space-between"; label.style.alignItems = "center"; label.style.marginBottom = "8px";
        label.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><img src="${c.photo || defaultLogoDataUrl()}" class="candidate-photo"><div><strong>${c.name}</strong></div></div><input type="radio" name="pos-${pos.id}" value="${c.id}">`;
        options.appendChild(label);
      });
    }
    card.appendChild(title); card.appendChild(options); container.appendChild(card);
  });
}

async function submitVote(){
  if (!currentVoterEmail || !currentOrgId) return toast("Not authenticated");
  const ref = doc(db,"organizations",currentOrgId);
  const snap = await getDoc(ref); const org = snap.data();
  const status = getOrgStatus(org); if (status.text !== "Active") return toast("Voting not active");
  const selections = {}; let all = true;
  (org.positions || []).forEach(pos => {
    const sel = document.querySelector(`input[name="pos-${pos.id}"]:checked`);
    if (sel) selections[pos.id] = sel.value; else all = false;
  });
  if (!all) return toast("Please vote for all positions");
  const receipt = Math.random().toString(36).slice(2,12).toUpperCase();
  org.votes = org.votes || {};
  org.votes[currentVoterEmail] = { choices: selections, timestamp: new Date().toISOString(), receipt };
  org.voters[currentVoterEmail].hasVoted = true;
  org.voterCount = Object.keys(org.voters || {}).length;
  await updateDoc(ref, { votes: org.votes, voters: org.voters, voterCount: org.voterCount });
  toast("Vote recorded");
  currentVoterEmail = null;
  setTimeout(()=> showScreen("gatewayScreen"), 900);
}

// Public results — read-only
async function renderPublicResults(orgId){
  const snap = await getDoc(doc(db,"organizations",orgId));
  if (!snap.exists()) return toast("Org not found");
  const org = snap.data();
  document.getElementById("publicOrgLogo").src = org.logoUrl || defaultLogoDataUrl();
  document.getElementById("publicOrgName").textContent = org.name;
  const box = document.getElementById("publicResults"); box.innerHTML = "";
  (org.positions || []).forEach(pos => {
    const card = document.createElement("div"); card.className = "list-item";
    card.innerHTML = `<h4>${pos.name}</h4>`;
    const counts = {}; let total = 0;
    Object.values(org.votes || {}).forEach(v => { if (v.choices && v.choices[pos.id]) { counts[v.choices[pos.id]] = (counts[v.choices[pos.id]] || 0) + 1; total++; }});
    (org.candidates || []).filter(c=>c.positionId===pos.id).forEach(c=>{
      const n = counts[c.id]||0; const pct = total?Math.round((n/total)*100):0;
      const row = document.createElement("div"); row.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${c.name}</strong><div class="subtext">${n} votes</div></div><div>${pct}%</div></div>`;
      card.appendChild(row);
    });
    if (counts['__NO__']) { const no = counts['__NO__']||0; const pctNo = total?Math.round((no/total)*100):0; const row = document.createElement("div"); row.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>NO</strong><div class="subtext">${no} votes</div></div><div>${pctNo}%</div></div>`; card.appendChild(row); }
    box.appendChild(card);
  });
}

// Guest portal
function renderGuestContent(){
  const box = document.getElementById("guestContent");
  box.innerHTML = `<div class="card"><h3>Guest Portal</h3><p>Use demo public link or ask org EC for their public token to view results.</p></div>`;
}

/* ----------------- Utilities ----------------- */
function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = e=> res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function defaultLogoDataUrl(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#0b0720"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="#9D00FF" font-family="Inter, Arial">ORG</text></svg>`);
}
function getDominantColorFromImage(dataUrl, cb){
  if (!dataUrl) return cb({r:157,g:0,b:255});
  const img = new Image(); img.crossOrigin="Anonymous"; img.src = dataUrl;
  img.onload = ()=>{
    const canvas = document.createElement("canvas"); canvas.width=80; canvas.height=80;
    const ctx = canvas.getContext("2d"); ctx.drawImage(img,0,0,80,80);
    const d = ctx.getImageData(0,0,80,80).data;
    let r=0,g=0,b=0,c=0;
    for (let i=0;i<d.length;i+=4){ const a=d[i+3]; if (a<128) continue; r+=d[i]; g+=d[i+1]; b+=d[i+2]; c++; }
    if (!c) return cb({r:157,g:0,b:255}); cb({r:Math.round(r/c), g:Math.round(g/c), b:Math.round(b/c)});
  };
  img.onerror = ()=> cb({r:157,g:0,b:255});
}
function rgbToNeonHex({r,g,b}){ r=Math.min(255,r+40); g=Math.min(255,g+10); b=Math.min(255,b+80); return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1); }
function applyOrgNeonPalette(dataUrl){ getDominantColorFromImage(dataUrl, rgb => { const neon = rgbToNeonHex(rgb); document.documentElement.style.setProperty('--dynamic-neon', neon); }); }
function generateStrongPassword(){ const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?"; let p=""; for (let i=0;i<10;i++) p+=chars[Math.floor(Math.random()*chars.length)]; return p; }

function getOrgStatus(org){
  const s = org.electionSettings && org.electionSettings.startTime ? new Date(org.electionSettings.startTime) : null;
  const e = org.electionSettings && org.electionSettings.endTime ? new Date(org.electionSettings.endTime) : null;
  const now = new Date();
  if (org.electionStatus === 'declared') return { text: 'Declared', startDisplay: s ? s.toLocaleString() : null, endDisplay: e ? e.toLocaleString() : null };
  if (org.electionStatus === 'closed') return { text: 'Closed', startDisplay: s ? s.toLocaleString() : null, endDisplay: e ? e.toLocaleString() : null };
  if (s && now < s) return { text: 'Scheduled', startDisplay: s.toLocaleString(), endDisplay: e ? e.toLocaleString() : null };
  if (e && now > e) return { text: 'Ended', startDisplay: s ? s.toLocaleString() : null, endDisplay: e.toLocaleString() };
  return { text: 'Active', startDisplay: s ? s.toLocaleString() : null, endDisplay: e ? e.toLocaleString() : null };
}

/* ----------------- Logout (robust) ----------------- */
async function logout(){
  try {
    if (_orgUnsub) { try { _orgUnsub(); } catch(e){} _orgUnsub = null; }
    // firebase auth sign out if used
    try { await signOut(auth).catch(()=>{}); } catch(e){}
    session = {}; saveSession();
    currentOrgId = null; currentVoterEmail = null;
    history.replaceState({}, "", location.pathname);
    showScreen("gatewayScreen");
    toast("Logged out");
  } catch(err){ console.error(err); toast("Logout failed"); }
}

/* ----------------- Init: wire UI + restore session ----------------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  // wire gateway buttons
  document.getElementById("btn-superadmin").onclick = ()=> showScreen("superAdminLoginScreen");
  document.getElementById("btn-ec").onclick = ()=> showScreen("ecLoginScreen");
  document.getElementById("btn-voter").onclick = async ()=>{
    const id = prompt("Organization ID (e.g. ORG-10001)");
    if (!id) return;
    try {
      const snap = await getDoc(doc(db,"organizations",id));
      if (!snap.exists()) { toast("Org not found"); return; }
      const org = snap.data();
      await prepareVoterForOrg(id);
      showScreen("voterLoginScreen");
      history.replaceState({}, "", `${location.pathname}?org=${encodeURIComponent(id)}`);
    } catch(e){ console.error(e); toast("Error"); }
  };
  document.getElementById("btn-public").onclick = async ()=>{
    const id = prompt("Organization ID for public results");
    if (!id) return;
    await renderPublicResults(id); showScreen("publicScreen");
  };
  document.getElementById("btn-guest").onclick = ()=> { renderGuestContent(); showScreen("guestScreen"); };

  // wire back buttons & login buttons
  document.getElementById("super-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("ec-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("voter-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("public-back").onclick = ()=> showScreen("gatewayScreen");
  document.getElementById("guest-back").onclick = ()=> showScreen("gatewayScreen");

  document.getElementById("super-login-btn").onclick = loginSuperAdmin;
  document.getElementById("ec-login-btn").onclick = loginEC;
  document.getElementById("voter-send-otp").onclick = sendVoterOTP;
  document.getElementById("voter-verify-otp").onclick = verifyVoterOTP;
  document.getElementById("submit-vote-btn").onclick = submitVote;

  // logout buttons
  document.querySelectorAll(".logout-btn").forEach(b => b.onclick = logout);

  // superadmin tabs
  document.querySelectorAll(".tab-btn[data-super-tab]").forEach(b => b.onclick = ()=> {
    document.querySelectorAll(".tab-btn[data-super-tab]").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.getAttribute("data-super-tab");
    document.querySelectorAll("#superAdminPanel .tab-content").forEach(c => c.classList.remove("active"));
    document.getElementById("superContent-" + tab).classList.add("active");
    if (tab === "orgs") renderSuperOrgs(); else renderSuperSettings();
  });

  // ec tabs (wire)
  document.querySelectorAll("#ecTabs .tab-btn").forEach(b => {
    b.onclick = ()=> { document.querySelectorAll("#ecTabs .tab-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active"); showECTab(b.getAttribute("data-ec-tab")); };
  });

  // quick restore session: if EC session exists, load panel
  if (session && session.role === 'ec' && session.orgId){
    try { loadECPanel(); showScreen("ecPanel"); } catch(e){ console.warn(e); showScreen("gatewayScreen"); }
  } else {
    // if ?org=... in url, auto-open voter flow (public token handled)
    const params = new URLSearchParams(location.search);
    const orgParam = params.get("org");
    const token = params.get("token");
    if (orgParam) {
      const snap = await getDoc(doc(db,"organizations",orgParam));
      if (!snap.exists()) { showScreen("gatewayScreen"); return; }
      const org = snap.data();
      if (token && org.publicEnabled && org.publicToken === token) { await renderPublicResults(orgParam); showScreen("publicScreen"); return; }
      await prepareVoterForOrg(orgParam);
      showScreen("voterLoginScreen");
      return;
    }
    showScreen("gatewayScreen");
  }

  // expose for debugging convenience
  window.logout = logout;
  window.ownerCreateOrg = ownerCreateOrg;
  window.renderSuperOrgs = renderSuperOrgs;
  window.renderPublicResults = renderPublicResults;
});

// save session on unload
window.addEventListener("beforeunload", ()=> saveSession());
