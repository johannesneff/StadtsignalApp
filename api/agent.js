// Stadtsignal — Agent-Endpoint (Vercel Serverless Function, Node).
// Nutzt Google Gemini (AI Studio, kostenloser Free-Tier) über die REST-API
// per fetch – kein SDK nötig (Node 18+/Vercel haben fetch eingebaut).
//
// Kostenbewusst:
//   - schnelles "flash"-Modell, kleines maxOutputTokens
//   - stabiler System-Prompt (implizites Caching der 2.5-Modelle)
//   - nur die aktuelle Frage wird gesendet (keine lange Chat-Historie)
//   - Event-Daten kommen aus dem Request-Body -> Funktion ist von data.js entkoppelt
//
// Ohne GEMINI_API_KEY antwortet die Funktion mit 503 -> das Frontend fällt
// automatisch auf die lokale Scoring-Empfehlung zurück.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_TOKENS = 900;

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
(3–5 Treffer aus dem EVENT-POOL, EXAKTE id in eckigen Klammern)

🌐 Weitere aktuelle Funde (Websuche)
- **Titel** — Datum/Uhrzeit — Ort — kurze Begründung — https://link-zur-eventseite
(0–3 ZUSÄTZLICHE, noch nicht beendete IT-/Tech-Events in Würzburg/Mainfranken, die NICHT im EVENT-POOL stehen – per Websuche aus Quellen wie ZDI Mainfranken, THWS, Uni Würzburg, IHK, Stadt Würzburg, Gründerzentren, Eventbrite. Immer mit echtem Link. Liefert die Suche nichts Verlässliches, diesen Abschnitt KOMPLETT weglassen.)

Regeln:
- Gewichte die AKTIVEN INTERESSEN und die HISTORIE (bereits besuchte Themen) STARK: Events, die dazu passen, bekommen höhere Match-Scores und stehen oben. Ohne aktive Interessen breit empfehlen.
- „📍 Treffer": ausschließlich Events aus dem EVENT-POOL mit deren EXAKTER id.
- „🌐 Weitere Funde": nur per Websuche verifizierte, reale Events mit Link; KEINE id; nichts erfinden.
- Berücksichtige den ANGEGEBENEN AKTUELLEN ZEITPUNKT: Schlage KEINE bereits beendeten Events vor; laufende/kommende sind erlaubt; bevorzuge zeitlich passende Treffer („heute", „heute Abend", „diese Woche").
- Bei breiten Anfragen ist auch ein Event außerhalb der Interessen ok; Begründung dann mit „Überraschungs-Tipp: …".
- Fasse dich kurz.`;

function fmtDe(iso) {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
    });
  } catch { return iso; }
}
function buildEventPool(events) {
  return events
    .map((e) => {
      const when = fmtDe(e.startsAt) + (e.endsAt ? "–" + fmtDe(e.endsAt) : "");
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

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    res.status(503).json({ error: "GEMINI_API_KEY nicht gesetzt" });
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

  if (!query.trim()) { res.status(400).json({ error: "Leere Anfrage" }); return; }
  if (!events.length) { res.status(400).json({ error: "Kein Event-Pool übergeben" }); return; }

  const nowIso = (body.now && typeof body.now === "string") ? body.now : new Date().toISOString();
  const systemText = `${FORMAT}\n\nEVENT-POOL:\n${buildEventPool(events)}`;
  const userMessage =
    `Aktueller Zeitpunkt: ${fmtDe(nowIso)} (Europe/Berlin).\n` +
    `Aktive Interessen: ${interestLabels.join(", ") || "(keine)"}.\n` +
    `Besuchte Event-IDs: ${history.length ? history.join(", ") : "(keine)"}.\n\n` +
    `Frage: ${query}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    // Websuche-Grounding: erlaubt dem Agenten, Events aus nicht-angebundenen
    // Quellen (ZDI, THWS, Uni, IHK, Stadt, Eventbrite …) live zu finden.
    tools: [{ google_search: {} }],
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.5,
      // Thinking aus -> Token-Budget bleibt für die Antwort (sonst abgeschnitten).
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  try {
    let r;
    // Bis zu 3 Versuche; bei 429/503 (Free-Tier-Überlastung) kurz warten und erneut.
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: payload,
      });
      if (r.ok || (r.status !== 503 && r.status !== 429)) break;
      if (attempt < 2) await sleep(700 * (attempt + 1));
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      res.status(r.status).json({ error: `Gemini-Fehler (${r.status})`, detail: detail.slice(0, 300) });
      return;
    }

    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    if (!text) {
      res.status(502).json({ error: "Leere Antwort von Gemini", reason: data?.candidates?.[0]?.finishReason || null });
      return;
    }

    res.status(200).json({ text, model: MODEL, usage: data?.usageMetadata || null });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Agent-Fehler" });
  }
}
