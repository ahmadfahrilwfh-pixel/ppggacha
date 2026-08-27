// admin.js – Admin Dashboard, Multi-Winner Gacha Engine, QR Code, Confetti + Sound
// PPG 70th Anniversary Doorprize · Prestige Night Edition
import {
  db, isConfigured,
  collection, query, orderBy, onSnapshot, updateDoc, doc, serverTimestamp
} from "./firebase-config.js";

// ── DOM ──────────────────────────────────────────────────────
const statTotal      = document.getElementById("stat-total");
const statEligible   = document.getElementById("stat-eligible");
const statWinners    = document.getElementById("stat-winners");
const slotScreen     = document.getElementById("slot-screen");
const slotLabel      = document.getElementById("slot-label");
const slotName       = document.getElementById("slot-name");
const slotId         = document.getElementById("slot-id");
const slotBranch     = document.getElementById("slot-branch");
const winnerProgress = document.getElementById("winner-progress");
const winnersLog     = document.getElementById("winners-log");
const drawBtn        = document.getElementById("draw-btn");
const drawBtnText    = document.getElementById("draw-btn-text");
const winnerCountInp = document.getElementById("winner-count-inp");
const adminPartList  = document.getElementById("admin-part-list");
const adminSearch    = document.getElementById("admin-search");
const adminLiveCount = document.getElementById("admin-live-count");
const themeToggle    = document.getElementById("theme-toggle");
const confettiCanvas = document.getElementById("confetti-canvas");
const qrCodeBox      = document.getElementById("qr-code-box");
const qrUrlText      = document.getElementById("qr-url-text");
const refreshQrBtn   = document.getElementById("refresh-qr-btn");
const setGithubBtn   = document.getElementById("set-github-url-btn");

const LS_KEY = "ppg_participants_demo_db";
let allParticipants = [];
let isDrawing = false;
let qrInstance = null;

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
  if (t === "light") { document.body.classList.add("light"); themeToggle.textContent = "🌙"; }
  else               { document.body.classList.remove("light"); themeToggle.textContent = "☀️"; }
}

// ============================================================
// QR CODE GENERATOR
// ============================================================
// ↓↓ URL GITHUB PAGES SUDAH DISET ↓↓
const GITHUB_PAGES_URL = "https://ahmadfahrilwfh-pixel.github.io/ppggacha/index.html";

function getRegistrationUrl() {
  if (GITHUB_PAGES_URL) return GITHUB_PAGES_URL;       // hardcoded URL
  const stored = localStorage.getItem("ppg_gh_pages_url");
  if (stored) return stored;
  // Auto-detect local IP via current origin
  const url = new URL(window.location.href);
  url.pathname = "/index.html";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function generateQR(url) {
  qrUrlText.textContent = url;
  qrCodeBox.innerHTML = "";
  try {
    qrInstance = new QRCode(qrCodeBox, {
      text: url,
      width: 160,
      height: 160,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch(e) {
    qrCodeBox.innerHTML = `<div style="padding:1rem;font-size:.75rem;color:#999;">QRCode.js tidak tersedia.<br>Pastikan ada koneksi internet.</div>`;
  }
}

function initQR() {
  const url = getRegistrationUrl();
  generateQR(url);
}

refreshQrBtn.addEventListener("click", () => {
  localStorage.removeItem("ppg_gh_pages_url");
  initQR();
});

setGithubBtn.addEventListener("click", () => {
  const input = prompt(
    "Masukkan URL GitHub Pages halaman pendaftaran Anda:\n(Contoh: https://username.github.io/ppg/index.html)",
    localStorage.getItem("ppg_gh_pages_url") || ""
  );
  if (input && input.startsWith("http")) {
    localStorage.setItem("ppg_gh_pages_url", input.trim());
    generateQR(input.trim());
  }
});

// ============================================================
// SOUND FX (Web Audio API – no external files needed)
// ============================================================
const sfx = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === "suspended") this.ctx.resume();
  },
  tick(freq = 500) {
    try {
      this.init(); if (!this.ctx) return;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.03);
      g.gain.setValueAtTime(0.06, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.03);
    } catch {}
  },
  fanfare() {
    try {
      this.init(); if (!this.ctx) return;
      [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        setTimeout(() => {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(f, this.ctx.currentTime);
          g.gain.setValueAtTime(0.15, this.ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
          o.connect(g); g.connect(this.ctx.destination);
          o.start(); o.stop(this.ctx.currentTime + 0.5);
        }, i * 130);
      });
    } catch {}
  }
};

// ============================================================
// CONFETTI ENGINE
// ============================================================
const confetti = (() => {
  const ctx = confettiCanvas.getContext("2d");
  let parts = [], rafId;
  function resize() {
    confettiCanvas.width  = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  return {
    burst() {
      parts = [];
      const cols = ["#60a5fa","#4ade80","#d4af37","#f0f6ff","#34d399","#a78bfa"];
      for (let i = 0; i < 160; i++) {
        parts.push({
          x: confettiCanvas.width / 2, y: confettiCanvas.height * 0.4,
          vx: (Math.random()-.5)*30, vy: (Math.random()-.75)*28,
          size: Math.random()*8+4, rot: Math.random()*360,
          rspd: (Math.random()-.5)*10, alpha: 1,
          color: cols[Math.floor(Math.random()*cols.length)]
        });
      }
      if (rafId) cancelAnimationFrame(rafId);
      this.draw();
    },
    draw() {
      ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
      let alive = false;
      for (const p of parts) {
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.45; p.rot+=p.rspd; p.alpha-=0.009;
        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0,p.alpha);
          ctx.translate(p.x,p.y);
          ctx.rotate(p.rot*Math.PI/180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
          ctx.restore();
        }
      }
      if (alive) rafId = requestAnimationFrame(() => this.draw());
      else ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
    }
  };
})();

// ============================================================
// DATA SYNC
// ============================================================
function getLocal() {
  const raw = localStorage.getItem(LS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function markLocalWinner(id) {
  const list = getLocal();
  const idx = list.findIndex(p => p.id === id);
  if (idx > -1) { list[idx].won = true; list[idx].wonAt = new Date().toISOString(); }
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("ppg_db_updated"));
}

function initSync() {
  if (isConfigured && db) {
    try {
      const q = query(collection(db, "participants"), orderBy("createdAt","desc"));
      onSnapshot(q, snap => {
        allParticipants = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        refreshUI();
      }, err => { console.error(err); startLocalSync(); });
    } catch { startLocalSync(); }
  } else {
    startLocalSync();
  }
}

function startLocalSync() {
  allParticipants = getLocal();
  refreshUI();
  ["ppg_db_updated","storage"].forEach(evt =>
    window.addEventListener(evt, () => { allParticipants = getLocal(); refreshUI(); })
  );
}

// ── UI REFRESH ───────────────────────────────────────────────
function refreshUI() {
  const total    = allParticipants.length;
  const eligible = allParticipants.filter(p => !p.won).length;
  const winners  = total - eligible;

  statTotal.textContent    = total;
  statEligible.textContent = eligible;
  statWinners.textContent  = winners;
  adminLiveCount.textContent = `${total} Peserta`;

  renderAdminList();
}

function renderAdminList() {
  const q = adminSearch?.value.toLowerCase().trim() ?? "";
  const filtered = allParticipants.filter(p =>
    [p.name,p.nik,p.branch,p.uniqueId].some(v => v?.toLowerCase().includes(q))
  );

  if (!filtered.length) {
    adminPartList.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:.875rem;">
      ${q ? "Tidak ada hasil." : "Belum ada data peserta."}
    </div>`;
    return;
  }

  adminPartList.innerHTML = filtered.map(p => `
    <div class="part-item">
      <div class="part-item-left">
        <div class="part-name">${esc(p.name)}</div>
        <div class="part-meta">NIK: ${esc(p.nik)} &nbsp;·&nbsp; ${esc(p.branch)}</div>
      </div>
      <div class="part-item-right">
        <span class="ticket-chip">${p.uniqueId ?? "DP70-?"}</span>
        <span class="status-chip ${p.won ? 'won':'eligible'}">${p.won ? "Menang":"Eligible"}</span>
      </div>
    </div>
  `).join("");
}

adminSearch?.addEventListener("input", renderAdminList);

// ============================================================
// MULTI-WINNER GACHA ENGINE
// ============================================================
async function startGacha() {
  if (isDrawing) return;

  const eligible = allParticipants.filter(p => !p.won);
  if (!eligible.length) {
    alert("Tidak ada peserta yang tersisa untuk diundi.");
    return;
  }

  const countReq = Math.max(1, Math.min(parseInt(winnerCountInp.value) || 1, eligible.length));
  const selectedWinners = pickRandom(eligible, countReq);

  isDrawing = true;
  drawBtn.disabled = true;
  drawBtnText.textContent = "Mengundi...";
  slotScreen.classList.remove("winner-mode");
  winnersLog.innerHTML = "";
  winnerProgress.textContent = "";

  // Animate winners one by one sequentially
  for (let i = 0; i < selectedWinners.length; i++) {
    winnerProgress.textContent = `Mengundi pemenang ${i + 1} dari ${selectedWinners.length}...`;
    await animateShuffle(eligible, selectedWinners[i], i, selectedWinners.length);

    // Append winner tag to log
    const tag = document.createElement("div");
    tag.className = "winner-tag";
    tag.textContent = `${selectedWinners[i].name} · ${selectedWinners[i].uniqueId}`;
    winnersLog.appendChild(tag);

    // Persist winner
    await persistWinner(selectedWinners[i]);

    // Short pause before next winner (only if more remain)
    if (i < selectedWinners.length - 1) {
      await sleep(1200);
      slotScreen.classList.remove("winner-mode");
    }
  }

  winnerProgress.textContent = countReq > 1
    ? `✅ ${countReq} pemenang berhasil dipilih!`
    : `✅ Pemenang berhasil dipilih!`;

  isDrawing = false;
  drawBtn.disabled = false;
  drawBtnText.textContent = "Undian Berikutnya";
}

// Animate one shuffle cycle, stop at `target`
function animateShuffle(pool, target, winnerIndex, totalWinners) {
  return new Promise(resolve => {
    let step = 0;
    const TOTAL_STEPS = 42;
    let delay = 40;           // ms – starts fast
    const MAX_DELAY = 480;    // ms – slows to this

    slotLabel.textContent = `MENGUNDI PEMENANG KE-${winnerIndex + 1}`;
    slotScreen.classList.remove("winner-mode");

    function tick() {
      // Pick random from pool for display during shuffle
      const pick = pool[Math.floor(Math.random() * pool.length)];
      slotName.textContent   = pick.name.toUpperCase();
      slotId.textContent     = pick.uniqueId ?? "";
      slotBranch.textContent = pick.branch;

      // Synthesise tick sound at decreasing pitch as it slows
      sfx.tick(460 + step * 7);

      step++;

      if (step >= TOTAL_STEPS) {
        // ── LAND ON WINNER ──
        slotName.textContent   = target.name.toUpperCase();
        slotId.textContent     = target.uniqueId ?? "";
        slotBranch.textContent = `🏆 Selamat! · Cabang: ${target.branch}`;
        slotLabel.textContent  = `🎊 PEMENANG KE-${winnerIndex + 1} DARI ${totalWinners}`;
        slotScreen.classList.add("winner-mode");
        sfx.fanfare();
        confetti.burst();
        resolve();
      } else {
        // Exponential deceleration
        delay += (MAX_DELAY - delay) * 0.09;
        setTimeout(tick, delay);
      }
    }
    tick();
  });
}

async function persistWinner(winner) {
  try {
    if (isConfigured && db) {
      await updateDoc(doc(db, "participants", winner.id), { won: true, wonAt: serverTimestamp() });
    } else {
      markLocalWinner(winner.id);
    }
  } catch(e) { console.error("Gagal update pemenang:", e); }
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const picks = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    picks.push(copy.splice(idx, 1)[0]);
  }
  return picks;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

drawBtn.addEventListener("click", startGacha);

// ── HELPERS ──────────────────────────────────────────────────
function esc(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[m]);
}

// ── BOOT ─────────────────────────────────────────────────────
initSync();
initQR();
