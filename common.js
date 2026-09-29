/* =========================================================================
   COMMON.JS — session, leaderboard storage, cloud sync, and shared helpers.

   USER ID FIX:
   - Each browser/device gets a persistent unique DEVICE USER ID.
   - Same device + same name = same progress.
   - Different device + same name = separate progress.
   - Progress is stored in Firebase using userId, NOT name.
   ========================================================================= */

const CLOUD_DB_URL = "https://ecg-final-test-default-rtdb.firebaseio.com/";

const LS_USER = "ecg_current_user";
const LS_DEVICE_ID = "ecg_device_user_id";

const LS_LEADERBOARD = "ecg_leaderboard";
const LS_PROGRESS = "ecg_progress";
const LS_CERTIFICATES = "ecg_certificates";
const LS_SEEN_INSTRUCTIONS = "ecg_seen_instructions";

const SS_ADMIN_PREVIEW = "ecg_admin_preview";


/* ============================================================
   DEVICE / USER ID
   ============================================================ */

/*
   Creates one permanent ID for this browser/device.

   Example:

   Mobile A:
   device_user_abc123

   Mobile B:
   device_user_xyz789

   Even if both users type "Sudharsan",
   their progress remains separate.
*/
function getDeviceUserId() {
  let id = localStorage.getItem(LS_DEVICE_ID);

  if (!id) {
    if (window.crypto && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id =
        "device_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).substring(2, 12);
    }

    localStorage.setItem(LS_DEVICE_ID, id);
  }

  return id;
}


/* ============================================================
   SESSION
   ============================================================ */

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(LS_USER));
  } catch (e) {
    return null;
  }
}


/*
   IMPORTANT:

   Calling setCurrentUser("Sudharsan") again on the same device
   will reuse the same device ID.

   Therefore:

   Login → Sudharsan → Level 5
   Logout
   Login → Sudharsan → Level 5
*/
function setCurrentUser(name) {
  const cleanName = String(name || "").trim();

  const userId = getDeviceUserId();

  const user = {
    id: userId,
    name: cleanName,
    isAdmin: cleanName.toLowerCase() === "adminisnarmi"
  };

  sessionStorage.setItem(LS_USER, JSON.stringify(user));

  return user;
}


function logout() {
  sessionStorage.removeItem(LS_USER);
  sessionStorage.removeItem(SS_ADMIN_PREVIEW);

  window.location.href = "index.html";
}


function requireLogin() {
  const u = getCurrentUser();

  if (!u) {
    window.location.href = "index.html";
    return null;
  }

  /*
     Older sessions may not have an ID.
     Give them the current device ID.
  */
  if (!u.id) {
    u.id = getDeviceUserId();
    sessionStorage.setItem(LS_USER, JSON.stringify(u));
  }

  return u;
}


/* ============================================================
   FIRST-TIME INSTRUCTIONS
   ============================================================ */

function hasSeenInstructions() {
  return localStorage.getItem(LS_SEEN_INSTRUCTIONS) === "1";
}


function markInstructionsSeen() {
  localStorage.setItem(LS_SEEN_INSTRUCTIONS, "1");
}


/* ============================================================
   ADMIN PREVIEW
   ============================================================ */

function isAdminPreviewing() {
  return sessionStorage.getItem(SS_ADMIN_PREVIEW) === "1";
}


function enterAdminPreview() {
  sessionStorage.setItem(SS_ADMIN_PREVIEW, "1");
}


function exitAdminPreview() {
  sessionStorage.removeItem(SS_ADMIN_PREVIEW);
}


/* ============================================================
   CLOUD SYNC
   ============================================================ */

function cloudEnabled() {
  return !!CLOUD_DB_URL.trim();
}


function cloudBase() {
  return CLOUD_DB_URL.trim().replace(/\/+$/, "");
}


/*
   Firebase keys cannot contain:
   . # $ [ ] / or whitespace
*/
function cloudKeySafe(value) {
  return (
    String(value)
      .replace(/[.#$\[\]\/\s]/g, "_") ||
    "user"
  );
}


async function cloudGet(path) {
  if (!cloudEnabled()) return undefined;

  try {
    const res = await fetch(
      cloudBase() + path + ".json"
    );

    if (!res.ok) return undefined;

    return await res.json();

  } catch (e) {
    console.warn(
      "Cloud sync (get) unavailable:",
      e
    );

    return undefined;
  }
}


async function cloudPut(path, value) {
  if (!cloudEnabled()) return;

  try {
    await fetch(
      cloudBase() + path + ".json",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(value)
      }
    );

  } catch (e) {
    console.warn(
      "Cloud sync (put) failed:",
      e
    );
  }
}


async function cloudPost(path, value) {
  if (!cloudEnabled()) return;

  try {
    await fetch(
      cloudBase() + path + ".json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(value)
      }
    );

  } catch (e) {
    console.warn(
      "Cloud sync (post) failed:",
      e
    );
  }
}


async function cloudDelete(path) {
  if (!cloudEnabled()) return;

  try {
    await fetch(
      cloudBase() + path + ".json",
      {
        method: "DELETE"
      }
    );

  } catch (e) {
    console.warn(
      "Cloud sync (delete) failed:",
      e
    );
  }
}


/* ============================================================
   CLOUD REFRESH
   ============================================================ */

/*
   IMPORTANT FIX:

   OLD:
       merged[p.name]

   NEW:
       merged[p.userId]

   Therefore two different devices can use the same name
   without sharing progress.
*/
async function refreshFromCloud() {

  if (!cloudEnabled()) return;

  try {

    const [
      cloudBoard,
      cloudProgress,
      cloudCerts
    ] = await Promise.all([
      cloudGet("/leaderboard"),
      cloudGet("/progress"),
      cloudGet("/certificates")
    ]);


    /* ---------------- leaderboard ---------------- */

    if (cloudBoard !== undefined) {

      const cloudRows =
        cloudBoard
          ? Object.values(cloudBoard).filter(Boolean)
          : [];

      localStorage.setItem(
        LS_LEADERBOARD,
        JSON.stringify(cloudRows)
      );
    }


    /* ---------------- progress ---------------- */

    if (cloudProgress !== undefined) {

      const merged = {};

      if (cloudProgress) {

        Object.values(cloudProgress)
          .filter(Boolean)
          .forEach((p) => {

            /*
               New records use userId.
            */

            if (p.userId) {

              merged[p.userId] = {
                userId: p.userId,
                name: p.name || "",
                unlocked: p.unlocked || 1
              };

              return;
            }


            /*
               Old records created before this fix
               used name instead of userId.

               We deliberately do NOT copy old name-based
               records into the new identity system.

               This prevents the old shared-name bug from
               continuing.
            */
          });
      }

      localStorage.setItem(
        LS_PROGRESS,
        JSON.stringify(merged)
      );
    }


    /* ---------------- certificates ---------------- */

    if (cloudCerts !== undefined) {

      const merged = {};

      if (cloudCerts) {

        Object.values(cloudCerts)
          .filter(Boolean)
          .forEach((rec) => {

            if (rec.userId) {

              merged[rec.userId] = rec;
            }
          });
      }

      localStorage.setItem(
        LS_CERTIFICATES,
        JSON.stringify(merged)
      );
    }

  } catch (e) {

    console.warn(
      "Cloud sync (refresh) failed:",
      e
    );
  }
}


/* ============================================================
   PROGRESS
   ============================================================ */


/*
   Get the current logged-in user's unique ID.
*/
function getCurrentUserId() {

  const user = getCurrentUser();

  if (user && user.id) {
    return user.id;
  }

  return getDeviceUserId();
}


/*
   Get progress using USER ID.

   The function still accepts "name" because your existing
   levels.html / game.html may call:

       getProgress(user.name)

   We ignore the name for identity purposes.
*/
function getProgress(name) {

  const all =
    JSON.parse(
      localStorage.getItem(LS_PROGRESS) || "{}"
    );

  const userId = getCurrentUserId();

  return (
    all[userId] || {
      userId,
      name: name || "",
      unlocked: 1
    }
  );
}


/*
   Unlock next level.

   Existing game.html can continue using:

       unlockNextLevel(user.name, level.level)

   But internally we now save by userId.
*/
function unlockNextLevel(name, completedLevel) {

  const all =
    JSON.parse(
      localStorage.getItem(LS_PROGRESS) || "{}"
    );

  const userId = getCurrentUserId();


  const cur =
    all[userId] || {
      userId,
      name: name || "",
      unlocked: 1
    };


  cur.userId = userId;

  /*
     Keep latest display name.
  */
  if (name) {
    cur.name = name;
  }


  cur.unlocked = Math.max(
    cur.unlocked,
    completedLevel + 1
  );


  all[userId] = cur;


  localStorage.setItem(
    LS_PROGRESS,
    JSON.stringify(all)
  );


  /*
     IMPORTANT:
     Firebase path uses userId, NOT name.
  */
  cloudPut(
    `/progress/${cloudKeySafe(userId)}`,
    {
      userId,
      name: cur.name,
      unlocked: cur.unlocked
    }
  );
}


/* ============================================================
   COURSE COMPLETION
   ============================================================ */

function isCourseComplete(name) {

  return (
    getProgress(name).unlocked >
    LEVELS.length
  );
}


/* ============================================================
   CERTIFICATE
   ============================================================ */

function makeCertId(name, timestamp) {

  let h = 0;

  const str =
    name + "|" + timestamp;

  for (
    let i = 0;
    i < str.length;
    i++
  ) {

    h =
      (
        Math.imul(31, h) +
        str.charCodeAt(i)
      ) | 0;
  }

  const code =
    Math.abs(h)
      .toString(36)
      .toUpperCase()
      .padStart(6, "0")
      .slice(0, 6);

  return `ECG-${code}`;
}


/*
   Certificate is now stored by userId.
*/
function getOrIssueCertificate(name) {

  if (!isCourseComplete(name)) {
    return null;
  }


  const all =
    JSON.parse(
      localStorage.getItem(
        LS_CERTIFICATES
      ) || "{}"
    );


  const userId =
    getCurrentUserId();


  if (all[userId]) {
    return all[userId];
  }


  const timestamp =
    new Date().toISOString();


  /*
     Only include this user's leaderboard records.
  */
  const board =
    getLeaderboard().filter(
      (r) =>
        r.userId === userId
    );


  const bestByLevel = {};


  board.forEach((r) => {

    if (
      !bestByLevel[r.level] ||
      r.score > bestByLevel[r.level]
    ) {

      bestByLevel[r.level] =
        r.score;
    }
  });


  const totalScore =
    Object.values(bestByLevel)
      .reduce(
        (a, b) => a + b,
        0
      );


  const record = {

    userId,

    name,

    completedAt:
      timestamp,

    certId:
      makeCertId(
        name,
        timestamp
      ),

    levelsCompleted:
      LEVELS.length,

    totalScore
  };


  all[userId] = record;


  localStorage.setItem(
    LS_CERTIFICATES,
    JSON.stringify(all)
  );


  cloudPut(
    `/certificates/${cloudKeySafe(userId)}`,
    record
  );


  return record;
}


function getCertificate(name) {

  const all =
    JSON.parse(
      localStorage.getItem(
        LS_CERTIFICATES
      ) || "{}"
    );


  const userId =
    getCurrentUserId();


  return (
    all[userId] || null
  );
}


/* ============================================================
   LEADERBOARD
   ============================================================ */

function getLeaderboard() {

  return JSON.parse(
    localStorage.getItem(
      LS_LEADERBOARD
    ) || "[]"
  );
}


function addLeaderboardEntry(entry) {

  const board =
    getLeaderboard();


  const userId =
    getCurrentUserId();


  const full = {

    ...entry,

    userId,

    timestamp:
      new Date().toISOString()
  };


  board.push(full);


  localStorage.setItem(
    LS_LEADERBOARD,
    JSON.stringify(board)
  );


  cloudPost(
    "/leaderboard",
    full
  );
}


function topScores(limit) {

  return getLeaderboard()
    .sort(
      (a, b) =>
        (b.score - a.score) ||
        (a.timeTakenSec -
          b.timeTakenSec)
    )
    .slice(
      0,
      limit || 50
    );
}


/* ============================================================
   PLAYER LEADERBOARD
   ============================================================ */

function getPlayerLeaderboard() {

  const rows =
    getLeaderboard();


  const byPlayer = {};


  rows.forEach((r) => {

    /*
       IMPORTANT:
       Group by userId, not name.
    */
    const playerId =
      r.userId ||
      ("legacy_" + r.name);


    if (!byPlayer[playerId]) {

      byPlayer[playerId] = {

        userId:
          playerId,

        name:
          r.name,

        bestByLevel: {},

        bestMarksByLevel: {},

        bestSingle: 0,

        lastPlayed:
          r.timestamp,

        attempts: 0
      };
    }


    const p =
      byPlayer[playerId];


    p.attempts++;


    if (
      !p.bestByLevel[r.level] ||
      r.score >
        p.bestByLevel[r.level]
    ) {

      p.bestByLevel[r.level] =
        r.score;
    }


    if (
      r.marks != null &&
      (
        !p.bestMarksByLevel[r.level] ||
        r.marks >
          p.bestMarksByLevel[r.level]
      )
    ) {

      p.bestMarksByLevel[r.level] =
        r.marks;
    }


    if (
      r.score >
      p.bestSingle
    ) {

      p.bestSingle =
        r.score;
    }


    if (
      new Date(r.timestamp) >
      new Date(p.lastPlayed)
    ) {

      p.lastPlayed =
        r.timestamp;
    }
  });


  return Object.values(byPlayer)

    .map((p) => ({

      ...p,

      totalPoints:
        Object.values(
          p.bestByLevel
        ).reduce(
          (a, b) => a + b,
          0
        ),

      totalMarks:
        Object.values(
          p.bestMarksByLevel
        ).reduce(
          (a, b) => a + b,
          0
        ),

      maxMarks:
        LEVELS.length * 10,

      levelsPlayed:
        Object.keys(
          p.bestByLevel
        ).length
    }))

    .sort(
      (a, b) =>
        b.totalPoints -
        a.totalPoints
    );
}


/* ============================================================
   EXPORT LEADERBOARD CSV
   ============================================================ */

function exportLeaderboardCSV() {

  const rows =
    getLeaderboard();


  const headers = [
    "userId",
    "name",
    "level",
    "score",
    "marks",
    "correct",
    "total",
    "timeTakenSec",
    "timestamp"
  ];


  const csv =
    [
      headers.join(",")
    ]
      .concat(
        rows.map((r) =>
          headers
            .map(
              (h) =>
                JSON.stringify(
                  r[h] ?? ""
                )
            )
            .join(",")
        )
      )
      .join("\n");


  return csv;
}


/* ============================================================
   DOWNLOAD FILE
   ============================================================ */

function downloadFile(
  filename,
  content,
  type
) {

  const blob =
    new Blob(
      [content],
      {
        type:
          type ||
          "text/plain"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement(
      "a"
    );


  a.href = url;

  a.download =
    filename;

  a.click();


  URL.revokeObjectURL(
    url
  );
}


/* ============================================================
   3D TILT
   ============================================================ */

function attachTilt(
  el,
  opts
) {

  if (
    window.matchMedia &&
    window.matchMedia(
      "(hover: none)"
    ).matches
  ) {

    return;
  }


  const max =
    (opts && opts.max) || 8;


  const lift =
    (opts && opts.lift) || 10;


  el.style.willChange =
    "transform";


  el.addEventListener(
    "mousemove",
    (e) => {

      const r =
        el.getBoundingClientRect();


      const px =
        (e.clientX - r.left) /
        r.width;


      const py =
        (e.clientY - r.top) /
        r.height;


      const rx =
        (0.5 - py) *
        max;


      const ry =
        (px - 0.5) *
        max;


      el.style.transform =
        `perspective(900px) ` +
        `rotateX(${rx.toFixed(2)}deg) ` +
        `rotateY(${ry.toFixed(2)}deg) ` +
        `translateY(-${lift}px) ` +
        `translateZ(0)`;
    }
  );


  el.addEventListener(
    "mouseleave",
    () => {
      el.style.transform = "";
    }
  );
}


/* ============================================================
   PER LEVEL COLOR THEME
   ============================================================ */

function applyAccent(
  el,
  theme
) {

  const target =
    el ||
    document.documentElement;


  target.style.setProperty(
    "--accent",
    theme.accent
  );


  target.style.setProperty(
    "--accent-dim",
    theme.accent2
  );


  target.style.setProperty(
    "--accent-glow",
    theme.accent + "33"
  );
}


/* ============================================================
   HTML ESCAPE
   ============================================================ */

function escapeHtml(str) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    String(str ?? "");


  return div.innerHTML;
}


/* ============================================================
   SHUFFLE
   ============================================================ */

function shuffle(arr) {

  const a =
    arr.slice();


  for (
    let i = a.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      a[i],
      a[j]
    ] = [
      a[j],
      a[i]
    ];
  }


  return a;
}


/* ============================================================
   FORMAT TIME
   ============================================================ */

function formatTime(sec) {

  const m =
    Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");


  const s =
    Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");


  return `${m}:${s}`;
}


/* ============================================================
   FORMAT DATE
   ============================================================ */

function formatDateNice(iso) {

  const d =
    new Date(iso);


  return d.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  );
}


/* ============================================================
   FLOATING PARTICLES
   ============================================================ */

function spawnFloatParticles(
  count,
  symbols
) {

  const glyphs =
    symbols ||
    [
      "🫀",
      "❤",
      "⚡",
      "✦"
    ];


  const colors = [
    "#22d3ee",
    "#fb923c",
    "#a78bfa",
    "#f472b6",
    "#fbbf24",
    "#39ff88"
  ];


  for (
    let i = 0;
    i < (count || 14);
    i++
  ) {

    const p =
      document.createElement(
        "span"
      );


    p.className =
      "float-particle";


    p.textContent =
      glyphs[
        Math.floor(
          Math.random() *
          glyphs.length
        )
      ];


    p.style.left =
      Math.random() *
      100 +
      "vw";


    p.style.color =
      colors[
        Math.floor(
          Math.random() *
          colors.length
        )
      ];


    p.style.fontSize =
      (
        10 +
        Math.random() *
        14
      ) +
      "px";


    p.style.animationDuration =
      (
        10 +
        Math.random() *
        14
      ) +
      "s";


    p.style.animationDelay =
      (
        Math.random() *
        10
      ) +
      "s";


    document.body.appendChild(
      p
    );
  }
}


/* ============================================================
   CONFETTI
   ============================================================ */

function launchConfetti(
  container
) {

  const colors = [
    "#39ff88",
    "#ffb020",
    "#eef3f0",
    "#1fce6b"
  ];


  const wrap =
    document.createElement(
      "div"
    );


  wrap.className =
    "confetti";


  for (
    let i = 0;
    i < 60;
    i++
  ) {

    const s =
      document.createElement(
        "span"
      );


    const size =
      5 +
      Math.random() * 6;


    s.style.left =
      Math.random() *
      100 +
      "vw";


    s.style.width =
      size + "px";


    s.style.height =
      size * 0.5 +
      "px";


    s.style.background =
      colors[
        Math.floor(
          Math.random() *
          colors.length
        )
      ];


    s.style.animationDuration =
      1.8 +
      Math.random() * 1.4 +
      "s";


    s.style.animationDelay =
      Math.random() *
      0.4 +
      "s";


    wrap.appendChild(s);
  }


  (
    container ||
    document.body
  ).appendChild(wrap);


  setTimeout(
    () => wrap.remove(),
    3600
  );
}
