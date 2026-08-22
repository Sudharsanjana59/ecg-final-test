# ECG Pulse Match 🫀

A drag-and-drop ECG rhythm identification puzzle game — sign in, drag the
correct diagnosis label onto each waveform, and climb the leaderboard.

## Run it
No build step, no server required.
1. Unzip the folder.
2. Double-click `index.html` to open it in your browser (or right-click →
   Open With → your browser). Works on desktop and mobile browsers.
3. Optional: serve it locally for the most reliable font loading:
   `npx serve .` or `python3 -m http.server`, then open the printed URL.

## How to play
1. **Sign in** with any name on the login screen (no password — this is a
   practice game, not a real authentication system).
   - Sign in with the name **admin** to open the admin dashboard instead.
2. **First time in**, you'll land on a **How to Play** page explaining the
   controls, scoring, and certificate/leaderboard before you touch a level.
   You can revisit it anytime from the "ℹ️ How to play" link on the levels
   screen.
3. **Pick a level** (1 → 20, one level per rhythm — Normal Sinus Rhythm,
   Atrial Flutter, Atrial Fibrillation, Ventricular Tachycardia,
   Ventricular Fibrillation, Torsades de Pointes, 2nd-Degree AV Block,
   Complete Heart Block, RBBB, LBBB, Brugada Syndrome, Long QT Syndrome,
   WPW Syndrome, Sick Sinus Syndrome, LVH, RVH, Premature Atrial
   Contraction, Premature Ventricular Contraction, Bigeminy, and
   Trigeminy). Each level unlocks after you get a perfect score on the one
   before it.
4. Each level shows one or more **named ECG strips, each missing its wave**
   — just a row of empty dashed slots. Below, a **tray of small ECG
   waveform pieces** — some are the real pieces that belong in that strip,
   others are decoy pieces borrowed from a different rhythm (same size, so
   they visually could fit, but the pattern is wrong).
5. **Drag** pieces from the tray into the empty slots to rebuild each
   strip, left to right. Tap-and-drag works the same on touch screens. You
   can drag a placed piece back out or swap it for another at any time.
6. Once every slot is filled, hit **Submit**. Each slot lights up green
   (correct piece, correct position) or red (wrong), and any incomplete
   strip reveals a hint explaining the real rhythm.
7. Your score is a **potential-score counter that ticks down every
   second** you're still playing, multiplied by your accuracy when you
   submit — so working both fast and correctly scores highest. A perfect
   rebuild unlocks the next level and adds an entry to the **Leaderboard**.
8. Clear all 20 levels to unlock a **Certificate of Completion**,
   downloadable as a PNG or printable as a PDF.

## Project structure
```
ecg-puzzle-game/
├── index.html          Login screen (animated ECG hero)
├── instructions.html   How to Play page, shown before a player's first level
├── levels.html         Level select screen
├── game.html            The puzzle itself (drag & drop, scoring, hints)
├── leaderboard.html     Public leaderboard
├── certificate.html     Certificate of Completion (PNG/PDF export)
├── admin.html           Admin dataset + leaderboard export (name = "admin")
├── style.css            Design system, layout, animations
├── ecg-data.js          THE DATASET — rhythm names, hints, level composition
├── ecg-svg.js           Procedurally draws each ECG rhythm as SVG (no images needed)
├── common.js            Session, leaderboard, cloud sync, and shared helpers
└── README.md
```
All CSS/JS files sit flat next to the HTML files — every `<link>`/`<script>`
tag references them directly (`style.css`, not `css/style.css`; `common.js`,
not `js/common.js`). If you ever reorganize files into subfolders, update
those tags to match, or every page will silently fail to load.

## Editing the dataset (for admins)
Everything about the rhythms and levels lives in `ecg-data.js`:
- `ECG_TYPES` — add/edit a rhythm's display name, difficulty, typical rate,
  and the hint shown after a wrong guess.
- `LEVELS` — control which rhythm IDs appear in each level, how many
  `segments` each strip is cut into (more segments = harder), and the
  `timeBonusSeconds` window the score countdown decays over.

No image files to replace — waveforms are generated in code
(`ecg-svg.js`) so you can also tweak wave shape/amplitude there.

## Playing across multiple devices (leaderboard & progress sync)
By default, everything (leaderboard, level progress, certificates) is
stored in the browser's `localStorage`/`sessionStorage` — **per device,
per browser**. That's a hard limit of a pure static site: two phones (or
a phone and a laptop) genuinely cannot see each other's data unless
*something* in the middle stores it centrally. There's no way around this
without some kind of backend.

This project now ships with an **optional, free, zero-build cloud sync**
that solves that, using nothing but plain `fetch()` calls (no SDK, no npm
install):

1. Go to https://console.firebase.google.com → create a project (free).
2. Left sidebar → Build → **Realtime Database** → Create Database → start
   in **test mode** (fine for a practice game with no real personal data).
3. Copy the **Database URL** shown, e.g.
   `https://your-project-id-default-rtdb.firebaseio.com`
4. Open `common.js` and paste it into the `CLOUD_DB_URL` constant near the
   top of the file:
   ```js
   const CLOUD_DB_URL = "https://your-project-id-default-rtdb.firebaseio.com";
   ```
5. Re-upload/redeploy. That's it.

Once set, every device:
- **Pushes** new scores, unlocked levels, and certificates to the cloud
  the moment they happen (fire-and-forget — never blocks or slows down
  gameplay, and silently falls back to local-only if the request fails,
  e.g. no internet).
- **Pulls** the shared cloud data on `leaderboard.html`, `admin.html`,
  `levels.html`, `certificate.html`, and `game.html` load, merging it into
  local storage (additive only — it never deletes anything local).

Leave `CLOUD_DB_URL` as `""` to keep the game exactly as it was —
fully local, fully offline, no account needed.

**Security note:** Realtime Database "test mode" rules are open
read/write to anyone with the URL, which is appropriate for a practice
game's leaderboard but not for anything sensitive. If you want to lock it
down later, add simple Firebase rules restricting writes to sane shapes —
this project doesn't use Firebase Auth, so keep the rules
data-shape-based rather than user-based.

## Notes on the waveforms
All ECG traces are synthetic, generated with math (Gaussian/triangle pulses
for P/QRS/T waves, sine sums for chaotic rhythms) rather than photographed
or scanned real strips — this keeps the game copyright-clean and lets every
wave scale crisply to any screen size. They are stylized for gameplay and
readability, not for clinical diagnosis.
