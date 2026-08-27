// app.js – User Registration & Real-time Participant Feed
// Dolan Bareng RW 5 · Prestige Night Edition
import {
  db, isConfigured, limit,
  collection, addDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp
} from "./firebase-config.js";

// ── DOM ──────────────────────────────────────────────────────
const form        = document.getElementById("register-form");
const submitBtn   = document.getElementById("submit-btn");
const submitText  = document.getElementById("submit-btn-text");
const formAlert   = document.getElementById("form-alert");
const searchInp   = document.getElementById("search-input");
const partList    = document.getElementById("part-list");
const liveCount   = document.getElementById("live-count");
const themeToggle = document.getElementById("theme-toggle");

// Success Modal Elements
const successModal = document.getElementById("success-modal");
const closeModal  = document.getElementById("close-modal-btn");
const modalUid    = document.getElementById("modal-uid");
const modalName   = document.getElementById("modal-name");
const modalBranch = document.getElementById("modal-branch");

// Winner Announcement Modal Elements
const announcementModal = document.getElementById("winner-announcement-modal");
const closeAnnouncementBtn = document.getElementById("close-announcement-btn");
const announcementUid = document.getElementById("announcement-uid");
const announcementName = document.getElementById("announcement-name");
const announcementBranch = document.getElementById("announcement-branch");

const LS_KEY = "ppg_participants_demo_db";
let participants = [];
let initialWinnersLoaded = false;
const knownWinners = new Set();

// ── THEME ────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem("ppg_theme") || "dark";
  applyTheme(saved);
  themeToggle.addEventListener("click", () => {
    const next = document.body.classList.contains("light") ? "dark" : "light";
    applyTheme(next);
    localStorage.setItem("ppg_theme", next);
  });
})();

function applyTheme(t) {
  if (t === "light") {
    document.body.classList.add("light");
    themeToggle.textContent = "🌙";
  } else {
    document.body.classList.remove("light");
    themeToggle.textContent = "☀️";
  }
}

// ── SEQUENTIAL UNIQUE ID GENERATOR ───────────────────────────
async function getNextUid() {
  if (isConfigured && db) {
    try {
      const q = query(collection(db, "participants"), orderBy("uniqueId", "desc"), limit(1));
      const snap = await getDocs(q);
      let nextNum = 1;
      if (!snap.empty) {
        const lastId = snap.docs[0].data().uniqueId;
        const match = lastId.match(/RW5-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      return `RW5-${String(nextNum).padStart(5, '0')}`;
    } catch (e) {
      console.error("Error getting next sequential UID from Firestore:", e);
    }
  }
  
  // Fallback / Local Mode Sequential ID
  const localList = getLocal();
  let nextNum = 1;
  if (localList.length > 0) {
    // Find the max number in the current list
    let max = 0;
    localList.forEach(p => {
      const match = p.uniqueId ? p.uniqueId.match(/RW5-(\d+)/) : null;
      if (match) {
        const val = parseInt(match[1]);
        if (val > max) max = val;
      }
    });
    nextNum = max + 1;
  }
  return `RW5-${String(nextNum).padStart(5, '0')}`;
}

// ── LOCAL DEMO STORE (fallback when Firebase not configured) ─
function getLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const seed = [
      { id:"s1", uniqueId:"RW5-00001", name:"Budi Santoso",    branch:"RT 01 / Gang Kelinci", won:false, createdAt:new Date(Date.now()-3600000) },
      { id:"s2", uniqueId:"RW5-00002", name:"Siti Rahmawati",  branch:"RT 03 / Depan Pos",    won:false, createdAt:new Date(Date.now()-1800000) },
      { id:"s3", uniqueId:"RW5-00003", name:"Agus Pratama",    branch:"RT 02 / Blok C",       won:false, createdAt:new Date(Date.now()-900000) },
    ];
    localStorage.setItem(LS_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw);
}

function saveLocal(p) {
  const list = getLocal();
  list.unshift(p);
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("ppg_db_updated"));
}

// ── REAL-TIME LISTENER ───────────────────────────────────────
function startSync() {
  if (isConfigured && db) {
    try {
      const q = query(collection(db, "participants"), orderBy("createdAt", "desc"));
      onSnapshot(q, snap => {
        participants = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
        
        // Handle Real-time Winner Notifications
        if (!initialWinnersLoaded) {
          participants.forEach(p => {
            if (p.won) knownWinners.add(p.id);
          });
          initialWinnersLoaded = true;
        } else {
          participants.forEach(p => {
            if (p.won && !knownWinners.has(p.id)) {
              knownWinners.add(p.id);
              triggerWinnerAnnouncement(p.name, p.branch, p.uniqueId);
            }
          });
        }
      }, err => { console.error(err); startLocalSync(); });
    } catch { startLocalSync(); }
  } else {
    startLocalSync();
  }
}

function startLocalSync() {
  participants = getLocal();
  render();
  
  // Populate initial local winners
  participants.forEach(p => {
    if (p.won) knownWinners.add(p.id);
  });
  initialWinnersLoaded = true;

  const updateHandler = () => {
    participants = getLocal();
    render();
    
    // Check for new winners in local mode
    participants.forEach(p => {
      if (p.won && !knownWinners.has(p.id)) {
        knownWinners.add(p.id);
        triggerWinnerAnnouncement(p.name, p.branch, p.uniqueId);
      }
    });
  };

  window.addEventListener("ppg_db_updated", updateHandler);
  window.addEventListener("storage", updateHandler);
}

// ── RENDER LIST ──────────────────────────────────────────────
function render() {
  const q = searchInp?.value.toLowerCase().trim() ?? "";
  const filtered = participants.filter(p =>
    [p.name, p.branch, p.uniqueId].some(v => v?.toLowerCase().includes(q))
  );

  liveCount.textContent = `${participants.length} Peserta`;

  if (!filtered.length) {
    partList.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:2.5rem;font-size:.875rem;">
      ${q ? "Tidak ada hasil untuk pencarian ini." : "Belum ada peserta yang terdaftar."}
    </div>`;
    return;
  }

  partList.innerHTML = filtered.map(p => `
    <div class="part-item">
      <div class="part-item-left">
        <div class="part-name">${esc(p.name)}</div>
        <div class="part-meta">${esc(p.branch)}</div>
      </div>
      <div class="part-item-right">
        <span class="ticket-chip">${p.uniqueId ?? "RW5-?"}</span>
        <span class="status-chip ${p.won ? 'won' : 'eligible'}">${p.won ? "Menang" : "Aktif"}</span>
      </div>
    </div>
  `).join("");
}

searchInp?.addEventListener("input", render);

// ── REGISTRATION SUBMIT ──────────────────────────────────────
form.addEventListener("submit", async e => {
  e.preventDefault();
  clearAlert();

  const name   = form.name.value.trim();
  const branch = form.branch.value.trim();
  if (!name || !branch) return showAlert("Mohon isi semua kolom.");

  setLoading(true);

  try {
    const uid = await getNextUid(); // Sequential ID assignment

    if (isConfigured && db) {
      await addDoc(collection(db, "participants"), { 
        name, 
        branch, 
        uniqueId: uid, 
        won: false, 
        createdAt: serverTimestamp() 
      });
      openSuccessModal(name, branch, uid);
    } else {
      saveLocal({ 
        id: "l_" + Date.now(), 
        name, 
        branch, 
        uniqueId: uid, 
        won: false, 
        createdAt: new Date() 
      });
      openSuccessModal(name, branch, uid);
    }
    form.reset();
  } catch (err) {
    console.error(err);
    showAlert("Gagal menyimpan data. Periksa koneksi dan coba lagi.");
  } finally {
    setLoading(false);
  }
});

// ── MODALS ────────────────────────────────────────────────────
function openSuccessModal(name, branch, uid) {
  modalUid.textContent    = uid;
  modalName.textContent   = name;
  modalBranch.textContent = branch;
  successModal.classList.add("show");
}

closeModal.addEventListener("click", () => successModal.classList.remove("show"));
successModal.addEventListener("click", e => { if (e.target === successModal) successModal.classList.remove("show"); });

// Real-time winner announcement popups
function triggerWinnerAnnouncement(name, branch, uid) {
  announcementUid.textContent = uid;
  announcementName.textContent = name;
  announcementBranch.textContent = branch;
  announcementModal.classList.add("show");
}

closeAnnouncementBtn.addEventListener("click", () => announcementModal.classList.remove("show"));
announcementModal.addEventListener("click", e => { if (e.target === announcementModal) announcementModal.classList.remove("show"); });

// ── HELPERS ──────────────────────────────────────────────────
function showAlert(msg)  { formAlert.textContent = msg; formAlert.style.display = "block"; }
function clearAlert()    { formAlert.textContent = ""; formAlert.style.display = "none"; }
function setLoading(on)  {
  submitBtn.disabled = on;
  submitText.textContent = on ? "Memproses..." : "🚀 Daftarkan Saya!";
}
function esc(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[m]);
}

// ── BOOT ─────────────────────────────────────────────────────
startSync();
