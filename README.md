# Stadtsignal

**Stadtsignal** ist ein KI-Tech-Radar für IT-Events rund um Würzburg: Events
entdecken, nach Interessen filtern, auf einer Karte erkunden, im Kalender planen
und als persönlichen Newsletter erhalten.

Apple-minimalistisches, helles UI – ohne Build-Schritt, läuft direkt im Browser.

## Funktionen

- **Scanner** – Such-Agent mit Smart-Thinking, Empfehlung des Tages, Top-3-Vorschläge und Event-Feed.
- **Karte / Radar** – Leaflet-Karte mit Heatmap, kategoriefarbigen Markern und Zeitraum-Regler (Heute … +6 Tage).
- **Kalender** – Monatsansicht mit farbcodierten Event-Punkten; Tag wählen für Empfehlungen.
- **Historie** – besuchte Events und persönliche Notizen (lokal gespeichert).
- **Konto** – Anzeigename, 12 farbcodierte Interessen-Chips, Newsletter (E-Mail, Rhythmus, Live-Vorschau, Versand per `mailto:`).

Profil, Interessen, Historie und Notizen werden im `localStorage` gehalten.

## Technik

- Reines HTML/CSS/JavaScript, **kein Build** und keine Abhängigkeiten zum Installieren.
- Karte/Heatmap: [Leaflet](https://leafletjs.com/) + `leaflet.heat` (CDN), helle CARTO-Kacheln (kein API-Key).
- System-Schrift-Stack (SF Pro), responsiv über drei Breakpoints.

## Lokal starten

Ein beliebiger statischer Server genügt, z. B.:

```bash
python3 -m http.server 4321
# dann http://127.0.0.1:4321 öffnen
```

## Projektstruktur

```
index.html    – Grundgerüst, CDN-Einbindungen, Mount-Punkte
styles.css    – Design-System (Apple-minimal, Kategorie-Farben)
data.js       – Kategorien/Interessen + kuratierter Würzburger Event-Seed
scoring.js    – Agenten-Scoring (Interessen × Historie × Aktualität)
app.js        – Screens, Navigation, Karte, Kalender, Newsletter, State
```

## Nächste Schritte

Echte Datenquellen (Meetup, FHWS/JMU, ZDI, Heise, IHK), echter Newsletter-Versand,
Standort-Hinweise (Geolocation) und ein KI-Backend (z. B. Claude API) statt des
simulierten Scorings.
