# Stadtsignal

**Stadtsignal** ist ein KI-Tech-Radar für IT-Events rund um Würzburg: Events
über einen KI-Agenten in natürlicher Sprache finden, nach Interessen filtern, auf
einer Karte erkunden, im Kalender planen und als persönlichen Newsletter erhalten.

Apple-minimalistisches, helles UI. **Hybrid-Architektur:** statisches Frontend
(kein Build) + eine schlanke Serverless-Funktion für den echten KI-Agenten.

## Bereiche (Bottom-Navigation)

- **Übersicht** – Umschalter zwischen **Karte** (Leaflet-Heatmap, Kategorie-Marker, Zeitraum-Regler) und **Kalender** (Monatsraster mit Event-Punkten, Tagesdetail).
- **Scanner** (mittig) – KI-Agent: Frage in natürlicher Sprache → Smart-Thinking + Treffer. Dazu Empfehlung des Tages und Top 3 der nächsten 14 Tage (lokales Scoring, ohne KI-Kosten).
- **Einstellungen** – Anzeigename, 12 farbcodierte Interessen, Newsletter (Vorschau + `mailto:`-Versand) und **Historie** (Besucht / Notizen).

Profil, Interessen, Historie und Notizen liegen im `localStorage`.

## KI-Agent (kostenbewusst)

- Modell: **Claude Haiku** (`claude-haiku-4-5`) über die Serverless-Funktion [`api/agent.js`](api/agent.js).
- Sparmaßnahmen: kleines `max_tokens`, **Prompt-Caching** für System-Prompt + Event-Pool, nur die aktuelle Frage wird gesendet, und der Agent wird **nur bei aktiver Nutzer-Anfrage** aufgerufen (Empfehlungen laufen lokal).
- **Fallback:** Ohne `ANTHROPIC_API_KEY` (oder lokal ohne Funktions-Server) fällt der Scanner automatisch auf die lokale Scoring-Empfehlung zurück – die App funktioniert also überall.

## Technik

- Frontend: HTML/CSS/JavaScript als **ES-Module**, kein Build.
- Karte/Heatmap: [Leaflet](https://leafletjs.com/) + `leaflet.heat` (CDN), helle CARTO-Kacheln (kein API-Key).
- Agent: [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) in einer Vercel-Node-Funktion.
- `data.js` ist die einzige Datenquelle – wird von Browser **und** Funktion importiert.

## Projektstruktur

```
index.html     – Grundgerüst, CDN-Einbindungen, lädt app.js als Modul
styles.css     – Design-System (Apple-minimal, Kategorie-Farben)
data.js        – Kategorien/Interessen + Würzburger Event-Seed (Browser + Node)
scoring.js     – lokales Scoring (Fallback ohne KI-Key)
app.js         – Bereiche, Navigation, Karte, Kalender, Scanner, Newsletter, State
api/agent.js   – Serverless-Funktion: Claude-Haiku-Agent (Streaming-frei, gecacht)
package.json   – nur die Funktions-Abhängigkeit (@anthropic-ai/sdk)
vercel.json    – Funktions-Konfiguration (maxDuration)
.env.example   – Vorlage für ANTHROPIC_API_KEY
```

## Lokal starten

Frontend (Agent fällt mangels Funktions-Server auf die lokale Empfehlung zurück):

```bash
python3 -m http.server 4321
# dann http://127.0.0.1:4321 öffnen
```

Mit echtem Agent lokal (benötigt Node + Vercel CLI):

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
vercel dev
```

## Deployment (Vercel)

1. Repo zu GitHub pushen und in Vercel importieren **oder** `vercel` per CLI ausführen.
2. Kein Build nötig (Framework: „Other"); statische Dateien + `api/` werden automatisch erkannt.
3. In **Project Settings → Environment Variables** `ANTHROPIC_API_KEY` setzen.
4. Deployen – fertig. Ohne Key läuft die App weiter, nur der Scanner nutzt dann den lokalen Fallback.

## Nächste Schritte

Echte Live-Datenquellen (Meetup, FHWS/JMU, ZDI, Heise, IHK), echter
Newsletter-Versand mit HTML, Standort-Hinweise (Geolocation) und Streaming der
Agenten-Antwort.
