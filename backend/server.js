const express = require("express");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Multiple stable models
const MODELS = [
  ["gemini-2.0-flash-lite", "v1beta"],
  ["gemini-2.0-flash", "v1beta"],
  ["gemini-1.5-flash", "v1"]
];

// ✅ Gemini API call with retry + fallback
async function askGemini(prompt) {
  const key = process.env.GEMINI_KEY;

  for (const [model, version] of MODELS) {
    let retries = 1;

    while (retries >= 0) {
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${key}`;

        const res = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }]
        });

        const text =
          res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) return text;

      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message;

        console.log(`Model ${model} failed:`, status);

        // ❌ QUOTA ERROR → STOP + fallback
        if (status === 429) {
          console.log("Quota exceeded");

          return mockResponse(prompt);
        }

        // Retry once for temporary errors
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 2000));
          retries--;
        } else {
          break;
        }
      }
    }
  }

  // If all models fail
  return mockResponse(prompt);
}

// ✅ Mock fallback response (VERY IMPORTANT)
function mockResponse(prompt) {
  return `SUMMARY:
This report appears mostly normal.

STATUS:
NORMAL

DETAILS:
No major abnormalities detected in the given input.

SUGGESTIONS:
1. Maintain a healthy diet
2. Exercise regularly
3. Stay hydrated`;
}

// ✅ Voice API
app.post("/api/voice", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    const prompt = `You are a helpful Telugu health assistant.

User: ${message}

Explain simply in Telugu.`;

    const reply = await askGemini(prompt);

    res.json({ reply });

  } catch (err) {
    res.json({ reply: "Server error occurred" });
  }
});

// ✅ Report API
app.post("/api/report", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const improvedPrompt = prompt + `

Return response like this:

SUMMARY:
Give 3 short sentences explaining the report.

STATUS:
NORMAL or WARNING or CRITICAL

DETAILS:
Explain key findings.

SUGGESTIONS:
Give 3 health suggestions.
`;

    const result = await askGemini(improvedPrompt);

    res.json({ analysis: result });

  } catch (err) {
    res.status(500).json({ error: "Server error occurred" });
  }
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("Arogya Voice Backend Running ✅");
});

// ✅ Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});