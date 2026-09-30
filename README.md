# AI Rhythm Tutor — deploy steps for Sudharsanjana59/ecg-final-test

## 1. Get an Anthropic API key
console.anthropic.com → create a key. Never commit it to the repo.

## 2. Deploy the Worker
```
npm install -g wrangler
wrangler login
cd worker
wrangler secret put ANTHROPIC_API_KEY     # paste your key when prompted
wrangler deploy
```
This prints a URL like `https://ecg-rhythm-tutor.<your-subdomain>.workers.dev`.

## 3. Wire it to the frontend
Open `chatbot.js` (repo root) and set:
```js
const WORKER_URL = "https://ecg-rhythm-tutor.<your-subdomain>.workers.dev";
```
Commit + push. The chat button will appear on levels, game, instructions,
leaderboard, and certificate pages.

## Already set for you
- `ALLOWED_ORIGIN` in `worker.js` is set to `https://sudharsanjana59.github.io`
  (your Pages origin). If you're using a custom domain instead, update it.
- `ecg-knowledge.json` (repo root) was auto-generated from your actual
  `ecg-data.js` — all 20 current rhythms are already in there. If you add
  or remove a rhythm later, regenerate it or edit it by hand, then
  `wrangler deploy` again.

## Also fixed while I was in here
`certificate.html` had gotten doubled/corrupted (looked like two copies of
the file pasted together with an overlapping seam) — likely from a bad
copy-paste or merge at some point. I extracted the one clean, complete
copy and replaced the file with it. Everything it does (SVG certificate,
PNG download, print) is unchanged, just no longer duplicated.
