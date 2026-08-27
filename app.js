// app.js – User Registration & Real-time Participant Feed
// PPG 70th Anniversary Doorprize · Prestige Night Edition
import {
  db, isConfigured,
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
const successModal = document.getElementById("success-modal");
const closeModal  = document.getElementById("close-modal-btn");
const modalUid    = document.getElementById("modal-uid");
const modalName   = document.getElementById("modal-name");
const modalNik    = document.getElementById("modal-nik");
const modalBranch = document.getElementById("modal-branch");

const LS_KEY = "ppg_participants_demo_db";
let participants = [];

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

// ── UNIQUE ID ────────────────────────────────────────────────
function genUid() {
  return `RW5-${String(Math.floor(10000 + Math.random() * 90000))}`;
}

// ── LOCAL DEMO STORE (fallback when Firebase not configured) ─
function getLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const seed = [
      { id:"s1", uniqueId:"DP70-10045", nik:"PPG-10045", name:"Budi Santoso",    branch:"Kantor Pusat Jakarta", won:false, createdAt:new Date(Date.now()-3600000) },
      { id:"s2", uniqueId:"DP70-10089", nik:"PPG-10089", name:"Siti Rahmawati",  branch:"Cabang Surabaya",      won:false, createdAt:new Date(Date.now()-1800000) },
      { id:"s3", uniqueId:"DP70-10112", nik:"PPG-10112", name:"Agus Pratama",    branch:"Cabang Medan",         won:false, createdAt:new Date(Date.now()-900000) },
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
      }, err => { console.error(err); startLocalSync(); });
    } catch { startLocalSync(); }
  } else {
    startLocalSync();
  }
}

function startLocalSync() {
  participants = getLocal();
  render();
  ["ppg_db_updated","storage"].forEach(evt => window.addEventListener(evt, () => {
    participants = getLocal();
    render();
  }));
}

// ── RENDER LIST ──────────────────────────────────────────────
function render() {
  const q = searchInp?.value.toLowerCase().trim() ?? "";
  const filtered = participants.filter(p =>
    [p.name, p.nik, p.branch, p.uniqueId].some(v => v?.toLowerCase().includes(q))
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
        <div class="part-meta">NIK: ${esc(p.nik)} &nbsp;·&nbsp; ${esc(p.branch)}</div>
      </div>
      <div class="part-item-right">
        <span class="ticket-chip">${p.uniqueId ?? "DP70-?"}</span>
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

  const nik    = form.nik.value.trim();
  const name   = form.name.value.trim();
  const branch = form.branch.value.trim();
  if (!nik || !name || !branch) return showAlert("Mohon isi semua kolom.");

  setLoading(true);

  try {
    if (isConfigured && db) {
      const dup = await getDocs(query(collection(db, "participants"), where("nik","==",nik)));
      if (!dup.empty) { showAlert(`NIK "${nik}" sudah terdaftar.`); return; }
      const uid = genUid();
      await addDoc(collection(db, "participants"), { nik, name, branch, uniqueId: uid, won: false, createdAt: serverTimestamp() });
      openSuccessModal(name, nik, branch, uid);
    } else {
      const list = getLocal();
      if (list.some(p => p.nik.toLowerCase() === nik.toLowerCase())) {
        showAlert(`NIK "${nik}" sudah terdaftar.`); return;
      }
      const uid = genUid();
      saveLocal({ id:"l_"+Date.now(), nik, name, branch, uniqueId: uid, won: false, createdAt: new Date() });
      openSuccessModal(name, nik, branch, uid);
    }
    form.reset();
  } catch (err) {
    console.error(err);
    showAlert("Gagal menyimpan data. Periksa koneksi dan coba lagi.");
  } finally {
    setLoading(false);
  }
});

// ── MODAL ────────────────────────────────────────────────────
function openSuccessModal(name, nik, branch, uid) {
  modalUid.textContent    = uid;
  modalName.textContent   = name;
  modalNik.textContent    = nik;
  modalBranch.textContent = branch;
  successModal.classList.add("show");
}

closeModal.addEventListener("click", () => successModal.classList.remove("show"));
successModal.addEventListener("click", e => { if (e.target === successModal) successModal.classList.remove("show"); });

// ── HELPERS ──────────────────────────────────────────────────
function showAlert(msg)  { formAlert.textContent = msg; formAlert.style.display = "block"; }
function clearAlert()    { formAlert.textContent = ""; formAlert.style.display = "none"; }
function setLoading(on)  {
  submitBtn.disabled = on;
  submitText.textContent = on ? "Memproses..." : "Daftarkan Saya";
}
function esc(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[m]);
}

// ── BOOT ─────────────────────────────────────────────────────
startSync();
