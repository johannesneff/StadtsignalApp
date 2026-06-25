/* Stadtsignal — Agenten-Scoring.
   Bewertet Events anhand von aktiven Interessen, Historie und zeitlicher Nähe.
   In Produktion ersetzbar durch ein echtes KI-Backend (z. B. Claude API). */

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

/** Bewertet ein einzelnes Event -> { event, score (0..1), reasons[] }. */
function scoreEvent(event, input) {
  const interests = input.interests || [];
  const historyTags = input.historyTags || [];
  const reasons = [];
  let raw = 0;

  // Interessen-Überlappung (max 0.55)
  const overlap = event.tags.filter((t) => interests.includes(t));
  if (overlap.length > 0) {
    raw += Math.min(0.55, 0.32 + overlap.length * 0.12);
    reasons.push("passt zu deinen Interessen (" + overlap.map(categoryLabel).join(", ") + ")");
  }

  // Affinität zur Historie (max 0.25)
  if (historyTags.length > 0) {
    const histOverlap = event.tags.filter((t) => historyTags.includes(t)).length;
    if (histOverlap > 0) {
      raw += Math.min(0.25, 0.1 + histOverlap * 0.08);
      reasons.push("ähnlich zu Events, die du besucht hast");
    }
  }

  // Zeitliche Nähe / Aktualität (max 0.2)
  const delta = new Date(event.startsAt).getTime() - Date.now();
  if (delta > -HOUR * 6) {
    const days = Math.max(0, delta / DAY);
    raw += Math.max(0, 0.2 - days * 0.025);
    if (days < 1) reasons.push("findet heute oder morgen statt");
    else if (days < 3) reasons.push("steht zeitlich kurz bevor");
  }

  // Immer etwas anbieten
  if (raw === 0) {
    raw = 0.12;
    reasons.push("Entdeckungs-Tipp jenseits deiner Filter");
  }

  return { event, score: Math.min(1, raw), reasons };
}

/** Bewertet und sortiert alle Events absteigend nach Score. */
function scoreAndRank(events, input) {
  return events
    .map((e) => scoreEvent(e, input))
    .sort((a, b) => b.score - a.score);
}

/** Aggregiert die Tags aller besuchten Events zu einem Interessen-Profil. */
function aggregateHistoryTags(history, events) {
  const set = new Set();
  for (const id of history) {
    const ev = events.find((e) => e.id === id);
    if (ev) ev.tags.forEach((t) => set.add(t));
  }
  return [...set];
}
