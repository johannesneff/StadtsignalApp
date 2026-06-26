# Stadtsignal — Personas, Szenarien & Funktions-Strategie

> Grundlage für die Hackathon-Präsentation. Ergebnis eines „LLM-Council"-Durchlaufs
> (5 unabhängige Berater-Perspektiven + Peer-Review + Synthese).
> Stand: 2026-06-26.

---

## 1. Die Kernthese (in einem Satz)

**Niemand wacht mit dem Wunsch „Events entdecken" auf — Menschen wachen mit einem
Gefühl auf** („freier Donnerstag und gelangweilt", „alle machen KI, ich hänge
hinterher", „neu in der Stadt, kenne niemanden"). Stadtsignals Aufgabe ist nicht
*Events auflisten*, sondern **dieses Gefühl in einen konkreten Plan verwandeln, das
Haus zu verlassen.**

Das eine Primitiv, um das die ganze App gebaut sein sollte:

> **Frage rein → kuratierte, echte Event-Auswahl raus → begründet, *warum* sie zu dir passt.**

Das ist der **Scanner**. Alles andere ist Beiwerk.

---

## 2. Personas

Vier Personas, geordnet nach Demo-Tauglichkeit. Die ersten beiden tragen die
Präsentation; die letzten beiden sind „Roadmap"-Personas (Vision, nicht im Live-Demo).

### 🎓 Persona A — Lena, 23 · Austausch-/Masterstudentin (THWS), 3 Wochen in der Stadt
- **Situation:** Neu in Würzburg, kennt niemanden, Deutsch noch wackelig, interessiert sich für ML/KI.
- **Schmerz:** Isolation. Weiß nicht, wo „ihre Leute" sind. Meetup/Instagram sind unübersichtlich und auf Deutsch.
- **Frage an den Scanner:** *„Wo treffe ich diese Woche Leute, die sich für KI interessieren — Deutsch nicht zwingend?"*
- **Mehrwert:** Aus Einsamkeit wird ein konkreter Dienstag-Plan + Anschluss an eine Community.
- **Warum sie die Demo gewinnt:** emotionaler Bogen (allein → verbunden), klarer Vorher-/Nachher-Moment.

### 🧑‍💼 Persona B — Markus, 41 · Agentur-/Firmeninhaber, „hängt bei KI hinterher"
- **Situation:** Wenig Zeit, zwei freie Abende im Monat, will praktischen KI-Einstieg ohne Uni-Bubble.
- **Schmerz:** FOMO + Überforderung. Generische „KI-Talks" sind ihm zu oberflächlich oder zu studentisch.
- **Frage an den Scanner:** *„Einsteiger-KI-Sachen nach Feierabend, vor Ort, keine reinen Studi-Events."*
- **Mehrwert:** Zwei passgenaue Treffer statt 30 Minuten Recherche — FOMO aufgelöst.
- **Warum stark:** zeigt, dass **Präferenzen** (Abends · Vor Ort · Einsteiger) sichtbar wirken.

### 🛠️ Persona C — Aylin, 38 · Recruiterin/Talent-Scout bei einem Mittelständler *(Roadmap)*
- **Situation:** Sucht KI-Talente in der Region, weiß nicht, wo sie sich treffen.
- **Schmerz:** Lokaler Talentpool ist unsichtbar.
- **Vision-Frage:** *„Wo trifft sich diese Woche die KI-Community in Mainfranken?"* → **Talent-Radar statt Event-Radar.**
- **Status:** Vision-Slide — kein Live-Demo (braucht B2B-Kontext/Backend).

### 🏛️ Persona D — Veranstalter / Stadt / AI Week (Angebotsseite) *(Roadmap)*
- **Situation:** Organisator:innen (Meetup-Hosts, Uni, AI Week) hungern nach Reichweite.
- **Vision:** „Dein Event wurde diese Woche 47 passenden Nutzer:innen angezeigt." → B2B/Civic-Dashboard, Jahres-Begleiter der AI Week, denkbar gefördert durch die Wirtschaftsförderung.
- **Status:** ausdrücklich **Roadmap**, nicht Hackathon-Scope (kein Backend/keine Accounts).

---

## 3. Problemfälle mit echtem Mehrwert (Szenarien)

| # | Auslöser (Gefühl) | Frage an Stadtsignal | Was die App liefert |
|---|---|---|---|
| 1 | „Freier Abend, gelangweilt" | „Was ist heute Abend los?" | 1–3 echte, heute noch laufende Events + Begründung |
| 2 | „Neu, kenne niemanden" | „Wo treffe ich Leute mit KI-Interesse, Deutsch nicht zwingend?" | Community-/Meetup-Treffer diese Woche, anfängerfreundlich |
| 3 | „Hänge bei KI hinterher" | „Einsteiger-KI nach Feierabend, vor Ort" | gefilterte Treffer (Abends/Vor Ort/Einsteiger) + „weil…" |
| 4 | „Konkretes Lernziel" | „Was hilft mir diese Woche bei meiner Thesis über LLMs?" | passgenaue Auswahl; überspringt bereits Besuchtes |
| 5 | „Was lohnt sich überhaupt?" | „Lohnt sich die AI Week für mich?" | kuratierte Sessions entlang der Interessen |

---

## 4. Funktions-Strategie: Behalten · Schärfen · Streichen · Roadmap

### ✅ Behalten & in den Mittelpunkt stellen (das Produkt)
- **Scanner / KI-Agent** als *die* Oberfläche: natürliche Sprache rein, kuratierte echte Events raus.
- **Echte, belegte Datenquellen** (iCal/RSS/JSON + Websuche) — laut sagen: *„keine Halluzination, echte Events mit Quelle/Link."*
- **Interessen, Level, Historie** — aber **nur als unsichtbarer Ranking-Treibstoff** des Scanners.

### 🔧 Schärfen (höchster ROI für die Demo)
- **„Weil…"-Begründung pro Treffer** — eine Satz-Rationale, die die Personalisierung *sichtbar* macht:
  > „Weil du dich für NLP & Startups interessierst und letzten Monat beim PyData-Meetup warst."
  Macht den unsichtbaren Mehrwert in 3 Minuten greifbar. Günstig: Interessen/Historie gehen ohnehin in den Prompt — der Agent liefert zusätzlich einen Begründungssatz je Treffer.

### ✂️ Streichen oder von der Bühne nehmen (Interface-Überladung)
- **Tages-Heatmap auf der Karte:** Bei 3–8 KI-Events/Monat sind „2 Punkte" eine Pointe und entlarven dünne Daten. → Karte höchstens als **Ergebnis-Ansicht *innerhalb* einer Antwort** („hier ist der Ort von heute Abend"), nicht als eigener Tab. Code behalten, aber nicht im Pitch zeigen.
- **Überladenes Einstellungs-Formular:** 12 Interessen + Tage + Tageszeit + Modus + Level + Format + Freitext + Ort = „Steuererklärung" vor dem ersten Nutzen. Der Agent kann das meiste aus *einer* Frage ableiten. → **Zuerst fragen lassen, dann „zum Verfeinern: Interessen setzen" anbieten.**
- **Newsletter (mailto), Notizen, separater Kalender:** Standard, applaudiert niemand; auf frischem localStorage zudem leer im Demo. → in den Hintergrund.

### 🗺️ Roadmap-Slide (Vision, bewusst NICHT bauen)
- Proaktiver Agent („meldet sich von selbst": *„Lena, Donnerstag passt zu dir, 3 Bekannte gehen hin"*).
- Angebotsseite: Veranstalter-/Stadt-/AI-Week-Dashboard, Netzwerk-Effekte.
- Push/Benachrichtigungen, echte Accounts, Multi-City, automatische Quellen-Erkennung.

---

## 5. Das Demo-Risiko Nr. 1 (vom Council aufgedeckt)

Alle fünf Berater haben es einzeln übersehen — die Peer-Review brachte es einstimmig hoch:

> **Die ganze Story hängt an echten, dichten, live-parsenden Daten — und an einem
> stabilen Live-Agenten.** Bei nur wenigen Events/Monat ist das wahrscheinlichste
> Bühnen-Ergebnis: der Agent findet *nichts* oder eine Quelle bricht/limitiert.

**Absicherung vor der Präsentation:**
1. **Seed-Profil** vorbereiten (Personalisierung ist auf frischem localStorage sonst unsichtbar — Judge öffnet leeren Zustand).
2. **Gecachte Fallback-Antwort** für *eine* einstudierte Frage (kein Live-Netz-/Rate-Limit-Risiko im Wow-Moment).
3. **Leeres-Ergebnis-Pfad** mit Würde: „Diese Woche nichts Passendes — aber Donnerstag nächste Woche: …" + **sichtbare Quelle/Link** als Vertrauensbeweis.
4. Quellen vorab prüfen: liefern die Feeds für die Demo-Frage wirklich Treffer?

---

## 6. Empfohlener Demo-Ablauf (einstudieren bis flüssig)

1. **Ein Satz Pitch:** „Stadtsignal sagt dir in einem Satz, *was diese Woche in
   Würzburg für genau dich* in Tech/KI läuft — aus echten Quellen, nicht erfunden."
2. **Persona Lena** (Seed-Profil aktiv): Frage *„Wo treffe ich diese Woche KI-Leute,
   Deutsch nicht zwingend?"* → 2 echte Treffer **mit „weil…"-Begründung** + Link.
3. **Wow:** Der Agent **überspringt** ein generisches Event, das Lena schon als
   besucht markiert hat → sichtbarer Beweis für Personalisierung.
4. **Persona Markus** (eine Präferenz live umstellen: „Vor Ort/Einsteiger") → Auswahl
   ändert sich nachvollziehbar.
5. **Roadmap-Slide:** proaktiver Agent + Angebotsseite (Stadt/AI Week) als Ausblick.

**Leitprinzip:** *Eine* Persona, *eine* Frage, *ein* sichtbares „weil" — perfekt
einstudiert. Lieber ein makelloser Flow als fünf wacklige Features.

---

## 6b. Personalisierungs-Strategie (2. Council-Runde)

**Leitsatz:** Eine *schlanke stabile Schicht* + *Ableitung aus der Anfrage* schlägt ein großes Formular — und ist ehrlicher.

- **Stabil & explizit (bleibt):** Interessen-Tags · Bevorzugter Ort · Freitext-Fokus. (Doppeln als Such-Keywords bei dünnen Eventdaten.)
- **Pro-Anfrage & implizit (aus dem Satz abgeleitet vom Agenten):** Tag, Tageszeit, Online/Vor Ort, Level, Format — z. B. „Einsteiger-Workshop **heute Abend vor Ort**".
- **Verhaltenssignale (wachsen mit der Nutzung):** Suchverlauf, „Besucht"-Markierungen, „In Kalender"-Klicks (= stärkstes Signal, weil echte Zeit-Investition).
- **„weil …"-Begründung:** nur auf *tatsächlich vorhandene* Signale gestützt — **nie** einen Besuch/ein Interesse erfinden. Cold-Start: begründet schlicht über die Anfrage + (Default-)Interessen.
- **Demo-Absicherung:** `?demo=1` bzw. Button „Demo-Profil laden" befüllt Interessen/Fokus/Besucht/Suchverlauf, damit die Personalisierung bei t=0 sofort sichtbar ist.

### Umgesetzte Funktionen (Stand 2026-06-26)
1. **Suchverlauf** → fließt als weiches Signal in den Agenten ein.
2. **„weil …"-Begründung** pro Treffer (adaptiv, nur echte Signale).
3. **„In Kalender" (.ics)** pro Event — Hero, Treffer-Karten, Top-3, Karten-Popup.
4. **Verschlanktes Präferenz-Formular** (nur Fokus + Ort) + Gemini-Ableitung der übrigen Filter.
5. **Demo-Profil** (`?demo=1` / Button) für die Präsentation.

### Offene Voraussetzung
- Agent online/lokal braucht **`GEMINI_API_KEY`** (nicht `ANTHROPIC_API_KEY`). Key: aistudio.google.com/apikey. Lokal in `.env`, bei Vercel als Environment-Variable.

---

## 7. Anhang — Council-Kurzfassung

- **Einigkeit:** Scanner ist das Produkt; Karte/Heatmap & überladene Settings lenken ab; Personalisierung muss *sichtbar* werden; Personas Lena & Markus tragen.
- **Streit:** Wie groß denken? Vision (proaktiver Agent, B2B/Stadt, Netzwerk-Effekte) vs. radikaler Fokus auf den einen Demo-Moment. → Auflösung: **Vision auf die Roadmap-Slide, Bühne gehört dem fokussierten Scanner.**
- **Blinder Fleck (Peer-Review):** Daten-/Live-Demo-Risiko — mit Seed-Profil + gecachter Fallback-Antwort + würdevollem Leer-Pfad absichern.
