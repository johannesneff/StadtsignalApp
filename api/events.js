// Stadtsignal — Event-Ingestion (Vercel Serverless Function / lokaler Dev-Server).
// Phase 1: echte Termine aus iCal-Feeds (Meetup-Tech-Gruppen u. a.).
// Kein API-Key nötig. Parser, Normalisierung, Kategorisierung und ein
// einfaches Venue-Geocoding sind ohne Abhängigkeiten umgesetzt.
//
// Antwort: { events: [...], sources: [...], fetchedAt }
// Bei Fehlern liefert der Endpunkt, was erreichbar war (Frontend hat zusätzlich
// den kuratierten Seed als Fallback).

// --- Quellen (iCal). techOnly=true filtert breite Kalender auf Tech-Events. ---
const ICAL_SOURCES = [
  { name: "Meetup · DATA & ANALYTICS", url: "https://www.meetup.com/wurzburg-data-analytics-meetup/events/ical/" },
  { name: "Meetup · Analytics Pioneers", url: "https://www.meetup.com/analytics-pioneers-wurzburg/events/ical/" },
  { name: "Meetup · Modern Software Dev", url: "https://www.meetup.com/wuerzburg-software-development/events/ical/" },
  { name: "Meetup · Deep Learning", url: "https://www.meetup.com/Wurzburg-Deep-Learning-Meetup/events/ical/" },
  { name: "FRIZZ Würzburg", url: "https://frizz-wuerzburg.de/search/event/veranstaltungskalender/calendar.ics", techOnly: true },
];

// --- Quellen (RSS), z. B. TYPO3-Veranstaltungs-Feeds. ---
const RSS_SOURCES = [
  { name: "Uni Würzburg", url: "https://www.uni-wuerzburg.de/index.php?id=197207&type=151", techOnly: true },
];

// Tech-Relevanz-Filter für breite Kalender (Kultur etc. wird ausgesiebt).
function techRelevant(text) {
  const t = (text || "").toLowerCase();
  return /\bki\b|\bai\b|\bit\b|\bllm\b|tech|software|programmier|develop|entwickl|daten|\bdata\b|cyber|security|sicherheit|digital|robot|\bweb\b|cloud|devops|machine learning|deep learning|hackathon|startup|gründ|innovation|coding|python|javascript|\bux\b/.test(t);
}

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
    const endsAt = parseDt(getProp(block, "DTEND"));
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
      id, title, description: description || "—", startsAt, endsAt,
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
    let events = parseIcal(ics, src.name);
    if (src.techOnly) events = events.filter((e) => techRelevant(e.title + " " + e.description));
    return { name: src.name, ok: true, count: events.length, events };
  } catch (err) {
    return { name: src.name, ok: false, count: 0, error: err?.message || "fetch failed" };
  }
}

// --- RSS-Parsing (TYPO3/WordPress) ---
function stripHtml(s) { return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function decodeEntities(s) {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function rssTag(item, tag) {
  const m = item.match(new RegExp("<" + tag + "(?:[^>]*)>([\\s\\S]*?)</" + tag + ">", "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}
function parseRss(xml, sourceName) {
  const out = [];
  const items = xml.split(/<item[ >]/i).slice(1);
  for (const raw of items) {
    const item = raw.split(/<\/item>/i)[0];
    const title = stripHtml(rssTag(item, "title"));
    const pub = rssTag(item, "pubDate") || rssTag(item, "dc:date");
    if (!title || !pub) continue;
    const t = new Date(pub);
    if (isNaN(t.getTime())) continue;
    const startsAt = t.toISOString();
    const link = rssTag(item, "link") || "";
    const description = stripHtml(rssTag(item, "description")).slice(0, 400);
    const id = (slug(sourceName).slice(0, 6) + "-" + slug(link || title)).slice(0, 48);
    const category = categorize(title + " " + description);
    const [lat, lng] = geocode("", id);
    out.push({
      id, title, description: description || "—", startsAt, endsAt: null,
      location: "Würzburg", lat, lng,
      category, tags: tagsFor(title + " " + description, category),
      url: link || "https://www.uni-wuerzburg.de/aktuelles/veranstaltungen/", source: sourceName,
    });
  }
  return out;
}
async function fetchRss(src) {
  try {
    const r = await fetch(src.url, { headers: { "user-agent": "StadtsignalBot/1.0" } });
    if (!r.ok) return { name: src.name, ok: false, count: 0, error: `HTTP ${r.status}` };
    const xml = await r.text();
    let events = parseRss(xml, src.name);
    if (src.techOnly) events = events.filter((e) => techRelevant(e.title + " " + e.description));
    return { name: src.name, ok: true, count: events.length, events };
  } catch (err) {
    return { name: src.name, ok: false, count: 0, error: err?.message || "fetch failed" };
  }
}

// AI Week Mainfranken: eigene Timetable-JSON-API (kein iCal nötig).
const AIWEEK_NAME = "AI Week Mainfranken";
function truthy(v) { return v === true || v === "True" || v === "true" || v === 1; }
async function fetchAiWeek() {
  try {
    const r = await fetch("https://backend.timetable.ai-week.de/export/session.json", { headers: { "user-agent": "StadtsignalBot/1.0" } });
    if (!r.ok) return { name: AIWEEK_NAME, ok: false, count: 0, error: `HTTP ${r.status}` };
    const data = await r.json();
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const events = [];
    for (const s of sessions) {
      if (truthy(s.cancelled)) continue;
      const title = (s.title || "").trim();
      const startsAt = (s.start || "").trim();
      if (!title || !startsAt) continue;
      const desc = (s.description && s.description.short) ? String(s.description.short).trim().slice(0, 400) : "";
      const loc = s.location || null;
      const online = truthy(s.onlineOnly) || !loc;
      const location = loc
        ? [loc.name, loc.streetNo, loc.city].filter(Boolean).join(", ")
        : "Online";
      const id = "aiweek-" + (s.id || slug(title));
      let lat, lng;
      if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") { lat = loc.lat; lng = loc.lng; }
      else { [lat, lng] = geocode(online ? "" : location, id); }
      const linkVal = s.links && s.links.event ? String(s.links.event) : "";
      const url = /^https?:\/\//i.test(linkVal) ? linkVal : "https://www.ai-week.de/programm.php";
      const channel = (s.channel && s.channel.name) ? s.channel.name : "";
      const category = categorize(`${title} ${desc} ${channel}`);
      events.push({
        id, title, description: desc || "AI Week Mainfranken", startsAt,
        endsAt: (s.end || "").trim() || null,
        location: online ? "Online · AI Week" : location, lat, lng,
        category, tags: tagsFor(`${title} ${desc} ${channel}`, category),
        url, source: AIWEEK_NAME,
      });
    }
    return { name: AIWEEK_NAME, ok: true, count: events.length, events };
  } catch (err) {
    return { name: AIWEEK_NAME, ok: false, count: 0, error: err?.message || "fetch failed" };
  }
}

// ---------- Dedupe (gleiche Events aus mehreren Quellen zusammenführen) ----------
// Schlüssel: normalisierter Titel + Start-Tag + Start-Stunde. So wird z. B. ein
// AI-Week-Talk, der auch als Meetup-iCal auftaucht, nur einmal gezeigt.
function normTitle(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Diakritika weg
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function dayHourKey(iso) {
  // robust gegen "Z" und naive Wandzeit: nur die ersten 13 Zeichen (YYYY-MM-DDThh)
  const m = (iso || "").match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}` : (iso || "");
}
// Wie "vollständig" ist ein Datensatz? Höher = lieber behalten / als Basis nutzen.
function quality(e) {
  let q = 0;
  const url = e.url || "";
  const generic = /meetup\.com\/?$|ai-week\.de\/programm|uni-wuerzburg\.de\/aktuelles|frizz-wuerzburg\.de\/?$/i;
  if (url && !generic.test(url)) q += 3;          // echter Event-Link
  if (e.endsAt) q += 1;                            // bekannte Endzeit
  if (e.location && !/^würzburg$|^online/i.test(e.location)) q += 1; // konkrete Adresse
  q += Math.min((e.description || "").length, 300) / 300; // mehr Beschreibung
  return q;
}
function mergeEvents(base, other) {
  // Basis ist der bessere Datensatz; fehlende Felder aus dem anderen ergänzen.
  const out = { ...base };
  if (!out.endsAt && other.endsAt) out.endsAt = other.endsAt;
  if ((!out.description || out.description === "—") && other.description) out.description = other.description;
  const generic = /meetup\.com\/?$|ai-week\.de\/programm|uni-wuerzburg\.de\/aktuelles|frizz-wuerzburg\.de\/?$/i;
  if ((!out.url || generic.test(out.url)) && other.url && !generic.test(other.url)) out.url = other.url;
  // Quellen sichtbar zusammenführen (z. B. "Meetup · … + AI Week").
  const srcs = new Set([base.source, other.source].filter(Boolean));
  out.source = [...srcs].join(" + ");
  out.tags = [...new Set([...(base.tags || []), ...(other.tags || [])])];
  return out;
}
function dedupe(events) {
  const byKey = new Map();
  for (const e of events) {
    const key = normTitle(e.title) + "@" + dayHourKey(e.startsAt);
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, e); continue; }
    // Bessere Basis wählen, Rest mergen.
    const base = quality(e) >= quality(prev) ? e : prev;
    const other = base === e ? prev : e;
    byKey.set(key, mergeEvents(base, other));
  }
  return [...byKey.values()];
}

export default async function handler(req, res) {
  const now = Date.now();
  if (CACHE.data && now - CACHE.at < TTL && !(req.query && req.query.refresh)) {
    res.status(200).json({ ...CACHE.data, cached: true });
    return;
  }

  const results = await Promise.all([
    ...ICAL_SOURCES.map(fetchSource),
    ...RSS_SOURCES.map(fetchRss),
    fetchAiWeek(),
  ]);
  let events = [];
  for (const r of results) if (r.ok && r.events) events = events.concat(r.events);

  // Abgelaufene Events raus (laufende bleiben): Ende >= jetzt.
  // Ohne Endzeit: Annahme 3 h Dauer ab Start.
  const HOURS3 = 1000 * 60 * 60 * 3;
  const notEnded = (e) => {
    const end = e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + HOURS3;
    return end >= now;
  };
  events = dedupe(events.filter(notEnded))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const data = {
    events,
    sources: results.map((r) => ({ name: r.name, ok: r.ok, count: r.count, error: r.error || null })),
    fetchedAt: new Date(now).toISOString(),
  };
  CACHE = { at: now, data };
  res.status(200).json(data);
}
