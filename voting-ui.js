// ============================================================
// ✅ MODERN ORGANIZED NEON VOTING UI (CLEAN + PROFESSIONAL)
// ✅ AUTO LOADS POSITIONS & CANDIDATES FROM FIRESTORE
// ✅ CONNECTS DIRECTLY TO submitVote()
// ✅ RESPONSIVE • GLASS • SMOOTH
// ============================================================

import { getDocs, collection } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { db } from "./script.js";

// ===============================
// ✅ BUILD VOTING UI
// ===============================
window.buildVotingUI = async function () {
  try {
    const container = document.getElementById("voting-container");
    if (!container) return;

    container.innerHTML = `
      <div class="vote-loading">
        <div class="vote-spinner"></div>
        <p>Loading ballot...</p>
      </div>
    `;

    const posSnap = await getDocs(collection(db, "organizations", currentOrgId, "positions"));
    const candSnap = await getDocs(collection(db, "organizations", currentOrgId, "candidates"));

    const positions = [];
    posSnap.forEach(d => positions.push({ id: d.id, ...d.data() }));

    const candidates = [];
    candSnap.forEach(d => candidates.push({ id: d.id, ...d.data() }));

    if (positions.length === 0) {
      container.innerHTML = `<div class="vote-empty">No voting positions available.</div>`;
      return;
    }

    let html = `<div class="vote-wrapper">`;

    positions
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(pos => {
        const posCandidates = candidates.filter(c => c.positionId === pos.id);
        if (posCandidates.length === 0) return;

        html += `
          <section class="vote-section">
            <div class="vote-section-header">
              <div>
                <h2>${pos.name}</h2>
                ${pos.description ? `<p>${pos.description}</p>` : ""}
              </div>
              <span class="vote-badge">
                ${pos.votingType === "multiple" ? "Multiple Choice" : "Single Choice"}
              </span>
            </div>

            <div class="vote-grid">
        `;

        posCandidates.forEach(c => {
          const type = pos.votingType === "multiple" ? "checkbox" : "radio";

          html += `
            <label class="vote-card">
              <input 
                type="${type}"
                class="vote-input"
                name="vote-${pos.id}"
                data-position-id="${pos.id}"
                value="${c.id}"
              />

              <div class="vote-card-inner">
                <img src="${c.photo || getDefaultAvatar(c.name)}" />
                <div class="vote-info">
                  <strong>${c.name}</strong>
                  ${c.tagline ? `<span>${c.tagline}</span>` : ""}
                </div>
                <div class="vote-check">✔</div>
              </div>
            </label>
          `;
        });

        html += `
            </div>
          </section>
        `;
      });

    html += `
      <div class="vote-submit-zone">
        <button id="submitVoteBtn" class="neon-submit-btn" onclick="submitVote()">
          ✅ Submit My Vote
        </button>
      </div>
    </div>`;

    container.innerHTML = html;
    attachVoteAnimations();

  } catch (e) {
    console.error("Voting UI Error:", e);
    showToast("Failed to load ballot", "error");
  }
};

// ===============================
// ✅ UI INTERACTIONS
// ===============================
function attachVoteAnimations() {
  document.querySelectorAll(".vote-input").forEach(input => {
    input.addEventListener("change", () => {
      if (input.type === "radio") {
        document
          .querySelectorAll(`input[name="${input.name}"]`)
          .forEach(i => i.closest(".vote-card")?.classList.remove("active"));
      }

      if (input.checked) {
        input.closest(".vote-card")?.classList.add("active");
      } else {
        input.closest(".vote-card")?.classList.remove("active");
      }
    });
  });
}

// ===============================
// ✅ AUTO LOAD WHEN SCREEN OPENS
// ===============================
const _previousShowScreenVote = window.showScreen;
window.showScreen = function (screenId) {
  _previousShowScreenVote(screenId);
  if (screenId === "votingScreen") buildVotingUI();
};

// ===============================
// ✅ MODERN NEON STYLES
// ===============================
const style = document.createElement("style");
style.innerHTML = `
.vote-wrapper {
  max-width: 1100px;
  margin: auto;
  padding: 20px;
}

.vote-section {
  margin-bottom: 30px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(0,255,255,0.15);
  border-radius: 18px;
  padding: 18px;
}

.vote-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.vote-section-header h2 {
  color: #00eaff;
  margin: 0;
}

.vote-section-header p {
  font-size: 13px;
  color: rgba(255,255,255,0.7);
}

.vote-badge {
  font-size: 11px;
  padding: 6px 12px;
  border-radius: 20px;
  color: #00ffaa;
  border: 1px solid rgba(0,255,255,0.3);
}

.vote-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

.vote-card {
  cursor: pointer;
}

.vote-card input {
  display: none;
}

.vote-card-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(0,0,0,0.45);
  border-radius: 14px;
  padding: 14px;
  border: 1px solid rgba(0,255,255,0.12);
  transition: 0.25s ease;
}

.vote-card-inner img {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  object-fit: cover;
}

.vote-info strong {
  color: white;
  display: block;
}

.vote-info span {
  color: #8efaff;
  font-size: 12px;
}

.vote-check {
  margin-left: auto;
  font-size: 18px;
  color: #00ffaa;
  opacity: 0;
  transition: 0.3s;
}

.vote-card.active .vote-card-inner {
  border-color: #00ffaa;
  background: rgba(0,255,170,0.18);
  transform: scale(1.02);
}

.vote-card.active .vote-check {
  opacity: 1;
}

.vote-submit-zone {
  text-align: center;
  margin-top: 40px;
}

.neon-submit-btn {
  padding: 16px 38px;
  border-radius: 16px;
  cursor: pointer;
  border: none;
  font-size: 16px;
  font-weight: bold;
  background: linear-gradient(90deg,#9D00FF,#00C3FF);
  color: white;
  box-shadow: 0 0 25px rgba(157,0,255,0.4);
  transition: 0.25s;
}

.neon-submit-btn:hover {
  transform: translateY(-2px);
}

.vote-loading {
  text-align: center;
  padding: 60px;
}

.vote-spinner {
  width: 44px;
  height: 44px;
  border: 4px solid rgba(0,255,255,0.2);
  border-top: 4px solid #00eaff;
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: spin 1s linear infinite;
}

.vote-empty {
  text-align: center;
  padding: 50px;
  color: #ffc107;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);

console.log("✅ Modern Organized Voting UI Loaded");
