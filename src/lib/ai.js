import { cfg } from "./config.js";
import { log, safeErr } from "./log.js";
import { getBotProfile } from "./botProfile.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function readJson(response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

export function aiConfigured() {
  return Boolean(cfg.COOKMYBOTS_AI_ENDPOINT && cfg.COOKMYBOTS_AI_KEY);
}

export async function aiChat(messages, meta = {}) {
  if (!aiConfigured()) {
    return { ok: false, disabled: true, content: "" };
  }

  const allMessages = [
    { role: "system", content: getBotProfile() },
    ...messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 2500) })),
  ];

  const body = {
    messages: allMessages,
    meta: { platform: "telegram", feature: "market_explanation", ...meta },
  };

  const timeoutMs = Number(cfg.AI_TIMEOUT_MS || 600000);
  const retries = Math.max(0, Number(cfg.AI_MAX_RETRIES || 2));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = Date.now();
    const { signal, clear } = timeoutSignal(timeoutMs);
    try {
      log.info("ai.chat.start", { feature: meta.feature || "chat", attempt, configured: true });
      const response = await fetch(`${cfg.COOKMYBOTS_AI_ENDPOINT}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.COOKMYBOTS_AI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
      const { text, json } = await readJson(response);
      if (!response.ok) {
        const err = json?.error?.message || json?.message || json?.error || text || `HTTP ${response.status}`;
        throw new Error(String(err));
      }
      const content = json?.output?.content;
      if (!json?.ok || typeof content !== "string") {
        throw new Error("AI gateway returned no normalized output.content");
      }
      log.info("ai.chat.success", { feature: meta.feature || "chat", ms: Date.now() - started });
      return { ok: true, content };
    } catch (err) {
      log.error("ai.chat.failure", { feature: meta.feature || "chat", attempt, err: safeErr(err) });
      if (attempt >= retries) return { ok: false, error: safeErr(err), content: "" };
      await sleep(750 * (attempt + 1));
    } finally {
      clear();
    }
  }

  return { ok: false, content: "" };
}

export async function explainSignalWithAI(signal, context = {}) {
  const prompt = [
    "Explain this computed market analysis in plain educational language.",
    "Do not claim certainty. Do not provide financial advice. Mention that BUY, SELL, and NEUTRAL are analytical labels only.",
    JSON.stringify({ signal, context }).slice(0, 7000),
  ].join("\n");
  const result = await aiChat([{ role: "user", content: prompt }], { feature: "signal_explanation" });
  return result.ok ? result.content.slice(0, 1200) : "";
}
