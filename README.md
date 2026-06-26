# Stadtsignal

**Stadtsignal** ist ein KI-Tech-Radar für IT-Events rund um Würzburg/Mainfranken:
Events über einen KI-Agenten in natürlicher Sprache finden, nach Interessen
gewichtet, auf einer Karte erkunden, im Kalender planen, in den eigenen Kalender
übernehmen und als persönlichen Newsletter per E-Mail erhalten.

Minimalistisches, helles UI. **Hybrid-Architektur:** statisches Frontend
(kein Build) + schlanke Serverless-Funktionen für Agent, Event-Ingestion und Mailversand.

## Bereiche (Bottom-Navigation)

- **Übersicht** – Umschalter zwischen **Karte** (Leaflet, Tag-Stepper mit Dichte-Heatmap, Kategorie-Marker) und **Kalender** (Monatsraster, Tagesdetail). Events lassen sich per Klick in den eigenen Kalender exportieren (`.ics`).
- **Scanner** (mittig) – der **KI-Agent**: Frage in natürlicher Sprache → Smart-Thinking, geprüfte Treffer mit „weil …"-Begründung und Web-Funden. Dazu Empfehlung des Tages und Top 3 (lokales Scoring, ohne KI-Kosten). Zeit/Tag/Modus/Level/Format leitet der Agent aus der Frage ab; Interessen, Ort, Fokus und Suchverlauf fließen als Signale ein.
- **Einstellungen** – Anzeigename (erscheint personalisiert im Scanner), 12 Interessen, Präferenzen (Fokus + Ort), Newsletter (echte Mail), Historie (Besucht/Notizen) und ein **Demo-Profil** für Präsentationen.

Profil, Interessen, Präferenzen, Suchverlauf, Historie und Notizen liegen im `localStorage` (gerätelokal, keine Accounts).

## Echte Event-Quellen ([api/events.js](api/events.js))

Angebunden (live, Cache 6 h, abgelaufene Events werden anhand der aktuellen Zeit ausgefiltert; laufende bleiben):

- **Meetup** (iCal) – Würzburger Tech-Gruppen (DATA & ANALYTICS, Analytics Pioneers, Modern Software Dev, Deep Learning, WUE.tech)
- **ZDI / Gründerzentren Würzburg** (iCal, auf Tech/Startup gefiltert)
- **AI Week Mainfranken** (Timetable-JSON, mit Koordinaten)
- **FRIZZ Würzburg** (iCal, auf Tech gefiltert)
- **Uni Würzburg** (Veranstaltungs-RSS, auf Tech gefiltert)

Jedes Event wird angereichert: **Dubletten** aus mehreren Quellen werden zusammengeführt,
**exakte Position** via OpenStreetMap/Nominatim (gecached), **Link-Check** (eindeutig tote
Links → Suchlink; sonst Originallink erhalten, „✓ Link geprüft" nur bei echter Erreichbarkeit)
und ein **Event-Bild** (`og:image` der Seite, sonst Themen-Fallback).

Quellen ohne abrufbaren Feed (ZDI, THWS, IHK, Stadt Würzburg, Gründerzentren, Eventbrite)
deckt der **Agent per Websuche** ab (Google-Search-Grounding); diese Funde werden
serverseitig auf Erreichbarkeit geprüft, bevor sie angezeigt werden.

## KI-Agent (kostenlos)

- Modell: **Google Gemini** (`gemini-2.5-flash`, kostenloser AI-Studio Free-Tier) über [`api/agent.js`](api/agent.js) – per REST/`fetch`, **ohne SDK**.
- Sparsam: schnelles „flash"-Modell, kleines `maxOutputTokens`, nur die aktuelle Frage; der Agent wird **nur bei aktiver Nutzer-Anfrage** aufgerufen (Empfehlungen laufen lokal).
- **Fallback:** Ohne `GEMINI_API_KEY` (oder lokal ohne Funktions-Server) nutzt der Scanner die lokale Scoring-Empfehlung – die App funktioniert überall, der Modus wird sichtbar als „Lokal" markiert.
- Modell per `GEMINI_MODEL` umstellbar (z. B. `gemini-2.5-flash-lite`).

## Newsletter ([api/send-newsletter.js](api/send-newsletter.js))

- „An mich senden" verschickt eine **echte HTML-Mail** an die hinterlegte Adresse über **[Resend](https://resend.com)** – gleiches Layout wie die Vorschau, mit echten Event-Bildern. Es öffnet **keine** Mail-App mehr.
- Benötigt `RESEND_API_KEY`. Ohne eigene verifizierte Domain sendet der Test-Absender nur an die **eigene Resend-Konto-Adresse**.
- Auto-Versand-Schalter + Rhythmus speichern die Einstellung; echter wiederkehrender Versand (Cron + Abonnenten-Speicher) ist Roadmap.

## Technik

- Frontend: HTML/CSS/JavaScript als **klassische `<script>`-Tags** (kein Build, per Doppelklick auf `index.html` via `file://` öffenbar).
- Karte/Heatmap: [Leaflet](https://leafletjs.com/) + `leaflet.heat` (CDN), helle CARTO-Kacheln (kein API-Key).
- Serverless-Funktionen (`api/*.js`): reines `fetch`, **keine npm-Abhängigkeiten**.

## Projektstruktur

```
index.html             – Grundgerüst, CDN-Einbindungen, lädt die klassischen Scripts
styles.css             – Design-System (minimal, Kategorie-Farben)
data.js                – Kategorien/Interessen + Würzburger Event-Seed (Fallback)
scoring.js             – lokales Scoring (Fallback ohne KI-Key)
app.js                 – Bereiche, Navigation, Karte, Kalender, Scanner, Newsletter, State
api/events.js          – Event-Ingestion: Feeds, Dedupe, Geocoding, Link-Check, Bilder
api/agent.js           – Gemini-Agent (REST), Web-Grounding + Link-Verifikation
api/send-newsletter.js – echter Mailversand via Resend
dev-server.mjs         – lokaler Dev-Server (statisch + /api-Routing)
package.json           – type:module, keine Abhängigkeiten
vercel.json            – Funktions-Konfiguration (maxDuration)
.env.example           – Vorlage für GEMINI_API_KEY und RESEND_API_KEY
```

## Lokal starten

Nur Frontend (Agent + Newsletter fallen mangels Funktions-Server zurück):

```bash
python3 -m http.server 4321
# dann http://127.0.0.1:4321 öffnen  – oder index.html direkt doppelklicken
```

Mit echten Funktionen lokal (benötigt Node, kein Vercel-Konto):

```bash
echo "GEMINI_API_KEY=..." > .env      # https://aistudio.google.com/apikey
echo "RESEND_API_KEY=..." >> .env      # optional, https://resend.com/api-keys
npm run dev                             # http://localhost:5173
```

## Deployment (Vercel)

1. Repo zu GitHub pushen und in Vercel importieren (Framework: „Other", kein Build).
2. In **Project Settings → Environment Variables** `GEMINI_API_KEY` und `RESEND_API_KEY` setzen.
3. Zuerst als **Preview** deployen, kurz testen (Events laden · Agent antwortet · Mail an dich selbst), dann auf Production promoten.
4. Ohne Keys läuft die App weiter – Scanner nutzt den lokalen Fallback, der Newsletter zeigt einen Hinweis.

## Demo-Profil

`?demo=1` an die URL hängen **oder** in den Einstellungen „Demo-Profil laden": füllt
Interessen, Fokus, „Besucht" und Suchverlauf, damit die Personalisierung sofort
sichtbar ist. „Zurücksetzen" löscht alle lokalen Daten.
