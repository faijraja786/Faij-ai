require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\\/+$/, "");
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://faijraja786.github.io")
  .split(",").map(s => s.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by Faij AI backend."));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "256kb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 15),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." }
});

app.get("/", (_req, res) => res.json({
  app: "Faij AI Backend", status: "running", endpoints: ["/health", "/api/chat"]
}));
app.get("/health", (_req, res) => res.json({ ok: true, configured: Boolean(API_KEY) }));

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    if (!API_KEY) return res.status(503).json({
      error: "AI is not configured yet. Add AI_API_KEY in your hosting environment variables."
    });

    const body = req.body || {};
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 30) {
      return res.status(400).json({ error: "messages must be an array with 1 to 30 items." });
    }
    const messages = [];
    for (const m of body.messages) {
      if (!m || !["user", "assistant"].includes(m.role) ||
          typeof m.content !== "string" || !m.content.trim() || m.content.length > 12000) {
        return res.status(400).json({ error: "Each message needs role user/assistant and text up to 12000 characters." });
      }
      messages.push({ role: m.role, content: m.content.trim() });
    }
    const systemPrompt = typeof body.systemPrompt === "string"
      ? body.systemPrompt.slice(0, 3000)
      : "You are Faij AI, a helpful, safe, clear student assistant. Explain concepts step by step, adapt to the student's level, and never claim you performed actions you did not perform.";

    const upstream = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 1200
      }),
      signal: AbortSignal.timeout(45000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("AI provider error:", upstream.status, data?.error?.message || "No details");
      return res.status(502).json({ error: "AI provider failed. Check provider, model name, API key, and billing settings." });
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "The AI provider returned an empty response." });
    }
    res.json({ reply: reply.trim(), model: AI_MODEL });
  } catch (error) {
    console.error("Chat request failed:", error.message);
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({ error: "The AI request timed out. Please try again." });
    }
    res.status(500).json({ error: "Unexpected backend error." });
  }
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origin is not allowed by Faij AI backend.") return res.status(403).json({ error: err.message });
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "Invalid JSON body." });
  console.error("Server error:", err?.message || err);
  res.status(500).json({ error: "Server error." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Faij AI backend listening on port ${PORT}`));
