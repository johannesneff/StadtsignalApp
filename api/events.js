// Stadtsignal — Event-Ingestion (Vercel Serverless Function / lokaler Dev-Server).
// Phase 1: echte Termine aus iCal-Feeds (Meetup-Tech-Gruppen u. a.).
// Kein API-Key nötig. Parser, Normalisierung, Kategorisierung und ein
// einfaches Venue-Geocoding sind ohne Abhängigkeiten umgesetzt.
//
// Antwort: { events: [...], sources: [...], fetchedAt }
// Bei Fehlern liefert der Endpunkt, was erreichbar war (Frontend hat zusätzlich
// den kuratierten Seed als Fallback).

// --- Quellen (iCal). Weitere Gruppen/Feeds hier ergänzen. ---
const ICAL_SOURCES = [
  { name: "Meetup · DATA & ANALYTICS", url: "https://www.meetup.com/wurzburg-data-analytics-meetup/events/ical/" },
  { name: "Meetup · Analytics Pioneers", url: "https://www.meetup.com/analytics-pioneers-wurzburg/events/ical/" },
  { name: "Meetup · Modern Software Dev", url: "https://www.meetup.com/wuerzburg-software-development/events/ical/" },
  { name: "Meetup · Deep Learning", url: "https://www.meetup.com/Wurzburg-Deep-Learning-Meetup/events/ical/" },
];

const WUE = [49.7913, 9.9534];
const VENUE_COORDS = [
  [/digital hub|münzstr/i, 49.7949, 9.9277],
  [/posthalle|bahnhofplatz/i, 49.8016, 9.9337],
  [/ihk|mainaustr/i, 49.7917, 9.9263],
  [/zdi|veitshöchheimer/i, 49.8035, 9.9213],
  [/gründerzentrum|friedrich-bergius|igz/i, 49.7585, 9.9648],
  [/hubland|informatik|universität|uni würzburg|campus/i, 49.7836, 9.9683],
  [/fhws|thws|sanderheinrich/i, 49.7768, 9.9305],
  [/vogel|max-planck/i, 49.7649, 9.9608],
  [/marienplatz|central/i, 49.7913, 9.9298],
];

let CACHE = { at: 0, data: null };
const TTL = 1000 * 60 * 60 * 6; // 6 h

// ---------- iCal-Parsing ----------
function unfold(ics) {
  // RFC 5545: Fortsetzungszeilen beginnen mit Space/Tab.
  return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}
function unescapeText(v) {
  return (v || "")
    .replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function getProp(block, name) {
  const re = new RegExp("^" + name + "(;[^:\\n]*)?:(.*)$", "im");
  const m = block.match(re);
  return m ? { params: m[1] || "", value: m[2] || "" } : null;
}
function parseDt(prop) {
  if (!prop) return null;
  const m = prop.value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, Y, Mo, D, h = "00", mi = "00", s = "00", z] = m;
  if (z) return new Date(Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +s)).toISOString();
  // Wandzeit (z. B. TZID=Europe/Berlin) -> lokal-naives ISO, Browser zeigt Wandzeit.
  return `${Y}-${Mo}-${D}T${h}:${mi}:${s}`;
}

function categorize(text) {
  const t = text.toLowerCase();
  if (/security|owasp|cyber|ransomware|threat|pentest|hacking|sicherheit/.test(t)) return "security";
  if (/\bki\b|\bai\b|\bllm\b|machine learning|deep learning|gpt|gen.?ai|künstliche intelligenz|neural|prompt/.test(t)) return "ai";
  if (/data|analytics|\bsql\b|warehouse|pandas|polars|tracking|dashboard|datenbank|bi\b/.test(t)) return "data";
  return "dev";
}
function tagsFor(text, category) {
  const t = text.toLowerCase();
  const tags = new Set([category]);
  if (/cloud|kubernetes|devops|docker|\baws\b|azure|terraform/.test(t)) tags.add("cloud");
  if (/\bux\b|\bui\b|design|usability|figma/.test(t)) tags.add("ux");
  if (/mobile|android|\bios\b|flutter|react native/.test(t)) tags.add("mobile");
  if (/open.?source|\boss\b|github/.test(t)) tags.add("oss");
  if (/startup|gründ|founder|pitch|venture/.test(t)) tags.add("startup");
  if (/robot|\bros\b/.test(t)) tags.add("robotics");
  if (/blockchain|web3|crypto|ethereum/.test(t)) tags.add("blockchain");
  if (/\bgame|gaming|godot|unity/.test(t)) tags.add("gaming");
  return [...tags];
}
function geocode(loc, id) {
  const s = loc || "";
  for (const [re, lat, lng] of VENUE_COORDS) if (re.test(s)) return [lat, lng];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const dy = ((h % 1000) / 1000 - 0.5) * 0.03;
  const dx = (((h >> 10) % 1000) / 1000 - 0.5) * 0.045;
  return [WUE[0] + dy, WUE[1] + dx];
}
function slug(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

function parseIcal(ics, sourceName) {
  const out = [];
  const blocks = unfold(ics).split("BEGIN:VEVENT").slice(1);
  for (const raw of blocks) {
    const block = raw.split("END:VEVENT")[0];
    const startsAt = parseDt(getProp(block, "DTSTART"));
    if (!startsAt) continue;
    const title = unescapeText((getProp(block, "SUMMARY") || {}).value).trim();
    if (!title) continue;
    const description = unescapeText((getProp(block, "DESCRIPTION") || {}).value).trim().slice(0, 400);
    const location = unescapeText((getProp(block, "LOCATION") || {}).value).trim();
    const url = ((getProp(block, "URL") || {}).value || "").trim();
    const uid = ((getProp(block, "UID") || {}).value || "").trim();
    const id = (slug(sourceName).slice(0, 6) + "-" + (slug(uid) || slug(title))).slice(0, 48);
    const category = categorize(title + " " + description);
    const [lat, lng] = geocode(location, id);
    out.push({
      id, title, description: description || "—", startsAt,
      location: location || "Würzburg", lat, lng,
      category, tags: tagsFor(title + " " + description, category),
      url: url || "https://www.meetup.com/", source: sourceName,
    });
  }
  return out;
}

async function fetchSource(src) {
  try {
    const r = await fetch(src.url, { headers: { "user-agent": "StadtsignalBot/1.0" } });
    if (!r.ok) return { name: src.name, ok: false, count: 0, error: `HTTP ${r.status}` };
    const ics = await r.text();
    const events = parseIcal(ics, src.name);
    return { name: src.name, ok: true, count: events.length, events };
  } catch (err) {
    return { name: src.name, ok: false, count: 0, error: err?.message || "fetch failed" };
  }
}

export default async function handler(req, res) {
  const now = Date.now();
  if (CACHE.data && now - CACHE.at < TTL && !(req.query && req.query.refresh)) {
    res.status(200).json({ ...CACHE.data, cached: true });
    return;
  }

  const results = await Promise.all(ICAL_SOURCES.map(fetchSource));
  let events = [];
  for (const r of results) if (r.ok && r.events) events = events.concat(r.events);

  // nur kommende Events, dedupe per id, nach Datum sortiert
  const cutoff = new Date(now - 1000 * 60 * 60 * 12);
  const seen = new Set();
  events = events
    .filter((e) => new Date(e.startsAt) >= cutoff)
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const data = {
    events,
    sources: results.map((r) => ({ name: r.name, ok: r.ok, count: r.count, error: r.error || null })),
    fetchedAt: new Date(now).toISOString(),
  };
  CACHE = { at: now, data };
  res.status(200).json(data);
}
