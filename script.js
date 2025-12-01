// ===============================
//  Neon Voting App — script.js
//  FINAL CLEAN VERSION (No Errors)
//  Firebase + EC + SuperAdmin + Voter
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs,
  collection, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// ===============================
//  FIXED FIREBASE CONFIG
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.appspot.com",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

// Initialize Firebase services
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase);
const storage = getStorage(appFirebase);
const auth = getAuth(appFirebase);

// ===============================
//   LOCAL SESSION
// ===============================
const SESSION_KEY = "neon_session_v1";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ===============================
//   UI HELPERS
// ===============================
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  window.scrollTo(0, 0);
}

// ===============================
//   SUPERADMIN LOGIN
// ===============================

window.openSuperAdminLogin = () => showScreen("superAdminLoginScreen");

window.loginSuperAdmin = async function () {
  const pw = document.getElementById("superAdminPassword").value;

  const metaRef = doc(db, "meta", "superadmin");
  const snap = await getDoc(metaRef);

  // First time setup: create default superadmin
  if (!snap.exists()) {
    await setDoc(metaRef, { password: "superadmin123" });
    toast("Default superadmin created (superadmin123)");
  }

  const data = (await getDoc(metaRef)).data();
  if (pw !== data.password) return toast("Wrong superadmin password");

  session.role = "owner";
  saveSession();

  await renderSuperOrgs();
  showScreen("superAdminPanel");
};

// ===============================
//   SUPERADMIN PANEL
// ===============================

async function renderSuperOrgs() {
  const box = document.getElementById("superContent-orgs");
  box.innerHTML = "Loading…";

  const orgs = await getDocs(collection(db, "organizations"));

  let html = `
    <h3>Create Organization</h3>
    <input id="newOrgName" class="input" placeholder="Organization Name">
    <input id="newOrgPass" class="input" placeholder="EC Password (optional)">
    <input id="newOrgLogo" type="file" accept="image/*" class="input">
    <button class="btn neon-btn" onclick="ownerCreateOrg()">Create</button>

    <h3 style="margin-top:15px">Existing Organizations</h3>
  `;

  orgs.forEach(docSnap => {
    const o = docSnap.data();
    html += `
      <div class="list-item">
        <div>
          <strong>${o.name}</strong><br>
          <small>${docSnap.id}</small>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn-outline" onclick="ownerOpenOrg('${docSnap.id}')">Open</button>
          <button class="btn neon-btn-outline" onclick="ownerDeleteOrg('${docSnap.id}')">Delete</button>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;
}

window.ownerCreateOrg = async function () {
  const name = newOrgName.value.trim();
  let pass = newOrgPass.value.trim();
  const file = newOrgLogo.files[0];

  if (!name) return toast("Name required");
  if (!pass) pass = generatePassword();

  const orgId = "ORG-" + Math.floor(100000 + Math.random() * 900000);

  let logoUrl = "";

  if (file) {
    const data = await fileToDataUrl(file);
    const sRef = storageRef(storage, `orgs/${orgId}/logo.png`);
    await uploadString(sRef, data, "data_url");
    logoUrl = await getDownloadURL(sRef);
  }

  await setDoc(doc(db, "organizations", orgId), {
    name,
    ecPassword: pass,
    logoUrl,
    voters: {},
    positions: [],
    candidates: [],
    votes: {},
    voterCount: 0,
    publicEnabled: false,
    publicToken: null,
    electionSettings: { startTime: null, endTime: null },
    electionStatus: "scheduled"
  });

  toast(`Created ${orgId}. EC Password: ${pass}`);
  renderSuperOrgs();
};

window.ownerOpenOrg = function (id) {
  ecOrgId.value = id;
  showScreen("ecLoginScreen");
};

window.ownerDeleteOrg = async function (id) {
  if (!confirm("Delete this organization?")) return;
  await setDoc(doc(db, "organizations", id), { deleted: true });
  toast("Org deleted (soft-delete)");
  renderSuperOrgs();
};

// ===============================
//   EC LOGIN
// ===============================

window.openECLogin = () => showScreen("ecLoginScreen");

window.loginEC = async function () {
  const id = ecOrgId.value.trim();
  const pass = ecPassword.value;

  const snap = await getDoc(doc(db, "organizations", id));
  if (!snap.exists()) return toast("Organization not found");

  const org = snap.data();
  if (org.ecPassword !== pass) return toast("Wrong EC password");

  session.role = "ec";
  session.orgId = id;
  saveSession();

  await loadECPanel();
  showScreen("ecPanel");
};

// ===============================
//   EC PANEL LIVE LISTENER
// ===============================

async function loadECPanel() {
  const orgRef = doc(db, "organizations", session.orgId);

  onSnapshot(orgRef, snap => {
    if (!snap.exists()) return;

    const org = snap.data();
    document.getElementById("ecOrgName").textContent = `${org.name} • ${session.orgId}`;
    document.getElementById("ecOrgLogo").src = org.logoUrl || defaultLogo();

    applyNeonFromImage(org.logoUrl);

    renderECTab();
  });

  showECTab("dashboard");
}

// ===============================
//   EC TAB HANDLER
// ===============================

window.showECTab = function (tab) {
  session.ecTab = tab;
  saveSession();
  renderECTab();
};

function renderECTab() {
  const tab = session.ecTab || "dashboard";

  document.querySelectorAll("#ecTabs .tab-btn")
    .forEach(btn => btn.classList.remove("active"));
  document.querySelector(`#ecTabs .tab-btn[onclick*="${tab}"]`)
    ?.classList.add("active");

  document.querySelectorAll("[id^='ecContent-']")
    .forEach(c => c.classList.remove("active"));
  document.getElementById(`ecContent-${tab}`)?.classList.add("active");

  if (tab === "dashboard") renderECDashboard();
  if (tab === "voters") renderECVoters();
  if (tab === "positions") renderECPositions();
  if (tab === "candidates") renderECCandidates();
  if (tab === "settings") renderECSettings();
}

// ===============================
//   EC — DASHBOARD
// ===============================

async function renderECDashboard() {
  const snap = await getDoc(doc(db, "organizations", session.orgId));
  const o = snap.data();

  const el = document.getElementById("ecContent-dashboard");
  const cast = Object.keys(o.votes || {}).length;
  const pct = o.voterCount ? Math.round((cast / o.voterCount) * 100) : 0;

  el.innerHTML = `
    <div class="ec-tiles">
      <div class="tile"><div class="label">Total Voters</div><div class="value">${o.voterCount}</div></div>
      <div class="tile"><div class="label">Positions</div><div class="value">${o.positions.length}</div></div>
      <div class="tile"><div class="label">Candidates</div><div class="value">${o.candidates.length}</div></div>
      <div class="tile"><div class="label">Votes Cast</div><div class="value">${cast}</div></div>
    </div>

    <div class="tile" style="margin-top:15px">
      <div class="label">Participation</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="subtext">${pct}%</div>
    </div>
  `;
}

// ===============================
//  EC — VOTERS
// ===============================

async function renderECVoters() {
  const snap = await getDoc(doc(db, "organizations", session.orgId));
  const org = snap.data();

  const el = document.getElementById("ecContent-voters");

  el.innerHTML = `
    <h3>Add Voter</h3>
    <input id="vName" class="input" placeholder="Name">
    <input id="vEmail" class="input" placeholder="Email">
    <button class="btn neon-btn" onclick="addVoter()">Add</button>

    <h3 style="margin-top:15px">Voter List</h3>
    <div id="vList"></div>
  `;

  const vList = document.getElementById("vList");
  vList.innerHTML = Object.entries(org.voters || {}).map(([email, v]) => `
    <div class="list-item">
      <div>
        <strong>${v.name}</strong><br>
        <small>${email}</small><br>
        <small>${v.hasVoted ? "Voted" : "Not Voted"}</small>
      </div>
      <button class="btn neon-btn-outline" onclick="deleteVoter('${email}')">Delete</button>
    </div>
  `).join("");
}

window.addVoter = async function () {
  const name = vName.value.trim();
  const email = vEmail.value.trim().toLowerCase();

  if (!email.includes("@")) return toast("Invalid email");
  if (!name) return toast("Name required");

  const ref = doc(db, "organizations", session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();

  if (org.voters[email]) return toast("Voter exists");

  org.voters[email] = { name, hasVoted: false };
  org.voterCount = Object.keys(org.voters).length;

  await updateDoc(ref, org);

  toast("Voter added");
  renderECVoters();
};

window.deleteVoter = async function (email) {
  if (!confirm("Delete voter?")) return;

  const ref = doc(db, "organizations", session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();

  delete org.voters[email];
  delete org.votes[email];
  org.voterCount = Object.keys(org.voters).length;

  await updateDoc(ref, org);
  toast("Deleted");

  renderECVoters();
};

// ===============================
//   EC — POSITIONS
// ===============================

async function renderECPositions() {
  const snap = await getDoc(doc(db, "organizations", session.orgId));
  const org = snap.data();

  const el = document.getElementById("ecContent-positions");

  el.innerHTML = `
    <h3>Add Position</h3>
    <input id="pName" class="input" placeholder="Position Name">
    <button class="btn neon-btn" onclick="addPosition()">Add</button>

    <h3 style="margin-top:15px">Positions</h3>
    <div id="pList"></div>
  `;

  const pList = document.getElementById("pList");
  pList.innerHTML = org.positions.map(p => `
    <div class="list-item">
      <div>${p.name}</div>
      <button class="btn neon-btn-outline" onclick="deletePosition('${p.id}')">Delete</button>
    </div>
  `).join("");
}

window.addPosition = async function () {
  const name = pName.value.trim();
  if (!name) return toast("Position required");

  const id = "pos-" + Date.now();

  const ref = doc(db, "organizations", session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();

  org.positions.push({ id, name });

  await updateDoc(ref, org);
  toast("Position added");

  renderECPositions();
};

window.deletePosition = async function (id) {
  if (!confirm("Delete position?")) return;

  const ref = doc(db, "organizations", session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();

  org.positions = org.positions.filter(p => p.id !== id);

  // remove candidates under that position
  org.candidates = org.candidates.filter(c => c.positionId !== id);

  await updateDoc(ref, org);
  toast("Deleted");

  renderECPositions();
};

// ===============================
//   EC — CANDIDATES
// ===============================

async function renderECCandidates() {
  const snap = await getDoc(doc(db, "organizations", session.orgId));
  const org = snap.data();

  const el = document.getElementById("ecContent-candidates");

  el.innerHTML = `
    <h3>Add Candidate</h3>
    <input id="cName" class="input" placeholder="Candidate Name">
    <select id="cPos" class="input">
      ${org.positions.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
    </select>
    <input id="cPhoto" type="file" accept="image/*" class="input">
    <button class="btn neon-btn" onclick="addCandidate()">Add</button>

    <h3 style="margin-top:15px">Candidates</h3>
    <div id="cList"></div>
  `;

  const cList = document.getElementById("cList");
  cList.innerHTML = org.candidates.map(c => `
    <div class="list-item">
      <div style="display:flex;gap:10px">
        <img src="${c.photo || defaultLogo()}" class="candidate-photo">
        <div>
          <strong>${c.name}</strong><br>
          <small>${org.positions.find(p => p.id === c.positionId)?.name}</small>
        </div>
      </div>
      <button class="btn neon-btn-outline" onclick="deleteCandidate('${c.id}')">Delete</button>
    </div>
  `).join("");
}

window.addCandidate = async function () {
  const name = cName.value.trim();
  const pos = cPos.value;
  const file = cPhoto.files[0];

  if (!name) return toast("Candidate name required");

  const id = "cand-" + Date.now();

  const ref = doc(db, "organizations", session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();

  let photoUrl = "";

  if (file) {
    const data = await fileToDataUrl(file);
    const sRef = storageRef(storage, `orgs/${session.orgId}/candidates/${id}.png`);
    await uploadString(sRef, data, "data_url");
    photoUrl = await getDownloadURL(sRef);
  }

  org.candidates.push({
    id,
    name,
    positionId: pos,
    photo: photoUrl
  });

  await updateDoc(ref, org);
  toast("Candidate added");

  renderECCandidates();
};

window.deleteCandidate = async function (id) {
  if (!confirm("Delete candidate?")) return;

  const ref = doc(db, "organizations", session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();

  org.candidates = org.candidates.filter(c => c.id !== id);

  await updateDoc(ref, org);
  toast("Deleted");

  renderECCandidates();
};

// ===============================
//   EC — SETTINGS
// ===============================

async function renderECSettings() {
  const snap = await getDoc(doc(db, "organizations", session.orgId));
  const org = snap.data();

  const el = document.getElementById("ecContent-settings");

  const start = org.electionSettings.startTime
    ? new Date(org.electionSettings.startTime).toISOString().slice(0, 16)
    : "";

  const end = org.electionSettings.endTime
    ? new Date(org.electionSettings.endTime).toISOString().slice(0, 16)
    : "";

  el.innerHTML = `
    <h3>Election Timing</h3>
    <label class="subtext">Start</label>
    <input id="eStart" type="datetime-local" class="input" value="${start}">

    <label class="subtext">End</label>
    <input id="eEnd" type="datetime-local" class="input" value="${end}">

    <button class="btn neon-btn" onclick="saveTimes()">Save Times</button>
    <button class="btn neon-btn-outline" onclick="clearTimes()">Clear</button>

    <h3 style="margin-top:20px">Public Results</h3>
    <button class="btn neon-btn" onclick="makePublic()">Generate Token</button>
    <button class="btn neon-btn-outline" onclick="copyPublicLink()">Copy Link</button>
  `;
}

window.saveTimes = async function () {
  const orgRef = doc(db, "organizations", session.orgId);
  const snap = await getDoc(orgRef);
  const org = snap.data();

  const s = eStart.value ? new Date(eStart.value).toISOString() : null;
  const e = eEnd.value ? new Date(eEnd.value).toISOString() : null;

  org.electionSettings = { startTime: s, endTime: e };

  const now = new Date();
  if (s && now < new Date(s)) org.electionStatus = "scheduled";
  else if (e && now > new Date(e)) org.electionStatus = "closed";
  else org.electionStatus = "active";

  await updateDoc(orgRef, org);
  toast("Times saved");
};

window.clearTimes = async function () {
  const orgRef = doc(db, "organizations", session.orgId);
  await updateDoc(orgRef, {
    electionSettings: { startTime: null, endTime: null },
    electionStatus: "active"
  });
  toast("Times cleared");
};

window.makePublic = async function () {
  const ref = doc(db, "organizations", session.orgId);
  const snap = await getDoc(ref);
  const org = snap.data();

  if (!org.publicToken)
    org.publicToken = Math.random().toString(36).slice(2, 12).toUpperCase();

  org.publicEnabled = true;

  await updateDoc(ref, org);
  toast("Public token generated");
};

window.copyPublicLink = async function () {
  const ref = doc(db, "organizations", session.orgId);
  const org = (await getDoc(ref)).data();

  if (!org.publicEnabled) return toast("Enable public first");

  const link =
    `${location.origin}${location.pathname}?org=${session.orgId}&token=${org.publicToken}`;

  navigator.clipboard.writeText(link);
  toast("Link copied");
};

// ===============================
//   VOTER LOGIN
// ===============================

window.openVoterLogin = () => {
  const orgId = prompt("Enter Organization ID");
  if (!orgId) return;
  prepareVoter(orgId);
};

async function prepareVoter(orgId) {
  const snap = await getDoc(doc(db, "organizations", orgId));
  if (!snap.exists()) return toast("Not found");

  const org = snap.data();
  currentOrgId = orgId;

  document.getElementById("voterOrgName").textContent = `${org.name} • ${orgId}`;
  document.getElementById("voterOrgLogo").src = org.logoUrl || defaultLogo();

  applyNeonFromImage(org.logoUrl);

  showScreen("voterLoginScreen");
}

let currentOrgId = null;
let currentVoter = null;

window.sendVoterOTP = async function () {
  const email = voterEmail.value.trim().toLowerCase();

  const snap = await getDoc(doc(db, "organizations", currentOrgId));
  const org = snap.data();

  if (!org.voters[email]) return toast("Not registered");
  if (org.voters[email].hasVoted) return toast("Already voted");

  session.pending = { orgId: currentOrgId, email, otp: "123456" };
  saveSession();

  voterOTPSection.classList.remove("hidden");
  toast("Demo OTP sent: 123456");
};

window.verifyVoterOTP = async function () {
  const code = voterOTP.value.trim();

  if (!session.pending) return toast("No pending OTP");
  if (code !== session.pending.otp) return toast("Wrong OTP");

  currentOrgId = session.pending.orgId;
  currentVoter = session.pending.email;

  delete session.pending;
  saveSession();

  const snap = await getDoc(doc(db, "organizations", currentOrgId));
  const org = snap.data();

  voterNameLabel.textContent = org.voters[currentVoter].name;

  loadVoteUI();
  showScreen("votingScreen");
};

// ===============================
//   VOTING UI
// ===============================

async function loadVoteUI() {
  const snap = await getDoc(doc(db, "organizations", currentOrgId));
  const org = snap.data();

  const box = document.getElementById("votingPositions");
  box.innerHTML = "";

  (org.positions || []).forEach(pos => {
    const div = document.createElement("div");
    div.className = "list-item";

    div.innerHTML = `<strong>${pos.name}</strong>`;

    const candList = (org.candidates || []).filter(c => c.positionId === pos.id);

    const options = document.createElement("div");
    options.style.marginTop = "8px";

    if (candList.length === 1) {
      const c = candList[0];
      options.innerHTML = `
        <label><input type="radio" name="pos-${pos.id}" value="${c.id}"> YES — ${c.name}</label><br>
        <label><input type="radio" name="pos-${pos.id}" value="NO"> NO</label>
      `;
    } else {
      candList.forEach(c => {
        const opt = document.createElement("label");
        opt.style.display = "flex";
        opt.style.justifyContent = "space-between";
        opt.innerHTML = `
          <div style="display:flex;gap:10px;align-items:center">
            <img src="${c.photo || defaultLogo()}" class="candidate-photo">
            <strong>${c.name}</strong>
          </div>
          <input type="radio" name="pos-${pos.id}" value="${c.id}">
        `;
        options.appendChild(opt);
      });
    }

    div.appendChild(options);
    box.appendChild(div);
  });
}

window.submitVote = async function () {
  const snap = await getDoc(doc(db, "organizations", currentOrgId));
  const org = snap.data();

  const selections = {};

  for (const pos of org.positions) {
    const sel = document.querySelector(`input[name="pos-${pos.id}"]:checked`);
    if (!sel) return toast("Vote all positions");
    selections[pos.id] = sel.value;
  }

  org.votes[currentVoter] = {
    choices: selections,
    timestamp: new Date().toISOString()
  };
  org.voters[currentVoter].hasVoted = true;

  await updateDoc(doc(db, "organizations", currentOrgId), org);

  toast("Vote submitted");

  currentVoter = null;
  showScreen("gatewayScreen");
};

// ===============================
//   PUBLIC RESULTS
// ===============================

window.openPublicResults = async function () {
  const id = prompt("Enter Org ID");
  if (!id) return;

  const snap = await getDoc(doc(db, "organizations", id));
  if (!snap.exists()) return toast("Org not found");

  const org = snap.data();

  publicOrgLogo.src = org.logoUrl || defaultLogo();
  publicOrgName.textContent = org.name;

  const box = publicResults;
  box.innerHTML = "";

  (org.positions || []).forEach(pos => {
    const card = document.createElement("div");
    card.className = "list-item";

    card.innerHTML = `<h4>${pos.name}</h4>`;

    const counts = {};
    let total = 0;

    Object.values(org.votes || {}).forEach(v => {
      const cId = v.choices[pos.id];
      if (cId) {
        counts[cId] = (counts[cId] || 0) + 1;
        total++;
      }
    });

    (org.candidates || [])
      .filter(c => c.positionId === pos.id)
      .forEach(c => {
        const n = counts[c.id] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const row = document.createElement("div");

        row.style.marginTop = "6px";
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between">
            <strong>${c.name}</strong>
            <span>${pct}% • ${n} votes</span>
          </div>
        `;
        card.appendChild(row);
      });

    box.appendChild(card);
  });

  showScreen("publicScreen");
};

// ===============================
//   GUEST PORTAL
// ===============================
window.openGuestPortal = () => {
  guestContent.innerHTML = `
    <div class="card">
      <h3>Guest Portal</h3>
      <p>This demo portal shows previews and sample screenshots.</p>
    </div>
  `;
  showScreen("guestScreen");
};

// ===============================
//   LOGOUT
// ===============================

window.logout = function () {
  session = {};
  saveSession();
  showScreen("gatewayScreen");
  toast("Logged out");
};

// ===============================
//   UTILS
// ===============================

function fileToDataUrl(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });
}

function defaultLogo() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(`
  <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="120" fill="#0b0720"/>
  <text x="50%" y="55%" text-anchor="middle" fill="#ff00ff" font-size="28" font-family="Inter">ORG</text>
  </svg>`);
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

function applyNeonFromImage(url) {
  if (!url) return;
  const img = new Image();
  img.src = url;
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = 50;
    c.height = 50;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 50, 50);
    const d = ctx.getImageData(0, 0, 50, 50).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) continue;
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      count++;
    }
    if (count) {
      r = Math.min(255, r / count + 60);
      g = Math.min(255, g / count + 20);
      b = Math.min(255, b / count + 100);
      const neon = `rgb(${r},${g},${b})`;
      document.documentElement.style.setProperty("--dynamic-neon", neon);
    }
  };
}

// ===============================
//   RESTORE SESSION ON LOAD
// ===============================

document.addEventListener("DOMContentLoaded", async () => {
  if (session.role === "ec" && session.orgId) {
    await loadECPanel();
    showScreen("ecPanel");
    return;
  }
  showScreen("gatewayScreen");
});
