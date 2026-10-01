/**
 * ECG Pulse Match — AI Rhythm Tutor widget.
 * Injects a floating chat button + panel. Loaded on levels/game/
 * instructions/leaderboard/certificate pages (see each file's <script>
 * tags). SETUP: change WORKER_URL below once you've deployed the Worker
 * in /worker (see worker/README.md).
 */
(function () {
  const WORKER_URL = "/api/chat";
  const MAX_HISTORY = 10;       // last N messages sent back to the worker
  const TIMEOUT_MS = 30000;     // abort a hung request after 30s

  const SUGGESTIONS = [
    "AFib vs AFlutter?",
    "Why is WPW dangerous?",
    "What is a heart block?",
  ];

  let history = []; // { role: "user"|"assistant", content: string }
  let sending = false;

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) =>
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
    );
    return node;
  }

  const HEART_SVG = `
    <svg class="ai-heart" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
      <path fill="currentColor"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3
           c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42
           22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>`;

  function mount() {
    // Launcher: glowing, pulsing heart (static markup, safe for innerHTML)
    const launcher = el("button", {
      class: "ai-tutor-launcher ai-tutor-launcher-shine",
      type: "button",
      "aria-label": "Ask the Rhythm Tutor",
      "aria-expanded": "false",
    });
    launcher.innerHTML = HEART_SVG;

    const chips = el("div", { class: "ai-tutor-chips" });
    SUGGESTIONS.forEach((text) => {
      const chip = el("button", { class: "ai-tutor-chip", type: "button" }, text);
      chip.addEventListener("click", () => {
        input.value = text;
        send();
      });
      chips.appendChild(chip);
    });

    const panel = el(
      "div",
      { class: "ai-tutor-panel", role: "dialog", "aria-label": "Rhythm Tutor" },
      el(
        "div",
        { class: "ai-tutor-head" },
        el("span", {}, "🩺 Rhythm Tutor"),
        el("button", { class: "ai-tutor-close", type: "button", "aria-label": "Close" }, "✕")
      ),
      el(
        "div",
        { class: "ai-tutor-body", id: "aiTutorBody", "aria-live": "polite" },
        el(
          "div",
          { class: "ai-tutor-msg ai-tutor-msg-bot" },
          "Ask me anything about the rhythms in this game — e.g. \"What's the difference between AFib and AFlutter?\" or \"Why is WPW dangerous?\""
        )
      ),
      chips,
      el(
        "div",
        { class: "ai-tutor-input-row" },
        el("input", {
          type: "text",
          id: "aiTutorInput",
          placeholder: "Ask about a rhythm…",
          autocomplete: "off",
          maxlength: "300",
          "aria-label": "Your question",
        }),
        el("button", { class: "ai-tutor-send", id: "aiTutorSend", type: "button" }, "Send")
      )
    );

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    const input = document.getElementById("aiTutorInput");
    const sendBtn = document.getElementById("aiTutorSend");
    const body = document.getElementById("aiTutorBody");

    function setOpen(open) {
      panel.classList.toggle("open", open);
      launcher.setAttribute("aria-expanded", String(open));
      if (open) input.focus();
    }
    launcher.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
    panel.querySelector(".ai-tutor-close").addEventListener("click", () => {
      setOpen(false);
      launcher.focus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("open")) setOpen(false);
    });

    function addMessage(role, text) {
      const msg = el(
        "div",
        { class: `ai-tutor-msg ai-tutor-msg-${role === "user" ? "user" : "bot"}` },
        text
      );
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
    function setBusy(busy) {
      sending = busy;
      sendBtn.disabled = busy;
      input.disabled = busy;
    }

    async function send() {
      const question = input.value.trim();
      if (!question || sending) return;
      setBusy(true);
      input.value = "";
      chips.remove(); // suggestions only make sense before the first question
      addMessage("user", question);
      const typing = addMessage("bot", "…thinking");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, history }),
          signal: controller.signal,
        });

        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          /* non-JSON body */
        }

        typing.remove();

        if (!res.ok || !data || data.error) {
          const msg =
            (data && data.error) ||
            (res.status === 429
              ? "Too many questions — please wait a moment."
              : `The tutor had a problem (error ${res.status}). Try again.`);
          addMessage("bot", "⚠️ " + msg);
        } else {
          const answer = String(data.answer || "").trim();
          addMessage("bot", answer || "Sorry, I didn't get an answer. Try rephrasing.");
          addSources(data.sources);
          history.push({ role: "user", content: question });
          history.push({ role: "assistant", content: answer });
          history = history.slice(-MAX_HISTORY);
        }
      } catch (e) {
        typing.remove();
        addMessage(
          "bot",
          e.name === "AbortError"
            ? "⚠️ The tutor took too long to respond. Please try again."
            : "⚠️ Couldn't reach the tutor. Check your connection and try again."
        );
      } finally {
        clearTimeout(timer);
        setBusy(false);
        input.focus();
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
