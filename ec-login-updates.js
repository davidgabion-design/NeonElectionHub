// EC-LOGIN-UPDATES.js - Copy and add to your main script
// === UPDATED EC LOGIN FUNCTION ===
async function loginEC() {
    const orgId = document.getElementById('ec-org-id').value.trim();
    const pass  = document.getElementById('ec-pass').value.trim();

    if (!orgId || !pass) {
        showToast("Enter organization ID and EC password", "error");
        return;
    }

    showToast("Checking credentials...", "info");
    
    try {
        const { doc, getDoc } = window.firebaseModules;
        const orgRef = doc(db, "organizations", orgId);
        const snap = await getDoc(orgRef);

        if (!snap.exists()) {
            showToast("Organization not found", "error");
            return;
        }

        const org = snap.data();
        
        // Check if organization is active
        if (org.electionStatus === "inactive" || org.electionStatus === "closed") {
            showToast("Organization is inactive or closed", "error");
            return;
        }
        
        // Validate password (case-sensitive)
        if (org.ecPassword !== pass) {
            showToast("Invalid EC password", "error");
            return;
        }

        // Store in localStorage for persistence
        localStorage.setItem("currentOrgId", orgId);
        localStorage.setItem("currentECPassword", pass);
        localStorage.setItem("isECLoggedIn", "true");
        localStorage.setItem("lastLogin", new Date().toISOString());
        
        // Load full organization data
        currentECOrg = { 
            id: orgId, 
            name: org.name || orgId,
            ecPassword: org.ecPassword,
            electionStatus: org.electionStatus || "active",
            voterCount: org.voterCount || 0,
            voteCount: org.voteCount || 0,
            ...org 
        };

        // Update EC panel header
        const nameEl   = document.getElementById('ecOrgName');
        const statusEl = document.getElementById('ecOrgStatus');
        const idEl     = document.getElementById('ecOrgIdDisplay');

        if (nameEl)   nameEl.textContent   = org.name || orgId;
        if (statusEl) statusEl.textContent = "Status: " + (org.electionStatus || "active");
        if (idEl)     idEl.textContent     = "ID: " + orgId;

        showScreen('ecPanel');
        switchECTab('voters');
        showToast(`Welcome, EC of ${org.name || orgId}`, "success");
        
        // Load organization data
        loadOrganizationData();
        
    } catch (e) {
        console.error("EC login error:", e);
        showToast("Login failed: " + e.message, "error");
    }
}

// === LOAD ORGANIZATION DATA ===
async function loadOrganizationData() {
    if (!currentECOrg) return;
    
    try {
        const { collection, getDocs } = window.firebaseModules;
        const orgId = currentECOrg.id;
        
        // Load voters
        const votersRef = collection(db, "organizations", orgId, "voters");
        const votersSnap = await getDocs(votersRef);
        const voters = votersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Load positions
        const positionsRef = collection(db, "organizations", orgId, "positions");
        const positionsSnap = await getDocs(positionsRef);
        const positions = positionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Load candidates
        const candidatesRef = collection(db, "organizations", orgId, "candidates");
        const candidatesSnap = await getDocs(candidatesRef);
        const candidates = candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Store in currentECOrg for easy access
        currentECOrg.voters = voters;
        currentECOrg.positions = positions;
        currentECOrg.candidates = candidates;
        
        console.log("Loaded organization data:", {
            voters: voters.length,
            positions: positions.length,
            candidates: candidates.length
        });
        
        // Refresh current tab
        refreshCurrentTab();
        
    } catch (error) {
        console.error("Error loading organization data:", error);
        // It's okay if collections don't exist yet
    }
}

// === REFRESH CURRENT TAB ===
function refreshCurrentTab() {
    // Get active tab
    const activeTabBtn = document.querySelector('#ecTabs .tab-btn.active');
    if (!activeTabBtn) return;
    
    const tab = activeTabBtn.getAttribute('data-ec-tab');
    
    // Refresh the tab content
    switch(tab) {
        case 'voters':
            renderVotersTab(true);
            break;
        case 'positions':
            renderPositionsTab(true);
            break;
        case 'candidates':
            renderCandidatesTab(true);
            break;
        case 'outcomes':
            renderOutcomesTab(true);
            break;
        case 'settings':
            renderSettingsTab(true);
            break;
    }
}

// === UPDATED VOTERS TAB ===
function renderVotersTab(refresh = false) {
    const el = document.getElementById('votersContent');
    if (!el) return;

    if (!currentECOrg) {
        el.innerHTML = `<p class="subtext">No organization loaded.</p>`;
        return;
    }

    const voters = currentECOrg.voters || [];
    const totalVoters = currentECOrg.voterCount || voters.length;
    const votesCast = currentECOrg.voteCount || 0;
    
    let html = `
        <h3 style="margin-bottom:20px;color:#00eaff;">
            <i class="fas fa-users"></i> Voters Management
        </h3>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:15px;margin-bottom:25px;">
            <div style="background:rgba(0,255,255,0.05);padding:15px;border-radius:10px;border:1px solid rgba(0,255,255,0.1);">
                <div style="font-size:24px;font-weight:bold;color:#00ffaa;">${totalVoters}</div>
                <div style="color:#aaa;font-size:13px;">Total Voters</div>
            </div>
            <div style="background:rgba(157,0,255,0.05);padding:15px;border-radius:10px;border:1px solid rgba(157,0,255,0.1);">
                <div style="font-size:24px;font-weight:bold;color:#9D00FF;">${votesCast}</div>
                <div style="color:#aaa;font-size:13px;">Votes Cast</div>
            </div>
            <div style="background:rgba(0,195,255,0.05);padding:15px;border-radius:10px;border:1px solid rgba(0,195,255,0.1);">
                <div style="font-size:24px;font-weight:bold;color:#00C3FF;">${Math.round((votesCast / totalVoters) * 100) || 0}%</div>
                <div style="color:#aaa;font-size:13px;">Turnout Rate</div>
            </div>
        </div>
        
        <div style="margin-bottom:20px;display:flex;gap:10px;">
            <button class="btn neon-btn-outline" onclick="addVoter()">
                <i class="fas fa-user-plus"></i> Add Voter
            </button>
            <button class="btn neon-btn-outline" onclick="importVoters()">
                <i class="fas fa-file-import"></i> Import CSV
            </button>
            <button class="btn neon-btn-outline" onclick="exportVoters()">
                <i class="fas fa-file-export"></i> Export
            </button>
        </div>
    `;
    
    if (voters.length === 0) {
        html += `
            <div style="text-align:center;padding:40px;background:rgba(255,255,255,0.02);border-radius:10px;border:1px dashed rgba(255,255,255,0.1);">
                <i class="fas fa-users" style="font-size:48px;color:#00C3FF;margin-bottom:15px;opacity:0.5;"></i>
                <h4 style="color:#fff;">No Voters Yet</h4>
                <p style="color:#aaa;margin-top:10px;">Add voters manually or import from CSV</p>
            </div>
        `;
    } else {
        html += `
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;margin-top:10px;">
                    <thead>
                        <tr style="background:rgba(0,255,255,0.1);">
                            <th style="padding:12px;text-align:left;color:#00eaff;">Email</th>
                            <th style="padding:12px;text-align:left;color:#00eaff;">Name</th>
                            <th style="padding:12px;text-align:left;color:#00eaff;">Status</th>
                            <th style="padding:12px;text-align:left;color:#00eaff;">Voted</th>
                            <th style="padding:12px;text-align:left;color:#00eaff;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        voters.forEach((voter, index) => {
            const hasVoted = voter.hasVoted || false;
            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px;">${voter.email || 'N/A'}</td>
                    <td style="padding:12px;">${voter.name || 'N/A'}</td>
                    <td style="padding:12px;">
                        <span style="padding:4px 8px;border-radius:4px;background:${voter.status === 'active' ? 'rgba(0,255,170,0.1)' : 'rgba(255,68,68,0.1)'};color:${voter.status === 'active' ? '#00ffaa' : '#ff4444'};">
                            ${voter.status || 'pending'}
                        </span>
                    </td>
                    <td style="padding:12px;">
                        <span style="padding:4px 8px;border-radius:4px;background:${hasVoted ? 'rgba(0,255,170,0.1)' : 'rgba(255,68,68,0.1)'};color:${hasVoted ? '#00ffaa' : '#ff4444'};">
                            ${hasVoted ? '✓ Voted' : 'Not Voted'}
                        </span>
                    </td>
                    <td style="padding:12px;">
                        <button onclick="editVoter('${voter.id}')" style="background:transparent;border:1px solid rgba(0,255,255,0.2);color:#8efaff;padding:4px 8px;border-radius:4px;cursor:pointer;margin-right:5px;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteVoter('${voter.id}')" style="background:transparent;border:1px solid rgba(255,68,68,0.2);color:#ff8888;padding:4px 8px;border-radius:4px;cursor:pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    el.innerHTML = html;
}

// === ADD VOTER FUNCTION ===
async function addVoter() {
    if (!currentECOrg) return;
    
    const email = prompt("Enter voter email:");
    if (!email) return;
    
    const name = prompt("Enter voter name:", "");
    
    try {
        const { doc, setDoc, serverTimestamp } = window.firebaseModules;
        const voterId = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const voterRef = doc(db, "organizations", currentECOrg.id, "voters", voterId);
        
        await setDoc(voterRef, {
            email: email,
            name: name || "",
            status: "active",
            hasVoted: false,
            otp: null,
            otpExpiry: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        showToast(`Voter ${email} added successfully`, "success");
        loadOrganizationData(); // Refresh data
        
    } catch (error) {
        console.error("Error adding voter:", error);
        showToast("Error adding voter: " + error.message, "error");
    }
}

// === AUTOMATIC LOGIN CHECK ===
function checkAutomaticLogin() {
    const orgId = localStorage.getItem("currentOrgId");
    const password = localStorage.getItem("currentECPassword");
    const isLoggedIn = localStorage.getItem("isECLoggedIn");
    
    if (orgId && password && isLoggedIn === "true") {
        // Auto-fill the login form
        const orgInput = document.getElementById('ec-org-id');
        const passInput = document.getElementById('ec-pass');
        
        if (orgInput) orgInput.value = orgId;
        if (passInput) passInput.value = password;
        
        // Show notification
        showToast(`Auto-filled credentials for ${orgId}`, "info", 3000);
    }
}

// === ADD TO DOM LOADED EVENT ===
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    
    // Add automatic login check
    setTimeout(checkAutomaticLogin, 1000);
    
    // Add logout cleanup
    window.logout = function() {
        currentECOrg = null;
        localStorage.removeItem("currentOrgId");
        localStorage.removeItem("currentECPassword");
        localStorage.removeItem("isECLoggedIn");
        showScreen('gatewayScreen');
        showToast('Logged out successfully', 'info');
    };
});

// === ADD HELPER FUNCTIONS ===
async function importVoters() {
    showToast("CSV import feature coming soon!", "info");
    // TODO: Implement CSV import
}

async function exportVoters() {
    if (!currentECOrg || !currentECOrg.voters) {
        showToast("No voters to export", "warning");
        return;
    }
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + ["Email,Name,Status,Voted"].join(",") + "\\n"
        + currentECOrg.voters.map(v => 
            `"${v.email || ''}","${v.name || ''}","${v.status || ''}","${v.hasVoted ? 'Yes' : 'No'}"`
          ).join("\\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `voters_${currentECOrg.id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${currentECOrg.voters.length} voters`, "success");
}

async function editVoter(voterId) {
    showToast("Edit voter feature coming soon!", "info");
    // TODO: Implement voter editing
}

async function deleteVoter(voterId) {
    if (!confirm("Are you sure you want to delete this voter?")) return;
    
    try {
        const { doc, deleteDoc } = window.firebaseModules;
        const voterRef = doc(db, "organizations", currentECOrg.id, "voters", voterId);
        await deleteDoc(voterRef);
        
        showToast("Voter deleted successfully", "success");
        loadOrganizationData(); // Refresh data
        
    } catch (error) {
        console.error("Error deleting voter:", error);
        showToast("Error deleting voter: " + error.message, "error");
    }
}
