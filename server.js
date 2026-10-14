require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.AI_API_KEY;

const AI_BASE_URL = (
  process.env.AI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai"
).replace(/\/+$/, "");

const AI_MODEL = process.env.AI_MODEL || "gemini-2.5-flash";

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://faijraja786.github.io"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by Faij AI backend."));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "256kb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 15),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please wait a minute and try again.",
  },
});

app.get("/", (_req, res) => {
  res.json({
    app: "Faij AI Backend",
    status: "running",
    provider: "Gemini",
    endpoints: ["/health", "/api/chat"],
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(API_KEY),
    provider: "Gemini",
    model: AI_MODEL,
  });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "AI_API_KEY is missing in the hosting environment.",
      });
    }

    const body = req.body || {};
    const inputMessages = body.messages;

    if (
      !Array.isArray(inputMessages) ||
      inputMessages.length < 1 ||
      inputMessages.length > 30
    ) {
      return res.status(400).json({
        error: "messages must be an array containing 1 to 30 messages.",
      });
    }

    const messages = [];

    for (const message of inputMessages) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim()
      ) {
        return res.status(400).json({
          error: "Each message must have a valid role and non-empty text.",
        });
      }

      messages.push({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content.trim().slice(0, 12000),
      });
    }

    const apiResponse = await fetch(
      `${AI_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are Faij AI, a helpful educational AI assistant. " +
                "Reply in Hindi when the user prefers Hindi. " +
                "Explain clearly, accurately, and step by step. " +
                "For coding questions, provide practical and correct code.",
            },
            ...messages,
          ],
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(45000),
      }
    );

    const responseText = await apiResponse.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = null;
    }

    if (!apiResponse.ok) {
      // Do not log API keys or expose secrets.
      console.error("Gemini API returned status:", apiResponse.status);

      if (apiResponse.status === 401 || apiResponse.status === 403) {
        return res.status(apiResponse.status).json({
          error:
            "Gemini authentication failed. Check that AI_API_KEY is a valid Gemini API key.",
        });
      }

      if (apiResponse.status === 429) {
        return res.status(429).json({
          error: "Gemini rate limit or quota reached. Try again later.",
        });
      }

      if (apiResponse.status === 404) {
        return res.status(502).json({
          error: "Gemini endpoint or model not found. Check AI_MODEL.",
        });
      }

      return res.status(502).json({
        error: "Gemini provider request failed.",
        providerStatus: apiResponse.status,
      });
    }

    const reply = result?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      console.error("Gemini response did not contain a text reply.");

      return res.status(502).json({
        error: "Gemini returned an empty or unexpected response.",
      });
    }

    return res.json({ reply: reply.trim() });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({
        error: "AI response timed out. Please try again.",
      });
    }

    console.error("Chat backend error:", error.message);

    return res.status(500).json({
      error: "Internal backend error. Check the server logs.",
    });
  }
});

app.use((err, _req, res, _next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request is too large.",
    });
  }

  console.error("Request error:", err.message);

  return res.status(500).json({
    error: "Request could not be processed.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Faij AI backend is running on port", PORT);
  console.log("AI provider: Gemini");
  console.log("AI model:", AI_MODEL);
});
