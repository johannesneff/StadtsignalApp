// Stadtsignal — Agent-Endpoint (Vercel Serverless Function, Node).
// Schlanker, kostenbewusster Aufruf von Claude Haiku:
//   - kleines max_tokens
//   - Prompt-Caching für System-Prompt + Event-Pool (günstige Folge-Requests)
//   - nur die aktuelle Frage wird gesendet (keine lange Chat-Historie)
//   - kein Thinking (günstigste Variante)
// Ohne ANTHROPIC_API_KEY antwortet die Funktion mit 503 -> das Frontend
// fällt automatisch auf die lokale Scoring-Empfehlung zurück.

import Anthropic from "@anthropic-ai/sdk";
import { EVENTS, INTEREST_BY_ID } from "../data.js";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;

// Event-Pool einmal pro Instanz bauen -> stabiler Prefix -> Cache-Treffer.
const EVENT_POOL = EVENTS.map((e) => {
  const when = new Date(e.startsAt).toLocaleString("de-DE", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return `- [${e.id}] "${e.title}" | ${e.category} | tags: ${e.tags.join(",")} | ${when} | ${e.location} | ${e.description}`;
}).join("\n");

const SYSTEM_PROMPT = `Du bist der „Stadtsignal"-Tech-Radar-Agent für die Würzburger IT-Community.
Du hilfst, passende IT-Events rund um Würzburg zu finden.

ANTWORTE IMMER AUF DEUTSCH und IMMER GENAU IN DIESEM FORMAT:

🧠 Smart-Thinking
1) Verlauf analysieren: <ein kurzer Satz>
2) Schwerpunkte erkennen: <ein kurzer Satz>
3) Anfrage interpretieren: <ein kurzer Satz>
4) Quellen durchsuchen: <ein kurzer Satz>
5) Bewerten & sortieren: <ein kurzer Satz>

📍 Treffer
- [id] **Titel** — Match XX% — kurze Begründung in einem Satz
- [id] **Titel** — Match XX% — Begründung
(3–5 Treffer)

Wähle ausschließlich Events aus dem EVENT-POOL und nutze deren EXAKTE id in eckigen Klammern.
Bei breiten Anfragen darfst du auch ein Event außerhalb der Interessen vorschlagen; beginne die Begründung dann mit „Überraschungs-Tipp: …".
Fasse dich kurz.

EVENT-POOL:
${EVENT_POOL}`;

function labelInterests(ids) {
  return (ids || []).map((id) => INTEREST_BY_ID[id]?.label ?? id).join(", ") || "(keine)";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY nicht gesetzt" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const query = (body?.query || "").toString().slice(0, 500);
  const interests = Array.isArray(body?.interests) ? body.interests.slice(0, 12) : [];
  const history = Array.isArray(body?.history) ? body.history.slice(0, 30) : [];

  if (!query.trim()) {
    res.status(400).json({ error: "Leere Anfrage" });
    return;
  }

  const userMessage =
    `Aktive Interessen: ${labelInterests(interests)}.\n` +
    `Besuchte Event-IDs: ${history.length ? history.join(", ") : "(keine)"}.\n\n` +
    `Frage: ${query}`;

  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Stabiler, großer Prefix wird gecacht; die kleine, variable Frage steht in messages.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    res.status(200).json({ text, model: MODEL, usage: response.usage });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || "Agent-Fehler" });
  }
}
