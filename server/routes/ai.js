// server/routes/ai.js
// Backend proxy for Anthropic API — keeps the API key off the browser
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

// All AI routes require authentication
router.use(requireAuth);

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-haiku-20241022";

async function callClaude(system, userMsg) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured on server");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// POST /api/ai/parse-email
router.post("/parse-email", async (req, res) => {
  try {
    const { from, subject, body } = req.body;
    if (!body && !subject) return res.status(400).json({ error: "Email body or subject required" });

    const system = `You are a property management dispatcher. Extract work order details from a tenant email.
Return ONLY valid JSON with these fields:
{
  "tenant_name": "",
  "unit": "",
  "phone": "",
  "property_name": "",
  "address": "",
  "category": "Plumbing|Electrical|HVAC|Appliance|General|Pest|Locks/Security",
  "priority": "emergency|high|medium|low",
  "description": ""
}
Use "medium" priority if unsure. Use "General" category if unsure.`;

    const userMsg = `From: ${from}\nSubject: ${subject || ""}\n\n${body || ""}`;
    const raw = await callClaude(system, userMsg);

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not extract JSON from AI response");
    const parsed = JSON.parse(match[0]);
    res.json(parsed);
  } catch (err) {
    console.error("[AI parse-email]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/analyze
router.post("/analyze", async (req, res) => {
  try {
    const { summary, question } = req.body;
    if (!summary) return res.status(400).json({ error: "Pipeline summary required" });

    const system = `You are an expert property management operations analyst.
Analyze the provided work order pipeline data and give concise, actionable insights.
Use bullet points for key findings. Be direct — skip filler phrases.
Limit response to 300 words.`;

    const userMsg = `Pipeline data:\n${JSON.stringify(summary, null, 2)}\n\nQuestion: ${question || "What are the key insights and what should I prioritize?"}`;
    const result = await callClaude(system, userMsg);
    res.json({ result });
  } catch (err) {
    console.error("[AI analyze]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
