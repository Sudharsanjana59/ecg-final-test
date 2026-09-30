/**
 * ECG Pulse Match — AI Rhythm Tutor backend (Cloudflare Worker).
 * Holds the Anthropic API key as a secret, retrieves the most relevant
 * rhythm(s) from ecg-knowledge.json (the "R" in RAG), and calls Claude.
 *
 * DEPLOY:
 *   npm install -g wrangler
 *   wrangler login
 *   cd worker
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler deploy
 * Then copy the deployed URL into WORKER_URL in chatbot.js (repo root).
 */
import KNOWLEDGE from "../ecg-knowledge.json";

// Auto-filled from your repo (Sudharsanjana59/ecg-final-test). If your
// GitHub Pages custom domain differs, update this.
const ALLOWED_ORIGIN = "https://sudharsanjana59.github.io";
const MODEL = "claude-sonnet-4-5-20250929";

function retrieve(question, topK = 3) {
  const stop = new Set(["the","a","an","is","are","of","in","on","what","how","why","does","do","which","to","and","or","for","with","it","this","that"]);
  const words = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));

  const scored = KNOWLEDGE.map((doc) => {
    const haystackName = (doc.name + " " + doc.id).toLowerCase();
    const haystackBody = doc.summary.toLowerCase();
    let score = 0;
    words.forEach((w) => {
      if (haystackName.includes(w)) score += 3;
      if (haystackBody.includes(w)) score += 1;
    });
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, topK);
  return top.length ? top.map((s) => s.doc) : [KNOWLEDGE[0]];
}

function buildSystemPrompt(retrievedDocs) {
  const context = retrievedDocs
    .map((d) => `### ${d.name} (${d.id})\nTypical rate: ${d.rate}\n${d.summary}`)
    .join("\n\n");

  return `You are the in-app "Rhythm Tutor" for ECG Pulse Match, a browser game that teaches ECG rhythm recognition across ${KNOWLEDGE.length} rhythms.

Answer ONLY questions about ECG rhythms, the rhythms listed in the reference material below, and how to play this game. If asked something unrelated (general medical advice, diagnosing a real patient, anything off-topic), politely decline and redirect to ECG rhythm education.

Keep answers short (2-5 sentences unless asked for more detail), written for someone learning ECG interpretation, not a cardiologist.

Ground your answer in this reference material when relevant. If it doesn't cover what's being asked, say so rather than inventing clinical facts.

REFERENCE MATERIAL:
${context}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
    if (request.method !== "POST") return json({ error: "Use POST" }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const question = (body.question || "").toString().trim().slice(0, 500);
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!question) return json({ error: "Missing 'question'" }, 400);

    const retrievedDocs = retrieve(question);
    const systemPrompt = buildSystemPrompt(retrievedDocs);
    const messages = [
      ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.content).slice(0, 1000) })),
      { role: "user", content: question },
    ];

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system: systemPrompt, messages }),
    });

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", await anthropicRes.text());
      return json({ error: "The tutor is unavailable right now. Try again in a moment." }, 502);
    }

    const data = await anthropicRes.json();
    const answer = (data.content || []).map((b) => b.text || "").join("").trim() || "Sorry, I couldn't come up with an answer.";
    return json({ answer, sources: retrievedDocs.map((d) => d.name) });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...corsHeaders() } });
}
