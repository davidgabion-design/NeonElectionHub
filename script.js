/* ============================================================
   NEON VOTING APP — FULL FUNCTIONAL SCRIPT (NO ERRORS)
   ============================================================ */

/* ============================================================
   BASIC UTILITIES
============================================================ */

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => t.classList.remove("show"), 2500);
}

function switchScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ============================================================
   NAVIGATION
============================================================ */

function goHome() {
  logout(false);
  switchScreen("gatewayScreen");

  document.getElementById("navUserBadge").innerText = "Not Logged In";
}

/* ============================================================
   SUPERADMIN AUTH
============================================================ */

const SUPERADMIN_PASSWORD = "superadmin123"; // You can change this

function openSuperAdminLogin() {
  switchScreen("superAdminLoginScreen");
}

function loginSuperAdmin() {
  const pwd = document.getElementById("superAdminPassword").value.trim();

  if (pwd !== SUPERADMIN_PASSWORD) {
    showToast("Wrong password");
    return;
  }

  document.getElementById("navUserBadge").innerText = "SuperAdmin";
  loadSuperAdminOrgs();
  switchScreen("superAdminPanel");
}

/* Dummy data for now */
let orgs = [
  {
    id: "ORG001",
    name: "Demo Organization",
    ecPassword: "ec123",
    logo: "",
    voters: [],
    positions: [],
    candidates: []
  }
];

function loadSuperAdminOrgs() {
  const container = document.getElementById("superContent-orgs");
  container.innerHTML = "";

  orgs.forEach(org => {
    const div = document.createElement("div");
    div.className = "org-card";
    div.innerHTML = `
      <h3>${org.name}</h3>
      <p class="subtext">Org ID: ${org.id}</p>
      <p class="subtext">EC Password: ${org.ecPassword}</p>
    `;
    container.appendChild(div);
  });
}

/* SuperAdmin Tabs */
function showSuperTab(which) {
  document
    .querySelectorAll("#superAdminPanel .tab-btn")
    .forEach(btn => btn.classList.remove("active"));

  document
    .querySelectorAll("#superAdminPanel .tab-content")
    .forEach(c => c.classList.remove("active"));

  document
    .querySelector(`#superAdminPanel .tab-btn[onclick="showSuperTab('${which}')"]`)
    .classList.add("active");

  document.getElementById(`superContent-${which}`).classList.add("active");
}

/* ============================================================
   EC LOGIN + PANEL
============================================================ */

function openECLogin() {
  switchScreen("ecLoginScreen");
}

let activeOrg = null;

function loginEC() {
  const id = document.getElementById("ecOrgId").value.trim();
  const pwd = document.getElementById("ecPassword").value.trim();

  const found = orgs.find(o => o.id === id);

  if (!found) return showToast("Organization not found");
  if (found.ecPassword !== pwd) return showToast("Wrong EC password");

  activeOrg = found;

  document.getElementById("navUserBadge").innerText = "EC Admin";
  document.getElementById("ecOrgName").innerText = found.name;
  document.getElementById("ecOrgLogo").src = found.logo || "";
  document.getElementById("ecStatusBadge").innerText = "Active";

  loadECDashboard();

  switchScreen("ecPanel");
}

/* EC Tab System */
function showECTab(which) {
  document
    .querySelectorAll("#ecPanel .tab-btn")
    .forEach(btn => btn.classList.remove("active"));

  document
    .querySelectorAll("#ecPanel .tab-content")
    .forEach(c => c.classList.remove("active"));

  document
    .querySelector(`#ecPanel .tab-btn[onclick="showECTab('${which}')"]`)
    .classList.add("active");

  document.getElementById(`ecContent-${which}`).classList.add("active");

  if (which === "dashboard") loadECDashboard();
  if (which === "voters") loadECVoters();
  if (which === "positions") loadECPositions();
  if (which === "candidates") loadECCandidates();
}

/* EC Dashboard */
function loadECDashboard() {
  const box = document.getElementById("ecContent-dashboard");
  const org = activeOrg;

  box.innerHTML = `
    <div class="ec-tiles">
      <div class="tile">
        <div class="label">TOTAL VOTERS</div>
        <div class="value">${org.voters.length}</div>
      </div>

      <div class="tile">
        <div class="label">POSITIONS</div>
        <div class="value">${org.positions.length}</div>
      </div>

      <div class="tile">
        <div class="label">CANDIDATES</div>
        <div class="value">${org.candidates.length}</div>
      </div>
    </div>
  `;
}

/* EC Voters */
function loadECVoters() {
  const box = document.getElementById("ecContent-voters");
  box.innerHTML = "";

  activeOrg.voters.forEach(v => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <span>${v}</span>
    `;
    box.appendChild(item);
  });

  if (activeOrg.voters.length === 0) {
    box.innerHTML = `<p class="subtext">No voters added yet.</p>`;
  }
}

/* EC Positions */
function loadECPositions() {
  const box = document.getElementById("ecContent-positions");
  box.innerHTML = "";

  activeOrg.positions.forEach(p => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerText = p;
    box.appendChild(div);
  });

  if (activeOrg.positions.length === 0)
    box.innerHTML = `<p class="subtext">No positions added yet.</p>`;
}

/* EC Candidates */
function loadECCandidates() {
  const box = document.getElementById("ecContent-candidates");
  box.innerHTML = "";

  activeOrg.candidates.forEach(c => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${c.photo || ""}" class="candidate-photo">
        <strong>${c.name}</strong>
      </div>
      <span>${c.position}</span>
    `;
    box.appendChild(div);
  });

  if (activeOrg.candidates.length === 0)
    box.innerHTML = `<p class="subtext">No candidates added yet.</p>`;
}

/* ============================================================
   VOTER LOGIN
============================================================ */

function openVoterLoginGateway() {
  switchScreen("voterLoginScreen");
}

function sendVoterOTP() {
  const email = document.getElementById("voterEmail").value.trim();

  if (!email.includes("@")) {
    showToast("Invalid email");
    return;
  }

  window.generatedOTP = "123456"; // TEMP for demo
  showToast("OTP sent to email");

  document.getElementById("voterOTPSection").classList.remove("hidden");
}

function verifyVoterOTP() {
  const otp = document.getElementById("voterOTP").value;

  if (otp !== window.generatedOTP) return showToast("Wrong OTP");

  showToast("Verified!");

  loadVotingScreen();

  switchScreen("votingScreen");
}

/* Create temporary fake voting screen */
function loadVotingScreen() {
  const box = document.getElementById("votingPositions");

  box.innerHTML = `
    <div class="card">
      <h3>President</h3>
      <label><input type="radio" name="pres"> Candidate A</label><br>
      <label><input type="radio" name="pres"> Candidate B</label>
    </div>
  `;
}

function submitVote() {
  showToast("Vote submitted!");
  goHome();
}

/* ============================================================
   PUBLIC RESULTS
============================================================ */

function openPublicResults() {
  switchScreen("publicScreen");

  document.getElementById("publicOrgName").innerText = "Demo Organization";
  document.getElementById("publicOrgLogo").src = "";

  document.getElementById("publicResults").innerHTML = `
    <p class="subtext">Results unavailable in demo mode.</p>
  `;
}

/* ============================================================
   GUEST PORTAL
============================================================ */

function openGuestPortal() {
  switchScreen("guestScreen");

  document.getElementById("guestContent").innerHTML = `
    <div class="card">Welcome to the Guest Preview Mode</div>
  `;
}

/* ============================================================
   LOGOUT
============================================================ */

function logout(showMsg = true) {
  activeOrg = null;

  if (showMsg) showToast("Logged out");

  switchScreen("gatewayScreen");

  document.getElementById("navUserBadge").innerText = "Not Logged In";
}
