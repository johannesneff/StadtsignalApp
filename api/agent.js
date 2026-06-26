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
(0–3 ZUSÄTZLICHE, noch nicht beendete IT-/Tech-Events in Würzburg/Mainfranken, die NICHT im EVENT-POOL stehen – per Websuche aus Quellen wie ZDI Mainfranken, THWS, Uni Würzburg, IHK, Stadt Würzburg, Gründerzentren, Eventbrite. STRENGE Regeln: Nimm ein Event NUR auf, wenn du dir SEHR SICHER bist, dass es real und konkret existiert, und der Link DIREKT auf die spezifische Event-Detailseite zeigt (KEINE Startseite, KEINE Übersichts-/Kalenderseite, KEIN Such- oder Weiterleitungslink). Erfinde NICHTS und rate keine URLs. Im geringsten Zweifel das Event WEGLASSEN. Lieber diesen Abschnitt KOMPLETT weglassen als einen unsicheren oder allgemeinen Link zu zeigen.)

Regeln:
- Gewichte die AKTIVEN INTERESSEN und die HISTORIE (bereits besuchte Themen) STARK: Events, die dazu passen, bekommen höhere Match-Scores und stehen oben. Ohne aktive Interessen breit empfehlen.
- LEITE Zeit/Tag/Tageszeit, Modus (Online/Vor Ort), Level (Einsteiger/Fortgeschritten) und Format (Workshop/Talk/Networking/Konferenz) AUS DER ANFRAGE selbst ab (z. B. „Einsteiger-Workshop heute Abend vor Ort") und richte die Auswahl danach. Diese kommen NICHT aus Einstellungen.
- Nutze als stabile Präferenzen nur „Fokus/Ziele" und „Bevorzugter Ort", sowie die LETZTEN SUCHANFRAGEN als weiches Zusatzsignal für wiederkehrende Interessen.
- BEGRÜNDUNG („weil …"): Stütze jede Begründung NUR auf TATSÄCHLICH übergebene Signale (genannte Interessen, echte besuchte Event-IDs, letzte Suchanfragen, Wortlaut der Anfrage). Erfinde NIEMALS einen Besuch oder ein Interesse, das nicht übergeben wurde. Sind kaum Signale vorhanden, begründe schlicht über die Anfrage selbst.
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

// ---------- Anti-Halluzination: Websuche-Funde real verifizieren ----------
// Jeder „🌐 Weitere Funde"-Link wird tatsächlich abgerufen. Nur Funde, deren
// Seite (a) erreichbar ist (2xx) und (b) einen markanten Titel-Token enthält,
// bleiben stehen. Alles andere wird entfernt -> keine toten/erfundenen Links.
function extractUrl(line) { const m = line.match(/https?:\/\/[^\s)<>\]]+/); return m ? m[0].replace(/[.,;:]+$/, "") : null; }
function extractTitle(line) { const m = line.match(/\*\*(.+?)\*\*/); return m ? m[1] : ""; }

// STRENGE Prüfung für Websuche-Funde (fail-CLOSED): Ein Fund bleibt nur, wenn die
// verlinkte Seite das Event tatsächlich belegt. Im Zweifel (Timeout, Homepage,
// Such-/Redirect-Link, kein inhaltlicher Treffer) wird er VERWORFEN – so verschwinden
// leere/erfundene Event-Seiten. (Pool-Events aus echten Feeds bleiben fail-open.)
async function verifyWebFind(url, title) {
  if (!url) return false;
  // Such-/Grounding-Redirect-/Homepage-artige Links sind kein echtes Event.
  if (/google\.[a-z.]+\/search|bing\.com\/search|duckduckgo|vertexaisearch|grounding-api-redirect|webcache/i.test(url)) return false;
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; StadtsignalBot/1.0)" } });
    clearTimeout(tm);
    if (!r.ok) return false;
    const finalUrl = r.url || url;
    let path = "/";
    try { path = new URL(finalUrl).pathname || "/"; } catch { /* ignore */ }
    if (path === "/" || path.length < 4) return false; // blanke Startseite ≠ konkretes Event
    const html = (await r.text()).toLowerCase();
    if (/seite (konnte )?nicht gefunden|page not found|fehler 404|error 404|404 not found/.test(html.slice(0, 8000))) return false;
    // Inhaltlicher Beleg: markante Titel-Tokens müssen auf der Seite vorkommen.
    const tokens = (title || "").toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length > 4);
    if (!tokens.length) return false; // ohne prüfbaren Titel nicht belegbar
    const hits = tokens.filter((t) => html.includes(t)).length;
    const need = tokens.length >= 2 ? 2 : 1; // mind. zwei starke Tokens, sonst einer
    return hits >= need;
  } catch { return false; } // Timeout/DNS -> im Zweifel raus (streng)
}

async function filterWebFinds(text) {
  const lines = text.split("\n");
  const webStart = lines.findIndex((l) => l.trim().startsWith("🌐"));
  if (webStart === -1) return text;
  const checks = [];
  for (let i = webStart + 1; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("-")) continue;
    const url = extractUrl(lines[i]);
    checks.push(verifyWebFind(url, extractTitle(lines[i])).then((ok) => ({ i, ok })));
  }
  // Alles verwerfen, was nicht belegt ist.
  const drop = new Set((await Promise.all(checks)).filter((r) => !r.ok).map((r) => r.i));
  let kept = lines.filter((_, idx) => !drop.has(idx));
  // Leeren „🌐"-Abschnitt (kein einziger Fund übrig) komplett entfernen.
  const ws = kept.findIndex((l) => l.trim().startsWith("🌐"));
  if (ws !== -1 && !kept.slice(ws + 1).some((l) => l.trim().startsWith("-"))) kept = kept.filter((_, idx) => idx !== ws);
  return kept.join("\n");
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
  const recentSearches = Array.isArray(body.recentSearches) ? body.recentSearches.map((s) => String(s).slice(0, 80)).slice(0, 5) : [];
  const events = Array.isArray(body.events) ? body.events.slice(0, 60) : [];

  if (!query.trim()) { res.status(400).json({ error: "Leere Anfrage" }); return; }
  if (!events.length) { res.status(400).json({ error: "Kein Event-Pool übergeben" }); return; }

  const nowIso = (body.now && typeof body.now === "string") ? body.now : new Date().toISOString();
  const prefs = body.prefs && typeof body.prefs === "object" ? body.prefs : {};

  const systemText = `${FORMAT}\n\nEVENT-POOL:\n${buildEventPool(events)}`;
  const userMessage =
    `Aktueller Zeitpunkt: ${fmtDe(nowIso)} (Europe/Berlin).\n` +
    `Aktive Interessen: ${interestLabels.join(", ") || "(keine)"}.\n` +
    (prefs.area ? `Bevorzugter Ort: ${prefs.area}\n` : "") +
    (prefs.focus ? `Fokus/Ziele: ${prefs.focus}\n` : "") +
    (recentSearches.length ? `Letzte Suchanfragen: ${recentSearches.join(" · ")}\n` : "") +
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

    // Websuche-Funde verifizieren (tote/erfundene Links entfernen), bevor geantwortet wird.
    let safeText = text;
    try { safeText = await filterWebFinds(text); } catch { safeText = text; }

    res.status(200).json({ text: safeText, model: MODEL, usage: data?.usageMetadata || null });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Agent-Fehler" });
  }
}
