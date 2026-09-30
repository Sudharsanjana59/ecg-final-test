/**
 * ECG Pulse Match — AI Rhythm Tutor widget.
 * Injects a floating chat button + panel. Loaded on levels/game/
 * instructions/leaderboard/certificate pages (see each file's <script>
 * tags). SETUP: change WORKER_URL below once you've deployed the Worker
 * in /worker (see worker/README.md).
 */
(function () {
  const WORKER_URL = "/api/chat";

  const history = []; // { role: "user"|"assistant", content: string }
  let sending = false;

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  }

  function mount() {
    const launcher = el("button", { class: "ai-tutor-launcher", "aria-label": "Ask the Rhythm Tutor" }, "🩺💬");

    const panel = el(
      "div",
      { class: "ai-tutor-panel" },
      el(
        "div",
        { class: "ai-tutor-head" },
        el("span", {}, "🩺 Rhythm Tutor"),
        el("button", { class: "ai-tutor-close", "aria-label": "Close" }, "✕")
      ),
      el(
        "div",
        { class: "ai-tutor-body", id: "aiTutorBody" },
        el(
          "div",
          { class: "ai-tutor-msg ai-tutor-msg-bot" },
          "Ask me anything about the rhythms in this game — e.g. \"What's the difference between AFib and AFlutter?\" or \"Why is WPW dangerous?\""
        )
      ),
      el(
        "div",
        { class: "ai-tutor-input-row" },
        el("input", { type: "text", id: "aiTutorInput", placeholder: "Ask about a rhythm…", autocomplete: "off", maxlength: "300" }),
        el("button", { class: "ai-tutor-send", id: "aiTutorSend" }, "Send")
      )
    );

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    launcher.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) document.getElementById("aiTutorInput").focus();
    });
    panel.querySelector(".ai-tutor-close").addEventListener("click", () => panel.classList.remove("open"));

    const input = document.getElementById("aiTutorInput");
    const sendBtn = document.getElementById("aiTutorSend");
    const body = document.getElementById("aiTutorBody");

    function addMessage(role, text) {
      const msg = el("div", { class: `ai-tutor-msg ai-tutor-msg-${role === "user" ? "user" : "bot"}` }, text);
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
      return msg;
    }
    function addSources(names) {
      if (!names || !names.length) return;
      const line = el("div", { class: "ai-tutor-sources" }, "based on: " + names.join(", "));
      body.appendChild(line);
      body.scrollTop = body.scrollHeight;
    }

    async function send() {
      const question = input.value.trim();
      if (!question || sending) return;
      sending = true;
      input.value = "";
      addMessage("user", question);
      const typing = addMessage("bot", "…thinking");
      sendBtn.disabled = true;

      try {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, history }),
        });
        const data = await res.json();
        typing.remove();
        if (data.error) {
          addMessage("bot", "⚠️ " + data.error);
        } else {
          addMessage("bot", data.answer);
          addSources(data.sources);
          history.push({ role: "user", content: question });
          history.push({ role: "assistant", content: data.answer });
        }
      } catch (e) {
        typing.remove();
        addMessage("bot", "⚠️ Couldn't reach the tutor. Check your connection and try again.");
      } finally {
        sending = false;
        sendBtn.disabled = false;
        input.focus();
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
