/* =========================================================================
   COMMON.JS — session, leaderboard storage, cloud sync, and small shared
   helpers.

   WHY SCORES DON'T SHOW UP ON OTHER DEVICES BY DEFAULT
   Everything is stored in this browser's localStorage, which never leaves
   this device/browser — there is no server, so two phones (or a phone and
   a laptop) can never see each other's data on their own. That's not a
   bug, it's what "no build step, no server" means.

   OPTIONAL CROSS-DEVICE SYNC (5-minute, free, no-code-build setup)
   This file can ALSO mirror the leaderboard/progress/certificates to a
   small free cloud database, so every device that opens the game merges
   in everyone else's latest data. It's entirely optional and off by
   default — the game works exactly as before until you turn it on.

   To turn it on:
     1. Go to https://console.firebase.google.com → Create a project (free).
     2. In the left sidebar: Build → Realtime Database → Create Database →
        start in TEST MODE (fine for a practice game with no real user data).
     3. Copy the "Database URL" it gives you — looks like:
        https://your-project-id-default-rtdb.firebaseio.com
     4. Paste it into CLOUD_DB_URL below, between the quotes.
     5. Re-upload this file. That's it — no SDK, no npm install, no build
        step. This file talks to Firebase over plain REST calls.
   Leave CLOUD_DB_URL as "" to keep the game fully local/offline, exactly
   like before.
   ========================================================================= */
const CLOUD_DB_URL = "https://ecgrhythm-16755-default-rtdb.firebaseio.com/";

const LS_USER = "ecg_current_user";
const LS_LEADERBOARD = "ecg_leaderboard";
const LS_PROGRESS = "ecg_progress";
const LS_CERTIFICATES = "ecg_certificates";
const LS_SEEN_INSTRUCTIONS = "ecg_seen_instructions";
const SS_ADMIN_PREVIEW = "ecg_admin_preview";

/* ---------------- session ---------------- */
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem(LS_USER)); } catch (e) { return null; }
}
function setCurrentUser(name) {
  sessionStorage.setItem(LS_USER, JSON.stringify({ name, isAdmin: name.trim().toLowerCase() === "adminisnarmi" }));
}
function logout() {
  sessionStorage.removeItem(LS_USER);
  sessionStorage.removeItem(SS_ADMIN_PREVIEW);
  window.location.href = "index.html";
}
function requireLogin() {
  const u = getCurrentUser();
  if (!u) { window.location.href = "index.html"; return null; }
  return u;
}

/* ---------------- first-time "how to play" instructions ---------------- */
function hasSeenInstructions() {
  return localStorage.getItem(LS_SEEN_INSTRUCTIONS) === "1";
}
function markInstructionsSeen() {
  localStorage.setItem(LS_SEEN_INSTRUCTIONS, "1");
}

/* ---------------- admin "play as user" preview mode ---------------- */
/* Lets an admin click "Play as user" without instantly being bounced back
   to admin.html by the isAdmin redirect guard on levels/game/certificate.
   The flag lives in sessionStorage (this tab only) and is cleared the
   moment they head back to the admin dashboard or sign out. */
function isAdminPreviewing() {
  return sessionStorage.getItem(SS_ADMIN_PREVIEW) === "1";
}
function enterAdminPreview() {
  sessionStorage.setItem(SS_ADMIN_PREVIEW, "1");
}
function exitAdminPreview() {
  sessionStorage.removeItem(SS_ADMIN_PREVIEW);
}

/* ---------------- optional cloud sync (see header comment) ---------------- */
function cloudEnabled() {
  return !!CLOUD_DB_URL;
}
/* Firebase RTDB keys can't contain . # $ [ ] / or whitespace - swap those
   out so any player name is safe to use as a key. */
function cloudKeySafe(name) {
  return String(name).replace(/[.#$\[\]\/\s]/g, "_") || "player";
}
async function cloudGet(path) {
  if (!cloudEnabled()) return null;
  try {
    const res = await fetch(CLOUD_DB_URL + path + ".json");
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Cloud sync (get) unavailable:", e);
    return null;
  }
}
async function cloudPut(path, value) {
  if (!cloudEnabled()) return;
  try {
    await fetch(CLOUD_DB_URL + path + ".json", { method: "PUT", body: JSON.stringify(value) });
  } catch (e) {
    console.warn("Cloud sync (put) failed:", e);
  }
}
async function cloudPost(path, value) {
  if (!cloudEnabled()) return;
  try {
    await fetch(CLOUD_DB_URL + path + ".json", { method: "POST", body: JSON.stringify(value) });
  } catch (e) {
    console.warn("Cloud sync (post) failed:", e);
  }
}

/* Pulls the shared cloud leaderboard/progress/certificates and merges
   them into this device's localStorage (additive only — never deletes
   local data). Safe to call repeatedly; a no-op if cloud sync isn't
   configured. Call this once on page load, then re-render. */
async function refreshFromCloud() {
  if (!cloudEnabled()) return;
  try {
    const [cloudBoard, cloudProgress, cloudCerts] = await Promise.all([
      cloudGet("/leaderboard"),
      cloudGet("/progress"),
      cloudGet("/certificates"),
    ]);

    if (cloudBoard) {
      const cloudRows = Object.values(cloudBoard).filter(Boolean);
      const localRows = getLeaderboard();
      const seen = new Set(localRows.map((r) => `${r.name}|${r.level}|${r.score}|${r.timestamp}`));
      const merged = localRows.slice();
      cloudRows.forEach((r) => {
        const key = `${r.name}|${r.level}|${r.score}|${r.timestamp}`;
        if (!seen.has(key)) { merged.push(r); seen.add(key); }
      });
      localStorage.setItem(LS_LEADERBOARD, JSON.stringify(merged));
    }

    if (cloudProgress) {
      const localProgress = JSON.parse(localStorage.getItem(LS_PROGRESS) || "{}");
      Object.values(cloudProgress).filter(Boolean).forEach((p) => {
        if (!p.name) return;
        const cur = localProgress[p.name] || { unlocked: 1 };
        cur.unlocked = Math.max(cur.unlocked, p.unlocked || 1);
        localProgress[p.name] = cur;
      });
      localStorage.setItem(LS_PROGRESS, JSON.stringify(localProgress));
    }

    if (cloudCerts) {
      const localCerts = JSON.parse(localStorage.getItem(LS_CERTIFICATES) || "{}");
      Object.values(cloudCerts).filter(Boolean).forEach((rec) => {
        if (!rec.name) return;
        if (!localCerts[rec.name]) localCerts[rec.name] = rec;
      });
      localStorage.setItem(LS_CERTIFICATES, JSON.stringify(localCerts));
    }
  } catch (e) {
    console.warn("Cloud sync (refresh) failed:", e);
  }
}

/* ---------------- progress (levels unlocked) ---------------- */
function getProgress(name) {
  const all = JSON.parse(localStorage.getItem(LS_PROGRESS) || "{}");
  return all[name] || { unlocked: 1 };
}
function unlockNextLevel(name, completedLevel) {
  const all = JSON.parse(localStorage.getItem(LS_PROGRESS) || "{}");
  const cur = all[name] || { unlocked: 1 };
  cur.unlocked = Math.max(cur.unlocked, completedLevel + 1);
  all[name] = cur;
  localStorage.setItem(LS_PROGRESS, JSON.stringify(all));
  cloudPut(`/progress/${cloudKeySafe(name)}`, { name, unlocked: cur.unlocked }); // fire-and-forget
}

/* ---------------- course completion certificate ---------------- */
/* Small deterministic-looking ID from name+timestamp - just for a
   certificate reference number, not a security token. */
function makeCertId(name, timestamp) {
  let h = 0;
  const str = name + "|" + timestamp;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  const code = Math.abs(h).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  return `ECG-${code}`;
}

function isCourseComplete(name) {
  return getProgress(name).unlocked > LEVELS.length;
}

/* Returns the existing certificate record for this player, issuing (and
   persisting) a brand-new one the first time they qualify. Returns null
   if the player hasn't finished every level yet. */
function getOrIssueCertificate(name) {
  if (!isCourseComplete(name)) return null;
  const all = JSON.parse(localStorage.getItem(LS_CERTIFICATES) || "{}");
  if (all[name]) return all[name];
  const timestamp = new Date().toISOString();
  const board = getLeaderboard().filter((r) => r.name === name);
  const bestByLevel = {};
  board.forEach((r) => { if (!bestByLevel[r.level] || r.score > bestByLevel[r.level]) bestByLevel[r.level] = r.score; });
  const totalScore = Object.values(bestByLevel).reduce((a, b) => a + b, 0);
  const record = {
    name,
    completedAt: timestamp,
    certId: makeCertId(name, timestamp),
    levelsCompleted: LEVELS.length,
    totalScore,
  };
  all[name] = record;
  localStorage.setItem(LS_CERTIFICATES, JSON.stringify(all));
  cloudPut(`/certificates/${cloudKeySafe(name)}`, record); // fire-and-forget
  return record;
}

function getCertificate(name) {
  const all = JSON.parse(localStorage.getItem(LS_CERTIFICATES) || "{}");
  return all[name] || null;
}

/* ---------------- leaderboard ---------------- */
function getLeaderboard() {
  return JSON.parse(localStorage.getItem(LS_LEADERBOARD) || "[]");
}
function addLeaderboardEntry(entry) {
  const board = getLeaderboard();
  const full = { ...entry, timestamp: new Date().toISOString() };
  board.push(full);
  localStorage.setItem(LS_LEADERBOARD, JSON.stringify(board));
  cloudPost("/leaderboard", full); // fire-and-forget cloud sync, no-op if not configured
}
function topScores(limit) {
  return getLeaderboard()
    .sort((a, b) => (b.score - a.score) || (a.timeTakenSec - b.timeTakenSec))
    .slice(0, limit || 50);
}
/* Aggregates every raw attempt into one row per player: total points is
   the sum of that player's BEST score on each distinct level they've
   played (so retrying a level doesn't inflate the total, but clearing
   more levels keeps adding to it) — used by the public leaderboard and
   the admin dashboard so both show "who scored what" per player, not a
   separate row for every level/attempt. */
function getPlayerLeaderboard() {
  const rows = getLeaderboard();
  const byPlayer = {};
  rows.forEach((r) => {
    if (!byPlayer[r.name]) byPlayer[r.name] = { name: r.name, bestByLevel: {}, bestSingle: 0, lastPlayed: r.timestamp, attempts: 0 };
    const p = byPlayer[r.name];
    p.attempts++;
    if (!p.bestByLevel[r.level] || r.score > p.bestByLevel[r.level]) p.bestByLevel[r.level] = r.score;
    if (r.score > p.bestSingle) p.bestSingle = r.score;
    if (new Date(r.timestamp) > new Date(p.lastPlayed)) p.lastPlayed = r.timestamp;
  });
  return Object.values(byPlayer)
    .map((p) => ({
      ...p,
      totalPoints: Object.values(p.bestByLevel).reduce((a, b) => a + b, 0),
      levelsPlayed: Object.keys(p.bestByLevel).length,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
function exportLeaderboardCSV() {
  const rows = getLeaderboard();
  const headers = ["name", "level", "score", "correct", "total", "timeTakenSec", "timestamp"];
  const csv = [headers.join(",")].concat(
    rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))
  ).join("\n");
  return csv;
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- 3D tilt-on-hover helper ---------------- */
/* Applies a subtle perspective rotation that tracks the pointer, giving
   cards a physical, tilt-toward-you feel. Purely decorative — resets on
   pointer leave. Skipped automatically for touch-only devices. */
function attachTilt(el, opts) {
  if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;
  const max = (opts && opts.max) || 8;
  const lift = (opts && opts.lift) || 10;
  el.style.willChange = "transform";
  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * max;
    const ry = (px - 0.5) * max;
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-${lift}px) translateZ(0)`;
  });
  el.addEventListener("mouseleave", () => { el.style.transform = ""; });
}

/* ---------------- per-level color theming ---------------- */
/* Sets --accent / --accent-dim / --accent-glow custom properties on any
   element (or the document root) so buttons, borders, and glows for that
   scope pick up the level's own color instead of the default green. */
function applyAccent(el, theme) {
  const target = el || document.documentElement;
  target.style.setProperty("--accent", theme.accent);
  target.style.setProperty("--accent-dim", theme.accent2);
  target.style.setProperty("--accent-glow", theme.accent + "33");
}

/* ---------------- misc helpers ---------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function formatDateNice(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
/* ambient colorful floating particles for hero/background atmosphere */
function spawnFloatParticles(count, symbols) {
  const glyphs = symbols || ["🫀", "❤", "⚡", "✦"];
  const colors = ["#22d3ee", "#fb923c", "#a78bfa", "#f472b6", "#fbbf24", "#39ff88"];
  for (let i = 0; i < (count || 14); i++) {
    const p = document.createElement("span");
    p.className = "float-particle";
    p.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    p.style.left = Math.random() * 100 + "vw";
    p.style.color = colors[Math.floor(Math.random() * colors.length)];
    p.style.fontSize = (10 + Math.random() * 14) + "px";
    p.style.animationDuration = (10 + Math.random() * 14) + "s";
    p.style.animationDelay = (Math.random() * 10) + "s";
    document.body.appendChild(p);
  }
}

function launchConfetti(container) {
  const colors = ["#39ff88", "#ffb020", "#eef3f0", "#1fce6b"];
  const wrap = document.createElement("div");
  wrap.className = "confetti";
  for (let i = 0; i < 60; i++) {
    const s = document.createElement("span");
    const size = 5 + Math.random() * 6;
    s.style.left = Math.random() * 100 + "vw";
    s.style.width = size + "px";
    s.style.height = size * 0.5 + "px";
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    s.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
    s.style.animationDelay = Math.random() * 0.4 + "s";
    wrap.appendChild(s);
  }
  (container || document.body).appendChild(wrap);
  setTimeout(() => wrap.remove(), 3600);
}
