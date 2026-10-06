/* =========================================================================
   COMMON.JS — ECG PULSE MATCH

   PLAYER ID SYSTEM
   ----------------
   A player is identified by:

       DEVICE ID + PLAYER NAME

   Example:

       Device A + Sudharsan
       Device A + Arun
       Device B + Sudharsan

   These are 3 separate players.

   Same device + same name
   -----------------------
   The player gets the same ID and continues their progress.

   Same device + different name
   ----------------------------
   A new player is created and starts from Level 1.

   Different device + same name
   ----------------------------
   A different player is created and starts from Level 1.

   This prevents two people using the same name on different devices
   from sharing their level progress.
   ========================================================================= */


/* =========================================================================
   FIREBASE
   ========================================================================= */

const CLOUD_DB_URL =
  const CLOUD_DB_URL =
  "https://ecg-puzzle-game-default-rtdb.firebaseio.com/";


/* =========================================================================
   LOCAL STORAGE KEYS
   ========================================================================= */

const LS_USER = "ecg_current_user";

const LS_DEVICE_ID = "ecg_device_id";

const LS_LEADERBOARD = "ecg_leaderboard";

const LS_PROGRESS = "ecg_progress";

const LS_CERTIFICATES = "ecg_certificates";

const LS_SEEN_INSTRUCTIONS = "ecg_seen_instructions";

const SS_ADMIN_PREVIEW = "ecg_admin_preview";


/* =========================================================================
   PLAYER / DEVICE ID
   ========================================================================= */

/*
   Creates one permanent ID for this browser/device.

   This ID is stored in localStorage.

   Example:

   ecg_device_id =
   "a7f7c4e9-9d7a-4a2a-9e4e-123456789abc"
*/

function getDeviceId() {

  let deviceId = localStorage.getItem(LS_DEVICE_ID);

  if (!deviceId) {

    if (window.crypto && crypto.randomUUID) {

      deviceId = crypto.randomUUID();

    } else {

      deviceId =
        "device_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2);

    }

    localStorage.setItem(LS_DEVICE_ID, deviceId);
  }

  return deviceId;
}


/*
   Creates the actual PLAYER ID.

   Example:

   Device:
   abc123

   Name:
   Sudharsan

   Player ID:
   abc123_sudharsan
*/

function getPlayerId(name) {

  const deviceId = getDeviceId();

  const cleanName = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[.#$[\]/]/g, "_");

  return deviceId + "_" + cleanName;
}


/* =========================================================================
   SESSION
   ========================================================================= */

function getCurrentUser() {

  try {

    const raw = sessionStorage.getItem(LS_USER);

    if (!raw) {
      return null;
    }

    const user = JSON.parse(raw);

    return user;

  } catch (e) {

    console.warn("Could not read current user:", e);

    return null;
  }
}


/*
   Login / set current user.

   IMPORTANT:
   We calculate the player ID from DEVICE + NAME.

   So changing the name creates a different player.
*/

function setCurrentUser(name) {

  name = String(name || "").trim();

  if (!name) {
    return null;
  }

  const deviceId = getDeviceId();

  const playerId = getPlayerId(name);

  const user = {

    id: playerId,

    userId: playerId,

    deviceId: deviceId,

    name: name,

    isAdmin:
      name.toLowerCase() === "adminisnarmi"
  };

  sessionStorage.setItem(
    LS_USER,
    JSON.stringify(user)
  );

  return user;
}


/* =========================================================================
   LOGOUT
   ========================================================================= */

function logout() {

  sessionStorage.removeItem(LS_USER);

  sessionStorage.removeItem(SS_ADMIN_PREVIEW);

  window.location.href = "index.html";
}


/* =========================================================================
   REQUIRE LOGIN
   ========================================================================= */

function requireLogin() {

  const user = getCurrentUser();

  if (!user) {

    window.location.href = "index.html";

    return null;
  }

  /*
     Backward compatibility.

     If an old session exists without ID,
     recreate the user with the new ID system.
  */

  if (!user.id || !user.deviceId) {

    return setCurrentUser(user.name);
  }

  return user;
}


/* =========================================================================
   FIRST TIME INSTRUCTIONS
   ========================================================================= */

function hasSeenInstructions() {

  return localStorage.getItem(
    LS_SEEN_INSTRUCTIONS
  ) === "1";
}


function markInstructionsSeen() {

  localStorage.setItem(
    LS_SEEN_INSTRUCTIONS,
    "1"
  );
}


/* =========================================================================
   ADMIN PREVIEW
   ========================================================================= */

function isAdminPreviewing() {

  return sessionStorage.getItem(
    SS_ADMIN_PREVIEW
  ) === "1";
}


function enterAdminPreview() {

  sessionStorage.setItem(
    SS_ADMIN_PREVIEW,
    "1"
  );
}


function exitAdminPreview() {

  sessionStorage.removeItem(
    SS_ADMIN_PREVIEW
  );
}


/* =========================================================================
   FIREBASE CLOUD FUNCTIONS
   ========================================================================= */

function cloudEnabled() {

  return !!CLOUD_DB_URL.trim();
}


function cloudBase() {

  return CLOUD_DB_URL
    .trim()
    .replace(/\/+$/, "");
}


/*
   Firebase keys cannot contain:

   .
   #
   $
   [
   ]
   /
   whitespace
*/

function cloudKeySafe(value) {

  return String(value || "")
    .trim()
    .replace(/[.#$[\]/\s]/g, "_")
    || "player";
}


/* =========================================================================
   FIREBASE GET
   ========================================================================= */

async function cloudGet(path) {

  if (!cloudEnabled()) {
    return undefined;
  }

  try {

    const res = await fetch(
      cloudBase() +
      path +
      ".json"
    );

    if (!res.ok) {

      console.warn(
        "Cloud GET failed:",
        res.status
      );

      return undefined;
    }

    return await res.json();

  } catch (e) {

    console.warn(
      "Cloud sync GET unavailable:",
      e
    );

    return undefined;
  }
}


/* =========================================================================
   FIREBASE PUT
   ========================================================================= */

async function cloudPut(path, value) {

  if (!cloudEnabled()) {
    return;
  }

  try {

    await fetch(
      cloudBase() +
      path +
      ".json",
      {

        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(value)
      }
    );

  } catch (e) {

    console.warn(
      "Cloud PUT failed:",
      e
    );
  }
}


/* =========================================================================
   FIREBASE POST
   ========================================================================= */

async function cloudPost(path, value) {

  if (!cloudEnabled()) {
    return;
  }

  try {

    await fetch(
      cloudBase() +
      path +
      ".json",
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(value)
      }
    );

  } catch (e) {

    console.warn(
      "Cloud POST failed:",
      e
    );
  }
}


/* =========================================================================
   FIREBASE DELETE
   ========================================================================= */

async function cloudDelete(path) {

  if (!cloudEnabled()) {
    return;
  }

  try {

    await fetch(
      cloudBase() +
      path +
      ".json",
      {
        method: "DELETE"
      }
    );

  } catch (e) {

    console.warn(
      "Cloud DELETE failed:",
      e
    );
  }
}


/* =========================================================================
   CLOUD SYNC
   ========================================================================= */

async function refreshFromCloud() {

  if (!cloudEnabled()) {
    return;
  }

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


    /* ================================================================
       LEADERBOARD
       ================================================================ */

    if (cloudBoard !== undefined) {

      const cloudRows =
        cloudBoard
          ? Object.values(cloudBoard)
              .filter(Boolean)
          : [];

      localStorage.setItem(
        LS_LEADERBOARD,
        JSON.stringify(cloudRows)
      );
    }


    /* ================================================================
       PROGRESS
       ================================================================ */

    if (cloudProgress !== undefined) {

      const merged = {};

      if (cloudProgress) {

        Object.values(cloudProgress)
          .filter(Boolean)
          .forEach((p) => {

            /*
               NEW FORMAT

               {
                 userId,
                 deviceId,
                 name,
                 unlocked
               }
            */

            if (!p.userId) {

              /*
                 IMPORTANT:

                 Ignore old records that only have:

                 {
                   name: "Sudharsan"
                 }

                 This prevents the old shared-name bug.
              */

              return;
            }


            merged[p.userId] = {

              userId: p.userId,

              deviceId:
                p.deviceId || "",

              name:
                p.name || "",

              unlocked:
                Number(p.unlocked) || 1

            };

          });
      }

      localStorage.setItem(
        LS_PROGRESS,
        JSON.stringify(merged)
      );
    }


    /* ================================================================
       CERTIFICATES
       ================================================================ */

    if (cloudCerts !== undefined) {

      const merged = {};

      if (cloudCerts) {

        Object.values(cloudCerts)
          .filter(Boolean)
          .forEach((record) => {

            /*
               New certificate records use userId.

               Ignore old name-only certificates.
            */

            if (!record.userId) {
              return;
            }

            merged[record.userId] = record;

          });
      }

      localStorage.setItem(
        LS_CERTIFICATES,
        JSON.stringify(merged)
      );
    }

  } catch (e) {

    console.warn(
      "Cloud refresh failed:",
      e
    );
  }
}


/* =========================================================================
   PROGRESS
   ========================================================================= */


/*
   Get current player's progress.

   IMPORTANT:
   We do NOT use:

       all[name]

   anymore.

   We use:

       all[userId]
*/

function getProgress(name) {

  const user = getCurrentUser();

  if (!user) {

    return {
      unlocked: 1
    };
  }


  const all =
    JSON.parse(
      localStorage.getItem(
        LS_PROGRESS
      ) || "{}"
    );


  const playerId =
    user.id || getPlayerId(name);


  return all[playerId] || {

    userId: playerId,

    deviceId:
      user.deviceId || getDeviceId(),

    name:
      user.name || name,

    unlocked: 1

  };
}


/* =========================================================================
   UNLOCK NEXT LEVEL
   ========================================================================= */

function unlockNextLevel(
  name,
  completedLevel
) {

  const user = getCurrentUser();

  if (!user) {
    return;
  }


  const all =
    JSON.parse(
      localStorage.getItem(
        LS_PROGRESS
      ) || "{}"
    );


  const playerId =
    user.id || getPlayerId(name);


  const current =
    all[playerId] || {

      userId: playerId,

      deviceId:
        user.deviceId || getDeviceId(),

      name:
        user.name || name,

      unlocked: 1

    };


  const nextLevel =
    Number(completedLevel) + 1;


  current.unlocked =
    Math.max(
      Number(current.unlocked) || 1,
      nextLevel
    );


  current.userId =
    playerId;


  current.deviceId =
    user.deviceId || getDeviceId();


  current.name =
    user.name || name;


  all[playerId] = current;


  localStorage.setItem(
    LS_PROGRESS,
    JSON.stringify(all)
  );


  /*
     IMPORTANT:

     Firebase path is now:

     /progress/DEVICEID_NAME

     NOT:

     /progress/Sudharsan
  */

  cloudPut(
    `/progress/${cloudKeySafe(playerId)}`,
    current
  );
}


/* =========================================================================
   CERTIFICATE ID
   ========================================================================= */

function makeCertId(
  name,
  timestamp
) {

  let h = 0;

  const str =
    name +
    "|" +
    timestamp;


  for (
    let i = 0;
    i < str.length;
    i++
  ) {

    h =
      (
        Math.imul(
          31,
          h
        ) +
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


/* =========================================================================
   COURSE COMPLETE
   ========================================================================= */

function isCourseComplete(name) {

  return (
    getProgress(name).unlocked >
    LEVELS.length
  );
}


/* =========================================================================
   ISSUE CERTIFICATE
   ========================================================================= */

function getOrIssueCertificate(name) {

  if (!isCourseComplete(name)) {
    return null;
  }


  const user =
    getCurrentUser();


  if (!user) {
    return null;
  }


  const all =
    JSON.parse(
      localStorage.getItem(
        LS_CERTIFICATES
      ) || "{}"
    );


  const playerId =
    user.id || getPlayerId(name);


  /*
     If certificate already exists,
     return it.
  */

  if (all[playerId]) {

    return all[playerId];
  }


  const timestamp =
    new Date().toISOString();


  /*
     Calculate score only for THIS player.
  */

  const board =
    getLeaderboard()
      .filter(
        (r) =>
          r.userId === playerId
      );


  const bestByLevel = {};


  board.forEach((r) => {

    const level =
      Number(r.level);


    /*
       Ignore invalid old levels.

       Your intended course is LEVELS.length.
    */

    if (
      !Number.isFinite(level) ||
      level < 1 ||
      level > LEVELS.length
    ) {
      return;
    }


    if (
      !bestByLevel[level] ||
      Number(r.score) >
        Number(bestByLevel[level])
    ) {

      bestByLevel[level] =
        Number(r.score) || 0;
    }

  });


  const totalScore =
    Object.values(
      bestByLevel
    ).reduce(
      (a, b) => a + b,
      0
    );


  const record = {

    userId: playerId,

    deviceId:
      user.deviceId || getDeviceId(),

    name: name,

    completedAt:
      timestamp,

    certId:
      makeCertId(
        name,
        timestamp
      ),

    levelsCompleted:
      LEVELS.length,

    totalScore:
      totalScore

  };


  all[playerId] =
    record;


  localStorage.setItem(
    LS_CERTIFICATES,
    JSON.stringify(all)
  );


  cloudPut(
    `/certificates/${cloudKeySafe(playerId)}`,
    record
  );


  return record;
}


/* =========================================================================
   GET CERTIFICATE
   ========================================================================= */

function getCertificate(name) {

  const user =
    getCurrentUser();


  if (!user) {
    return null;
  }


  const all =
    JSON.parse(
      localStorage.getItem(
        LS_CERTIFICATES
      ) || "{}"
    );


  const playerId =
    user.id || getPlayerId(name);


  return (
    all[playerId] ||
    null
  );
}


/* =========================================================================
   LEADERBOARD
   ========================================================================= */

function getLeaderboard() {

  return JSON.parse(
    localStorage.getItem(
      LS_LEADERBOARD
    ) || "[]"
  );
}


/* =========================================================================
   ADD LEADERBOARD ENTRY
   ========================================================================= */

function addLeaderboardEntry(entry) {

  const user =
    getCurrentUser();


  if (!user) {
    return;
  }


  const board =
    getLeaderboard();


  const full = {

    ...entry,

    /*
       VERY IMPORTANT:

       Every score now contains the
       unique player ID.
    */

    userId:
      user.id || getPlayerId(user.name),

    deviceId:
      user.deviceId || getDeviceId(),

    name:
      user.name,

    timestamp:
      new Date().toISOString()

  };


  board.push(full);


  localStorage.setItem(
    LS_LEADERBOARD,
    JSON.stringify(board)
  );


  /*
     Cloud leaderboard.

     Each attempt gets a Firebase
     generated key using POST.
  */

  cloudPost(
    "/leaderboard",
    full
  );
}


/* =========================================================================
   TOP SCORES
   ========================================================================= */

function topScores(limit) {

  return getLeaderboard()

    .filter((r) => {

      const level =
        Number(r.level);

      return (
        level >= 1 &&
        level <= LEVELS.length
      );

    })

    .sort(
      (a, b) =>
        (Number(b.score) -
          Number(a.score)) ||
        (
          Number(a.timeTakenSec) -
          Number(b.timeTakenSec)
        )
    )

    .slice(
      0,
      limit || 50
    );
}


/* =========================================================================
   PLAYER LEADERBOARD
   ========================================================================= */

/*
   ONE ROW PER UNIQUE PLAYER.

   Because userId contains:

       DEVICE + NAME

   two people called Sudharsan can now
   exist separately.

   Example:

       Device A + Sudharsan
       Device B + Sudharsan

   will be two different rows.
*/

function getPlayerLeaderboard() {

  const rows =
    getLeaderboard();


  const byPlayer = {};


  rows.forEach((r) => {

    const level =
      Number(r.level);


    /*
       Ignore invalid levels such as
       Level 21 / Level 22 if your course
       has only 20 levels.
    */

    if (
      !Number.isFinite(level) ||
      level < 1 ||
      level > LEVELS.length
    ) {

      return;
    }


    /*
       Old leaderboard entries may not
       have userId.

       We skip those because they cannot
       reliably identify the player.
    */

    if (!r.userId) {
      return;
    }


    const playerId =
      r.userId;


    if (!byPlayer[playerId]) {

      byPlayer[playerId] = {

        userId:
          playerId,

        name:
          r.name || "Unknown",

        deviceId:
          r.deviceId || "",

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


    /*
       BEST SCORE FOR EACH LEVEL
    */

    if (
      !p.bestByLevel[level] ||
      Number(r.score) >
        Number(p.bestByLevel[level])
    ) {

      p.bestByLevel[level] =
        Number(r.score) || 0;
    }


    /*
       BEST MARKS FOR EACH LEVEL
    */

    if (
      r.marks != null &&
      (
        !p.bestMarksByLevel[level] ||
        Number(r.marks) >
          Number(
            p.bestMarksByLevel[level]
          )
      )
    ) {

      p.bestMarksByLevel[level] =
        Number(r.marks) || 0;
    }


    /*
       BEST SINGLE SCORE
    */

    if (
      Number(r.score) >
      Number(p.bestSingle)
    ) {

      p.bestSingle =
        Number(r.score) || 0;
    }


    /*
       LAST PLAYED
    */

    if (
      !p.lastPlayed ||
      new Date(r.timestamp) >
        new Date(p.lastPlayed)
    ) {

      p.lastPlayed =
        r.timestamp;
    }

  });


  return Object.values(
    byPlayer
  )

    .map((p) => {

      return {

        ...p,

        totalPoints:
          Object.values(
            p.bestByLevel
          ).reduce(
            (a, b) =>
              Number(a) +
              Number(b),
            0
          ),

        totalMarks:
          Object.values(
            p.bestMarksByLevel
          ).reduce(
            (a, b) =>
              Number(a) +
              Number(b),
            0
          ),

        maxMarks:
          LEVELS.length * 10,

        levelsPlayed:
          Object.keys(
            p.bestByLevel
          ).length

      };

    })

    .sort(
      (a, b) =>
        b.totalPoints -
        a.totalPoints
    );
}


/* =========================================================================
   EXPORT LEADERBOARD CSV
   ========================================================================= */

function exportLeaderboardCSV() {

  const rows =
    getLeaderboard();


  const headers = [

    "userId",

    "deviceId",

    "name",

    "level",

    "score",

    "marks",

    "correct",

    "total",

    "timeTakenSec",

    "timestamp"

  ];


  const csv = [

    headers.join(","),

    ...rows.map((r) =>

      headers
        .map(
          (h) =>
            JSON.stringify(
              r[h] ?? ""
            )
        )
        .join(",")
    )

  ].join("\n");


  return csv;
}


/* =========================================================================
   DOWNLOAD FILE
   ========================================================================= */

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
    URL.createObjectURL(blob);


  const a =
    document.createElement("a");


  a.href = url;

  a.download =
    filename;


  a.click();


  URL.revokeObjectURL(url);
}


/* =========================================================================
   3D TILT EFFECT
   ========================================================================= */

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
    (opts && opts.max) ||
    8;


  const lift =
    (opts && opts.lift) ||
    10;


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
        `perspective(900px)
         rotateX(${rx.toFixed(2)}deg)
         rotateY(${ry.toFixed(2)}deg)
         translateY(-${lift}px)
         translateZ(0)`;
    }
  );


  el.addEventListener(
    "mouseleave",
    () => {

      el.style.transform =
        "";
    }
  );
}


/* =========================================================================
   LEVEL ACCENT
   ========================================================================= */

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


/* =========================================================================
   ESCAPE HTML
   ========================================================================= */

function escapeHtml(str) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    String(str ?? "");


  return div.innerHTML;
}


/* =========================================================================
   SHUFFLE
   ========================================================================= */

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
    ] =
    [
      a[j],
      a[i]
    ];
  }


  return a;
}


/* =========================================================================
   FORMAT TIME
   ========================================================================= */

function formatTime(sec) {

  const m =
    Math.floor(
      sec / 60
    )
    .toString()
    .padStart(2, "0");


  const s =
    Math.floor(
      sec % 60
    )
    .toString()
    .padStart(2, "0");


  return `${m}:${s}`;
}


/* =========================================================================
   FORMAT DATE
   ========================================================================= */

function formatDateNice(
  iso
) {

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


/* =========================================================================
   FLOATING PARTICLES
   ========================================================================= */

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
      10 +
      Math.random() *
      14 +
      "px";


    p.style.animationDuration =
      10 +
      Math.random() *
      14 +
      "s";


    p.style.animationDelay =
      Math.random() *
      10 +
      "s";


    document.body.appendChild(p);
  }
}


/* =========================================================================
   CONFETTI
   ========================================================================= */

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
      Math.random() *
      6;


    s.style.left =
      Math.random() *
      100 +
      "vw";


    s.style.width =
      size +
      "px";


    s.style.height =
      size *
      0.5 +
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
      Math.random() *
      1.4 +
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
  ).appendChild(
    wrap
  );


  setTimeout(
    () => wrap.remove(),
    3600
  );
       }
