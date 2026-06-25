// Stadtsignal — Agent-Endpoint (Vercel Serverless Function, Node).
// Schlanker, kostenbewusster Aufruf von Claude Haiku:
//   - kleines max_tokens
//   - Prompt-Caching für System-Prompt + Event-Pool (günstige Folge-Requests)
//   - nur die aktuelle Frage wird gesendet (keine lange Chat-Historie)
//   - kein Thinking (günstigste Variante)
// Die Event-Daten kommen aus dem Request-Body (vom Frontend) – so ist die
// Funktion komplett von data.js entkoppelt und das Frontend bleibt ein
// klassisches, direkt im Browser öffenbares Script.
// Ohne ANTHROPIC_API_KEY antwortet die Funktion mit 503 -> das Frontend
// fällt automatisch auf die lokale Scoring-Empfehlung zurück.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;

const FORMAT = `Du bist der „Stadtsignal"-Tech-Radar-Agent für die Würzburger IT-Community.
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
Fasse dich kurz.`;

function buildEventPool(events) {
  return events
    .map((e) => {
      let when = e.startsAt;
      try {
        when = new Date(e.startsAt).toLocaleString("de-DE", {
          weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });
      } catch { /* roher Wert */ }
      const tags = Array.isArray(e.tags) ? e.tags.join(",") : "";
      return `- [${e.id}] "${e.title}" | ${e.category} | tags: ${tags} | ${when} | ${e.location} | ${e.description}`;
    })
    .join("\n");
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
  body = body || {};

  const query = (body.query || "").toString().slice(0, 500);
  const interestLabels = Array.isArray(body.interestLabels) ? body.interestLabels.slice(0, 12) : [];
  const history = Array.isArray(body.history) ? body.history.slice(0, 30) : [];
  const events = Array.isArray(body.events) ? body.events.slice(0, 60) : [];

  if (!query.trim()) {
    res.status(400).json({ error: "Leere Anfrage" });
    return;
  }
  if (!events.length) {
    res.status(400).json({ error: "Kein Event-Pool übergeben" });
    return;
  }

  // Stabiler Prefix (Format + Event-Pool) -> gecacht. Volatile Frage in messages.
  const systemText = `${FORMAT}\n\nEVENT-POOL:\n${buildEventPool(events)}`;
  const userMessage =
    `Aktive Interessen: ${interestLabels.join(", ") || "(keine)"}.\n` +
    `Besuchte Event-IDs: ${history.length ? history.join(", ") : "(keine)"}.\n\n` +
    `Frage: ${query}`;

  try {
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
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
