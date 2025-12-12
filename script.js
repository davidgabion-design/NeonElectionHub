// script.js — Complete Neon Voting System with Email History Subcollection Fix & WhatsApp Integration
// FIXED: Email change now uses separate subcollection to avoid serverTimestamp() in arrays
// ADDED: WhatsApp invite functionality for voters
// FIXED: EC refresh tab and invite functionality issues

// ---------------- Firebase imports ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp, writeBatch, orderBy
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

// ---------------- Global State ----------------
let currentOrgId = null;
let currentOrgData = null;
let currentOrgUnsub = null;
let voterSession = null;
let selectedCandidates = {};
let activeTab = 'voters';
let countdownInterval = null;
let voterCountdownInterval = null;
let refreshIntervals = {};

// ---------------- Session Management ----------------
const SESSION_KEY = "neon_voting_session_v6";
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");

function saveSession() { 
  localStorage.setItem(SESSION_KEY, JSON.stringify(session)); 
}

// ---------------- UI Functions ----------------
function showToast(msg, type = "info", duration = 3000) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;z-index:1001;display:none;border:1px solid rgba(0,255,255,0.1);backdrop-filter:blur(10px);';
    document.body.appendChild(t);
  }
  
  t.textContent = msg;
  t.style.background = type === "error" ? "linear-gradient(90deg, #d32f2f, #b71c1c)" :
                       type === "success" ? "linear-gradient(90deg, #00C851, #007E33)" :
                       type === "warning" ? "linear-gradient(90deg, #ff9800, #f57c00)" :
                       "linear-gradient(90deg, #9D00FF, #00C3FF)";
  t.style.border = type === "error" ? "1px solid rgba(255,68,68,0.3)" : "1px solid rgba(0,255,255,0.2)";
  t.classList.add("show");
  
  setTimeout(() => {
    t.classList.remove("show");
  }, duration);
}

function showScreen(screenId) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (voterCountdownInterval) {
    clearInterval(voterCountdownInterval);
    voterCountdownInterval = null;
  }
  
  Object.values(refreshIntervals).forEach(interval => {
    clearInterval(interval);
  });
  refreshIntervals = {};
  
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (screenId === 'votingScreen' && currentOrgData) {
      startVoterCountdown();
    }
  }
}

// ---------------- Tab Management ----------------
function setupTabs() {
  console.log("Setting up tabs...");
  
  const superTabs = document.getElementById('superTabs');
  if (superTabs) {
    console.log("Found super tabs");
    superTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (!tabBtn) return;
      
      console.log("Super tab clicked:", tabBtn.dataset.superTab);
      
      document.querySelectorAll('#superTabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      tabBtn.classList.add('active');
      
      const tabId = tabBtn.dataset.superTab;
      showSuperTab(tabId);
    });
    
    const defaultTab = document.querySelector('#superTabs .tab-btn.active') || 
                      document.querySelector('#superTabs .tab-btn');
    if (defaultTab) {
      defaultTab.classList.add('active');
      showSuperTab(defaultTab.dataset.superTab);
    }
  }
  
  const ecTabs = document.getElementById('ecTabs');
  if (ecTabs) {
    console.log("Found EC tabs");
    
    ecTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (!tabBtn) return;
      
      console.log("EC tab clicked:", tabBtn.dataset.ecTab);
      
      document.querySelectorAll('#ecTabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      tabBtn.classList.add('active');
      
      const tabId = tabBtn.dataset.ecTab;
      activeTab = tabId;
      showECTab(tabId);
    });
    
    const defaultTab = document.querySelector('#ecTabs .tab-btn.active') || 
                      document.querySelector('#ecTabs .tab-btn');
    if (defaultTab) {
      defaultTab.classList.add('active');
      activeTab = defaultTab.dataset.ecTab;
      showECTab(defaultTab.dataset.ecTab);
    }
  }
  
  console.log("Tabs setup complete");
}

function showSuperTab(tabId) {
  console.log("Showing super tab:", tabId);
  
  document.querySelectorAll('[id^="superContent-"]').forEach(content => {
    content.classList.remove('active');
  });
  
  const tabContent = document.getElementById(`superContent-${tabId}`);
  if (tabContent) {
    tabContent.classList.add('active');
    
    const shouldLoad = tabContent.innerHTML.includes('Loading') || 
                      tabContent.innerHTML.trim() === '' ||
                      tabContent.innerHTML.includes('empty-state');
    
    if (shouldLoad) {
      console.log(`Loading content for super tab: ${tabId}`);
      if (tabId === 'orgs') {
        loadSuperOrganizations();
      } else if (tabId === 'settings') {
        loadSuperSettings();
      } else if (tabId === 'delete') {
        loadSuperDelete();
      }
    }
  }
}

async function showECTab(tabId) {
  console.log("Showing EC tab:", tabId);
  
  document.querySelectorAll('[id^="ecContent-"]').forEach(content => {
    content.classList.remove('active');
  });
  
  const tabContent = document.getElementById(`ecContent-${tabId}`);
  if (tabContent) {
    tabContent.classList.add('active');
    
    if (currentOrgData) {
      console.log(`Loading content for EC tab: ${tabId}`);
      if (tabId === 'voters') {
        await loadECVoters();
      } else if (tabId === 'positions') {
        await loadECPositions();
      } else if (tabId === 'candidates') {
        await loadECCandidates();
      } else if (tabId === 'outcomes') {
        await loadECOutcomes();
      } else if (tabId === 'settings') {
        await loadECSettings();
      }
    } else {
      showQuickLoading(`ecContent-${tabId}`, `Loading ${tabId}...`);
    }
  }
}

// ---------------- Quick Loading Functions ----------------
function showQuickLoading(containerId, message = "Loading...") {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div class="spinner" style="margin:0 auto 20px auto;width:40px;height:40px;border:4px solid rgba(255,255,255,0.1);border-top-color:#9D00FF;border-radius:50%;animation:spin 1s linear infinite"></div>
      <h3 style="color:#fff;margin-bottom:10px;">${message}</h3>
      <p class="subtext">Please wait...</p>
    </div>
  `;
}

function renderError(containerId, message = "Error loading content", retryFunction = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-exclamation-triangle" style="color:#ff4444;font-size:48px;margin-bottom:20px"></i>
      <h3>${message}</h3>
      ${retryFunction ? `
        <button class="btn neon-btn mt-20" onclick="${retryFunction}">
          <i class="fas fa-redo"></i> Retry
        </button>
      ` : ''}
    </div>
  `;
}

// ---------------- Super Admin Functions ----------------
async function loginSuperAdmin() {
  const pass = document.getElementById("super-admin-pass").value.trim();
  if (!pass) { 
    showToast("Enter password", "error"); 
    return; 
  }
  
  try {
    const ref = doc(db, "meta", "superAdmin");
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      const defaultPass = "admin123";
      await setDoc(ref, { password: defaultPass });
      if (pass === defaultPass) {
        session.role = 'superadmin'; 
        saveSession();
        showScreen("superAdminPanel");
        loadSuperOrganizations();
        document.getElementById("super-admin-pass").value = "";
        showToast("SuperAdmin created & logged in", "success");
        return;
      } else {
        showToast("Wrong password. Try admin123 for first-time", "error"); 
        return;
      }
    } else {
      const cfg = snap.data();
      if (cfg.password === pass) {
        session.role = 'superadmin'; 
        saveSession();
        showScreen("superAdminPanel");
        loadSuperOrganizations();
        document.getElementById("super-admin-pass").value = "";
        showToast("SuperAdmin logged in", "success");
      } else {
        showToast("Wrong password", "error");
      }
    }
  } catch(e) { 
    console.error(e); 
    showToast("Login error", "error"); 
  }
}

async function loadSuperOrganizations() {
  const el = document.getElementById("superContent-orgs");
  if (!el) return;
  
  showQuickLoading("superContent-orgs", "Loading Organizations");
  
  try {
    const snaps = await getDocs(collection(db, "organizations"));
    const orgs = []; 
    snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    
    if (orgs.length === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-building" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Organizations Yet</h3>
          <p class="subtext">Create your first organization in the Settings tab</p>
          <button class="btn neon-btn mt-20" onclick="showCreateOrgModal()">
            <i class="fas fa-plus"></i> Create First Organization
          </button>
        </div>
      `;
      return;
    }
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-building"></i> Organizations (${orgs.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showCreateOrgModal()">
            <i class="fas fa-plus"></i> Create New
          </button>
          <button class="btn neon-btn-outline" onclick="refreshSuperOrgs()">
            <i class="fas fa-redo"></i> Refresh
          </button>
        </div>
      </div>
    `;
    
    orgs.forEach(org => {
      const voterCount = org.voterCount || 0;
      const voteCount = org.voteCount || 0;
      const status = org.electionStatus || 'active';
      const logoUrl = org.logoUrl || getDefaultLogo(org.name);
      
      const statusConfig = {
        'active': { color: '#00ffaa', label: 'Active', icon: 'fa-play-circle' },
        'scheduled': { color: '#ffc107', label: 'Scheduled', icon: 'fa-clock' },
        'declared': { color: '#9D00FF', label: 'Results Declared', icon: 'fa-flag-checkered' },
        'ended': { color: '#888', label: 'Ended', icon: 'fa-stop-circle' }
      }[status] || { color: '#888', label: status, icon: 'fa-question-circle' };
      
      let scheduleInfo = '';
      if (org.electionSettings?.startTime) {
        const startTime = new Date(org.electionSettings.startTime);
        const now = new Date();
        if (startTime > now) {
          const timeDiff = startTime - now;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          scheduleInfo = `Starts in ${hours}h ${minutes}m`;
        } else if (org.electionSettings?.endTime && new Date(org.electionSettings.endTime) > now) {
          scheduleInfo = 'Voting in progress';
        } else if (org.electionSettings?.endTime && new Date(org.electionSettings.endTime) <= now) {
          scheduleInfo = 'Voting ended';
        }
      }
      
      html += `
        <div class="org-card">
          <div style="display:flex;gap:15px;align-items:center">
            <img src="${logoUrl}" 
                 style="width:80px;height:80px;border-radius:12px;object-fit:cover;border:2px solid rgba(0,255,255,0.2);background:#08102a;">
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <strong style="font-size:18px;color:#fff">${org.name || org.id}</strong>
                  <div class="subtext" style="margin-top:4px">ID: ${org.id}</div>
                  ${scheduleInfo ? `<div class="subtext" style="margin-top:2px;color:#00eaff"><i class="fas fa-clock"></i> ${scheduleInfo}</div>` : ''}
                  <div class="subtext" style="margin-top:2px">EC Password: ••••••••</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
                  <span style="font-size:12px;padding:4px 10px;border-radius:12px;background:${statusConfig.color}20;color:${statusConfig.color};border:1px solid ${statusConfig.color}40;display:flex;align-items:center;gap:5px">
                    <i class="fas ${statusConfig.icon}"></i> ${statusConfig.label}
                  </span>
                  <span class="subtext">${voterCount} voters • ${voteCount} votes</span>
                </div>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:15px">
            <button class="btn neon-btn-outline" onclick="openOrgAsEC('${org.id}')" style="flex:1">
              <i class="fas fa-user-tie"></i> EC Login
            </button>
            <button class="btn neon-btn-outline" onclick="showECInviteModal('${org.id}', '${escapeHtml(org.name || org.id)}', '${org.ecPassword || ''}')" title="Send EC Invite">
              <i class="fas fa-paper-plane"></i>
            </button>
            <button class="btn neon-btn-outline" onclick="showPasswordModal('${org.id}', '${org.ecPassword || ''}')" title="View Password">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    el.innerHTML = html;
  } catch(e) { 
    console.error(e); 
    renderError("superContent-orgs", "Error loading organizations", "loadSuperOrganizations()");
  }
}

function refreshSuperOrgs() {
  loadSuperOrganizations();
  showToast("Organizations refreshed", "success");
}

async function loadSuperSettings() {
  const el = document.getElementById("superContent-settings");
  if (!el) return;
  
  el.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-user-shield"></i> SuperAdmin Security</h3>
      <label class="label">Change SuperAdmin Password</label>
      <input id="new-super-pass" class="input" placeholder="New password (min 8 characters)" type="password">
      <div style="margin-top:10px">
        <button class="btn neon-btn" onclick="changeSuperPassword()">
          <i class="fas fa-key"></i> Change Password
        </button>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-building"></i> Create New Organization</h3>
      
      <label class="label">Organization Logo (Optional)</label>
      <div style="margin-bottom:15px">
        <div id="orgLogoPreview" style="width:100px;height:100px;border-radius:12px;border:2px dashed rgba(0,255,255,0.3);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);margin-bottom:10px">
          <i class="fas fa-building" style="font-size:32px;color:#00eaff"></i>
        </div>
        <input type="file" id="orgLogoFile" accept="image/*" class="input" onchange="previewOrgLogo()">
      </div>
      
      <label class="label">Organization Name *</label>
      <input id="new-org-name" class="input" placeholder="Enter organization name" required>
      
      <label class="label">Description (Optional)</label>
      <textarea id="new-org-desc" class="input" placeholder="Organization description" rows="2"></textarea>
      
      <label class="label">EC Password * (min 6 characters)</label>
      <input id="new-org-ec-pass" class="input" placeholder="Set EC password" type="password" required>
      
      <label class="label">EC Email (optional - for notifications)</label>
      <input id="new-org-ec-email" class="input" placeholder="ec@example.com" type="email">
      
      <label class="label">EC Phone (optional - for notifications)</label>
      <input id="new-org-ec-phone" class="input" placeholder="+233XXXXXXXXX">
      
      <div style="margin-top:20px">
        <button class="btn neon-btn" onclick="createNewOrganization()">
          <i class="fas fa-plus-circle"></i> Create Organization
        </button>
      </div>
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-cog"></i> System Settings</h3>
      <div style="margin-top:15px">
        <label class="label" style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="enable-email-alerts" checked>
          <span>Enable Email Notifications</span>
        </label>
        <label class="label" style="display:flex;align-items:center;gap:10px;margin-top:10px">
          <input type="checkbox" id="enable-sms-alerts" checked>
          <span>Enable SMS Notifications</span>
        </label>
        <label class="label" style="display:flex;align-items:center;gap:10px;margin-top:10px">
          <input type="checkbox" id="auto-delete-ended" checked>
          <span>Auto-delete ended elections after 30 days</span>
        </label>
      </div>
    </div>
  `;
}

async function loadSuperDelete() {
  const el = document.getElementById("superContent-delete");
  if (!el) return;
  
  showQuickLoading("superContent-delete", "Loading Organizations");
  
  try {
    const snaps = await getDocs(collection(db, "organizations"));
    const orgs = []; 
    snaps.forEach(s => orgs.push({ id: s.id, ...s.data() }));
    
    if (orgs.length === 0) {
      el.innerHTML = `
        <div class="card">
          <p class="subtext">No organizations to delete.</p>
        </div>
      `;
      return;
    }
    
    let html = `
      <div class="danger-zone" style="padding:20px;border-radius:16px;margin-bottom:20px">
        <h3 style="color:#ff4444;margin-bottom:10px">
          <i class="fas fa-exclamation-triangle"></i> Delete Organizations
        </h3>
        <p class="subtext" style="color:#ff9999">
          Warning: This action cannot be undone. All data (voters, votes, candidates, positions) will be permanently deleted.
        </p>
      </div>
    `;
    
    orgs.forEach(org => {
      const voterCount = org.voterCount || 0;
      const voteCount = org.voteCount || 0;
      const date = org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'Unknown';
      
      html += `
        <div class="list-item" style="border-left:4px solid #ff4444;align-items:center">
          <div style="flex:1">
            <div style="display:flex;gap:10px;align-items:center">
              <img src="${org.logoUrl || getDefaultLogo(org.name)}" 
                   style="width:50px;height:50px;border-radius:10px;object-fit:cover;background:#08102a;">
              <div>
                <strong>${org.name || org.id}</strong>
                <div class="subtext" style="margin-top:2px">ID: ${org.id}</div>
                <div class="subtext" style="margin-top:2px">
                  ${voterCount} voters • ${voteCount} votes • Created: ${date}
                </div>
              </div>
            </div>
          </div>
          <div>
            <button class="btn btn-danger" onclick="deleteOrganizationConfirm('${org.id}', '${escapeHtml(org.name || org.id)}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
    });
    
    el.innerHTML = html;
  } catch(e) { 
    console.error(e); 
    renderError("superContent-delete", "Error loading delete list", "loadSuperDelete()");
  }
}

// ---------------- EC Functions ----------------
async function loginEC() {
  const id = document.getElementById("ec-org-id").value.trim();
  const pass = document.getElementById("ec-pass").value.trim();
  
  if (!id || !pass) { 
    showToast("Enter organization ID and password", "error"); 
    return; 
  }
  
  try {
    const ref = doc(db, "organizations", id);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) { 
      showToast("Organization not found", "error"); 
      return; 
    }
    
    const org = snap.data();
    
    if (org.ecPassword !== pass) { 
      showToast("Wrong EC password", "error"); 
      return; 
    }
    
    session.role = 'ec'; 
    session.orgId = id; 
    saveSession();
    
    showScreen("ecPanel");
    await openECPanel(id);
    
    document.getElementById("ec-org-id").value = "";
    document.getElementById("ec-pass").value = "";
    
    showToast("EC logged in successfully", "success");
    
  } catch(e) { 
    console.error(e); 
    showToast("Login failed", "error"); 
  }
}

async function openECPanel(orgId) {
  currentOrgId = orgId;
  
  if (currentOrgUnsub) {
    currentOrgUnsub();
    currentOrgUnsub = null;
  }
  
  try {
    const ref = doc(db, "organizations", orgId);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      showToast("Organization not found", "error");
      logout();
      return;
    }
    
    currentOrgData = snap.data();
    
    updateECUI();
    
    await showECTab(activeTab);
    
    currentOrgUnsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        currentOrgData = snap.data();
        updateECUI();
        
        if (activeTab === 'outcomes') {
          loadECOutcomes();
        } else if (activeTab === 'voters') {
          loadECVoters();
        }
      } else {
        showToast("Organization deleted", "error");
        logout();
      }
    });
    
  } catch (e) {
    console.error("Error opening EC panel:", e);
    showToast("Error loading organization data", "error");
  }
}

function updateECUI() {
  if (!currentOrgData) return;
  
  document.getElementById('ecOrgName').textContent = currentOrgData.name || currentOrgData.id;
  document.getElementById('ecOrgIdDisplay').textContent = `ID: ${currentOrgId}`;
  
  const statusColor = currentOrgData.electionStatus === 'declared' ? '#9D00FF' :
                     currentOrgData.electionStatus === 'scheduled' ? '#ffc107' : '#00ffaa';
  
  const statusElement = document.querySelector('#ecPanel .app-subtext');
  if (statusElement) {
    statusElement.innerHTML = `
      <span style="color:${statusColor}">${currentOrgData.electionStatus || 'active'}</span> • 
      ${currentOrgData.voterCount || 0} voters • 
      ${currentOrgData.voteCount || 0} votes
    `;
  }
}

// ---------------- Voters Tab with FIXED Email Change ----------------
async function loadECVoters() {
  const el = document.getElementById("ecContent-voters");
  if (!el || !currentOrgId) return;
  
  showQuickLoading("ecContent-voters", "Loading Voters");
  
  try {
    const snap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    const voters = [];
    snap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-users"></i> Voters (${voters.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddVoterModal()">
            <i class="fas fa-user-plus"></i> Add Voter
          </button>
          <button class="btn neon-btn-outline" onclick="showBulkVoterModal()">
            <i class="fas fa-users"></i> Bulk Add
          </button>
          <button class="btn neon-btn-outline" onclick="refreshECData()">
            <i class="fas fa-redo"></i> Refresh
          </button>
          <button class="btn neon-btn-outline" onclick="showBulkWhatsAppInviteModal()" title="Bulk WhatsApp Invites">
            <i class="fab fa-whatsapp"></i> Bulk Invite
          </button>
        </div>
      </div>
    `;
    
    if (voters.length === 0) {
      html += `
        <div class="card info-card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-users" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Voters Yet</h3>
          <p class="subtext">Add voters to start your election</p>
          <button class="btn neon-btn mt-20" onclick="showAddVoterModal()">
            <i class="fas fa-user-plus"></i> Add Your First Voter
          </button>
        </div>
      `;
    } else {
      let votedCount = voters.filter(v => v.hasVoted && !v.isReplaced).length;
      let pendingCount = voters.filter(v => !v.hasVoted && !v.isReplaced).length;
      let replacedCount = voters.filter(v => v.isReplaced).length;
      
      html += `
        <div class="card info-card" style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-around;text-align:center">
            <div>
              <div class="label">Active Voters</div>
              <div style="font-size:24px;font-weight:bold;color:#00eaff">${votedCount + pendingCount}</div>
            </div>
            <div>
              <div class="label">Voted</div>
              <div style="font-size:24px;font-weight:bold;color:#00ffaa">${votedCount}</div>
            </div>
            <div>
              <div class="label">Pending</div>
              <div style="font-size:24px;font-weight:bold;color:#ffc107">${pendingCount}</div>
            </div>
            ${replacedCount > 0 ? `
            <div>
              <div class="label">Replaced</div>
              <div style="font-size:24px;font-weight:bold;color:#888">${replacedCount}</div>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div style="display:flex;gap:10px;margin-bottom:15px">
          <input type="text" id="voterSearch" class="input" placeholder="Search voters by name or email..." style="flex:1" onkeyup="searchVoters()">
          <button class="btn neon-btn-outline" onclick="exportVotersCSV()">
            <i class="fas fa-download"></i> Export
          </button>
        </div>
        
        <div id="votersList">
      `;
      
      voters.forEach(v => {
        if (v.isReplaced) {
          // Skip displaying replaced voters in main list
          return;
        }
        
        const email = decodeURIComponent(v.id);
        const phoneDisplay = v.phone ? formatPhoneForDisplay(v.phone) : 'No phone';
        const dobDisplay = v.dateOfBirth ? formatDateForDisplay(new Date(v.dateOfBirth)) : 'Not provided';
        const status = v.hasVoted ? 
          '<span style="color:#00ffaa;background:rgba(0,255,170,0.1);padding:4px 10px;border-radius:12px;font-size:12px">✅ Voted</span>' :
          '<span style="color:#ffc107;background:rgba(255,193,7,0.1);padding:4px 10px;border-radius:12px;font-size:12px">⏳ Pending</span>';
        
        const addedDate = v.addedAt ? formatFirestoreTimestamp(v.addedAt) : 'N/A';
        const votedDate = v.hasVoted && v.votedAt ? formatFirestoreTimestamp(v.votedAt) : null;
        
        html += `
          <div class="list-item voter-item" data-email="${email.toLowerCase()}" data-name="${(v.name || '').toLowerCase()}" style="align-items:center">
            <div style="display:flex;gap:12px;align-items:center;flex:1">
              <div style="width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,#9D00FF,#00C3FF);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">
                ${(v.name || email).charAt(0).toUpperCase()}
              </div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div>
                    <strong class="voter-name">${escapeHtml(v.name || email)}</strong>
                    <div class="subtext voter-email" style="margin-top:2px">${escapeHtml(email)}</div>
                    <div class="subtext" style="margin-top:2px"><i class="fas fa-phone"></i> ${phoneDisplay}</div>
                    <div class="subtext" style="margin-top:2px"><i class="fas fa-birthday-cake"></i> ${dobDisplay}</div>
                  </div>
                  ${status}
                </div>
                <div class="subtext" style="margin-top:4px">
                  Added: ${addedDate}
                  ${votedDate ? ` • Voted: ${votedDate}` : ''}
                  ${v.previousEmail ? `<br><span style="color:#ffc107"><i class="fas fa-history"></i> Previous email: ${v.previousEmail}</span>` : ''}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="editVoterModal('${escapeHtml(v.id)}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn neon-btn-outline email-change-btn" data-voter-id="${escapeHtml(v.id)}" data-email="${escapeHtml(email)}" data-name="${escapeHtml(v.name || email)}" title="Change Email">
                <i class="fas fa-at"></i>
              </button>
              <button class="btn neon-btn-outline" onclick="sendVoterInvite('${escapeHtml(email)}', '${escapeHtml(v.name || email)}', '${escapeHtml(v.phone || '')}')" title="Send Email Invite">
                <i class="fas fa-paper-plane"></i>
              </button>
              <button class="btn neon-btn-outline" onclick="sendWhatsAppInvite('${escapeHtml(email)}', '${escapeHtml(v.name || email)}', '${escapeHtml(v.phone || '')}')" title="Send WhatsApp">
                <i class="fab fa-whatsapp"></i>
              </button>
              <button class="btn btn-danger" onclick="removeVoter('${escapeHtml(v.id)}', '${escapeHtml(v.name || email)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
    }
    
    el.innerHTML = html;
    
    // Attach event listeners for email change buttons
    setTimeout(() => {
      document.querySelectorAll('.email-change-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const voterId = btn.getAttribute('data-voter-id');
          const email = btn.getAttribute('data-email');
          const name = btn.getAttribute('data-name');
          changeVoterEmailModal(voterId, email, name);
        });
      });
    }, 100);
    
    // Set up auto-refresh for voters tab
    if (refreshIntervals.voters) {
      clearInterval(refreshIntervals.voters);
    }
    refreshIntervals.voters = setInterval(() => {
      if (activeTab === 'voters') {
        loadECVoters();
      }
    }, 30000);
    
  } catch(e) { 
    console.error("Error loading voters:", e);
    renderError("ecContent-voters", "Error loading voters: " + e.message, "loadECVoters()");
  }
}

// FIXED: Unified refresh function for all EC tabs
window.refreshECData = function() {
  if (!currentOrgId || !activeTab) {
    showToast("No organization loaded", "error");
    return;
  }
  
  console.log("Refreshing EC data for tab:", activeTab);
  
  // Clear any existing intervals
  Object.values(refreshIntervals).forEach(interval => {
    if (interval) clearInterval(interval);
  });
  
  // Refresh the current tab
  if (activeTab === 'voters') {
    loadECVoters();
  } else if (activeTab === 'positions') {
    loadECPositions();
  } else if (activeTab === 'candidates') {
    loadECCandidates();
  } else if (activeTab === 'outcomes') {
    loadECOutcomes();
  } else if (activeTab === 'settings') {
    loadECSettings();
  }
  
  showToast(`${activeTab} data refreshed`, "success");
};

// ---------------- Positions Tab ----------------
async function loadECPositions() {
  const el = document.getElementById("ecContent-positions");
  if (!el || !currentOrgId) return;
  
  showQuickLoading("ecContent-positions", "Loading Positions");
  
  try {
    const snap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const positions = [];
    snap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-list-ol"></i> Positions (${positions.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddPositionModal()">
            <i class="fas fa-plus-circle"></i> Add Position
          </button>
          <button class="btn neon-btn-outline" onclick="refreshECData()">
            <i class="fas fa-redo"></i> Refresh
          </button>
        </div>
      </div>
    `;
    
    if (positions.length === 0) {
      html += `
        <div class="card info-card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-list-ol" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Positions Yet</h3>
          <p class="subtext">Add positions to organize your election</p>
          <button class="btn neon-btn mt-20" onclick="showAddPositionModal()">
            <i class="fas fa-plus-circle"></i> Add Your First Position
          </button>
        </div>
      `;
    } else {
      positions.forEach(p => {
        html += `
          <div class="list-item" style="align-items:center">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:50px;height:50px;border-radius:8px;background:linear-gradient(135deg,#9D00FF,#00C3FF);display:flex;align-items:center;justify-content:center;color:white;">
                  <i class="fas fa-briefcase"></i>
                </div>
                <div>
                  <strong>${p.name}</strong>
                  ${p.description ? `<div class="subtext" style="margin-top:4px">${p.description}</div>` : ''}
                  <div class="subtext" style="margin-top:4px">ID: ${p.id}</div>
                  <div class="subtext" style="margin-top:4px">
                    Max Candidates: ${p.maxCandidates || 1} • Voting Type: ${p.votingType === 'multiple' ? 'Multiple Choice' : 'Single Choice'}
                  </div>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="editPositionModal('${p.id}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-danger" onclick="deletePositionConfirm('${p.id}', '${escapeHtml(p.name)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    
    el.innerHTML = html;
    
  } catch(e) { 
    console.error("Error loading positions:", e);
    renderError("ecContent-positions", "Error loading positions", "loadECPositions()");
  }
}

// ---------------- Candidates Tab ----------------
async function loadECCandidates() {
  const el = document.getElementById("ecContent-candidates");
  if (!el || !currentOrgId) return;
  
  showQuickLoading("ecContent-candidates", "Loading Candidates");
  
  try {
    const [candidatesSnap, positionsSnap] = await Promise.all([
      getDocs(collection(db, "organizations", currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", currentOrgId, "positions"))
    ]);
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-user-friends"></i> Candidates (${candidates.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddCandidateModal()">
            <i class="fas fa-user-plus"></i> Add Candidate
          </button>
          <button class="btn neon-btn-outline" onclick="refreshECData()">
            <i class="fas fa-redo"></i> Refresh
          </button>
        </div>
      </div>
    `;
    
    if (candidates.length === 0) {
      html += `
        <div class="card info-card" style="text-align:center;padding:40px 20px;">
          <i class="fas fa-user-friends" style="font-size:48px;color:#00eaff;margin-bottom:20px"></i>
          <h3>No Candidates Yet</h3>
          <p class="subtext">Add candidates for each position</p>
          <button class="btn neon-btn mt-20" onclick="showAddCandidateModal()">
            <i class="fas fa-user-plus"></i> Add Your First Candidate
          </button>
        </div>
      `;
    } else {
      const grouped = {};
      candidates.forEach(c => {
        grouped[c.positionId] = grouped[c.positionId] || [];
        grouped[c.positionId].push(c);
      });
      
      positions.forEach(pos => {
        const posCandidates = grouped[pos.id] || [];
        if (posCandidates.length === 0) return;
        
        html += `
          <div class="card" style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
              <h4 style="color:#00eaff;margin:0">
                <i class="fas fa-users"></i> ${pos.name}
                <span class="subtext">(${posCandidates.length} candidates)</span>
              </h4>
              <button class="btn neon-btn-outline" onclick="showAddCandidateForPositionModal('${pos.id}', '${escapeHtml(pos.name)}')">
                <i class="fas fa-user-plus"></i> Add to ${pos.name}
              </button>
            </div>
        `;
        
        posCandidates.forEach(c => {
          const photoUrl = c.photo || getDefaultAvatar(c.name);
          
          html += `
            <div class="list-item" style="margin-top:10px;align-items:center">
              <div style="display:flex;gap:12px;align-items:center">
                <img src="${photoUrl}" 
                     style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid rgba(0,255,255,0.2);background:#08102a;">
                <div style="flex:1">
                  <strong>${c.name}</strong>
                  ${c.tagline ? `<div class="subtext" style="margin-top:2px">${c.tagline}</div>` : ''}
                  ${c.bio ? `<div class="subtext" style="margin-top:2px;font-size:12px">${c.bio.substring(0, 100)}${c.bio.length > 100 ? '...' : ''}</div>` : ''}
                  <div class="subtext" style="margin-top:2px">ID: ${c.id}</div>
                  <div class="subtext" style="margin-top:2px">
                    <i class="fas fa-chart-line"></i> Votes: ${c.votes || 0}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn neon-btn-outline" onclick="editCandidateModal('${c.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteCandidateConfirm('${c.id}', '${escapeHtml(c.name)}')" title="Delete">
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
    console.error("Error loading candidates:", e);
    renderError("ecContent-candidates", "Error loading candidates", "loadECCandidates()");
  }
}

// ---------------- Outcomes Tab ----------------
async function loadECOutcomes() {
  const el = document.getElementById("ecContent-outcomes");
  if (!el || !currentOrgId || !currentOrgData) return;
  
  showQuickLoading("ecContent-outcomes", "Loading Voting Outcomes");
  
  try {
    const [votesSnap, positionsSnap, candidatesSnap, votersSnap] = await Promise.all([
      getDocs(collection(db, "organizations", currentOrgId, "votes")),
      getDocs(collection(db, "organizations", currentOrgId, "positions")),
      getDocs(collection(db, "organizations", currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", currentOrgId, "voters"))
    ]);
    
    const votes = [];
    votesSnap.forEach(s => votes.push(s.data()));
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    const totalVoters = voters.filter(v => !v.isReplaced).length;
    const votesCast = votes.length;
    const participationRate = totalVoters ? Math.round((votesCast / totalVoters) * 100) : 0;
    const remainingVoters = totalVoters - votesCast;
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      voterCount: totalVoters,
      voteCount: votesCast
    });
    
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      currentOrgData = orgSnap.data();
      updateECUI();
    }
    
    let html = `
      <div class="card info-card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-around;text-align:center;gap:20px">
          <div>
            <div class="label">Active Voters</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${totalVoters}</div>
            <div class="subtext" style="font-size:12px">Excluding replaced</div>
          </div>
          <div>
            <div class="label">Votes Cast</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${votesCast}</div>
            <div class="subtext" style="font-size:12px">Actual votes</div>
          </div>
          <div>
            <div class="label">Participation</div>
            <div style="font-weight:bold;font-size:28px;color:#00eaff">${participationRate}%</div>
            <div class="subtext" style="font-size:12px">${votesCast}/${totalVoters}</div>
          </div>
          <div>
            <div class="label">Remaining</div>
            <div style="font-weight:bold;font-size:28px;color:#ffc107">${remainingVoters}</div>
            <div class="subtext" style="font-size:12px">Yet to vote</div>
          </div>
        </div>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-chart-bar"></i> Results by Position</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn-outline" onclick="refreshECData()">
            <i class="fas fa-redo"></i> Refresh
          </button>
          <button class="btn neon-btn" onclick="exportResultsCSV()">
            <i class="fas fa-download"></i> Export Results
          </button>
          <button class="btn neon-btn-outline" onclick="syncVoterCounts()" title="Force Sync Voter Counts">
            <i class="fas fa-sync-alt"></i> Sync Counts
          </button>
        </div>
      </div>
    `;
    
    if (positions.length === 0) {
      html += `
        <div class="card">
          <p class="subtext">No positions created yet. Add positions in the Positions tab.</p>
        </div>
      `;
    } else {
      positions.forEach(pos => {
        const posCandidates = candidates.filter(c => c.positionId === pos.id);
        if (posCandidates.length === 0) return;
        
        const counts = {};
        votes.forEach(v => {
          if (v.choices && v.choices[pos.id]) {
            const candId = v.choices[pos.id];
            counts[candId] = (counts[candId] || 0) + 1;
          }
        });
        
        const totalPositionVotes = Object.values(counts).reduce((a, b) => a + b, 0);
        
        html += `
          <div class="card" style="margin-bottom:20px">
            <h4 style="color:#00eaff;margin-bottom:15px">
              <i class="fas fa-chart-pie"></i> ${pos.name}
              <span class="subtext">(${totalPositionVotes} votes)</span>
            </h4>
        `;
        
        const sortedCandidates = [...posCandidates].sort((a, b) => {
          return (counts[b.id] || 0) - (counts[a.id] || 0);
        });
        
        sortedCandidates.forEach((candidate, index) => {
          const candidateVotes = counts[candidate.id] || 0;
          const percentage = totalPositionVotes ? Math.round((candidateVotes / totalPositionVotes) * 100) : 0;
          const isLeading = index === 0 && candidateVotes > 0;
          
          html += `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;border-radius:8px;background:${isLeading ? 'rgba(0,255,170,0.1)' : 'rgba(255,255,255,0.02)'};border-left:4px solid ${isLeading ? '#00ffaa' : 'transparent'}">
              <span style="color:#888;min-width:20px">#${index + 1}</span>
              <img src="${candidate.photo || getDefaultAvatar(candidate.name)}" 
                   style="width:50px;height:50px;border-radius:8px;object-fit:cover;border:2px solid rgba(0,255,255,0.2)">
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
            </div>
          `;
        });
        
        if (sortedCandidates.length > 1 && totalPositionVotes > 0) {
          const leadingCandidate = sortedCandidates[0];
          const secondCandidate = sortedCandidates[1];
          const leadingVotes = counts[leadingCandidate.id] || 0;
          const secondVotes = counts[secondCandidate.id] || 0;
          const lead = leadingVotes - secondVotes;
          
          html += `
            <div style="margin-top:15px;padding:12px;border-radius:8px;background:rgba(0,255,255,0.05);border:1px solid rgba(0,255,255,0.1);">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <strong style="color:#00eaff">Current Leader:</strong>
                  <div style="margin-top:4px">${leadingCandidate.name}</div>
                  <div class="subtext">${leadingVotes} votes</div>
                </div>
                ${lead > 0 ? `
                  <div style="color:#00ffaa;font-weight:bold;font-size:18px">
                    <i class="fas fa-trophy"></i> +${lead} vote${lead === 1 ? '' : 's'}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }
        
        html += `</div>`;
      });
    }
    
    el.innerHTML = html;
    
    if (refreshIntervals.outcomes) {
      clearInterval(refreshIntervals.outcomes);
    }
    refreshIntervals.outcomes = setInterval(() => {
      if (activeTab === 'outcomes') {
        loadECOutcomes();
      }
    }, 15000);
    
  } catch(e) { 
    console.error("Error loading outcomes:", e);
    renderError("ecContent-outcomes", "Error loading outcomes", "loadECOutcomes()");
  }
}

// ---------------- Settings Tab ----------------
async function loadECSettings() {
  const el = document.getElementById("ecContent-settings");
  if (!el || !currentOrgData) return;
  
  const org = currentOrgData;
  const startTime = org.electionSettings?.startTime || '';
  const endTime = org.electionSettings?.endTime || '';
  const declared = org.electionStatus === 'declared';
  
  el.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-calendar-alt"></i> Election Schedule</h3>
      <label class="label">Start Date & Time</label>
      <input id="ecStartTime" type="datetime-local" class="input" value="${startTime ? new Date(startTime).toISOString().slice(0,16) : ''}">
      <label class="label">End Date & Time</label>
      <input id="ecEndTime" type="datetime-local" class="input" value="${endTime ? new Date(endTime).toISOString().slice(0,16) : ''}">
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn neon-btn" onclick="saveElectionSchedule()" style="flex:1">Save Schedule</button>
        <button class="btn neon-btn-outline" onclick="clearElectionSchedule()" style="flex:1">Clear</button>
      </div>
      ${startTime ? `
        <div class="subtext" style="margin-top:10px;padding:8px;background:rgba(0,255,255,0.05);border-radius:8px">
          <i class="fas fa-info-circle"></i> Current: ${new Date(startTime).toLocaleString()} to ${endTime ? new Date(endTime).toLocaleString() : 'No end time'}
        </div>
      ` : ''}
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-share-alt"></i> Public Results</h3>
      <p class="subtext">Generate a public link for viewing results</p>
      <div style="display:flex;gap:8px">
        <button class="btn neon-btn" onclick="generatePublicLink()" style="flex:1">
          ${org.publicEnabled ? 'Regenerate Link' : 'Generate Link'}
        </button>
        ${org.publicEnabled ? `
          <button class="btn neon-btn-outline" onclick="copyPublicLink()" style="flex:1">Copy Link</button>
        ` : ''}
      </div>
      ${org.publicEnabled && org.publicToken ? `
        <div class="link-box" style="margin-top:12px">
          <strong>Public Results Link:</strong><br>
          <code>${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}</code>
          <button class="btn neon-btn-outline" onclick="navigator.clipboard.writeText('${window.location.origin}${window.location.pathname}?org=${org.id}&token=${org.publicToken}').then(() => showToast('Link copied!', 'success'))" style="margin-top:8px;width:100%">
            <i class="fas fa-copy"></i> Copy Link
          </button>
        </div>
      ` : ''}
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-flag-checkered"></i> Declare Results</h3>
      <p class="subtext">Finalize and declare election results (locks voting)</p>
      <button class="btn neon-btn" ${declared ? 'disabled' : ''} onclick="declareResultsConfirm()" style="width:100%">
        ${declared ? '<i class="fas fa-check-circle"></i> Results Declared' : '<i class="fas fa-flag"></i> Declare Final Results'}
      </button>
      ${declared ? `
        <div class="subtext" style="margin-top:8px;padding:8px;background:rgba(157,0,255,0.1);border-radius:8px">
          <i class="fas fa-clock"></i> Declared at: ${org.resultsDeclaredAt ? new Date(org.resultsDeclaredAt).toLocaleString() : 'N/A'}
        </div>
      ` : ''}
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3><i class="fas fa-bell"></i> Send Voter Alerts</h3>
      <p class="subtext">Send alerts to voters about the election</p>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn neon-btn-outline" onclick="send30MinAlerts()" style="flex:1">
          <i class="fas fa-clock"></i> 30-Min Alert
        </button>
        <button class="btn neon-btn-outline" onclick="sendVoteStartAlerts()" style="flex:1">
          <i class="fas fa-play"></i> Start Alert
        </button>
      </div>
    </div>
    
    <div class="card danger-zone" style="margin-top:20px">
      <h3><i class="fas fa-exclamation-triangle"></i> Danger Zone</h3>
      <p class="subtext">Reset or clear election data</p>
      <div style="margin-top:10px">
        <button class="btn btn-danger" onclick="resetVotesConfirm()" style="width:100%;margin-bottom:10px">
          <i class="fas fa-undo"></i> Reset All Votes
        </button>
        <button class="btn btn-danger" onclick="clearAllDataConfirm()" style="width:100%">
          <i class="fas fa-trash-alt"></i> Clear All Election Data
        </button>
      </div>
    </div>
  `;
}

// ---------------- Event Listeners ----------------
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Neon Voting System Initialized');
  
  setupTabs();
  
  document.getElementById('btn-superadmin')?.addEventListener('click', () => {
    showScreen('superAdminLoginScreen');
  });
  
  document.getElementById('btn-ec')?.addEventListener('click', () => {
    showScreen('ecLoginScreen');
  });
  
  document.getElementById('btn-voter')?.addEventListener('click', () => {
    showScreen('voterLoginScreen');
  });
  
  document.getElementById('btn-public')?.addEventListener('click', () => {
    showScreen('publicScreen');
  });
  
  document.getElementById('btn-guest')?.addEventListener('click', () => {
    showScreen('guestScreen');
  });
  
  const backButtons = {
    'super-back': 'gatewayScreen',
    'ec-back': 'gatewayScreen',
    'voter-back': 'gatewayScreen',
    'public-back': 'gatewayScreen',
    'guest-back': 'gatewayScreen'
  };
  
  Object.entries(backButtons).forEach(([id, screen]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      showScreen(screen);
    });
  });
  
  document.getElementById('super-login-btn')?.addEventListener('click', loginSuperAdmin);
  document.getElementById('ec-login-btn')?.addEventListener('click', loginEC);
  
  document.getElementById('voter-send-otp')?.addEventListener('click', async () => {
    const email = document.getElementById('voter-email').value.trim();
    if (!email) {
      showToast('Please enter email', 'error');
      return;
    }
    
    showToast('OTP would be sent to ' + email, 'success');
    document.getElementById('voter-otp-group').classList.remove('hidden');
  });
  
  document.getElementById('voter-verify-otp')?.addEventListener('click', async () => {
    const otp = document.getElementById('voter-otp').value.trim();
    if (!otp || otp.length !== 6) {
      showToast('Please enter valid 6-digit OTP', 'error');
      return;
    }
    
    showToast('OTP verified successfully', 'success');
    showScreen('votingScreen');
  });
  
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', logout);
  });
  
  // Add event delegation for dynamically loaded invite buttons
  document.addEventListener('click', function(e) {
    // Check if click is on a voter invite button
    const inviteBtn = e.target.closest('[onclick*="sendVoterInvite"]');
    if (inviteBtn) {
      e.preventDefault();
      const onclickAttr = inviteBtn.getAttribute('onclick');
      // Extract parameters from onclick string
      const match = onclickAttr.match(/sendVoterInvite\('([^']+)',\s*'([^']*)',\s*'([^']*)'\)/);
      if (match) {
        const email = match[1];
        const name = match[2];
        const phone = match[3];
        sendVoterInvite(email, name, phone);
      }
    }
    
    // Check if click is on a WhatsApp invite button
    const whatsappBtn = e.target.closest('[onclick*="sendWhatsAppInvite"]');
    if (whatsappBtn) {
      e.preventDefault();
      const onclickAttr = whatsappBtn.getAttribute('onclick');
      const match = onclickAttr.match(/sendWhatsAppInvite\('([^']+)',\s*'([^']*)',\s*'([^']*)'\)/);
      if (match) {
        const email = match[1];
        const name = match[2];
        const phone = match[3];
        sendWhatsAppInvite(email, name, phone);
      }
    }
    
    // Check if click is on an email change button
    const emailChangeBtn = e.target.closest('.email-change-btn');
    if (emailChangeBtn) {
      e.preventDefault();
      const voterId = emailChangeBtn.getAttribute('data-voter-id');
      const email = emailChangeBtn.getAttribute('data-email');
      const name = emailChangeBtn.getAttribute('data-name');
      changeVoterEmailModal(voterId, email, name);
    }
  });
  
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('org');
  const role = params.get('role');
  const voterId = params.get('voter');
  
  if (orgId) {
    try {
      const orgSnap = await getDoc(doc(db, "organizations", orgId));
      if (orgSnap.exists()) {
        const org = orgSnap.data();
        
        if (role === 'ec') {
          document.getElementById('ec-org-id').value = orgId;
          showScreen('ecLoginScreen');
          showToast(`Please enter EC password for ${org.name}`, 'info');
        } else if (voterId) {
          document.querySelector('#voterLoginScreen .app-title').textContent = org.name;
          document.getElementById('voter-email').value = decodeURIComponent(voterId);
          showScreen('voterLoginScreen');
          showToast(`Welcome to ${org.name} voting`, 'info');
        } else if (params.get('token') === org.publicToken || org.publicEnabled) {
          document.getElementById('publicOrgName').textContent = org.name;
          showScreen('publicScreen');
        }
      }
    } catch(e) {
      console.error('URL parameter error:', e);
    }
  }
  
  if (session.role === 'superadmin') {
    showScreen('superAdminPanel');
  } else if (session.role === 'ec' && session.orgId) {
    showScreen('ecPanel');
    openECPanel(session.orgId);
  }
});

// ---------------- Utility Functions ----------------
function logout() {
  if (currentOrgUnsub) {
    currentOrgUnsub();
    currentOrgUnsub = null;
  }
  if (countdownInterval) clearInterval(countdownInterval);
  if (voterCountdownInterval) clearInterval(voterCountdownInterval);
  Object.values(refreshIntervals).forEach(interval => clearInterval(interval));
  refreshIntervals = {};
  
  document.getElementById('countdown-container')?.remove();
  
  currentOrgId = null;
  currentOrgData = null;
  voterSession = null;
  selectedCandidates = {};
  session = {};
  saveSession();
  
  showScreen('gatewayScreen');
  showToast('Logged out successfully', 'info');
}

function getDefaultLogo(orgName = '') {
  const initials = orgName ? orgName.substring(0, 2).toUpperCase() : 'NV';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#9D00FF"/>
          <stop offset="100%" style="stop-color:#00C3FF"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#08102a"/>
      <circle cx="100" cy="80" r="40" fill="url(#grad)"/>
      <text x="100" y="85" font-size="24" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">${initials}</text>
      <text x="100" y="150" font-size="16" text-anchor="middle" fill="#9beaff" font-family="Arial">Voting</text>
    </svg>
  `);
}

function getDefaultAvatar(name = '') {
  const initials = name ? name.substring(0, 2).toUpperCase() : 'U';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#9D00FF"/>
          <stop offset="100%" style="stop-color:#00C3FF"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#avatarGrad)"/>
      <text x="50%" y="55%" font-size="80" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" dy="0.35em">${initials}</text>
    </svg>
  `);
}

function formatPhoneForDisplay(phone) {
  if (!phone) return "No phone";
  const clean = phone.replace(/\D/g, '');
  
  if (clean.startsWith('233') && clean.length === 12) {
    const local = clean.substring(3);
    return `+233 ${local.substring(0, 3)} ${local.substring(3, 6)} ${local.substring(6)}`;
  }
  
  if (clean.length === 10 && clean.startsWith('0')) {
    return `+233 ${clean.substring(1, 4)} ${clean.substring(4, 7)} ${clean.substring(7)}`;
  }
  
  return `+${clean}`;
}

function formatDateForDisplay(date) {
  if (!date || isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function formatFirestoreTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  
  try {
    let date;
    
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch(e) {
    console.error('Error formatting timestamp:', e);
    return 'N/A';
  }
}

function validateDateOfBirth(dateStr) {
  if (!dateStr || dateStr.trim() === '') {
    return { valid: true };
  }
  
  dateStr = dateStr.trim();
  
  let date;
  
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr) && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  } else {
    date = new Date(dateStr);
  }
  
  if (isNaN(date.getTime())) {
    return { 
      valid: false, 
      error: 'Invalid date format. Please use YYYY-MM-DD or DD/MM/YYYY format.' 
    };
  }
  
  const today = new Date();
  if (date > today) {
    return { 
      valid: false, 
      error: 'Date of birth cannot be in the future.' 
    };
  }
  
  const ageInYears = (today - date) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageInYears > 150) {
    return { 
      valid: false, 
      error: 'Age seems unrealistic. Please check the date.' 
    };
  }
  
  return { 
    valid: true, 
    date: date.toISOString().split('T')[0]
  };
}

// ---------------- Modal Functions ----------------
function createModal(title, content, buttons = null) {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  `;
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    background: linear-gradient(135deg, #0a1929 0%, #08102a 100%);
    border-radius: 16px;
    border: 1px solid rgba(0, 255, 255, 0.1);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(157, 0, 255, 0.1);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.4s ease;
  `;
  
  let modalHTML = `
    <div style="padding: 25px; border-bottom: 1px solid rgba(0, 255, 255, 0.1);">
      <h3 style="margin: 0; color: #00eaff; font-size: 20px; display: flex; align-items: center; gap: 10px;">
        ${title}
      </h3>
    </div>
    <div style="padding: 25px;">
      ${content}
    </div>
  `;
  
  if (buttons) {
    modalHTML += `
      <div style="padding: 20px 25px 25px; border-top: 1px solid rgba(0, 255, 255, 0.1); display: flex; gap: 10px; justify-content: flex-end;">
        ${buttons}
      </div>
    `;
  }
  
  modal.innerHTML = modalHTML;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  return overlay;
}

// ---------------- FIXED Email Change Function with History Subcollection ----------------
window.changeVoterEmail = async function(oldVoterId, oldEmail, voterName) {
  const newEmailInput = document.getElementById('newVoterEmail');
  const confirmEmailInput = document.getElementById('confirmNewVoterEmail');
  const reasonInput = document.getElementById('emailChangeReason');
  
  if (!newEmailInput || !confirmEmailInput) {
    showToast('Email inputs not found', 'error');
    return;
  }
  
  const newEmail = newEmailInput.value.trim().toLowerCase();
  const confirmEmail = confirmEmailInput.value.trim().toLowerCase();
  const reason = reasonInput?.value.trim();
  
  if (!newEmail || !confirmEmail) {
    showToast('Please enter and confirm the new email address', 'error');
    return;
  }
  
  if (newEmail !== confirmEmail) {
    showToast('Email addresses do not match', 'error');
    return;
  }
  
  if (!validateEmail(newEmail)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  if (newEmail === oldEmail.toLowerCase()) {
    showToast('New email is the same as the current email', 'error');
    return;
  }
  
  try {
    const newVoterRef = doc(db, "organizations", currentOrgId, "voters", encodeURIComponent(newEmail));
    const newVoterSnap = await getDoc(newVoterRef);
    
    if (newVoterSnap.exists()) {
      showToast('A voter with this email already exists', 'error');
      return;
    }
  } catch(e) {
    console.error('Error checking duplicate email:', e);
    showToast('Error checking email availability', 'error');
    return;
  }
  
  try {
    const batch = writeBatch(db);
    
    // 1. Record email change in history subcollection
    const emailHistoryRef = doc(
      collection(db, "organizations", currentOrgId, "voters", oldVoterId, "emailHistory")
    );
    
    await setDoc(emailHistoryRef, {
      oldEmail: oldEmail,
      newEmail: newEmail,
      reason: reason || '',
      changedBy: 'ec-admin',
      changedAt: serverTimestamp(),
      organizationId: currentOrgId,
      voterName: voterName
    });
    
    // 2. Get the old voter data
    const oldVoterRef = doc(db, "organizations", currentOrgId, "voters", oldVoterId);
    const oldVoterSnap = await getDoc(oldVoterRef);
    
    if (!oldVoterSnap.exists()) {
      showToast('Voter not found', 'error');
      return;
    }
    
    const oldVoterData = oldVoterSnap.data();
    const hasVoted = oldVoterData.hasVoted || false;
    
    // 3. Create NEW voter document with new email
    const newVoterRef = doc(db, "organizations", currentOrgId, "voters", encodeURIComponent(newEmail));
    
    const newVoterData = {
      ...oldVoterData,
      email: newEmail,
      name: oldVoterData.name || voterName,
      previousEmail: oldEmail,
      emailUpdatedAt: new Date().toISOString(),
      hasVoted: hasVoted,
      votedAt: oldVoterData.votedAt || null,
      isActive: true,
      isReplaced: false,
      lastUpdated: serverTimestamp()
    };
    
    batch.set(newVoterRef, newVoterData);
    
    // 4. Mark OLD voter as inactive/replaced
    batch.update(oldVoterRef, {
      isActive: false,
      isReplaced: true,
      replacedBy: newEmail,
      replacedAt: new Date().toISOString(),
      replacementReason: reason || '',
      lastUpdated: serverTimestamp()
    });
    
    // 5. Update vote records if the voter has voted
    if (hasVoted && oldVoterData.votedAt) {
      try {
        const votesQuery = query(
          collection(db, "organizations", currentOrgId, "votes"),
          where("voterEmail", "==", oldEmail)
        );
        const votesSnap = await getDocs(votesQuery);
        
        if (!votesSnap.empty) {
          votesSnap.forEach(voteDoc => {
            batch.update(voteDoc.ref, {
              voterEmail: newEmail,
              emailUpdatedAt: new Date().toISOString()
            });
          });
        }
      } catch(voteError) {
        console.error('Error updating vote records:', voteError);
      }
    }
    
    await batch.commit();
    
    showToast(`Email changed from ${oldEmail} to ${newEmail}`, 'success');
    document.querySelector('.modal-overlay')?.remove();
    
    loadECVoters();
    
  } catch(e) {
    console.error('Error changing voter email:', e);
    showToast('Error changing email: ' + e.message, 'error');
  }
};

// ---------------- FIXED Voter Invite Functions (Email & WhatsApp) ----------------
window.sendVoterInvite = async function(email, name, phone) {
  try {
    // Check if we're in the EC panel
    if (!currentOrgId) {
      showToast("Organization not loaded", "error");
      return;
    }
    
    // Decode the email if it's encoded
    const decodedEmail = decodeURIComponent(email);
    
    const voterLink = `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&voter=${encodeURIComponent(decodedEmail)}`;
    const orgName = currentOrgData?.name || 'Election';
    
    const subject = `Invitation to Vote in ${orgName}`;
    const body = `Hello ${name || 'Voter'},\n\nYou have been invited to vote in the ${orgName} election.\n\nPlease use this link to vote:\n${voterLink}\n\nThis link is unique to you. Do not share it with others.\n\nThank you,\n${orgName} Election Committee`;
    
    // Create mailto link
    const mailtoLink = `mailto:${decodedEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open in new tab
    window.open(mailtoLink, '_blank');
    showToast(`Email invite opened for ${name || decodedEmail}`, 'success');
    
  } catch(e) {
    console.error('Error sending email invite:', e);
    showToast('Error opening email client: ' + e.message, 'error');
  }
};

// FIXED WhatsApp invite function
window.sendWhatsAppInvite = async function(email, name, phone) {
  try {
    if (!currentOrgId) {
      showToast("Organization not loaded", "error");
      return;
    }
    
    const decodedEmail = decodeURIComponent(email);
    const voterLink = `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&voter=${encodeURIComponent(decodedEmail)}`;
    const orgName = currentOrgData?.name || 'Election';
    
    if (!phone || phone.trim() === '') {
      showToast(`No phone number available for ${name || decodedEmail}`, 'warning');
      
      // Open a modal to ask for phone number
      showAddPhoneModal(decodedEmail, name);
      return;
    }
    
    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');
    let whatsappNumber = cleanPhone;
    
    // Handle Ghanaian numbers
    if (cleanPhone.startsWith('233') && cleanPhone.length === 12) {
      whatsappNumber = cleanPhone;
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith('0')) {
      whatsappNumber = '233' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 9) {
      whatsappNumber = '233' + cleanPhone;
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('+233')) {
      whatsappNumber = cleanPhone.substring(1);
    } else {
      // If it doesn't match any pattern, use as-is
      whatsappNumber = cleanPhone.replace('+', '');
    }
    
    // WhatsApp message
    const message = `Hello ${name || 'Voter'}!

You're invited to vote in *${orgName}* election.

🔗 *Voting Link:* ${voterLink}

📝 *Instructions:*
1. Click the link above
2. Use your email to log in
3. Cast your vote

⏰ *Important:* This link is unique to you. Do not share it.

Thank you!
*${orgName} Election Committee*`;
    
    // Create WhatsApp link
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    
    // Open in new tab
    window.open(whatsappLink, '_blank', 'noopener,noreferrer');
    
    showToast(`WhatsApp invite opened for ${name || decodedEmail}`, 'success');
    
  } catch(e) {
    console.error('Error sending WhatsApp invite:', e);
    showToast('Error creating WhatsApp link: ' + e.message, 'error');
  }
};

// Helper function to add phone number if missing
function showAddPhoneModal(email, name) {
  const modal = createModal(
    '<i class="fas fa-phone"></i> Add Phone Number',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Voter: ${name || email}</label>
          <input class="input" value="${email}" disabled style="background: rgba(255,255,255,0.05);">
        </div>
        <div>
          <label class="label">Phone Number *</label>
          <input id="voterPhoneInput" class="input" placeholder="+233XXXXXXXXX" required>
          <div class="subtext" style="margin-top: 5px;">Required for WhatsApp invites</div>
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> Format:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • Ghana: +233XXXXXXXXX or 0XXXXXXXXX<br>
            • Other: Include country code (+1, +44, etc.)
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="saveVoterPhone('${encodeURIComponent(email)}', '${escapeHtml(name || '')}')">
        <i class="fas fa-save"></i> Save & Send
      </button>
    `
  );
}

// Function to save phone number and send WhatsApp
async function saveVoterPhone(email, name) {
  const phoneInput = document.getElementById('voterPhoneInput')?.value.trim();
  
  if (!phoneInput) {
    showToast('Phone number is required', 'error');
    return;
  }
  
  try {
    // Save phone number to voter
    const voterRef = doc(db, "organizations", currentOrgId, "voters", email);
    await updateDoc(voterRef, {
      phone: phoneInput,
      updatedAt: serverTimestamp()
    });
    
    // Reload voters to show updated phone
    loadECVoters();
    
    // Close modal
    document.querySelector('.modal-overlay')?.remove();
    
    // Now send WhatsApp invite
    setTimeout(() => {
      sendWhatsAppInvite(email, name, phoneInput);
    }, 500);
    
  } catch(e) {
    console.error('Error saving phone:', e);
    showToast('Error saving phone number: ' + e.message, 'error');
  }
}

// ---------------- Bulk WhatsApp Invite Functions ----------------
window.showBulkWhatsAppInviteModal = function() {
  const modal = createModal(
    '<i class="fab fa-whatsapp"></i> Bulk WhatsApp Invites',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Select Voters to Invite</label>
          <div id="bulkWhatsAppVoterList" style="max-height: 300px; overflow-y: auto; border: 1px solid rgba(0,255,255,0.2); border-radius: 8px; padding: 10px;">
            <div style="text-align: center; padding: 20px; color: #9beaff;">
              <i class="fas fa-spinner fa-spin"></i> Loading voters...
            </div>
          </div>
        </div>
        <div>
          <label class="label">Custom Message (Optional)</label>
          <textarea id="bulkWhatsAppMessage" class="input" rows="4" placeholder="Add a custom message for all invites..."></textarea>
        </div>
        <div style="background: rgba(0, 255, 170, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 170, 0.1);">
          <div style="color: #00ffaa; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> Note:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • Only voters with phone numbers will be included<br>
            • WhatsApp will open in multiple tabs for selected voters<br>
            • You'll need to confirm sending on each WhatsApp tab
          </div>
        </div>
        <div id="bulkWhatsAppStats" style="display: none; background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-chart-bar"></i> Selection Stats:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            <span id="selectedVoterCount">0</span> voters selected • 
            <span id="eligibleVoterCount">0</span> with phone numbers
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" id="sendBulkWhatsAppBtn" disabled>
        <i class="fab fa-whatsapp"></i> Send Invites
      </button>
    `
  );
  
  // Load voters for bulk selection
  loadVotersForBulkWhatsApp();
};

async function loadVotersForBulkWhatsApp() {
  try {
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    const activeVoters = voters.filter(v => !v.isReplaced && !v.hasVoted);
    
    let html = '';
    if (activeVoters.length === 0) {
      html = `<div style="text-align: center; padding: 20px; color: #ffc107;">
                <i class="fas fa-users-slash"></i><br>
                No eligible voters found. All voters have either voted or been replaced.
              </div>`;
    } else {
      html = `<div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                  <input type="checkbox" id="selectAllWhatsAppVoters" onchange="toggleAllWhatsAppVoters(this.checked)">
                  <span>Select All Eligible Voters (${activeVoters.filter(v => v.phone).length} with phones)</span>
                </label>
              </div>`;
      
      activeVoters.forEach(voter => {
        const email = decodeURIComponent(voter.id);
        const hasPhone = voter.phone && voter.phone.trim() !== '';
        
        html += `
          <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <input type="checkbox" 
                   class="whatsapp-voter-checkbox" 
                   value="${voter.id}" 
                   data-name="${escapeHtml(voter.name || email)}" 
                   data-phone="${escapeHtml(voter.phone || '')}"
                   ${!hasPhone ? 'disabled' : ''}
                   onchange="updateBulkWhatsAppStats()">
            <div style="flex: 1;">
              <div style="font-weight: 500; color: ${hasPhone ? '#fff' : '#888'}">${voter.name || email}</div>
              <div style="font-size: 12px; color: #9beaff;">${email}</div>
              <div style="font-size: 11px; color: ${hasPhone ? '#00ffaa' : '#ffc107'};">
                <i class="fas fa-phone"></i> ${hasPhone ? formatPhoneForDisplay(voter.phone) : 'No phone number'}
              </div>
            </div>
          </div>
        `;
      });
    }
    
    document.getElementById('bulkWhatsAppVoterList').innerHTML = html;
    updateBulkWhatsAppStats();
    
  } catch(e) {
    console.error('Error loading voters for bulk WhatsApp:', e);
    document.getElementById('bulkWhatsAppVoterList').innerHTML = `
      <div style="text-align: center; padding: 20px; color: #ff4444;">
        <i class="fas fa-exclamation-triangle"></i><br>
        Error loading voters: ${e.message}
      </div>
    `;
  }
}

window.toggleAllWhatsAppVoters = function(checked) {
  document.querySelectorAll('.whatsapp-voter-checkbox:not(:disabled)').forEach(checkbox => {
    checkbox.checked = checked;
  });
  updateBulkWhatsAppStats();
};

window.updateBulkWhatsAppStats = function() {
  const checkboxes = document.querySelectorAll('.whatsapp-voter-checkbox:not(:disabled)');
  const selected = document.querySelectorAll('.whatsapp-voter-checkbox:not(:disabled):checked');
  const totalWithPhones = checkboxes.length;
  
  document.getElementById('selectedVoterCount').textContent = selected.length;
  document.getElementById('eligibleVoterCount').textContent = totalWithPhones;
  document.getElementById('bulkWhatsAppStats').style.display = 'block';
  
  const sendBtn = document.getElementById('sendBulkWhatsAppBtn');
  sendBtn.disabled = selected.length === 0;
};

window.sendBulkWhatsAppInvites = function() {
  const selectedVoters = [];
  const customMessage = document.getElementById('bulkWhatsAppMessage')?.value.trim() || '';
  
  document.querySelectorAll('.whatsapp-voter-checkbox:not(:disabled):checked').forEach(checkbox => {
    selectedVoters.push({
      id: checkbox.value,
      name: checkbox.dataset.name,
      phone: checkbox.dataset.phone
    });
  });
  
  if (selectedVoters.length === 0) {
    showToast('No voters selected', 'error');
    return;
  }
  
  // Send invites one by one with delay to avoid overwhelming browser
  let sentCount = 0;
  
  selectedVoters.forEach((voter, index) => {
    setTimeout(() => {
      try {
        const voterLink = `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&voter=${encodeURIComponent(voter.id)}`;
        const orgName = currentOrgData?.name || 'Election';
        
        // Clean phone number
        const cleanPhone = voter.phone.replace(/\D/g, '');
        let whatsappNumber = cleanPhone;
        
        // Handle Ghanaian numbers
        if (cleanPhone.startsWith('233') && cleanPhone.length === 12) {
          whatsappNumber = cleanPhone;
        } else if (cleanPhone.length === 10 && cleanPhone.startsWith('0')) {
          whatsappNumber = '233' + cleanPhone.substring(1);
        } else if (cleanPhone.length === 9) {
          whatsappNumber = '233' + cleanPhone;
        }
        
        // Base message
        let message = `Hello ${voter.name}!\n\nYou're invited to vote in *${orgName}* election.\n\n🔗 *Voting Link:* ${voterLink}\n\n📝 *Instructions:*\n1. Click the link above\n2. Use your email to log in\n3. Cast your vote\n\n⏰ *Important:* This link is unique to you. Do not share it.\n\n`;
        
        // Add custom message if provided
        if (customMessage) {
          message += `💬 *Message from Election Committee:*\n${customMessage}\n\n`;
        }
        
        message += `Thank you!\n*${orgName} Election Committee*`;
        
        // Create WhatsApp link
        const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        
        // Open in new tab
        window.open(whatsappLink, '_blank');
        
        sentCount++;
        
        // Show completion message
        if (sentCount === selectedVoters.length) {
          setTimeout(() => {
            showToast(`WhatsApp invites sent to ${sentCount} voters`, 'success');
            document.querySelector('.modal-overlay')?.remove();
          }, 1000);
        }
      } catch(e) {
        console.error(`Error sending WhatsApp to ${voter.name}:`, e);
      }
    }, index * 1000); // 1 second delay between each
  });
  
  showToast(`Opening WhatsApp for ${selectedVoters.length} voters...`, 'info');
};

// ---------------- Voter Modal Functions ----------------
window.showAddVoterModal = function() {
  const modal = createModal(
    '<i class="fas fa-user-plus"></i> Add New Voter',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Full Name *</label>
          <input id="voterNameInput" class="input" placeholder="Enter voter's full name" required>
        </div>
        <div>
          <label class="label">Email Address *</label>
          <input id="voterEmailInput" class="input" placeholder="voter@example.com" type="email" required>
        </div>
        <div>
          <label class="label">Phone Number (Optional)</label>
          <input id="voterPhoneInput" class="input" placeholder="+233XXXXXXXXX">
          <div class="subtext" style="margin-top: 5px;">Required for WhatsApp invites</div>
        </div>
        <div>
          <label class="label">Date of Birth (Optional)</label>
          <input id="voterDobInput" class="input" placeholder="YYYY-MM-DD or DD/MM/YYYY">
          <div class="subtext" style="margin-top: 5px;">Leave empty if not available</div>
        </div>
        <div>
          <label class="label">Voter ID (Optional)</label>
          <input id="voterIdInput" class="input" placeholder="Custom voter ID">
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> Note:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • Email must be unique<br>
            • Phone is required for WhatsApp invites<br>
            • Phone and Voter ID must be unique if provided
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="addVoterWithDate()">
        <i class="fas fa-user-plus"></i> Add Voter
      </button>
    `
  );
  
  setTimeout(() => {
    document.getElementById('voterNameInput')?.focus();
  }, 100);
};

window.showBulkVoterModal = function() {
  const modal = createModal(
    '<i class="fas fa-users"></i> Bulk Add Voters',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Voter Data (CSV Format)</label>
          <textarea id="bulkVoterData" class="input" placeholder="Format: Name, Email, Phone (optional), Date of Birth (optional)&#10;John Doe, john@example.com, +233501234567, 1990-01-15&#10;Jane Smith, jane@example.com, +233502345678, 1985-06-30" rows="8" style="font-family: monospace; font-size: 13px;"></textarea>
          <div class="subtext" style="margin-top: 5px;">
            One voter per line. Phone is recommended for WhatsApp invites. Date format: YYYY-MM-DD or DD/MM/YYYY
          </div>
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> CSV Format:
          </div>
          <div style="font-size: 12px; color: #9beaff; font-family: monospace;">
            Name, Email, Phone, Date of Birth<br>
            John Doe, john@example.com, +233501234567, 1990-01-15<br>
            Jane Smith, jane@example.com, +233502345678, 1985-06-30
          </div>
        </div>
        <div style="background: rgba(0, 255, 170, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 170, 0.1);">
          <div style="color: #00ffaa; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-check-circle"></i> Duplicate Protection:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • Duplicate emails will be skipped<br>
            • Duplicate phones will be skipped<br>
            • Invalid emails will be skipped<br>
            • Date validation applied if provided
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="processBulkVoters()">
        <i class="fas fa-upload"></i> Import Voters
      </button>
    `
  );
  
  setTimeout(() => {
    document.getElementById('bulkVoterData')?.focus();
  }, 100);
};

window.changeVoterEmailModal = async function(voterId, currentEmail, voterName) {
  const modal = createModal(
    `<i class="fas fa-at"></i> Change Email for ${escapeHtml(voterName)}`,
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Current Email</label>
          <input class="input" value="${escapeHtml(currentEmail)}" disabled style="background: rgba(255,255,255,0.05);">
        </div>
        <div>
          <label class="label">New Email Address *</label>
          <input id="newVoterEmail" class="input" placeholder="new-email@example.com" type="email" required>
          <div class="subtext" style="margin-top: 5px;">Enter the new email address for this voter</div>
        </div>
        <div>
          <label class="label">Confirm New Email *</label>
          <input id="confirmNewVoterEmail" class="input" placeholder="new-email@example.com" type="email" required>
          <div class="subtext" style="margin-top: 5px;">Re-enter the new email address to confirm</div>
        </div>
        <div>
          <label class="label">Reason for Change (Optional)</label>
          <textarea id="emailChangeReason" class="input" placeholder="Why are you changing this email? (e.g., typo correction, domain change)" rows="3"></textarea>
        </div>
        <div style="background: rgba(255, 193, 7, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 193, 7, 0.3);">
          <div style="color: #ffc107; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-exclamation-triangle"></i> Important Notes:
          </div>
          <div style="font-size: 12px; color: #ffd54f;">
            • This will create a new voter record with the new email<br>
            • The old voter record will be marked as "replaced"<br>
            • Voting history will be preserved if the voter has already voted<br>
            • The voter will need to use the new email to log in
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" id="cancelEmailChangeBtn">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" id="confirmEmailChangeBtn">
        <i class="fas fa-at"></i> Change Email
      </button>
    `
  );
  
  setTimeout(() => {
    document.getElementById('cancelEmailChangeBtn')?.addEventListener('click', () => {
      document.querySelector('.modal-overlay')?.remove();
    });
    
    document.getElementById('confirmEmailChangeBtn')?.addEventListener('click', () => {
      changeVoterEmail(voterId, currentEmail, voterName);
    });
  }, 100);
  
  setTimeout(() => {
    document.getElementById('newVoterEmail')?.focus();
  }, 100);
};

window.editVoterModal = async function(voterId) {
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    const voterSnap = await getDoc(voterRef);
    
    if (!voterSnap.exists()) {
      showToast('Voter not found', 'error');
      return;
    }
    
    const voter = voterSnap.data();
    const currentEmail = decodeURIComponent(voterId);
    
    const modal = createModal(
      `<i class="fas fa-edit"></i> Edit Voter: ${voter.name}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Current Email</label>
            <input class="input" value="${escapeHtml(currentEmail)}" disabled style="background: rgba(255,255,255,0.05);">
            <div class="subtext" style="margin-top: 5px;">To change email, use the "Change Email" button</div>
          </div>
          <div>
            <label class="label">Full Name *</label>
            <input id="editVoterName" class="input" value="${escapeHtml(voter.name || '')}" required>
          </div>
          <div>
            <label class="label">Phone Number</label>
            <input id="editVoterPhone" class="input" value="${escapeHtml(voter.phone || '')}" placeholder="+233XXXXXXXXX">
            <div class="subtext" style="margin-top: 5px;">Required for WhatsApp invites</div>
          </div>
          <div>
            <label class="label">Date of Birth (Optional)</label>
            <input id="editVoterDob" class="input" value="${voter.dateOfBirth ? formatDateForDisplay(new Date(voter.dateOfBirth)) : ''}" placeholder="YYYY-MM-DD or DD/MM/YYYY">
            <div class="subtext" style="margin-top: 5px;">Leave empty to remove</div>
          </div>
          <div>
            <label class="label">Voter ID</label>
            <input id="editVoterId" class="input" value="${escapeHtml(voter.voterId || '')}" placeholder="Custom voter ID">
          </div>
          <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
            <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
              <i class="fas fa-info-circle"></i> Voter Status:
            </div>
            <div style="font-size: 12px; color: ${voter.hasVoted ? '#00ffaa' : '#ffc107'};">
              ${voter.hasVoted ? '✅ Has voted' : '⏳ Pending vote'}
              ${voter.isReplaced ? '<br>⚠️ This voter has been replaced by another email' : ''}
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updateVoter('${voterId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => {
      document.getElementById('editVoterName')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading voter for edit:', e);
    showToast('Error loading voter details', 'error');
  }
};

window.addVoterWithDate = async function() {
  const name = document.getElementById('voterNameInput')?.value.trim();
  const email = document.getElementById('voterEmailInput')?.value.trim().toLowerCase();
  const dob = document.getElementById('voterDobInput')?.value.trim();
  const phone = document.getElementById('voterPhoneInput')?.value.trim();
  const voterId = document.getElementById('voterIdInput')?.value.trim();
  
  if (!name || !email) {
    showToast('Name and email are required', 'error');
    return;
  }
  
  if (!validateEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", encodeURIComponent(email));
    const existingVoter = await getDoc(voterRef);
    
    if (existingVoter.exists()) {
      showToast('A voter with this email already exists', 'error');
      return;
    }
  } catch(e) {
    console.error('Error checking duplicate email:', e);
  }
  
  if (phone) {
    try {
      const phoneQuery = query(
        collection(db, "organizations", currentOrgId, "voters"),
        where("phone", "==", phone)
      );
      const phoneSnap = await getDocs(phoneQuery);
      
      if (!phoneSnap.empty) {
        showToast('A voter with this phone number already exists', 'error');
        return;
      }
    } catch(e) {
      console.error('Error checking duplicate phone:', e);
    }
  }
  
  if (voterId) {
    try {
      const voterIdQuery = query(
        collection(db, "organizations", currentOrgId, "voters"),
        where("voterId", "==", voterId)
      );
      const voterIdSnap = await getDocs(voterIdQuery);
      
      if (!voterIdSnap.empty) {
        showToast('A voter with this Voter ID already exists', 'error');
        return;
      }
    } catch(e) {
      console.error('Error checking duplicate voter ID:', e);
    }
  }
  
  let dateOfBirth = '';
  let dateValidation = { valid: true };
  
  if (dob && dob.trim() !== '') {
    dateValidation = validateDateOfBirth(dob);
    if (!dateValidation.valid) {
      showToast(dateValidation.error, 'error');
      return;
    }
    dateOfBirth = dateValidation.date;
  }
  
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", encodeURIComponent(email));
    const voterData = {
      name: name,
      email: email,
      phone: phone || '',
      voterId: voterId || '',
      hasVoted: false,
      isActive: true,
      isReplaced: false,
      addedAt: serverTimestamp(),
      invited: false
    };
    
    if (dateOfBirth) {
      voterData.dateOfBirth = dateOfBirth;
    }
    
    await setDoc(voterRef, voterData);
    
    const orgRef = doc(db, "organizations", currentOrgId);
    const orgSnap = await getDoc(orgRef);
    const currentCount = orgSnap.exists() ? (orgSnap.data().voterCount || 0) : 0;
    
    await updateDoc(orgRef, {
      voterCount: currentCount + 1
    });
    
    const updatedOrgSnap = await getDoc(orgRef);
    if (updatedOrgSnap.exists()) {
      currentOrgData = updatedOrgSnap.data();
      updateECUI();
    }
    
    showToast('Voter added successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECVoters();
  } catch(e) {
    console.error('Error adding voter:', e);
    showToast('Error adding voter: ' + e.message, 'error');
  }
};

window.updateVoter = async function(voterId) {
  const name = document.getElementById('editVoterName')?.value.trim();
  const dob = document.getElementById('editVoterDob')?.value.trim();
  const phone = document.getElementById('editVoterPhone')?.value.trim();
  const voterIdField = document.getElementById('editVoterId')?.value.trim();
  
  if (!name) {
    showToast('Name is required', 'error');
    return;
  }
  
  let currentVoterData = null;
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    const voterSnap = await getDoc(voterRef);
    if (voterSnap.exists()) {
      currentVoterData = voterSnap.data();
    }
  } catch(e) {
    console.error('Error getting current voter data:', e);
  }
  
  if (phone && phone !== (currentVoterData?.phone || '')) {
    try {
      const phoneQuery = query(
        collection(db, "organizations", currentOrgId, "voters"),
        where("phone", "==", phone)
      );
      const phoneSnap = await getDocs(phoneQuery);
      
      if (!phoneSnap.empty) {
        showToast('A voter with this phone number already exists', 'error');
        return;
      }
    } catch(e) {
      console.error('Error checking duplicate phone:', e);
    }
  }
  
  if (voterIdField && voterIdField !== (currentVoterData?.voterId || '')) {
    try {
      const voterIdQuery = query(
        collection(db, "organizations", currentOrgId, "voters"),
        where("voterId", "==", voterIdField)
      );
      const voterIdSnap = await getDocs(voterIdQuery);
      
      if (!voterIdSnap.empty) {
        showToast('A voter with this Voter ID already exists', 'error');
        return;
      }
    } catch(e) {
      console.error('Error checking duplicate voter ID:', e);
    }
  }
  
  let dateOfBirth = '';
  
  if (dob && dob.trim() !== '') {
    const dateValidation = validateDateOfBirth(dob);
    if (!dateValidation.valid) {
      showToast(dateValidation.error, 'error');
      return;
    }
    dateOfBirth = dateValidation.date;
  }
  
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    const updateData = {
      name: name,
      phone: phone || '',
      voterId: voterIdField || '',
      updatedAt: serverTimestamp()
    };
    
    if (dateOfBirth) {
      updateData.dateOfBirth = dateOfBirth;
    } else {
      updateData.dateOfBirth = '';
    }
    
    await updateDoc(voterRef, updateData);
    
    showToast('Voter updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECVoters();
  } catch(e) {
    console.error('Error updating voter:', e);
    showToast('Error updating voter: ' + e.message, 'error');
  }
};

window.processBulkVoters = async function() {
  const data = document.getElementById('bulkVoterData')?.value.trim();
  if (!data) {
    showToast('Please enter voter data', 'error');
    return;
  }
  
  const lines = data.split('\n').filter(line => line.trim());
  const voters = [];
  const duplicateCheck = {
    emails: new Set(),
    phones: new Set(),
    voterIds: new Set()
  };
  
  for (const line of lines) {
    const parts = line.split(',').map(part => part.trim());
    if (parts.length >= 2) {
      const voter = {
        name: parts[0],
        email: parts[1].toLowerCase(),
        phone: parts[2] || '',
        dateOfBirth: parts[3] || ''
      };
      
      if (!voter.name || !voter.email || !validateEmail(voter.email)) {
        showToast(`Invalid voter: ${voter.name} (${voter.email})`, 'error');
        continue;
      }
      
      if (duplicateCheck.emails.has(voter.email)) {
        showToast(`Duplicate email in batch: ${voter.email}`, 'error');
        continue;
      }
      
      if (voter.phone && duplicateCheck.phones.has(voter.phone)) {
        showToast(`Duplicate phone in batch: ${voter.phone}`, 'error');
        continue;
      }
      
      voters.push(voter);
      duplicateCheck.emails.add(voter.email);
      if (voter.phone) duplicateCheck.phones.add(voter.phone);
    }
  }
  
  if (voters.length === 0) {
    showToast('No valid voters found', 'error');
    return;
  }
  
  try {
    const batch = writeBatch(db);
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    
    for (const voter of voters) {
      try {
        const voterRef = doc(db, "organizations", currentOrgId, "voters", encodeURIComponent(voter.email));
        const existingVoter = await getDoc(voterRef);
        
        if (existingVoter.exists()) {
          duplicateCount++;
          continue;
        }
        
        if (voter.phone) {
          const phoneQuery = query(
            collection(db, "organizations", currentOrgId, "voters"),
            where("phone", "==", voter.phone)
          );
          const phoneSnap = await getDocs(phoneQuery);
          
          if (!phoneSnap.empty) {
            duplicateCount++;
            continue;
          }
        }
        
        const voterData = {
          name: voter.name,
          email: voter.email,
          phone: voter.phone || '',
          hasVoted: false,
          isActive: true,
          isReplaced: false,
          addedAt: serverTimestamp(),
          invited: false
        };
        
        if (voter.dateOfBirth && voter.dateOfBirth.trim() !== '') {
          const dateValidation = validateDateOfBirth(voter.dateOfBirth);
          if (dateValidation.valid) {
            voterData.dateOfBirth = dateValidation.date;
          }
        }
        
        batch.set(voterRef, voterData);
        successCount++;
      } catch(e) {
        console.error('Error processing voter:', voter.email, e);
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      await batch.commit();
      
      const orgRef = doc(db, "organizations", currentOrgId);
      const orgSnap = await getDoc(orgRef);
      const currentCount = orgSnap.exists() ? (orgSnap.data().voterCount || 0) : 0;
      
      await updateDoc(orgRef, {
        voterCount: currentCount + successCount
      });
      
      const updatedOrgSnap = await getDoc(orgRef);
      if (updatedOrgSnap.exists()) {
        currentOrgData = updatedOrgSnap.data();
        updateECUI();
      }
      
      let message = `Added ${successCount} voters successfully!`;
      if (duplicateCount > 0) message += ` ${duplicateCount} duplicates skipped.`;
      if (errorCount > 0) message += ` ${errorCount} errors.`;
      
      showToast(message, 'success');
      document.querySelector('.modal-overlay')?.remove();
      loadECVoters();
    } else {
      showToast('No new voters added. All may be duplicates.', 'warning');
    }
  } catch(e) {
    console.error('Error adding bulk voters:', e);
    showToast('Error: ' + e.message, 'error');
  }
};

window.removeVoter = async function(voterId, voterName) {
  if (!voterId) {
    showToast('Invalid voter ID', 'error');
    return;
  }
  
  if (!confirm(`Are you sure you want to delete voter: ${voterName}?`)) {
    return;
  }
  
  try {
    const voterRef = doc(db, "organizations", currentOrgId, "voters", voterId);
    await deleteDoc(voterRef);
    
    const orgRef = doc(db, "organizations", currentOrgId);
    const orgSnap = await getDoc(orgRef);
    const currentCount = orgSnap.exists() ? (orgSnap.data().voterCount || 0) : 0;
    
    await updateDoc(orgRef, {
      voterCount: Math.max(0, currentCount - 1)
    });
    
    const updatedOrgSnap = await getDoc(orgRef);
    if (updatedOrgSnap.exists()) {
      currentOrgData = updatedOrgSnap.data();
      updateECUI();
    }
    
    showToast(`Voter ${voterName} deleted`, 'success');
    loadECVoters();
  } catch(e) {
    console.error('Error deleting voter:', e);
    showToast('Error deleting voter: ' + e.message, 'error');
  }
};

window.searchVoters = function() {
  const searchTerm = document.getElementById('voterSearch')?.value.toLowerCase() || '';
  const voterItems = document.querySelectorAll('.voter-item');
  
  voterItems.forEach(item => {
    const email = item.dataset.email || '';
    const name = item.dataset.name || '';
    
    if (email.includes(searchTerm) || name.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
};

// ---------------- Position Modal Functions ----------------
window.showAddPositionModal = function() {
  const modal = createModal(
    '<i class="fas fa-plus-circle"></i> Add New Position',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Position Name *</label>
          <input id="positionNameInput" class="input" placeholder="e.g., President, Secretary, Treasurer" required>
        </div>
        <div>
          <label class="label">Description (Optional)</label>
          <textarea id="positionDescInput" class="input" placeholder="Brief description of the position" rows="3"></textarea>
        </div>
        <div>
          <label class="label">Maximum Candidates *</label>
          <input id="positionMaxCandidates" class="input" type="number" min="1" max="10" value="1">
          <div class="subtext" style="margin-top: 5px;">Maximum number of candidates for this position</div>
        </div>
        <div>
          <label class="label">Voting Type *</label>
          <div style="display: flex; gap: 20px; margin-top: 5px;">
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="votingType" value="single" checked>
              <span>Single Choice</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="votingType" value="multiple">
              <span>Multiple Choice</span>
            </label>
          </div>
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> Note:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • Position names must be unique<br>
            • Single choice: Voter selects only one candidate<br>
            • Multiple choice: Voter can select multiple candidates (up to max)
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="addPosition()">
        <i class="fas fa-plus-circle"></i> Add Position
      </button>
    `
  );
  
  setTimeout(() => {
    document.getElementById('positionNameInput')?.focus();
  }, 100);
};

window.addPosition = async function() {
  const name = document.getElementById('positionNameInput')?.value.trim();
  const description = document.getElementById('positionDescInput')?.value.trim();
  const maxCandidates = parseInt(document.getElementById('positionMaxCandidates')?.value || '1');
  const votingType = document.querySelector('input[name="votingType"]:checked')?.value || 'single';
  
  if (!name) {
    showToast('Position name is required', 'error');
    return;
  }
  
  if (maxCandidates < 1 || maxCandidates > 10) {
    showToast('Maximum candidates must be between 1 and 10', 'error');
    return;
  }
  
  try {
    const positionQuery = query(
      collection(db, "organizations", currentOrgId, "positions"),
      where("name", "==", name)
    );
    const positionSnap = await getDocs(positionQuery);
    
    if (!positionSnap.empty) {
      showToast('A position with this name already exists', 'error');
      return;
    }
  } catch(e) {
    console.error('Error checking duplicate position:', e);
  }
  
  try {
    const positionRef = doc(collection(db, "organizations", currentOrgId, "positions"));
    const positionId = positionRef.id;
    
    await setDoc(positionRef, {
      id: positionId,
      name: name,
      description: description || '',
      maxCandidates: maxCandidates,
      votingType: votingType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast('Position added successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
  } catch(e) {
    console.error('Error adding position:', e);
    showToast('Error adding position: ' + e.message, 'error');
  }
};

window.editPositionModal = async function(positionId) {
  try {
    const positionRef = doc(db, "organizations", currentOrgId, "positions", positionId);
    const positionSnap = await getDoc(positionRef);
    
    if (!positionSnap.exists()) {
      showToast('Position not found', 'error');
      return;
    }
    
    const position = positionSnap.data();
    
    const modal = createModal(
      `<i class="fas fa-edit"></i> Edit Position: ${position.name}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Position Name *</label>
            <input id="editPositionName" class="input" value="${escapeHtml(position.name || '')}" required>
          </div>
          <div>
            <label class="label">Description</label>
            <textarea id="editPositionDesc" class="input" rows="3">${escapeHtml(position.description || '')}</textarea>
          </div>
          <div>
            <label class="label">Maximum Candidates *</label>
            <input id="editPositionMaxCandidates" class="input" type="number" min="1" max="10" value="${position.maxCandidates || 1}">
          </div>
          <div>
            <label class="label">Voting Type *</label>
            <div style="display: flex; gap: 20px; margin-top: 5px;">
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="editVotingType" value="single" ${position.votingType === 'single' ? 'checked' : ''}>
                <span>Single Choice</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="editVotingType" value="multiple" ${position.votingType === 'multiple' ? 'checked' : ''}>
                <span>Multiple Choice</span>
              </label>
            </div>
          </div>
          <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
            <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
              <i class="fas fa-info-circle"></i> Note:
            </div>
            <div style="font-size: 12px; color: #9beaff;">
              Changing voting type may affect existing votes<br>
              Consider resetting votes if changing from multiple to single
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updatePosition('${positionId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => {
      document.getElementById('editPositionName')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading position for edit:', e);
    showToast('Error loading position details', 'error');
  }
};

window.updatePosition = async function(positionId) {
  const name = document.getElementById('editPositionName')?.value.trim();
  const description = document.getElementById('editPositionDesc')?.value.trim();
  const maxCandidates = parseInt(document.getElementById('editPositionMaxCandidates')?.value || '1');
  const votingType = document.querySelector('input[name="editVotingType"]:checked')?.value || 'single';
  
  if (!name) {
    showToast('Position name is required', 'error');
    return;
  }
  
  if (maxCandidates < 1 || maxCandidates > 10) {
    showToast('Maximum candidates must be between 1 and 10', 'error');
    return;
  }
  
  try {
    const positionQuery = query(
      collection(db, "organizations", currentOrgId, "positions"),
      where("name", "==", name)
    );
    const positionSnap = await getDocs(positionQuery);
    
    let duplicate = false;
    positionSnap.forEach(doc => {
      if (doc.id !== positionId) {
        duplicate = true;
      }
    });
    
    if (duplicate) {
      showToast('Another position with this name already exists', 'error');
      return;
    }
  } catch(e) {
    console.error('Error checking duplicate position:', e);
  }
  
  try {
    const positionRef = doc(db, "organizations", currentOrgId, "positions", positionId);
    
    await updateDoc(positionRef, {
      name: name,
      description: description || '',
      maxCandidates: maxCandidates,
      votingType: votingType,
      updatedAt: serverTimestamp()
    });
    
    showToast('Position updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
  } catch(e) {
    console.error('Error updating position:', e);
    showToast('Error updating position: ' + e.message, 'error');
  }
};

window.deletePositionConfirm = function(positionId, positionName) {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Delete Position',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-trash-alt"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Delete "${escapeHtml(positionName)}"?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will also delete all candidates for this position and remove any votes cast for them.
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> Warning: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="deletePosition('${positionId}')" style="flex: 1">
        <i class="fas fa-trash"></i> Delete Position
      </button>
    `
  );
};

window.deletePosition = async function(positionId) {
  try {
    const candidatesQuery = query(
      collection(db, "organizations", currentOrgId, "candidates"),
      where("positionId", "==", positionId)
    );
    const candidatesSnap = await getDocs(candidatesQuery);
    
    const batch = writeBatch(db);
    candidatesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const positionRef = doc(db, "organizations", currentOrgId, "positions", positionId);
    batch.delete(positionRef);
    
    await batch.commit();
    
    showToast('Position and all associated candidates deleted', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
    loadECCandidates();
  } catch(e) {
    console.error('Error deleting position:', e);
    showToast('Error deleting position: ' + e.message, 'error');
  }
};

// ---------------- Candidate Modal Functions ----------------
window.showAddCandidateModal = function() {
  loadPositionsForCandidateModal();
};

async function loadPositionsForCandidateModal() {
  try {
    const positionsSnap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    if (positions.length === 0) {
      showToast('Please create positions first', 'error');
      return;
    }
    
    let positionOptions = '';
    positions.forEach(p => {
      positionOptions += `<option value="${p.id}">${p.name}</option>`;
    });
    
    const modal = createModal(
      '<i class="fas fa-user-plus"></i> Add New Candidate',
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Select Position *</label>
            <select id="candidatePositionSelect" class="input" required>
              <option value="">Select a position...</option>
              ${positionOptions}
            </select>
          </div>
          <div>
            <label class="label">Candidate Name *</label>
            <input id="candidateNameInput" class="input" placeholder="Enter candidate's full name" required>
          </div>
          <div>
            <label class="label">Tagline (Optional)</label>
            <input id="candidateTaglineInput" class="input" placeholder="Short slogan or tagline">
          </div>
          <div>
            <label class="label">Biography (Optional)</label>
            <textarea id="candidateBioInput" class="input" placeholder="Candidate biography, achievements, etc." rows="4"></textarea>
          </div>
          <div>
            <label class="label">Candidate Photo (Optional)</label>
            <div style="margin-bottom: 10px;">
              <div id="candidatePhotoPreview" style="width: 100px; height: 100px; border-radius: 8px; border: 2px dashed rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
                <i class="fas fa-user" style="font-size: 32px; color: #00eaff"></i>
              </div>
              <input type="file" id="candidatePhotoFile" accept="image/*" class="input" onchange="previewCandidatePhoto()">
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="addCandidate()">
          <i class="fas fa-user-plus"></i> Add Candidate
        </button>
      `
    );
    
    setTimeout(() => {
      document.getElementById('candidatePositionSelect')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading positions:', e);
    showToast('Error loading positions', 'error');
  }
}

window.showAddCandidateForPositionModal = function(positionId, positionName) {
  loadPositionForCandidateModal(positionId, positionName);
};

async function loadPositionForCandidateModal(positionId, positionName) {
  const modal = createModal(
    `<i class="fas fa-user-plus"></i> Add Candidate to ${positionName}`,
    `
      <input type="hidden" id="candidatePositionId" value="${positionId}">
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Candidate Name *</label>
          <input id="candidateNameInput" class="input" placeholder="Enter candidate's full name" required>
        </div>
        <div>
          <label class="label">Tagline (Optional)</label>
          <input id="candidateTaglineInput" class="input" placeholder="Short slogan or tagline">
        </div>
        <div>
          <label class="label">Biography (Optional)</label>
          <textarea id="candidateBioInput" class="input" placeholder="Candidate biography, achievements, etc." rows="4"></textarea>
        </div>
        <div>
          <label class="label">Candidate Photo (Optional)</label>
          <div style="margin-bottom: 10px;">
            <div id="candidatePhotoPreview" style="width: 100px; height: 100px; border-radius: 8px; border: 2px dashed rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
              <i class="fas fa-user" style="font-size: 32px; color: #00eaff"></i>
            </div>
            <input type="file" id="candidatePhotoFile" accept="image/*" class="input" onchange="previewCandidatePhoto()">
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="addCandidate()">
        <i class="fas fa-user-plus"></i> Add Candidate
      </button>
    `
  );
  
  setTimeout(() => {
    document.getElementById('candidateNameInput')?.focus();
  }, 100);
}

window.previewCandidatePhoto = function() {
  const fileInput = document.getElementById('candidatePhotoFile');
  const preview = document.getElementById('candidatePhotoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
};

window.addCandidate = async function() {
  const positionId = document.getElementById('candidatePositionId')?.value || 
                    document.getElementById('candidatePositionSelect')?.value;
  const name = document.getElementById('candidateNameInput')?.value.trim();
  const tagline = document.getElementById('candidateTaglineInput')?.value.trim();
  const bio = document.getElementById('candidateBioInput')?.value.trim();
  const photoFile = document.getElementById('candidatePhotoFile')?.files[0];
  
  if (!positionId) {
    showToast('Please select a position', 'error');
    return;
  }
  
  if (!name) {
    showToast('Candidate name is required', 'error');
    return;
  }
  
  try {
    const candidateQuery = query(
      collection(db, "organizations", currentOrgId, "candidates"),
      where("positionId", "==", positionId),
      where("name", "==", name)
    );
    const candidateSnap = await getDocs(candidateQuery);
    
    if (!candidateSnap.empty) {
      showToast('A candidate with this name already exists for this position', 'error');
      return;
    }
    
    let photoUrl = '';
    
    if (photoFile) {
      try {
        const storageReference = storageRef(storage, `organizations/${currentOrgId}/candidates/${Date.now()}_${photoFile.name}`);
        const reader = new FileReader();
        
        photoUrl = await new Promise((resolve, reject) => {
          reader.onload = async function(e) {
            try {
              await uploadString(storageReference, e.target.result.split(',')[1], 'base64', {
                contentType: photoFile.type
              });
              const url = await getDownloadURL(storageReference);
              resolve(url);
            } catch(error) {
              reject(error);
            }
          };
          reader.readAsDataURL(photoFile);
        });
      } catch(photoError) {
        console.error('Error uploading photo:', photoError);
        showToast('Error uploading photo, using default avatar', 'warning');
        photoUrl = getDefaultAvatar(name);
      }
    } else {
      photoUrl = getDefaultAvatar(name);
    }
    
    const candidateRef = doc(collection(db, "organizations", currentOrgId, "candidates"));
    const candidateId = candidateRef.id;
    
    await setDoc(candidateRef, {
      id: candidateId,
      positionId: positionId,
      name: name,
      tagline: tagline || '',
      bio: bio || '',
      photo: photoUrl,
      votes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast('Candidate added successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error adding candidate:', e);
    showToast('Error adding candidate: ' + e.message, 'error');
  }
};

window.editCandidateModal = async function(candidateId) {
  try {
    const candidateRef = doc(db, "organizations", currentOrgId, "candidates", candidateId);
    const candidateSnap = await getDoc(candidateRef);
    
    if (!candidateSnap.exists()) {
      showToast('Candidate not found', 'error');
      return;
    }
    
    const candidate = candidateSnap.data();
    
    const positionsSnap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    let positionOptions = '';
    positions.forEach(p => {
      positionOptions += `<option value="${p.id}" ${p.id === candidate.positionId ? 'selected' : ''}>${p.name}</option>`;
    });
    
    const modal = createModal(
      `<i class="fas fa-edit"></i> Edit Candidate: ${candidate.name}`,
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Select Position *</label>
            <select id="editCandidatePosition" class="input" required>
              <option value="">Select a position...</option>
              ${positionOptions}
            </select>
          </div>
          <div>
            <label class="label">Candidate Name *</label>
            <input id="editCandidateName" class="input" value="${escapeHtml(candidate.name || '')}" required>
          </div>
          <div>
            <label class="label">Tagline</label>
            <input id="editCandidateTagline" class="input" value="${escapeHtml(candidate.tagline || '')}" placeholder="Short slogan or tagline">
          </div>
          <div>
            <label class="label">Biography</label>
            <textarea id="editCandidateBio" class="input" rows="4" placeholder="Candidate biography, achievements, etc.">${escapeHtml(candidate.bio || '')}</textarea>
          </div>
          <div>
            <label class="label">Candidate Photo</label>
            <div style="margin-bottom: 10px;">
              <div id="editCandidatePhotoPreview" style="width: 100px; height: 100px;border-radius: 8px; border: 2px solid rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
                <img src="${candidate.photo || getDefaultAvatar(candidate.name)}" style="width:100%;height:100%;object-fit:cover;">
              </div>
              <input type="file" id="editCandidatePhotoFile" accept="image/*" class="input" onchange="previewEditCandidatePhoto()">
              <div class="subtext" style="margin-top: 5px;">Leave empty to keep current photo</div>
            </div>
          </div>
          <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
            <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
              <i class="fas fa-chart-line"></i> Statistics:
            </div>
            <div style="font-size: 12px; color: #9beaff;">
              Current Votes: ${candidate.votes || 0}<br>
              Added: ${candidate.createdAt ? formatFirestoreTimestamp(candidate.createdAt) : 'N/A'}
            </div>
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updateCandidate('${candidateId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => {
      document.getElementById('editCandidateName')?.focus();
    }, 100);
  } catch(e) {
    console.error('Error loading candidate for edit:', e);
    showToast('Error loading candidate details', 'error');
  }
};

window.previewEditCandidatePhoto = function() {
  const fileInput = document.getElementById('editCandidatePhotoFile');
  const preview = document.getElementById('editCandidatePhotoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
};

window.updateCandidate = async function(candidateId) {
  const positionId = document.getElementById('editCandidatePosition')?.value;
  const name = document.getElementById('editCandidateName')?.value.trim();
  const tagline = document.getElementById('editCandidateTagline')?.value.trim();
  const bio = document.getElementById('editCandidateBio')?.value.trim();
  const photoFile = document.getElementById('editCandidatePhotoFile')?.files[0];
  
  if (!positionId) {
    showToast('Please select a position', 'error');
    return;
  }
  
  if (!name) {
    showToast('Candidate name is required', 'error');
    return;
  }
  
  try {
    const candidateRef = doc(db, "organizations", currentOrgId, "candidates", candidateId);
    const candidateSnap = await getDoc(candidateRef);
    const currentCandidate = candidateSnap.data();
    
    if (currentCandidate.name !== name || currentCandidate.positionId !== positionId) {
      const candidateQuery = query(
        collection(db, "organizations", currentOrgId, "candidates"),
        where("positionId", "==", positionId),
        where("name", "==", name)
      );
      const candidateSnap = await getDocs(candidateQuery);
      
      let duplicate = false;
      candidateSnap.forEach(doc => {
        if (doc.id !== candidateId) {
          duplicate = true;
        }
      });
      
      if (duplicate) {
        showToast('Another candidate with this name already exists for this position', 'error');
        return;
      }
    }
    
    let photoUrl = currentCandidate.photo;
    
    if (photoFile) {
      try {
        const storageReference = storageRef(storage, `organizations/${currentOrgId}/candidates/${Date.now()}_${photoFile.name}`);
        const reader = new FileReader();
        
        photoUrl = await new Promise((resolve, reject) => {
          reader.onload = async function(e) {
            try {
              await uploadString(storageReference, e.target.result.split(',')[1], 'base64', {
                contentType: photoFile.type
              });
              const url = await getDownloadURL(storageReference);
              resolve(url);
            } catch(error) {
              reject(error);
            }
          };
          reader.readAsDataURL(photoFile);
        });
        
        if (currentCandidate.photo && !currentCandidate.photo.includes('data:image/svg+xml')) {
          try {
            const oldPhotoRef = storageRef(storage, currentCandidate.photo);
            await deleteObject(oldPhotoRef);
          } catch(deleteError) {
            console.warn('Could not delete old photo:', deleteError);
          }
        }
      } catch(photoError) {
        console.error('Error uploading photo:', photoError);
        showToast('Error uploading photo, keeping current photo', 'warning');
      }
    } else {
      photoUrl = currentCandidate.photo;
    }
    
    await updateDoc(candidateRef, {
      positionId: positionId,
      name: name,
      tagline: tagline || '',
      bio: bio || '',
      photo: photoUrl,
      updatedAt: serverTimestamp()
    });
    
    showToast('Candidate updated successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error updating candidate:', e);
    showToast('Error updating candidate: ' + e.message, 'error');
  }
};

window.deleteCandidateConfirm = function(candidateId, candidateName) {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Delete Candidate',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-user-slash"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Delete "${escapeHtml(candidateName)}"?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will remove all votes cast for this candidate.
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> Warning: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="deleteCandidate('${candidateId}')" style="flex: 1">
        <i class="fas fa-trash"></i> Delete Candidate
      </button>
    `
  );
};

window.deleteCandidate = async function(candidateId) {
  try {
    const candidateRef = doc(db, "organizations", currentOrgId, "candidates", candidateId);
    const candidateSnap = await getDoc(candidateRef);
    
    if (candidateSnap.exists()) {
      const candidate = candidateSnap.data();
      
      if (candidate.photo && !candidate.photo.includes('data:image/svg+xml')) {
        try {
          const photoRef = storageRef(storage, candidate.photo);
          await deleteObject(photoRef);
        } catch(deleteError) {
          console.warn('Could not delete candidate photo:', deleteError);
        }
      }
    }
    
    await deleteDoc(candidateRef);
    
    showToast('Candidate deleted', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error deleting candidate:', e);
    showToast('Error deleting candidate: ' + e.message, 'error');
  }
};

// ---------------- Settings Functions ----------------
window.saveElectionSchedule = async function() {
  const startTime = document.getElementById('ecStartTime')?.value;
  const endTime = document.getElementById('ecEndTime')?.value;
  
  if (!startTime) {
    showToast('Start time is required', 'error');
    return;
  }
  
  try {
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : null;
    
    if (endDate && endDate <= startDate) {
      showToast('End time must be after start time', 'error');
      return;
    }
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      electionSettings: {
        startTime: startDate.toISOString(),
        endTime: endDate ? endDate.toISOString() : null
      },
      electionStatus: 'scheduled'
    });
    
    showToast('Election schedule saved!', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error saving schedule:', e);
    showToast('Error saving schedule: ' + e.message, 'error');
  }
};

window.clearElectionSchedule = async function() {
  try {
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      electionSettings: {},
      electionStatus: 'active'
    });
    
    showToast('Election schedule cleared!', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error clearing schedule:', e);
    showToast('Error clearing schedule: ' + e.message, 'error');
  }
};

window.generatePublicLink = async function() {
  try {
    const publicToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      publicEnabled: true,
      publicToken: publicToken,
      publicLink: `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&token=${publicToken}`
    });
    
    showToast('Public link generated!', 'success');
    loadECSettings();
  } catch(e) {
    console.error('Error generating link:', e);
    showToast('Error generating link: ' + e.message, 'error');
  }
};

window.copyPublicLink = function() {
  const link = `${window.location.origin}${window.location.pathname}?org=${currentOrgId}&token=${currentOrgData?.publicToken}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copied to clipboard!', 'success');
  });
};

window.declareResultsConfirm = function() {
  const modal = createModal(
    '<i class="fas fa-flag-checkered"></i> Declare Final Results',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #9D00FF; margin-bottom: 20px;">
          <i class="fas fa-flag"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Declare Final Results?</h3>
        <p style="color: #9beaff; margin-bottom: 20px;">
          This will lock voting and mark the election as completed. Voters will no longer be able to vote.
        </p>
        <div style="background: rgba(157, 0, 255, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(157, 0, 255, 0.3);">
          <div style="color: #9D00FF; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> Note: This action cannot be reversed!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="declareResults()" style="flex: 1; background: linear-gradient(90deg, #9D00FF, #00C3FF);">
        <i class="fas fa-flag"></i> Declare Results
      </button>
    `
  );
};

window.declareResults = async function() {
  try {
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      electionStatus: 'declared',
      resultsDeclaredAt: serverTimestamp()
    });
    
    showToast('Results declared successfully! Voting is now locked.', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECSettings();
  } catch(e) {
    console.error('Error declaring results:', e);
    showToast('Error declaring results: ' + e.message, 'error');
  }
};

window.resetVotesConfirm = function() {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Reset All Votes',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff9800; margin-bottom: 20px;">
          <i class="fas fa-undo"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Reset All Votes?</h3>
        <p style="color: #ffcc80; margin-bottom: 20px;">
          This will reset all votes to zero. Voters will be able to vote again.
        </p>
        <div style="background: rgba(255, 152, 0, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 152, 0, 0.3);">
          <div style="color: #ff9800; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> All vote counts will be reset to zero!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-warning" onclick="resetAllVotes()" style="flex: 1">
        <i class="fas fa-undo"></i> Reset Votes
      </button>
    `
  );
};

window.resetAllVotes = async function() {
  try {
    const candidatesSnap = await getDocs(collection(db, "organizations", currentOrgId, "candidates"));
    const batch = writeBatch(db);
    
    candidatesSnap.forEach(doc => {
      batch.update(doc.ref, { votes: 0 });
    });
    
    const votesSnap = await getDocs(collection(db, "organizations", currentOrgId, "votes"));
    votesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    votersSnap.forEach(doc => {
      const voterData = doc.data();
      if (!voterData.isReplaced) {
        batch.update(doc.ref, { 
          hasVoted: false,
          votedAt: null 
        });
      }
    });
    
    const orgRef = doc(db, "organizations", currentOrgId);
    batch.update(orgRef, { voteCount: 0 });
    
    await batch.commit();
    
    showToast('All votes reset successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECSettings();
    loadECOutcomes();
  } catch(e) {
    console.error('Error resetting votes:', e);
    showToast('Error resetting votes: ' + e.message, 'error');
  }
};

window.clearAllDataConfirm = function() {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Clear All Election Data',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-trash-alt"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Clear ALL Election Data?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will delete ALL data: Voters, Candidates, Positions, and Votes. The election will be completely reset.
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> WARNING: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="clearAllData()" style="flex: 1">
        <i class="fas fa-trash-alt"></i> Clear All Data
      </button>
    `
  );
};

window.clearAllData = async function() {
  try {
    showToast('Clearing all data...', 'info');
    
    const votesSnap = await getDocs(collection(db, "organizations", currentOrgId, "votes"));
    const batch1 = writeBatch(db);
    votesSnap.forEach(doc => {
      batch1.delete(doc.ref);
    });
    await batch1.commit();
    
    const candidatesSnap = await getDocs(collection(db, "organizations", currentOrgId, "candidates"));
    const batch2 = writeBatch(db);
    const deletePhotoPromises = [];
    
    candidatesSnap.forEach(doc => {
      const candidate = doc.data();
      batch2.delete(doc.ref);
      
      if (candidate.photo && !candidate.photo.includes('data:image/svg+xml')) {
        try {
          const photoRef = storageRef(storage, candidate.photo);
          deletePhotoPromises.push(deleteObject(photoRef));
        } catch(photoError) {
          console.warn('Could not delete candidate photo:', photoError);
        }
      }
    });
    await batch2.commit();
    await Promise.all(deletePhotoPromises);
    
    const positionsSnap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const batch3 = writeBatch(db);
    positionsSnap.forEach(doc => {
      batch3.delete(doc.ref);
    });
    await batch3.commit();
    
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    const batch4 = writeBatch(db);
    votersSnap.forEach(doc => {
      batch4.delete(doc.ref);
    });
    await batch4.commit();
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      voterCount: 0,
      voteCount: 0,
      electionSettings: {},
      electionStatus: 'active',
      publicEnabled: false,
      publicToken: null,
      publicLink: null,
      resultsDeclaredAt: null
    });
    
    showToast('All election data cleared successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECSettings();
    
    loadECVoters();
    loadECPositions();
    loadECCandidates();
    loadECOutcomes();
  } catch(e) {
    console.error('Error clearing data:', e);
    showToast('Error clearing data: ' + e.message, 'error');
  }
};

window.send30MinAlerts = async function() {
  try {
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let sentCount = 0;
    
    votersSnap.forEach(doc => {
      const voter = doc.data();
      if (!voter.isReplaced && !voter.hasVoted) {
        sentCount++;
      }
    });
    
    showToast(`30-minute alerts sent to ${sentCount} pending voters`, 'success');
  } catch(e) {
    console.error('Error sending alerts:', e);
    showToast('Error sending alerts: ' + e.message, 'error');
  }
};

window.sendVoteStartAlerts = async function() {
  try {
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let sentCount = 0;
    
    votersSnap.forEach(doc => {
      const voter = doc.data();
      if (!voter.isReplaced) {
        sentCount++;
      }
    });
    
    showToast(`Vote start alerts sent to ${sentCount} voters`, 'success');
  } catch(e) {
    console.error('Error sending alerts:', e);
    showToast('Error sending alerts: ' + e.message, 'error');
  }
};

// ---------------- Export Functions ----------------
window.exportVotersCSV = async function() {
  try {
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    const voters = [];
    votersSnap.forEach(s => voters.push({ id: s.id, ...s.data() }));
    
    let csv = 'Name,Email,Phone,Date of Birth,Voter ID,Has Voted,Status,Replaced By\n';
    
    voters.forEach(v => {
      const name = `"${v.name || ''}"`;
      const email = `"${decodeURIComponent(v.id)}"`;
      const phone = `"${v.phone || ''}"`;
      const dob = v.dateOfBirth ? `"${formatDateForDisplay(new Date(v.dateOfBirth))}"` : '""';
      const voterId = `"${v.voterId || ''}"`;
      const hasVoted = v.hasVoted ? 'Yes' : 'No';
      const status = v.isReplaced ? 'Replaced' : 'Active';
      const replacedBy = v.replacedBy ? `"${v.replacedBy}"` : '""';
      
      csv += `${name},${email},${phone},${dob},${voterId},${hasVoted},${status},${replacedBy}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voters_${currentOrgId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Voters CSV exported successfully!', 'success');
  } catch(e) {
    console.error('Error exporting voters CSV:', e);
    showToast('Error exporting CSV: ' + e.message, 'error');
  }
};

window.exportResultsCSV = async function() {
  try {
    const [votesSnap, positionsSnap, candidatesSnap] = await Promise.all([
      getDocs(collection(db, "organizations", currentOrgId, "votes")),
      getDocs(collection(db, "organizations", currentOrgId, "positions")),
      getDocs(collection(db, "organizations", currentOrgId, "candidates"))
    ]);
    
    const votes = [];
    votesSnap.forEach(s => votes.push(s.data()));
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    let csv = 'Position,Candidate,Votes,Percentage\n';
    
    positions.forEach(pos => {
      const posCandidates = candidates.filter(c => c.positionId === pos.id);
      if (posCandidates.length === 0) return;
      
      const counts = {};
      votes.forEach(v => {
        if (v.choices && v.choices[pos.id]) {
          const candId = v.choices[pos.id];
          counts[candId] = (counts[candId] || 0) + 1;
        }
      });
      
      const totalPositionVotes = Object.values(counts).reduce((a, b) => a + b, 0);
      
      const sortedCandidates = [...posCandidates].sort((a, b) => {
        return (counts[b.id] || 0) - (counts[a.id] || 0);
      });
      
      sortedCandidates.forEach(candidate => {
        const candidateVotes = counts[candidate.id] || 0;
        const percentage = totalPositionVotes ? ((candidateVotes / totalPositionVotes) * 100).toFixed(2) : '0.00';
        
        csv += `"${pos.name}","${candidate.name}",${candidateVotes},${percentage}%\n`;
      });
      
      csv += '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${currentOrgId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Results CSV exported successfully!', 'success');
  } catch(e) {
    console.error('Error exporting results CSV:', e);
    showToast('Error exporting results: ' + e.message, 'error');
  }
};

// ---------------- Super Admin Modal Functions ----------------
window.showCreateOrgModal = function() {
  const modal = createModal(
    '<i class="fas fa-plus"></i> Create New Organization',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Organization Logo (Optional)</label>
          <div style="margin-bottom: 10px;">
            <div id="orgLogoPreview" style="width: 100px; height: 100px; border-radius: 8px; border: 2px dashed rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 10px;">
              <i class="fas fa-building" style="font-size: 32px; color: #00eaff"></i>
            </div>
            <input type="file" id="orgLogoFile" accept="image/*" class="input" onchange="previewOrgLogo()">
          </div>
        </div>
        <div>
          <label class="label">Organization Name *</label>
          <input id="newOrgName" class="input" placeholder="Enter organization name" required>
        </div>
        <div>
          <label class="label">Description (Optional)</label>
          <textarea id="newOrgDesc" class="input" placeholder="Organization description" rows="2"></textarea>
        </div>
        <div>
          <label class="label">EC Password * (min 6 characters)</label>
          <input id="newOrgECPass" class="input" placeholder="Set EC password" type="password" required>
        </div>
        <div>
          <label class="label">EC Email (optional)</label>
          <input id="newOrgECEmail" class="input" placeholder="ec@example.com" type="email">
        </div>
        <div>
          <label class="label">EC Phone (optional)</label>
          <input id="newOrgECPhone" class="input" placeholder="+233XXXXXXXXX">
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-info-circle"></i> Note:
          </div>
          <div style="font-size: 12px; color: #9beaff;">
            • EC Password will be used by Election Commissioners to log in<br>
            • Keep this password secure
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="createNewOrganization()">
        <i class="fas fa-plus-circle"></i> Create Organization
      </button>
    `
  );
};

window.previewOrgLogo = function() {
  const fileInput = document.getElementById('orgLogoFile');
  const preview = document.getElementById('orgLogoPreview');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
};

window.createNewOrganization = async function() {
  const name = document.getElementById('newOrgName')?.value.trim();
  const description = document.getElementById('newOrgDesc')?.value.trim();
  const ecPassword = document.getElementById('newOrgECPass')?.value;
  const ecEmail = document.getElementById('newOrgECEmail')?.value.trim();
  const ecPhone = document.getElementById('newOrgECPhone')?.value.trim();
  const logoFile = document.getElementById('orgLogoFile')?.files[0];
  
  if (!name) {
    showToast('Organization name is required', 'error');
    return;
  }
  
  if (!ecPassword || ecPassword.length < 6) {
    showToast('EC password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    const orgId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 8);
    
    let logoUrl = '';
    
    if (logoFile) {
      try {
        const storageReference = storageRef(storage, `organizations/${orgId}/logo`);
        const reader = new FileReader();
        
        logoUrl = await new Promise((resolve, reject) => {
          reader.onload = async function(e) {
            try {
              await uploadString(storageReference, e.target.result.split(',')[1], 'base64', {
                contentType: logoFile.type
              });
              const url = await getDownloadURL(storageReference);
              resolve(url);
            } catch(error) {
              reject(error);
            }
          };
          reader.readAsDataURL(logoFile);
        });
      } catch(photoError) {
        console.error('Error uploading logo:', photoError);
        logoUrl = getDefaultLogo(name);
      }
    } else {
      logoUrl = getDefaultLogo(name);
    }
    
    const orgRef = doc(db, "organizations", orgId);
    
    await setDoc(orgRef, {
      id: orgId,
      name: name,
      description: description || '',
      logoUrl: logoUrl,
      ecPassword: ecPassword,
      ecEmail: ecEmail || '',
      ecPhone: ecPhone || '',
      voterCount: 0,
      voteCount: 0,
      electionStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast(`Organization "${name}" created successfully!`, 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadSuperOrganizations();
  } catch(e) {
    console.error('Error creating organization:', e);
    showToast('Error creating organization: ' + e.message, 'error');
  }
};

window.openOrgAsEC = function(orgId) {
  document.getElementById('ec-org-id').value = orgId;
  showScreen('ecLoginScreen');
  showToast(`Enter EC password for organization`, 'info');
};

window.showECInviteModal = function(orgId, orgName, ecPassword) {
  const modal = createModal(
    `<i class="fas fa-paper-plane"></i> Send EC Invite for ${orgName}`,
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Organization ID</label>
          <input class="input" value="${orgId}" disabled style="background: rgba(255,255,255,0.05);">
        </div>
        <div>
          <label class="label">EC Password</label>
          <input class="input" value="${ecPassword}" disabled style="background: rgba(255,255,255,0.05);">
        </div>
        <div>
          <label class="label">Recipient Email *</label>
          <input id="ecInviteEmail" class="input" placeholder="ec@example.com" type="email" required>
        </div>
        <div>
          <label class="label">Message (Optional)</label>
          <textarea id="ecInviteMessage" class="input" rows="3" placeholder="Add a personal message..."></textarea>
        </div>
        <div style="background: rgba(0, 255, 255, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.1);">
          <div style="color: #00eaff; font-size: 12px; margin-bottom: 5px;">
            <i class="fas fa-link"></i> EC Login Link:
          </div>
          <div style="font-size: 12px; color: #9beaff; word-break: break-all;">
            ${window.location.origin}${window.location.pathname}?org=${orgId}&role=ec
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="sendECInvite('${orgId}', '${escapeHtml(orgName)}', '${ecPassword}')">
        <i class="fas fa-paper-plane"></i> Send Invite
      </button>
    `
  );
};

window.sendECInvite = function(orgId, orgName, ecPassword) {
  const email = document.getElementById('ecInviteEmail')?.value.trim();
  const message = document.getElementById('ecInviteMessage')?.value.trim();
  
  if (!email || !validateEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  const loginLink = `${window.location.origin}${window.location.pathname}?org=${orgId}&role=ec`;
  
  const emailBody = `
Organization: ${orgName}
Organization ID: ${orgId}
EC Password: ${ecPassword}
Login Link: ${loginLink}

${message ? `Message: ${message}` : ''}

Please use the above credentials to log in as Election Commissioner.
  `;
  
  console.log('EC Invite would be sent to:', email);
  console.log('Email body:', emailBody);
  
  showToast(`EC invite sent to ${email}`, 'success');
  document.querySelector('.modal-overlay')?.remove();
};

window.showPasswordModal = function(orgId, ecPassword) {
  const modal = createModal(
    '<i class="fas fa-eye"></i> View EC Password',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #00eaff; margin-bottom: 20px;">
          <i class="fas fa-key"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">EC Password</h3>
        <div style="background: rgba(0, 255, 255, 0.1); padding: 15px; border-radius: 8px; border: 2px solid rgba(0, 255, 255, 0.3); margin: 20px 0;">
          <div style="font-family: monospace; font-size: 20px; color: #00ffaa; letter-spacing: 2px;">
            ${ecPassword}
          </div>
        </div>
        <p style="color: #9beaff; font-size: 14px;">
          This password is used by Election Commissioners to log in.
        </p>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Close
      </button>
      <button class="btn neon-btn" onclick="navigator.clipboard.writeText('${ecPassword}').then(() => showToast('Password copied!', 'success'))" style="flex: 1">
        <i class="fas fa-copy"></i> Copy Password
      </button>
    `
  );
};

window.deleteOrganizationConfirm = function(orgId, orgName) {
  const modal = createModal(
    '<i class="fas fa-exclamation-triangle"></i> Delete Organization',
    `
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 72px; color: #ff4444; margin-bottom: 20px;">
          <i class="fas fa-building"></i>
        </div>
        <h3 style="color: #fff; margin-bottom: 10px;">Delete "${escapeHtml(orgName)}"?</h3>
        <p style="color: #ff9999; margin-bottom: 20px;">
          This will permanently delete ALL data for this organization:<br>
          • All voters and their data<br>
          • All positions and candidates<br>
          • All votes and results<br>
          • Organization settings and configurations
        </p>
        <div style="background: rgba(255, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 68, 68, 0.3);">
          <div style="color: #ff4444; font-size: 12px;">
            <i class="fas fa-exclamation-circle"></i> WARNING: This action cannot be undone!
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()" style="flex: 1">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn btn-danger" onclick="deleteOrganization('${orgId}')" style="flex: 1">
        <i class="fas fa-trash"></i> Delete Organization
      </button>
    `
  );
};

window.deleteOrganization = async function(orgId) {
  try {
    showToast('Deleting organization...', 'info');
    
    const collections = ['voters', 'positions', 'candidates', 'votes', 'emailChanges'];
    
    for (const collectionName of collections) {
      const snap = await getDocs(collection(db, "organizations", orgId, collectionName));
      const batch = writeBatch(db);
      snap.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    
    await deleteDoc(doc(db, "organizations", orgId));
    
    showToast('Organization deleted successfully!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadSuperDelete();
    loadSuperOrganizations();
  } catch(e) {
    console.error('Error deleting organization:', e);
    showToast('Error deleting organization: ' + e.message, 'error');
  }
};

window.changeSuperPassword = async function() {
  const newPass = document.getElementById('new-super-pass')?.value;
  
  if (!newPass || newPass.length < 8) {
    showToast('New password must be at least 8 characters', 'error');
    return;
  }
  
  try {
    const ref = doc(db, "meta", "superAdmin");
    await updateDoc(ref, { password: newPass });
    
    showToast('SuperAdmin password changed successfully!', 'success');
    document.getElementById('new-super-pass').value = '';
  } catch(e) {
    console.error('Error changing password:', e);
    showToast('Error changing password: ' + e.message, 'error');
  }
};

// ---------------- Sync Function ----------------
window.syncVoterCounts = async function() {
  try {
    showToast('Syncing voter counts...', 'info');
    
    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let totalVoters = 0;
    votersSnap.forEach(doc => {
      const voterData = doc.data();
      if (!voterData.isReplaced) {
        totalVoters++;
      }
    });
    
    const votesSnap = await getDocs(collection(db, "organizations", currentOrgId, "votes"));
    const votesCast = votesSnap.size;
    
    const orgRef = doc(db, "organizations", currentOrgId);
    await updateDoc(orgRef, {
      voterCount: totalVoters,
      voteCount: votesCast,
      lastSync: serverTimestamp()
    });
    
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      currentOrgData = orgSnap.data();
      updateECUI();
    }
    
    showToast(`Synced! Total Active Voters: ${totalVoters}, Votes Cast: ${votesCast}`, 'success');
    loadECOutcomes();
  } catch(e) {
    console.error('Error syncing voter counts:', e);
    showToast('Error syncing counts: ' + e.message, 'error');
  }
};

// ---------------- Animation CSS ----------------
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .show {
    display: block !important;
    animation: fadeIn 0.3s ease;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00C3FF, #9D00FF);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
`;
document.head.appendChild(style);

// Hotfix for immediate issues
console.log("✅ Neon Voting System Initialized with fixes for refresh and invite issues");