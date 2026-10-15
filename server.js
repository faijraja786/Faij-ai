require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "gemini-2.5-flash";

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://faijraja786.github.io"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(AI_MODEL)}:generateContent`;

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed."));
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
    model: AI_MODEL,
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

    const inputMessages = req.body?.messages;

    if (
      !Array.isArray(inputMessages) ||
      inputMessages.length < 1 ||
      inputMessages.length > 30
    ) {
      return res.status(400).json({
        error: "messages must be an array containing 1 to 30 messages.",
      });
    }

    const contents = [];

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

      const text = message.content.trim().slice(0, 12000);

      // Gemini uses "model" instead of "assistant".
      const role = message.role === "assistant" ? "model" : "user";

      // Merge consecutive messages with the same role.
      const last = contents[contents.length - 1];

      if (last && last.role === role) {
        last.parts[0].text += "\n" + text;
      } else {
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return res.status(400).json({
        error: "The last message must be from the user.",
      });
    }

    const apiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are Faij AI, a helpful educational AI assistant. " +
                "Reply in Hindi when the user prefers Hindi. " +
                "Explain clearly, accurately, and step by step. " +
                "For coding questions, provide practical and correct code.",
            },
          ],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    const responseText = await apiResponse.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = null;
    }

    if (!apiResponse.ok) {
      const providerMessage =
        result?.error?.message || "No error message returned";

      // Never log the API key.
      console.error("Gemini API error:", {
        status: apiResponse.status,
        message: providerMessage,
        model: AI_MODEL,
      });

      if (apiResponse.status === 401 || apiResponse.status === 403) {
        return res.status(apiResponse.status).json({
          error: "Gemini authentication failed. Check your API key and access.",
        });
      }

      if (apiResponse.status === 429) {
        return res.status(429).json({
          error: "Gemini quota or rate limit reached. Try again later.",
        });
      }

      return res.status(502).json({
        error: "Gemini provider request failed.",
        providerStatus: apiResponse.status,
      });
    }

    const reply = result?.candidates
      ?.flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini returned no text. Check candidate finish reason.");

      return res.status(502).json({
        error: "Gemini returned an empty or unexpected response.",
      });
    }

    return res.json({ reply });
  } catch (error) {
    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return res.status(504).json({
        error: "AI response timed out. Please try again.",
      });
    }

    console.error("Chat backend error:", error.message);

    return res.status(500).json({
      error: "Internal backend error. Check server logs.",
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
  console.log("AI provider: Gemini Native API");
  console.log("AI model:", AI_MODEL);
});
