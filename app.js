/* Stadtsignal — App-Logik (klassisches Script, kein Build).
   Direkt per Doppelklick auf index.html im Browser öffenbar (file://).
   Nutzt globale Symbole aus data.js (INTERESTS, EVENTS, interestColor …)
   und scoring.js (scoreAndRank, aggregateHistoryTags).
   Drei Bereiche: Übersicht (Karte + Kalender) · Scanner (KI-Agent) · Einstellungen. */

(function () {
  "use strict";

  const DAY = 1000 * 60 * 60 * 24;
const WUERZBURG = [49.7913, 9.9534];

/* ---------------------- State ---------------------- */
const LS_KEY = "stadtsignal.v2";
const defaultState = {
  interests: ["ai", "dev", "security", "data"],
  history: [],
  notes: {},
  name: "",
  email: "",
  rhythm: "weekly",
  autoSend: false,
  locationHints: false,
  // Zuletzt gesuchte Anfragen (lokal, fließen als Signal in den Agenten ein).
  searchHistory: [],
  // Stabile Präferenzen: Fokus/Ziele + bevorzugter Ort. Zeit/Tag/Modus/Level/Format
  // werden NICHT mehr per Formular abgefragt, sondern vom Agenten aus der Anfrage abgeleitet.
  prefs: { focus: "", area: "" },
};
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = Object.assign({}, defaultState, JSON.parse(raw));
      s.prefs = Object.assign({}, defaultState.prefs, s.prefs || {}); // alte States migrieren
      return s;
    }
  } catch (e) { /* ignore */ }
  return Object.assign({}, defaultState, { prefs: Object.assign({}, defaultState.prefs) });
}
const state = loadState();
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* ---------------------- Helpers ---------------------- */
function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(node.dataset, v);
      else node.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return node;
}
const $ = (sel, root) => (root || document).querySelector(sel);
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const WD = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
function pad(n) { return String(n).padStart(2, "0"); }
function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}., ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}
function fmtTime(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`; }
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function dayOffset(iso) { return Math.round((new Date(iso).setHours(0, 0, 0, 0) - startOfToday().getTime()) / DAY); }
function sameDay(iso, date) {
  const d = new Date(iso);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
}
// Ende eines Events (oder Start + 3 h, falls kein Ende bekannt).
function eventEnd(e) {
  return e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + 3 * 60 * 60 * 1000;
}
// Abgelaufen = bereits beendet. Laufende (gestartet, noch nicht beendet) gelten als aktiv.
function isExpired(e) { return eventEnd(e) < Date.now(); }
function activeEvents() { return EVENTS.filter((e) => !isExpired(e)); }

function scoreInput() {
  return { interests: state.interests, historyTags: aggregateHistoryTags(state.history, EVENTS) };
}
function isVisited(id) { return state.history.includes(id); }
function toggleVisited(id) {
  const i = state.history.indexOf(id);
  if (i >= 0) {
    // Entfernen: existiert eine Notiz, erst separat bestätigen (kein automatisches Löschen).
    const note = (state.notes[id] || "").trim();
    if (note && !window.confirm("Zu diesem Event existiert eine Notiz.\n\nEvent wirklich aus „Besucht\" entfernen? Die zugehörige Notiz wird dabei gelöscht.")) {
      return;
    }
    if (note) delete state.notes[id];
    state.history.splice(i, 1);
  } else {
    state.history.push(id);
  }
  save();
  renderEinstellungen(); renderScanner();
  if (currentScreen === "uebersicht") renderUebersicht();
}

/* ---------------------- Icons ---------------------- */
const I = {
  // Übersicht — gestapelte Ebenen (vom Nutzer geliefert: Übersicht.svg)
  overview: '<svg class="ico" viewBox="0 0 26 29" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M24.082 18.7207C24.9707 19.2383 25.3418 19.6484 25.3418 20.2832C25.3418 20.9082 24.9707 21.3184 24.082 21.8457L14.0918 27.627C13.5547 27.9492 13.125 28.0957 12.666 28.0957C12.2168 28.0957 11.7871 27.9492 11.2402 27.627L1.25977 21.8457C0.361328 21.3184 0 20.9082 0 20.2832C0 19.6484 0.361328 19.2383 1.25977 18.7207L3.64969 17.334L5.41249 18.3568L2.35352 20.1074C2.28516 20.1465 2.22656 20.1953 2.22656 20.2832C2.22656 20.3613 2.28516 20.4102 2.35352 20.4492L12.1484 26.0547C12.3438 26.1719 12.5 26.2305 12.666 26.2305C12.8418 26.2305 12.9883 26.1719 13.1836 26.0547L22.9785 20.4492C23.0566 20.4102 23.1055 20.3613 23.1055 20.2832C23.1055 20.1953 23.0566 20.1465 22.9785 20.1074L19.9224 18.3585L21.6898 17.334L24.082 18.7207Z"/><path d="M24.082 12.8223C24.9707 13.3496 25.3418 13.7598 25.3418 14.3848C25.3418 15.0195 24.9707 15.4297 24.082 15.9473L14.0918 21.7383C13.5547 22.0508 13.125 22.207 12.666 22.207C12.2168 22.207 11.7871 22.0508 11.2402 21.7383L1.25977 15.9473C0.361328 15.4297 0 15.0195 0 14.3848C0 13.7598 0.361328 13.3496 1.25977 12.8223L3.95264 11.2598L5.72309 12.287L2.35352 14.2188C2.28516 14.2578 2.22656 14.3066 2.22656 14.3848C2.22656 14.4727 2.28516 14.5117 2.35352 14.5605L12.1484 20.166C12.3438 20.2734 12.5 20.332 12.666 20.332C12.8418 20.332 12.9883 20.2734 13.1836 20.166L22.9785 14.5605C23.0566 14.5117 23.1055 14.4727 23.1055 14.3848C23.1055 14.3066 23.0566 14.2578 22.9785 14.2188L19.6117 12.2886L21.3865 11.2598L24.082 12.8223Z"/><path d="M12.666 15.957C13.125 15.957 13.5547 15.8008 14.0918 15.4883L24.082 9.69727C24.9707 9.17969 25.3418 8.76953 25.3418 8.13477C25.3418 7.50977 24.9707 7.09961 24.082 6.57227L14.0918 0.791016C13.5547 0.46875 13.125 0.322266 12.666 0.322266C12.2168 0.322266 11.7871 0.46875 11.2402 0.791016L1.25977 6.57227C0.361328 7.09961 0 7.50977 0 8.13477C0 8.76953 0.361328 9.17969 1.25977 9.69727L11.2402 15.4883C11.7871 15.8008 12.2168 15.957 12.666 15.957ZM12.666 14.082C12.5 14.082 12.3438 14.0234 12.1484 13.916L2.35352 8.31055C2.28516 8.26172 2.22656 8.22266 2.22656 8.13477C2.22656 8.05664 2.28516 8.00781 2.35352 7.96875L12.1484 2.35352C12.3438 2.24609 12.5 2.1875 12.666 2.1875C12.8418 2.1875 12.9883 2.24609 13.1836 2.35352L22.9785 7.96875C23.0566 8.00781 23.1055 8.05664 23.1055 8.13477C23.1055 8.22266 23.0566 8.26172 22.9785 8.31055L13.1836 13.916C12.9883 14.0234 12.8418 14.082 12.666 14.082Z"/></svg>',
  // Scanner-Tab — Punktraster (vom Nutzer geliefert: Scanner.svg)
  scanner: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5.11719 1.63086C5.56641 1.63086 5.92773 1.26953 5.92773 0.820312C5.92773 0.380859 5.56641 0.0195312 5.11719 0.0195312C4.66797 0.0195312 4.30664 0.380859 4.30664 0.820312C4.30664 1.26953 4.66797 1.63086 5.11719 1.63086ZM9.42383 1.63086C9.87305 1.63086 10.2344 1.26953 10.2344 0.820312C10.2344 0.380859 9.87305 0.0195312 9.42383 0.0195312C8.98438 0.0195312 8.62305 0.380859 8.62305 0.820312C8.62305 1.26953 8.98438 1.63086 9.42383 1.63086ZM13.7402 1.63086C14.1797 1.63086 14.541 1.26953 14.541 0.820312C14.541 0.380859 14.1797 0.0195312 13.7402 0.0195312C13.291 0.0195312 12.9297 0.380859 12.9297 0.820312C12.9297 1.26953 13.291 1.63086 13.7402 1.63086ZM18.0469 1.63086C18.4961 1.63086 18.8574 1.26953 18.8574 0.820312C18.8574 0.380859 18.4961 0.0195312 18.0469 0.0195312C17.6074 0.0195312 17.2461 0.380859 17.2461 0.820312C17.2461 1.26953 17.6074 1.63086 18.0469 1.63086ZM0.810547 6.02539C1.25 6.02539 1.61133 5.66406 1.61133 5.21484C1.61133 4.76562 1.25 4.4043 0.810547 4.4043C0.361328 4.4043 0 4.76562 0 5.21484C0 5.66406 0.361328 6.02539 0.810547 6.02539ZM5.11719 6.23047C5.67383 6.23047 6.13281 5.78125 6.13281 5.21484C6.13281 4.6582 5.67383 4.19922 5.11719 4.19922C4.55078 4.19922 4.10156 4.6582 4.10156 5.21484C4.10156 5.78125 4.55078 6.23047 5.11719 6.23047ZM9.42383 6.48438C10.1172 6.48438 10.6934 5.9082 10.6934 5.21484C10.6934 4.52148 10.1172 3.94531 9.42383 3.94531C8.74023 3.94531 8.16406 4.52148 8.16406 5.21484C8.16406 5.9082 8.74023 6.48438 9.42383 6.48438ZM13.7402 6.48438C14.4336 6.48438 15 5.9082 15 5.21484C15 4.52148 14.4336 3.94531 13.7402 3.94531C13.0469 3.94531 12.4707 4.52148 12.4707 5.21484C12.4707 5.9082 13.0469 6.48438 13.7402 6.48438ZM18.0469 6.23047C18.6133 6.23047 19.0625 5.78125 19.0625 5.21484C19.0625 4.6582 18.6133 4.19922 18.0469 4.19922C17.4902 4.19922 17.0312 4.6582 17.0312 5.21484C17.0312 5.78125 17.4902 6.23047 18.0469 6.23047ZM22.3633 6.02539C22.8027 6.02539 23.1641 5.66406 23.1641 5.21484C23.1641 4.76562 22.8027 4.4043 22.3633 4.4043C21.9141 4.4043 21.5527 4.76562 21.5527 5.21484C21.5527 5.66406 21.9141 6.02539 22.3633 6.02539ZM0.810547 10.4297C1.25 10.4297 1.61133 10.0684 1.61133 9.62891C1.61133 9.17969 1.25 8.79883 0.810547 8.79883C0.361328 8.79883 0 9.17969 0 9.62891C0 10.0684 0.361328 10.4297 0.810547 10.4297ZM5.11719 10.8691C5.81055 10.8691 6.38672 10.293 6.38672 9.60938C6.38672 8.91602 5.81055 8.33984 5.11719 8.33984C4.42383 8.33984 3.84766 8.91602 3.84766 9.60938C3.84766 10.293 4.42383 10.8691 5.11719 10.8691ZM18.0469 10.8691C18.7402 10.8691 19.3164 10.293 19.3164 9.60938C19.3164 8.91602 18.7402 8.33984 18.0469 8.33984C17.3535 8.33984 16.7773 8.91602 16.7773 9.60938C16.7773 10.293 17.3535 10.8691 18.0469 10.8691ZM22.3633 10.4297C22.8027 10.4297 23.1641 10.0684 23.1641 9.62891C23.1641 9.17969 22.8027 8.79883 22.3633 8.79883C21.9141 8.79883 21.5527 9.17969 21.5527 9.62891C21.5527 10.0684 21.9141 10.4297 22.3633 10.4297ZM0.810547 14.8047C1.25 14.8047 1.61133 14.4434 1.61133 13.9941C1.61133 13.5547 1.25 13.1934 0.810547 13.1934C0.361328 13.1934 0 13.5547 0 13.9941C0 14.4434 0.361328 14.8047 0.810547 14.8047ZM5.11719 15.2832C5.81055 15.2832 6.38672 14.707 6.38672 14.0137C6.38672 13.3203 5.81055 12.7539 5.11719 12.7539C4.42383 12.7539 3.84766 13.3203 3.84766 14.0137C3.84766 14.707 4.42383 15.2832 5.11719 15.2832ZM18.0469 15.2832C18.7402 15.2832 19.3164 14.707 19.3164 14.0137C19.3164 13.3203 18.7402 12.7539 18.0469 12.7539C17.3535 12.7539 16.7773 13.3203 16.7773 14.0137C16.7773 14.707 17.3535 15.2832 18.0469 15.2832ZM22.3633 14.8047C22.8027 14.8047 23.1641 14.4434 23.1641 13.9941C23.1641 13.5547 22.8027 13.1934 22.3633 13.1934C21.9141 13.1934 21.5527 13.5547 21.5527 13.9941C21.5527 14.4434 21.9141 14.8047 22.3633 14.8047ZM0.810547 19.209C1.25 19.209 1.61133 18.8477 1.61133 18.4082C1.61133 17.959 1.25 17.5977 0.810547 17.5977C0.361328 17.5977 0 17.959 0 18.4082C0 18.8477 0.361328 19.209 0.810547 19.209ZM5.11719 19.4238C5.67383 19.4238 6.13281 18.9648 6.13281 18.4082C6.13281 17.8418 5.67383 17.3926 5.11719 17.3926C4.55078 17.3926 4.10156 17.8418 4.10156 18.4082C4.10156 18.9648 4.55078 19.4238 5.11719 19.4238ZM9.42383 19.6777C10.1172 19.6777 10.6934 19.1016 10.6934 18.4082C10.6934 17.7148 10.1172 17.1387 9.42383 17.1387C8.74023 17.1387 8.16406 17.7148 8.16406 18.4082C8.16406 19.1016 8.74023 19.6777 9.42383 19.6777ZM13.7402 19.6777C14.4336 19.6777 15 19.1016 15 18.4082C15 17.7148 14.4336 17.1387 13.7402 17.1387C13.0469 17.1387 12.4707 17.7148 12.4707 18.4082C12.4707 19.1016 13.0469 19.6777 13.7402 19.6777ZM18.0469 19.4238C18.6133 19.4238 19.0625 18.9648 19.0625 18.4082C19.0625 17.8418 18.6133 17.3926 18.0469 17.3926C17.4902 17.3926 17.0312 17.8418 17.0312 18.4082C17.0312 18.9648 17.4902 19.4238 18.0469 19.4238ZM22.3633 19.209C22.8027 19.209 23.1641 18.8477 23.1641 18.4082C23.1641 17.959 22.8027 17.5977 22.3633 17.5977C21.9141 17.5977 21.5527 17.959 21.5527 18.4082C21.5527 18.8477 21.9141 19.209 22.3633 19.209ZM5.11719 23.6035C5.56641 23.6035 5.92773 23.2422 5.92773 22.793C5.92773 22.3535 5.56641 21.9922 5.11719 21.9922C4.66797 21.9922 4.30664 22.3535 4.30664 22.793C4.30664 23.2422 4.66797 23.6035 5.11719 23.6035ZM9.42383 23.6035C9.87305 23.6035 10.2344 23.2422 10.2344 22.793C10.2344 22.3535 9.87305 21.9922 9.42383 21.9922C8.98438 21.9922 8.62305 22.3535 8.62305 22.793C8.62305 23.2422 8.98438 23.6035 9.42383 23.6035ZM13.7402 23.6035C14.1797 23.6035 14.541 23.2422 14.541 22.793C14.541 22.3535 14.1797 21.9922 13.7402 21.9922C13.291 21.9922 12.9297 22.3535 12.9297 22.793C12.9297 23.2422 13.291 23.6035 13.7402 23.6035ZM18.0469 23.6035C18.4961 23.6035 18.8574 23.2422 18.8574 22.793C18.8574 22.3535 18.4961 21.9922 18.0469 21.9922C17.6074 21.9922 17.2461 22.3535 17.2461 22.793C17.2461 23.2422 17.6074 23.6035 18.0469 23.6035ZM9.42383 10.8691C10.1172 10.8691 10.6934 10.293 10.6934 9.60938C10.6934 8.91602 10.1172 8.33984 9.42383 8.33984C8.74023 8.33984 8.16406 8.91602 8.16406 9.60938C8.16406 10.293 8.74023 10.8691 9.42383 10.8691ZM13.7402 10.8691C14.4336 10.8691 15 10.293 15 9.60938C15 8.91602 14.4336 8.33984 13.7402 8.33984C13.0469 8.33984 12.4707 8.91602 12.4707 9.60938C12.4707 10.293 13.0469 10.8691 13.7402 10.8691ZM9.42383 15.2832C10.1172 15.2832 10.6934 14.707 10.6934 14.0137C10.6934 13.3203 10.1172 12.7539 9.42383 12.7539C8.74023 12.7539 8.16406 13.3203 8.16406 14.0137C8.16406 14.707 8.74023 15.2832 9.42383 15.2832ZM13.7402 15.2832C14.4336 15.2832 15 14.707 15 14.0137C15 13.3203 14.4336 12.7539 13.7402 12.7539C13.0469 12.7539 12.4707 13.3203 12.4707 14.0137C12.4707 14.707 13.0469 15.2832 13.7402 15.2832Z"/></svg>',
  sparkle: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5C10.4 6.7 11.7 5.4 12 2.5Zm6.5 9c.2 1.7 1 2.5 2.7 2.7-1.7.2-2.5 1-2.7 2.7-.2-1.7-1-2.5-2.7-2.7 1.7-.2 2.5-1 2.7-2.7Zm-12 2c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2Z"/></svg>',
  // Einstellungen-Tab — Konto/Person (vom Nutzer geliefert: einstellungen.svg)
  settings: '<svg class="ico" viewBox="0 0 22 23" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2.06055 22.5195H19.0723C20.3516 22.5195 21.1328 21.9043 21.1328 20.9082C21.1328 17.666 17.0801 13.1934 10.5664 13.1934C4.05273 13.1934 0 17.666 0 20.9082C0 21.9043 0.78125 22.5195 2.06055 22.5195ZM10.5762 10.9375C13.3008 10.9375 15.5859 8.51562 15.5859 5.39062C15.5859 2.33398 13.2812 0 10.5762 0C7.88086 0 5.57617 2.37305 5.57617 5.41016C5.57617 8.51562 7.86133 10.9375 10.5762 10.9375Z"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><circle cx="12" cy="12" r="2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>',
};

/* ---------------------- Bausteine ---------------------- */
function header(title, subtitle, action) {
  return h("div", { class: "page-header" },
    h("div", { class: "glyph", html: I.radio }),
    h("div", {}, h("h1", {}, title), h("p", {}, subtitle)),
    action ? h("div", { class: "header-action" }, action) : null,
  );
}
function hexA(hex, a) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function categoryTag(catId) {
  return h("span", { class: "tag", style: { background: hexA(interestColor(catId), 0.12), color: interestColor(catId) } },
    h("span", { class: "dot", style: { background: interestColor(catId) } }), categoryLabel(catId));
}
// Ehrliches Label: der Sammeltopf „dev" (= „Web-Entwicklung") wird, wenn möglich,
// durch den spezifischeren Tag ersetzt (Startups, DevOps & Cloud, UX/UI …).
function eventLabel(ev) {
  if (ev.category === "dev") {
    const SPEC = ["startup", "cloud", "ux", "robotics", "oss", "mobile", "blockchain", "gaming"];
    const t = (ev.tags || []).find((x) => SPEC.includes(x));
    if (t && INTEREST_BY_ID[t]) return INTEREST_BY_ID[t].label;
  }
  return categoryLabel(ev.category);
}
// Farbiger Tag mit dem ehrlichen Label (Farbe weiter aus der 4er-Kategorie).
function eventTag(ev) {
  const c = interestColor(ev.category);
  return h("span", { class: "tag", style: { background: hexA(c, 0.12), color: c } },
    h("span", { class: "dot", style: { background: c } }), eventLabel(ev));
}
function eventRow(ev, onClick) {
  const d = new Date(ev.startsAt);
  return h("button", { class: "event-row", onclick: onClick },
    h("div", { class: "event-date" }, h("div", { class: "d tnum" }, String(d.getDate())), h("div", { class: "m" }, MONTHS_SHORT[d.getMonth()])),
    h("div", { class: "event-main" },
      h("div", { class: "t" }, ev.title),
      h("div", { class: "meta" },
        eventTag(ev), h("span", {}, "· " + fmtTime(ev.startsAt)), h("span", {}, "· " + ev.location),
        isVisited(ev.id) ? h("span", { style: { color: "#34c759", fontWeight: "600" } }, "· ✓ besucht") : null),
    ),
    h("div", {}, ""),
  );
}

// Treffer-Karte mit Match-Score, Karten-Sprung und Link zur Eventseite.
// Ehrliches Link-Label: ein bei totem Link ersetzter Suchlink heißt „Event suchen".
function linkLabel(ev) { return ev.linkIsSearch ? "Event suchen →" : "Zur Eventseite →"; }
// Trust-Zeile: „✓ Link geprüft" nur, wenn der Server die Seite wirklich erreicht hat.
function trustLine(ev) {
  const src = ev.source || "";
  if (ev.linkVerified) return h("div", { class: "trust-line" }, h("span", { class: "verified" }, "✓ Link geprüft"), src ? "· " + src : null);
  if (src) return h("div", { class: "trust-line" }, h("span", { class: "muted" }, "Quelle: " + src));
  return null;
}
// Frische-Stempel: nur bei echten (live geladenen) Events.
function freshnessLine() {
  if (!EVENTS_META.live) return null;
  const t = EVENTS_META.fetchedAt ? new Date(EVENTS_META.fetchedAt) : new Date();
  const n = (EVENTS_META.sources || []).length;
  return h("div", { class: "freshness" }, `✓ ${EVENTS_META.count} echte Events aus ${n} Quelle${n === 1 ? "" : "n"} · Stand ${pad(t.getHours())}:${pad(t.getMinutes())} Uhr`);
}

function recoItem(ev, score, extraMeta) {
  const meta = eventLabel(ev) + " · " + fmtDateTime(ev.startsAt) + (extraMeta ? " · " + extraMeta : "");
  return h("div", { class: "reco-item" },
    h("div", {},
      h("button", { class: "reco-title", onclick: () => goToMap(ev.id) }, ev.title),
      h("div", { class: "meta" }, meta),
      h("div", { class: "reco-actions" },
        h("button", { class: "reco-link", onclick: () => goToMap(ev.id) }, "Auf der Karte"),
        h("button", { class: "reco-link", onclick: () => downloadIcs(ev) }, "In Kalender"),
        h("a", { class: "reco-link", href: ev.url, target: "_blank", rel: "noopener" }, linkLabel(ev)),
      ),
      trustLine(ev),
    ),
    h("span", { class: "match" }, Math.round(score * 100) + "%"),
  );
}

/* ============================================================
   SCANNER (KI-Agent + lokale Empfehlungen)
   ============================================================ */
// Persönliche Anrede auf der Startseite: „Was suchst du heute, Johannes?"
// Nutzt nur den ersten Namensteil; ohne Namen die neutrale Variante.
function firstName() {
  return (state.name || "").trim().split(/\s+/)[0] || "";
}
function greeting() {
  const n = firstName();
  return n ? `Was suchst du heute, ${n}?` : "Was suchst du heute?";
}
// Begrüßung live aktualisieren, sobald der Name getippt wird (kein Full-Rerender nötig).
function updateGreeting() {
  const el = document.getElementById("scannerGreeting");
  if (el) el.textContent = greeting();
}

function renderScanner() {
  const root = $("#screen-scanner");
  if (!root) return;
  clear(root);
  root.appendChild(header("Scanner", "Dein KI-Tech-Radar für Würzburg"));

  const body = h("div", { class: "screen-body" });
  const left = h("div", { style: { display: "grid", gap: "18px" } });

  const input = h("input", { class: "search-input", type: "text", placeholder: 'z. B. „KI-Workshops nächste Woche"', "aria-label": "Suche" });
  const goBtn = h("button", { class: "search-go", html: I.send, "aria-label": "Suchen" });
  const thinking = h("div", { class: "thinking" });
  const results = h("div", {});
  const runSearch = () => runScannerSearch(input.value, thinking, results, goBtn);
  goBtn.addEventListener("click", runSearch);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

  const suggestions = ["KI-Events diese Woche", "Workshops für Einsteiger", "Was ist heute Abend los?", "Wo lerne ich was über Security?"];
  const sugRow = h("div", { class: "chip-row" },
    suggestions.map((s) => h("button", { class: "chip", onclick: () => { input.value = s; runSearch(); } }, s)));

  left.appendChild(h("div", { class: "card" },
    h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Frag den Agenten"),
    h("h2", { class: "section-title", id: "scannerGreeting", style: { margin: "8px 0 16px" } }, greeting()),
    h("div", { class: "search-wrap" }, input, goBtn),
    h("div", { style: { marginTop: "14px" } }, sugRow),
    freshnessLine(),
    thinking, results,
  ));

  const ranked = scoreAndRank(activeEvents(), scoreInput());
  const top = ranked[0];
  if (top) {
    const ev = top.event;
    left.appendChild(h("div", { class: "card hero" },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Empfehlung des Tages"),
        h("span", { class: "match" }, Math.round(top.score * 100) + "% Match")),
      h("div", { class: "muted small", style: { marginTop: "4px" } }, "Persönlich für dich"),
      h("div", { class: "hero-title" }, ev.title),
      h("div", { class: "hero-meta" }, eventTag(ev), h("span", {}, "· " + fmtDateTime(ev.startsAt)), h("span", {}, "· " + ev.location)),
      h("p", { class: "reason" }, top.reasons.join(" · ")),
      h("div", { style: { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" } },
        h("button", { class: "btn primary", onclick: () => goToMap(ev.id) }, "Auf der Karte zeigen"),
        h("button", { class: "btn", onclick: () => downloadIcs(ev) }, h("span", { html: I.calendar }), "In Kalender"),
        h("button", { class: "btn", onclick: () => toggleVisited(ev.id) }, isVisited(ev.id) ? "✓ Besucht" : "Als besucht markieren"),
        h("a", { class: "btn", href: ev.url, target: "_blank", rel: "noopener" }, ev.linkIsSearch ? "Event suchen" : "Zur Eventseite")),
    ));
  }

  const next = ranked.filter((r) => dayOffset(r.event.startsAt) <= 14).slice(0, 3);
  left.appendChild(h("div", { class: "card" },
    h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Top 3 in den nächsten 14 Tagen"),
    h("div", { class: "reco-list", style: { marginTop: "14px" } },
      next.map((r) => recoItem(r.event, r.score)),
    ),
  ));

  body.appendChild(left);
  root.appendChild(body);
}

// Suchanfrage lokal merken (jüngste zuerst, ohne Duplikate, max. 10).
function recordSearch(query) {
  const q = (query || "").trim();
  if (!q) return;
  state.searchHistory = [q, ...state.searchHistory.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10);
  save();
}

async function runScannerSearch(query, thinkingEl, resultsEl, goBtn) {
  query = (query || "").trim();
  if (!query) return;
  recordSearch(query);
  clear(thinkingEl); clear(resultsEl);
  if (goBtn) goBtn.disabled = true;

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const steps = [
    "Verlauf analysieren …",
    "Schwerpunkte erkennen (" + (state.interests.map((i) => INTEREST_BY_ID[i].short).slice(0, 3).join(", ") || "alle") + ") …",
    `Anfrage interpretieren: „${query}" …`,
    "Quellen durchsuchen: Meetup · Eventbrite · Uni · ZDI · Heise …",
    "Bewerten & nach deinem Profil sortieren …",
  ];
  steps.forEach((s, idx) => thinkingEl.appendChild(
    h("div", { class: "think-step", style: { animationDelay: (reduced ? 0 : idx * 0.4) + "s" } }, h("span", { class: "tick" }, "✓"), s)));

  // Bei jeder Anfrage zuerst aktuelle Events abrufen (cache-gestützt),
  // damit der Agent genau diese in die Vorschläge einbezieht.
  await fetchEvents(false);

  // Echten Agenten versuchen; bei Fehler/ohne Key -> lokaler Fallback.
  let realText = null;
  try {
    const r = await fetch("/api/agent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        now: new Date().toISOString(),
        interestLabels: state.interests.map((i) => (INTEREST_BY_ID[i] || {}).label || i),
        prefs: prefsForAgent(),
        history: state.history,
        recentSearches: state.searchHistory.slice(0, 5),
        events: activeEvents().map((e) => ({ id: e.id, title: e.title, category: e.category, tags: e.tags, startsAt: e.startsAt, endsAt: e.endsAt || null, location: e.location, description: e.description })),
      }),
    });
    if (r.ok) { const d = await r.json(); realText = (d && d.text) ? d.text : null; }
  } catch (e) { /* offline / kein Endpoint */ }

  // Mindestdauer für die Thinking-Animation, damit sie sichtbar ist.
  if (!reduced) await new Promise((res) => setTimeout(res, steps.length * 400 + 150));
  clear(resultsEl);
  if (realText) renderAgentAnswer(resultsEl, realText, "KI · Gemini");
  else renderFallback(resultsEl, query);
  if (goBtn) goBtn.disabled = false;
}

function eventIdsInText(text) {
  const ids = [];
  const re = /\[([a-z]\d+)\]/gi;
  let m;
  while ((m = re.exec(text))) { const id = m[1]; if (EVENTS.some((e) => e.id === id) && !ids.includes(id)) ids.push(id); }
  return ids;
}
function formatAgentText(text) {
  // Escapen, dann **fett**, dann URLs (z. B. aus dem Websuche-Abschnitt) klickbar machen.
  let safe = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/(https?:\/\/[^\s<]+[^\s<.,;:)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return safe;
}
// Zerlegt die Agenten-Antwort in 📍 Pool-Treffer und 🌐 Web-Funde.
function parseAgentText(text) {
  const poolHits = [], webHits = [];
  let section = "";
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("🧠")) { section = "think"; continue; }
    if (line.startsWith("📍")) { section = "pool"; continue; }
    if (line.startsWith("🌐")) { section = "web"; continue; }
    if (section === "pool" && line.includes("[")) {
      let m = line.match(/\[([a-z0-9_-]+)\][^*]*\*\*(.+?)\*\*\s*[—–-]+\s*Match\s*(\d+)\s*%\s*[—–-]+\s*(.+)$/i);
      if (m) { poolHits.push({ id: m[1], match: +m[3], reason: m[4].trim() }); continue; }
      m = line.match(/\[([a-z0-9_-]+)\][^*]*\*\*(.+?)\*\*\s*[—–-]+\s*(.+)$/i);
      if (m) { poolHits.push({ id: m[1], reason: m[3].trim() }); continue; }
      m = line.match(/\[([a-z0-9_-]+)\]/i);
      if (m) poolHits.push({ id: m[1] });
    } else if (section === "web" && line.startsWith("-")) {
      const body = line.replace(/^[-\s]+/, "");
      const tm = body.match(/\*\*(.+?)\*\*/);
      const um = body.match(/https?:\/\/[^\s)]+/);
      const url = um ? um[0] : "";
      const title = (tm ? tm[1] : body.split(/\s[—–-]\s/)[0]).replace(/\*\*/g, "").trim();
      const middle = body.replace(/\*\*.+?\*\*/, "").replace(url, "");
      const parts = middle.split(/\s[—–-]\s/).map((s) => s.replace(/^[—–\-\s]+|[—–\-\s]+$/g, "")).filter(Boolean);
      if (title) webHits.push({ title, meta: parts.join(" · "), url });
    }
  }
  return { poolHits, webHits };
}

// Pool-Treffer als Panel-Karte (Begründung des Agenten + Match + Links).
function recoCard(ev, match, reason) {
  const pct = (match != null) ? match : Math.round(scoreAndRank([ev], scoreInput())[0].score * 100);
  return h("div", { class: "reco-item" },
    h("div", {},
      h("button", { class: "reco-title", onclick: () => goToMap(ev.id) }, ev.title),
      h("div", { class: "meta" }, eventLabel(ev) + " · " + fmtDateTime(ev.startsAt) + (ev.location ? " · " + ev.location : "")),
      reason ? h("div", { class: "reco-reason" }, reason) : null,
      h("div", { class: "reco-actions" },
        h("button", { class: "reco-link", onclick: () => goToMap(ev.id) }, "Auf der Karte"),
        h("button", { class: "reco-link", onclick: () => downloadIcs(ev) }, "In Kalender"),
        h("a", { class: "reco-link", href: ev.url, target: "_blank", rel: "noopener" }, linkLabel(ev))),
      trustLine(ev)),
    h("span", { class: "match" }, pct + "%"));
}

// Web-Fund als Panel-Karte (Titel verlinkt, Meta, „Web"-Badge).
function webCard(w) {
  return h("div", { class: "reco-item" },
    h("div", {},
      w.url
        ? h("a", { class: "reco-title", href: w.url, target: "_blank", rel: "noopener" }, w.title)
        : h("div", { class: "reco-title" }, w.title),
      w.meta ? h("div", { class: "meta" }, w.meta) : null,
      w.url ? h("div", { class: "reco-actions" }, h("a", { class: "reco-link", href: w.url, target: "_blank", rel: "noopener" }, "Zur Eventseite →")) : null),
    h("span", { class: "match", style: { background: "#ececef", color: "#6e6e73" } }, "Web"));
}

function renderAgentAnswer(container, text, badge) {
  const card = h("div", { class: "card agent-answer" });
  card.appendChild(h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" } },
    h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Antwort des Agenten"),
    h("span", { class: "match" }, badge)));

  const { poolHits, webHits } = parseAgentText(text);

  // 📍 Pool-Treffer als Karten
  const poolList = h("div", { class: "reco-list" });
  let poolCount = 0;
  const usedIds = new Set();
  poolHits.forEach((hit) => {
    const ev = EVENTS.find((e) => e.id === hit.id);
    if (!ev || usedIds.has(ev.id)) return;
    usedIds.add(ev.id);
    poolList.appendChild(recoCard(ev, hit.match != null ? hit.match : null, hit.reason));
    poolCount++;
  });
  // Fallback, falls das Parsen scheitert, aber IDs im Text stehen
  if (!poolCount) {
    eventIdsInText(text).forEach((id) => {
      const ev = EVENTS.find((e) => e.id === id);
      if (!ev || usedIds.has(id)) return;
      usedIds.add(id);
      poolList.appendChild(recoCard(ev, null, null));
      poolCount++;
    });
  }
  if (poolCount) card.appendChild(poolList);

  // 🌐 Web-Funde als Karten
  if (webHits.length) {
    card.appendChild(h("div", { class: "section-eyebrow", style: { margin: "16px 0 10px" } }, "🌐 Weitere Funde (Websuche)"));
    const webList = h("div", { class: "reco-list" });
    webHits.forEach((w) => webList.appendChild(webCard(w)));
    card.appendChild(webList);
  }

  // Letzter Fallback: nichts geparst -> formatierten Text zeigen
  if (!poolCount && !webHits.length) {
    card.appendChild(h("div", { class: "agent-text", html: formatAgentText(text) }));
  }

  container.appendChild(card);
}
function renderFallback(container, query) {
  const filtered = filterByQuery(EVENTS, query);
  const ranked = scoreAndRank(filtered, scoreInput()).slice(0, 6);
  const card = h("div", { class: "card agent-answer" },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" } },
      h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Antwort des Agenten"),
      h("span", { class: "match", style: { background: "#ececef", color: "#6e6e73" } }, "Lokal")),
    h("div", { class: "muted small", style: { marginBottom: "6px" } }, "Kein KI-Key aktiv – sortiert nach deinem Profil."),
  );
  const list = h("div", { class: "reco-list" });
  ranked.forEach((r) => list.appendChild(recoItem(r.event, r.score, r.event.source)));
  card.appendChild(list);
  container.appendChild(card);
}
function filterByQuery(events, query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return events;
  const KW = { ki: "ai", ai: "ai", llm: "ai", security: "security", cyber: "security", dev: "dev", web: "dev", frontend: "dev", data: "data", daten: "data", cloud: "cloud", devops: "cloud", mobile: "mobile", ux: "ux", design: "ux", startup: "startup", "open source": "oss", robot: "robotics", blockchain: "blockchain", web3: "blockchain", gaming: "gaming", game: "gaming" };
  const wantTags = [];
  for (const k in KW) if (q.includes(k)) wantTags.push(KW[k]);
  const wantTonight = q.includes("heute") || q.includes("abend");
  const wantWeek = q.includes("woche");
  const wantBeginner = q.includes("anfänger") || q.includes("einsteiger") || q.includes("lerne") || q.includes("workshop");
  let res = events.filter((e) => {
    const hay = (e.title + " " + e.description + " " + e.tags.join(" ")).toLowerCase();
    const tagHit = wantTags.length === 0 || e.tags.some((t) => wantTags.includes(t));
    const textHit = wantTags.length > 0 || q.split(/\s+/).some((w) => w.length > 2 && hay.includes(w));
    return tagHit && (textHit || wantTags.length > 0);
  });
  if (wantTonight) res = res.filter((e) => dayOffset(e.startsAt) <= 1);
  if (wantWeek) res = res.filter((e) => dayOffset(e.startsAt) <= 7);
  if (wantBeginner) res = res.filter((e) => /workshop|schnupper|einsteiger|hands-on|hack|treff/i.test(e.title + e.description));
  return res.length ? res : events;
}

/* ============================================================
   ÜBERSICHT (Karte + Kalender)
   ============================================================ */
let overviewTab = "karte";
let map = null, heatLayer = null, markers = [], markerById = {}, mapDayOffset = 0;
let calMonth = new Date().getMonth(), calYear = new Date().getFullYear(), calSelected = null;

function destroyMap() {
  if (map) { try { map.remove(); } catch (e) { /* */ } }
  map = null; heatLayer = null; markers = []; markerById = {};
}

function renderUebersicht() {
  const root = $("#screen-uebersicht");
  if (!root) return;
  destroyMap();
  clear(root);

  root.appendChild(header("Übersicht", "Karte & Kalender"));

  const body = h("div", { class: "screen-body" });
  body.appendChild(h("div", { style: { display: "flex", justifyContent: "center" } },
    h("div", { class: "segmented" },
      h("button", { "aria-pressed": overviewTab === "karte", onclick: () => { overviewTab = "karte"; renderUebersicht(); maybeInitMap(); } }, "Karte"),
      h("button", { "aria-pressed": overviewTab === "kalender", onclick: () => { overviewTab = "kalender"; renderUebersicht(); } }, "Kalender"),
    )));

  if (overviewTab === "karte") body.appendChild(buildMapCard());
  else buildCalendar(body);

  root.appendChild(body);
  if (overviewTab === "karte") setTimeout(maybeInitMap, 40);
}

/* --- Karte --- */
function dayStart(offset) { const d = startOfToday(); d.setDate(d.getDate() + offset); return d; }
function dayLabelShort(offset) { const d = dayStart(offset); return `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; }
function hasGeo(e) { return typeof e.lat === "number" && typeof e.lng === "number" && !e.online; }
function eventsOnOffset(offset) { const base = dayStart(offset); return EVENTS.filter((e) => !isExpired(e) && sameDay(e.startsAt, base)); }
function maxDayOffset() {
  let mx = 0;
  EVENTS.forEach((e) => { if (!isExpired(e)) { const o = dayOffset(e.startsAt); if (o > mx) mx = o; } });
  return Math.min(Math.max(mx, 0), 120);
}

function buildMapCard() {
  return h("div", { class: "card flush map-card" },
    h("div", { style: { padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
      h("div", { class: "section-title", style: { fontSize: "20px" } }, "Radar"),
      h("div", { class: "muted small", id: "map-day-top" }, mapDayOffset === 0 ? "Heute" : dayLabelShort(mapDayOffset))),
    h("div", { id: "map" }),
    h("div", { class: "day-stepper" },
      h("button", { class: "cal-nav", id: "day-prev", "aria-label": "Vorheriger Tag", onclick: () => stepDay(-1) }, "‹"),
      h("div", { class: "day-field" },
        h("div", { class: "day-label", id: "day-label" }, dayLabelShort(mapDayOffset) + (mapDayOffset === 0 ? " · Heute" : "")),
        h("div", { class: "day-count muted small", id: "day-count" }, eventsOnOffset(mapDayOffset).filter(hasGeo).length + " Events")),
      h("button", { class: "cal-nav", id: "day-next", "aria-label": "Nächster Tag", onclick: () => stepDay(1) }, "›")),
    h("div", { class: "legend" },
      ["ai", "dev", "data", "security"].map((c) =>
        h("span", { class: "item" }, h("span", { class: "dot", style: { background: interestColor(c) } }), categoryLabel(c)))),
    h("div", { class: "legend density-legend" },
      h("span", { class: "item muted small" }, "Verdichtung:"),
      h("span", { class: "density-bar" }),
      h("span", { class: "item muted small" }, "wenig → viel")),
    h("div", { class: "map-noloc", id: "map-noloc" }),
  );
}
// Events des Tages ohne Kartenstandort (online oder nicht verortbar) als Hinweis listen.
function renderMapNoloc() {
  const el = $("#map-noloc");
  if (!el) return;
  clear(el);
  const list = eventsOnOffset(mapDayOffset).filter((e) => !hasGeo(e));
  if (!list.length) { el.style.display = "none"; return; }
  el.style.display = "";
  el.appendChild(h("span", { class: "muted small" }, "Ohne Kartenstandort (keine Verortung möglich): "));
  const shown = list.slice(0, 8);
  shown.forEach((ev, i) => {
    el.appendChild(h("a", { class: "noloc-item", href: ev.url, target: "_blank", rel: "noopener" }, ev.title + (ev.online ? " · online" : "")));
    if (i < shown.length - 1) el.appendChild(document.createTextNode(" · "));
  });
}
function stepDay(delta) {
  const mx = maxDayOffset();
  mapDayOffset = Math.min(mx, Math.max(0, mapDayOffset + delta));
  refreshMapData();
}
function updateDayUI() {
  const mx = maxDayOffset();
  const lbl = $("#day-label"), cnt = $("#day-count"), top = $("#map-day-top"), prev = $("#day-prev"), next = $("#day-next");
  if (lbl) lbl.textContent = dayLabelShort(mapDayOffset) + (mapDayOffset === 0 ? " · Heute" : "");
  if (cnt) cnt.textContent = eventsOnOffset(mapDayOffset).filter(hasGeo).length + " Events";
  if (top) top.textContent = mapDayOffset === 0 ? "Heute" : dayLabelShort(mapDayOffset);
  if (prev) prev.disabled = mapDayOffset <= 0;
  if (next) next.disabled = mapDayOffset >= mx;
  renderMapNoloc();
}
function maybeInitMap() {
  if (currentScreen !== "uebersicht" || overviewTab !== "karte") return;
  initMap();
}
function initMap() {
  const el = document.getElementById("map");
  if (!el || typeof L === "undefined") return;
  if (map) { map.invalidateSize(); return; }
  map = L.map(el, { zoomControl: true, scrollWheelZoom: true }).setView(WUERZBURG, 13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap, © CARTO", maxZoom: 19, subdomains: "abcd",
  }).addTo(map);
  refreshMapData();
  setTimeout(() => { if (map) map.invalidateSize(); }, 120);
}
function refreshMapData() {
  if (!map) return;
  markers.forEach((m) => map.removeLayer(m));
  markers = []; markerById = {};
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }

  // Nur Events des gewählten Tages MIT echtem Standort anzeigen (Online-Events
  // haben keine Koordinaten und gehören nicht auf die Karte).
  const evs = eventsOnOffset(mapDayOffset).filter(hasGeo);
  const heatPts = [];
  evs.forEach((ev) => {
    heatPts.push([ev.lat, ev.lng, 1]); // Dichte: mehrere Events am selben Ort -> heißer
    const marker = L.circleMarker([ev.lat, ev.lng], {
      radius: 9, color: "#fff", weight: 2, fillColor: interestColor(ev.category), fillOpacity: 0.95,
    });
    marker.bindPopup(popupHtml(ev));
    marker.addTo(map);
    markers.push(marker); markerById[ev.id] = marker;
  });

  // Dichte-Heatmap mit Farbskala (wenig -> viel): blau/grün -> gelb -> rot.
  if (typeof L.heatLayer === "function" && heatPts.length) {
    heatLayer = L.heatLayer(heatPts, {
      radius: 42, blur: 30, minOpacity: 0.25, max: 2.5, maxZoom: 16,
      gradient: { 0.0: "#2c7fb8", 0.3: "#41b6c4", 0.5: "#7fcdbb", 0.7: "#c7e9b4", 0.85: "#ffffb2", 0.93: "#fd8d3c", 1.0: "#e31a1c" },
    });
    heatLayer.addTo(map);
  }
  updateDayUI();
}
// --- Kalender-Export (.ics) ---
// UTC-Stempel (eindeutig, egal ob die Quelle Wandzeit oder Z liefert).
function icsStamp(d) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
}
function downloadIcs(evOrId) {
  const ev = (typeof evOrId === "string") ? EVENTS.find((e) => e.id === evOrId) : evOrId;
  if (!ev) return;
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const e = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stadtsignal//Wuerzburg//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + (ev.id || "event") + "@stadtsignal",
    "DTSTAMP:" + icsStamp(new Date()),
    "DTSTART:" + icsStamp(start),
    "DTEND:" + icsStamp(end),
    "SUMMARY:" + e(ev.title),
    "DESCRIPTION:" + e((ev.description ? ev.description + "\n\n" : "") + (ev.url || "")),
    "LOCATION:" + e(ev.location || "Würzburg"),
    ev.url ? "URL:" + e(ev.url) : null,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: (slug(ev.title) || "event") + ".ics" });
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}
function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

function popupHtml(ev) {
  const visited = isVisited(ev.id);
  return `<div class="popup">
    <div class="popup-title">${esc(ev.title)}</div>
    <div class="popup-meta">${esc(eventLabel(ev))} · ${esc(fmtDateTime(ev.startsAt))}</div>
    <div class="popup-meta">${esc(ev.location)}</div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" style="padding:7px 14px;min-height:34px;font-size:13px" data-visit="${ev.id}">${visited ? "✓ Besucht" : "Merken"}</button>
      <button class="btn" style="padding:7px 14px;min-height:34px;font-size:13px" data-ics="${ev.id}">In Kalender</button>
      <a class="btn" style="padding:7px 14px;min-height:34px;font-size:13px" href="${esc(ev.url)}" target="_blank" rel="noopener">${ev.linkIsSearch ? "Event suchen" : "Zur Eventseite"}</a>
    </div>
    ${ev.linkVerified ? '<div style="margin-top:8px;font-size:11.5px;color:#1c7a3d;font-weight:700">✓ Link geprüft</div>' : ""}
    </div>`;
}
function goToMap(id) {
  const ev = EVENTS.find((e) => e.id === id);
  if (ev && !hasGeo(ev)) { toast("Dieses Event ist online – kein Standort auf der Karte.", "info"); return; }
  overviewTab = "karte";
  go("uebersicht");
  if (ev) mapDayOffset = Math.max(0, dayOffset(ev.startsAt)); // auf den Tag des Events springen
  renderUebersicht();
  setTimeout(() => {
    initMap();
    if (!map || !ev) return;
    map.invalidateSize();
    map.setView([ev.lat, ev.lng], 15, { animate: true });
    const m = markerById[id];
    if (m) m.openPopup();
  }, 180);
}

/* --- Kalender --- */
function buildCalendar(body) {
  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "cal-head" },
    h("button", { class: "cal-nav", "aria-label": "Vorheriger Monat", onclick: () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderUebersicht(); } }, "‹"),
    h("div", { class: "month" }, MONTHS[calMonth] + " " + calYear),
    h("button", { class: "cal-nav", "aria-label": "Nächster Monat", onclick: () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderUebersicht(); } }, "›")));

  const grid = h("div", { class: "cal-grid" });
  ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach((d) => grid.appendChild(h("div", { class: "cal-dow" }, d)));
  const first = new Date(calYear, calMonth, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  for (let i = 0; i < startPad; i++) grid.appendChild(h("div", { class: "cal-cell empty out" }));
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calYear, calMonth, day);
    const dayEvents = EVENTS.filter((e) => sameDay(e.startsAt, date));
    const cats = [...new Set(dayEvents.map((e) => e.category))].slice(0, 3);
    const isToday = sameDay(today.toISOString(), date);
    const isSel = calSelected && sameDay(calSelected.toISOString(), date);
    grid.appendChild(h("button", { class: "cal-cell" + (isToday ? " today" : ""), "aria-pressed": isSel ? "true" : "false",
      onclick: () => { calSelected = date; renderUebersicht(); } },
      h("span", { class: "num" }, String(day)),
      h("div", { class: "cal-dots" }, cats.map((c) => h("span", { class: "d", style: { background: interestColor(c) } })))));
  }
  card.appendChild(grid);
  body.appendChild(card);

  if (calSelected) {
    const dayEvents = scoreAndRank(EVENTS.filter((e) => sameDay(e.startsAt, calSelected)), scoreInput());
    const detail = h("div", { class: "card" }, h("div", { class: "section-eyebrow" }, fmtSelectedDay(calSelected)));
    if (dayEvents.length) detail.appendChild(h("div", { class: "event-list", style: { marginTop: "8px" } }, dayEvents.map((r) => eventRowWithVisit(r.event))));
    else detail.appendChild(h("div", { class: "empty-state", style: { marginTop: "12px" } }, "Keine Events an diesem Tag."));
    body.appendChild(detail);
  } else {
    body.appendChild(h("div", { class: "card" }, h("div", { class: "empty-state" }, "Wähle einen Tag aus, um Empfehlungen zu sehen.")));
  }
}
function fmtSelectedDay(date) { return `${WD[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`; }
function eventRowWithVisit(ev) {
  return h("div", { class: "event-row", style: { gridTemplateColumns: "56px 1fr auto" } },
    h("div", { class: "event-date" }, h("div", { class: "d tnum" }, fmtTime(ev.startsAt).slice(0, 5)), h("div", { class: "m" }, ev.source)),
    h("div", { class: "event-main" },
      h("div", { class: "t" }, ev.title),
      h("div", { class: "meta" }, eventTag(ev), h("span", {}, "· " + ev.location)),
      h("div", { class: "reco-actions" },
        h("button", { class: "reco-link", onclick: () => goToMap(ev.id) }, "Auf der Karte"),
        h("a", { class: "reco-link", href: ev.url, target: "_blank", rel: "noopener" }, "Zur Eventseite →"))),
    h("button", { class: "chip", onclick: () => toggleVisited(ev.id) }, isVisited(ev.id) ? "✓" : "Merken"));
}

/* ============================================================
   EINSTELLUNGEN (Profil · Interessen · Newsletter · Historie/Notizen)
   ============================================================ */
let histTab = "visited";
function renderEinstellungen() {
  const root = $("#screen-einstellungen");
  if (!root) return;
  clear(root);
  root.appendChild(header("Einstellungen", "Interessen, Präferenzen, Newsletter & Historie"));
  const body = h("div", { class: "screen-body" });

  // Profil
  const nameInput = h("input", { class: "input", type: "text", placeholder: "Wie heißt du?", value: state.name,
    oninput: (e) => { state.name = e.target.value; save(); updateGreeting(); } });
  body.appendChild(h("div", { class: "card" },
    h("div", { class: "profile-row" }, h("div", { class: "avatar", html: I.person }),
      h("div", {}, h("div", { class: "who" }, "Mein Konto"), h("div", { class: "muted small" }, "Gast – nur lokal gespeichert"))),
    h("div", { class: "field", style: { marginTop: "16px" } }, h("label", {}, "ANZEIGE-NAME"), nameInput)));

  // Interessen
  const chipRow = h("div", { class: "chip-row" });
  INTERESTS.forEach((it) => {
    const active = state.interests.includes(it.id);
    chipRow.appendChild(h("button", { class: "chip", "aria-pressed": active ? "true" : "false",
      style: active ? { background: hexA(it.color, 0.14), color: it.color } : {},
      onclick: () => toggleInterest(it.id) },
      h("span", { class: "dot", style: { background: it.color } }), it.label));
  });
  body.appendChild(h("div", { class: "card" },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" } },
      h("h2", { class: "section-title" }, "Interessen"), h("span", { class: "muted" }, state.interests.length + "/12 aktiv")),
    chipRow));

  // Standort-Hinweise
  const swInput = h("input", { type: "checkbox", onchange: (e) => { state.locationHints = e.target.checked; save(); } });
  swInput.checked = state.locationHints;
  body.appendChild(h("div", { class: "card" },
    h("div", { class: "toggle-row" },
      h("div", {}, h("div", { style: { fontWeight: "600" } }, "Standort-Hinweise"),
        h("div", { class: "muted small", style: { marginTop: "3px" } }, "Benachrichtigung bei Hotspots in deiner Nähe (geplant)")),
      h("label", { class: "switch" }, swInput, h("span", { class: "slider" })))));

  // Präferenzen (lokal, fließen in den Agenten ein)
  body.appendChild(buildPrefs());

  // Newsletter (zwischen Präferenzen und Historie)
  body.appendChild(buildNewsletter());

  // Historie (Besucht / Notizen)
  body.appendChild(buildHistorie());

  // Demo & Test (Beispiel-Profil / Zurücksetzen)
  body.appendChild(buildDemoTools());
  root.appendChild(body);
}

function buildNewsletter() {
  const emailInput = h("input", { class: "input", type: "email", placeholder: "du@beispiel.de", value: state.email,
    oninput: (e) => { state.email = e.target.value; save(); } });
  const seg = h("div", { class: "segmented" },
    [["daily", "Täglich"], ["weekly", "Wöchentlich"], ["monthly", "Monatlich"]].map(([v, l]) =>
      h("button", { "aria-pressed": state.rhythm === v, onclick: () => { state.rhythm = v; save(); renderEinstellungen(); } }, l)));
  const matching = EVENTS.filter((e) => e.tags.some((t) => state.interests.includes(t)));
  const perWeek = Math.max(1, Math.round(matching.length / 2));

  // Auto-Versand-Schalter (speichert die Einstellung; echter wiederkehrender
  // Versand braucht ein Backend mit Abonnenten-Speicher + Cron -> Roadmap).
  const autoInput = h("input", { type: "checkbox", onchange: (e) => { state.autoSend = e.target.checked; save(); renderEinstellungen(); } });
  autoInput.checked = !!state.autoSend;

  return h("div", { class: "card" },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" } },
      h("h2", { class: "section-title" }, "Newsletter"), h("span", { class: "muted" }, "ca. " + perWeek + " Events/Woche")),
    h("div", { class: "field", style: { marginBottom: "16px" } }, h("label", {}, "E-MAIL"), emailInput),
    h("div", { class: "field", style: { marginBottom: "16px" } }, h("label", {}, "RHYTHMUS"), seg),
    h("div", { class: "toggle-row", style: { marginBottom: state.autoSend ? "6px" : "18px" } },
      h("div", {}, h("div", { style: { fontWeight: "600" } }, "Automatisch senden"),
        h("div", { class: "muted small", style: { marginTop: "3px" } }, "Schickt den Radar im gewählten Rhythmus von selbst.")),
      h("label", { class: "switch" }, autoInput, h("span", { class: "slider" }))),
    state.autoSend ? h("div", { class: "muted small", style: { marginBottom: "18px" } }, "Hinweis: Automatischer Versand wird beim Deployment mit Cron aktiv – die Einstellung ist gespeichert.") : null,
    h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
      h("button", { class: "btn", onclick: openNewsletterPreview }, h("span", { html: I.eye }), "Vorschau"),
      h("button", { class: "btn primary", onclick: sendNewsletter }, h("span", { html: I.send }), "An mich senden")),
    h("div", { class: "muted small", style: { marginTop: "10px" } }, "„An mich senden“ verschickt jetzt eine echte E-Mail an die hinterlegte Adresse (gleiches Layout wie die Vorschau)."));
}

function prefField(label, control) {
  return h("div", { class: "field", style: { marginBottom: "16px" } }, h("label", {}, label), control);
}
function segChoice(value, options, onPick) {
  return h("div", { class: "segmented", style: { display: "flex", width: "100%" } },
    options.map(([v, l]) => h("button", {
      "aria-pressed": value === v ? "true" : "false",
      style: { flex: "1 1 0", fontSize: "13px", padding: "9px 6px" },
      onclick: () => onPick(v),
    }, l)));
}
function buildPrefs() {
  const p = state.prefs;
  const card = h("div", { class: "card" }, h("h2", { class: "section-title", style: { marginBottom: "6px" } }, "Präferenzen"));
  card.appendChild(h("div", { class: "muted small", style: { marginBottom: "16px" } },
    "Zeit, Tag, Online/Vor Ort, Level & Format erkennt der Agent automatisch aus deiner Frage – z. B. „Einsteiger-Workshop heute Abend vor Ort“. Hier hinterlegst du nur, was dauerhaft gilt:"));

  const focus = h("textarea", { class: "input", rows: "2", placeholder: 'z. B. „lerne gerade Rust", „suche Co-Founder", „Einstieg in MLOps" …',
    oninput: (e) => { p.focus = e.target.value; save(); } });
  focus.value = p.focus || "";
  card.appendChild(prefField("FOKUS / ZIELE", focus));

  const area = h("input", { class: "input", type: "text", placeholder: "z. B. Innenstadt, Hubland … (optional)", value: p.area || "",
    oninput: (e) => { p.area = e.target.value; save(); } });
  card.appendChild(prefField("BEVORZUGTER ORT (OPTIONAL)", area));

  return card;
}

// Stabile Präferenzen für den Agenten. Zeit/Tag/Modus/Level/Format kommen NICHT
// mehr hierher – die leitet der Agent aus der natürlichsprachlichen Anfrage ab.
function prefsForAgent() {
  const p = state.prefs;
  return {
    focus: (p.focus || "").slice(0, 300),
    area: (p.area || "").slice(0, 80),
  };
}

function buildHistorie() {
  const card = h("div", { class: "card" });
  card.appendChild(h("h2", { class: "section-title", style: { marginBottom: "14px" } }, "Historie"));
  const visited = state.history.map((id) => EVENTS.find((e) => e.id === id)).filter(Boolean);
  const noteIds = Object.keys(state.notes).filter((id) => state.notes[id] && state.notes[id].trim());

  card.appendChild(h("div", { style: { display: "flex", justifyContent: "center", marginBottom: "14px" } },
    h("div", { class: "segmented" },
      h("button", { "aria-pressed": histTab === "visited", onclick: () => { histTab = "visited"; renderEinstellungen(); } }, "Besucht (" + visited.length + ")"),
      h("button", { "aria-pressed": histTab === "notes", onclick: () => { histTab = "notes"; renderEinstellungen(); } }, "Notizen (" + noteIds.length + ")"))));

  if (histTab === "visited") {
    if (!visited.length) card.appendChild(h("div", { class: "empty-state" }, "Noch keine Events besucht. Markiere Events im Kalender oder auf der Karte."));
    else card.appendChild(h("div", { class: "event-list" }, visited.map((ev) => h("div", { class: "event-row" },
      h("div", { class: "event-date" }, h("div", { class: "d tnum" }, String(new Date(ev.startsAt).getDate())), h("div", { class: "m" }, MONTHS_SHORT[new Date(ev.startsAt).getMonth()])),
      h("div", { class: "event-main" },
        h("div", { class: "t" }, ev.title),
        h("div", { class: "meta" }, eventTag(ev), h("span", {}, "· " + ev.location),
          state.notes[ev.id] && state.notes[ev.id].trim() ? h("span", { style: { color: "var(--accent)", fontWeight: "600" } }, "· 📝 Notiz") : null),
        h("div", { class: "reco-actions" },
          h("button", { class: "reco-link", onclick: () => goToMap(ev.id) }, "Auf der Karte"),
          h("a", { class: "reco-link", href: ev.url, target: "_blank", rel: "noopener" }, "Zur Eventseite →"))),
      h("button", { class: "chip", onclick: () => toggleVisited(ev.id) }, "Entfernen")))));
  } else {
    if (!visited.length) card.appendChild(h("div", { class: "empty-state" }, "Markiere zuerst Events als besucht, dann kannst du hier Notizen hinterlegen."));
    else {
      visited.forEach((ev) => {
        const ta = h("textarea", { placeholder: "Notiz zu diesem Event …", oninput: (e) => { state.notes[ev.id] = e.target.value; save(); } });
        ta.value = state.notes[ev.id] || "";
        card.appendChild(h("div", { class: "note-row" },
          h("div", { style: { fontWeight: "600" } }, ev.title),
          h("div", { class: "meta small muted" }, fmtDateTime(ev.startsAt)), ta));
      });
    }
  }
  return card;
}

function toggleInterest(id) {
  const i = state.interests.indexOf(id);
  if (i >= 0) state.interests.splice(i, 1); else state.interests.push(id);
  save();
  renderEinstellungen(); renderScanner();
  if (currentScreen === "uebersicht" && overviewTab === "karte") refreshMapData();
}

/* ============================================================
   NEWSLETTER
   ============================================================ */
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date - firstThursday) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
function digestEvents() {
  const ranked = scoreAndRank(activeEvents(), scoreInput());
  return ranked.filter((r) => r.event.tags.some((t) => state.interests.includes(t))).slice(0, 4);
}
// Echtes Event-Bild (vom Server angereichert: og:image oder Themen-Fallback).
// Für Seed-Events ohne Bildfeld: Themen-Fallback nach Kategorie.
const CATEGORY_IMG = {
  ai: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=70",
  dev: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=70",
  data: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=70",
  security: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=70",
};
function thumbUrl(ev) { return ev.image || CATEGORY_IMG[ev.category] || CATEGORY_IMG.dev; }

function openNewsletterPreview() {
  const items = digestEvents();
  const top = items[0];
  const now = new Date();
  const name = state.name.trim() || "Tech-Fan";
  const root = $("#modal-root");
  const close = () => clear(root);
  const modal = h("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === modal) close(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Newsletter-Vorschau" },
      h("div", { class: "nl-header" },
        h("button", { class: "modal-close", "aria-label": "Schließen", onclick: close }, "×"),
        h("div", { class: "kw" }, "STADTSIGNAL · KW " + isoWeek(now) + " · " + pad(now.getDate()) + "." + pad(now.getMonth() + 1) + "."),
        h("div", { class: "nl-title" }, "Dein Würzburger Tech-Radar")),
      h("div", { class: "nl-body" },
        h("div", {}, h("div", { style: { fontWeight: "700", fontSize: "17px" } }, "Hallo " + name + " 👋"),
          h("p", { class: "muted", style: { margin: "6px 0 0", lineHeight: "1.5" } },
            "Diese Auswahl passt zu deinen Interessen: " + state.interests.map((i) => INTEREST_BY_ID[i].label).join(", ") + ".")),
        top ? h("div", { class: "card", style: { padding: "16px", background: hexA("#0a84ff", 0.06), boxShadow: "none" } },
          h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Empfehlung des Agenten · " + Math.round(top.score * 100) + "% Match"),
          h("div", { style: { fontWeight: "700", margin: "8px 0 4px" } }, top.event.title),
          h("div", { class: "muted small" }, top.reasons.join(" · "))) : null,
        h("div", { style: { display: "grid", gap: "12px" } }, items.map((r) => {
          const ev = r.event;
          return h("div", { class: "nl-event" },
            h("div", { class: "thumb", style: { backgroundImage: `url(${thumbUrl(ev)})` } }),
            h("div", { class: "body" },
              h("div", {}, eventTag(ev)),
              h("div", { class: "t", style: { marginTop: "4px" } }, ev.title),
              h("div", { class: "meta" }, fmtDateTime(ev.startsAt)),
              h("div", { class: "meta" }, ev.location),
              h("a", { href: ev.url, target: "_blank", rel: "noopener", style: { fontSize: "13px", fontWeight: "600" } }, "Zur Eventseite →")));
        }))),
      h("div", { class: "nl-foot" },
        h("button", { class: "btn", onclick: close }, "Schließen"),
        h("button", { class: "btn primary", onclick: () => { close(); sendNewsletter(); } }, h("span", { html: I.send }), "An mich senden"))));
  root.appendChild(modal);
  document.addEventListener("keydown", function onEsc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); } });
}
// Kurzer, nicht-blockierender Hinweis (statt alert/mailto).
function toast(msg, kind) {
  const t = h("div", { class: "toast " + (kind || "info") }, msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3600);
}

// Echte HTML-Mail an die hinterlegte Adresse senden (Serverless-Funktion + Resend).
// Öffnet NICHT mehr die Mail-App; bei fehlendem Endpoint/Key kommt ein Hinweis.
async function sendNewsletter() {
  const items = digestEvents();
  const to = state.email.trim();
  if (!to) { go("einstellungen"); toast("Bitte zuerst eine E-Mail-Adresse hinterlegen.", "warn"); return; }
  const now = new Date();
  const top = items[0];
  const payload = {
    to,
    name: state.name.trim() || "Tech-Fan",
    subject: `Stadtsignal · KW ${isoWeek(now)} · dein Würzburger Tech-Radar`,
    kw: String(isoWeek(now)),
    dateLabel: pad(now.getDate()) + "." + pad(now.getMonth() + 1) + ".",
    interests: state.interests.map((i) => INTEREST_BY_ID[i].label),
    top: top ? { title: top.event.title, match: Math.round(top.score * 100), reason: top.reasons.join(" · ") } : null,
    events: items.map((r) => {
      const ev = r.event;
      return { title: ev.title, category: ev.category, categoryLabel: eventLabel(ev), when: fmtDateTime(ev.startsAt), location: ev.location, url: ev.url, image: thumbUrl(ev) };
    }),
  };
  toast("Sende E-Mail …", "info");
  try {
    const r = await fetch("/api/send-newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) toast("✓ E-Mail an " + to + " gesendet.", "ok");
    else if (r.status === 503) toast("Versand nur auf der deployten Seite (RESEND_API_KEY fehlt).", "warn");
    else toast("Versand fehlgeschlagen: " + (d.error || ("HTTP " + r.status)), "warn");
  } catch (e) {
    toast("Kein Versand möglich (lokal/offline ohne Endpoint).", "warn");
  }
}

/* ============================================================
   Navigation
   ============================================================ */
const SCREENS = [
  { id: "uebersicht", label: "Übersicht", icon: I.overview, render: renderUebersicht },
  { id: "scanner", label: "Scanner", icon: I.scanner, render: renderScanner, fab: true },
  { id: "einstellungen", label: "Einstellungen", icon: I.settings, render: renderEinstellungen },
];
let currentScreen = "scanner";

function go(name, fromHash) {
  if (!SCREENS.some((s) => s.id === name)) name = "scanner";
  currentScreen = name;
  SCREENS.forEach((s) => {
    const el = document.getElementById("screen-" + s.id);
    if (el) el.classList.toggle("active", s.id === name);
  });
  document.querySelectorAll("#tabbar button").forEach((b) => b.setAttribute("aria-current", b.dataset.screen === name ? "page" : "false"));
  if (!fromHash && location.hash.slice(1) !== name) location.hash = name;
  if (name === "uebersicht") setTimeout(maybeInitMap, 40);
  window.scrollTo({ top: 0 });
}
function buildTabbar() {
  const bar = $("#tabbar");
  clear(bar);
  SCREENS.forEach((s) => bar.appendChild(h("button", {
    class: s.fab ? "fab" : "", dataset: { screen: s.id }, "aria-current": "false", "aria-label": s.label, onclick: () => go(s.id) },
    h("span", { class: "ico", html: s.icon }), h("span", {}, s.label))));
}
// Echte Events vom Ingestion-Endpunkt laden; ersetzt den Seed in-place.
// Fällt still auf den kuratierten Seed zurück (offline / file:// / kein Server).
let lastEventsFetch = 0;
let EVENTS_META = { live: false, count: 0, sources: [], fetchedAt: null }; // für Frische-Stempel
// Holt aktuelle Events vom Ingestion-Endpunkt und ersetzt den Seed in-place.
// Rendert NICHT neu (für den Aufruf mitten in einer laufenden Scanner-Suche).
async function fetchEvents(force) {
  try {
    const r = await fetch("/api/events" + (force ? "?refresh=1" : ""));
    if (!r.ok) return false;
    const d = await r.json();
    if (!d || !Array.isArray(d.events) || !d.events.length) return false;
    EVENTS.length = 0;
    for (const e of d.events) EVENTS.push(e);
    lastEventsFetch = Date.now();
    EVENTS_META = {
      live: true, count: d.events.length,
      sources: (d.sources || []).filter((s) => s.ok && s.count).map((s) => s.name),
      fetchedAt: d.fetchedAt || new Date().toISOString(),
    };
    return true;
  } catch (e) {
    return false; /* Seed bleibt aktiv */
  }
}
// Wie fetchEvents, aber mit Re-Render (Boot + Refresh-Button).
async function loadLiveEvents(force) {
  const ok = await fetchEvents(force);
  if (ok) {
    renderScanner();
    renderEinstellungen();
    if (currentScreen === "uebersicht") renderUebersicht();
    console.info(`Stadtsignal: ${EVENTS.length} echte Events aktualisiert.`);
  }
  return ok;
}

// Demo-/Präsentations-Profil: füllt Interessen, Fokus, Ort, „Besucht" und Suchhistorie,
// damit die Personalisierung („weil …") sofort sichtbar ist (sonst bei t=0 leer).
function loadDemoProfile() {
  const evs = activeEvents();
  state.name = (state.name && state.name.trim()) ? state.name : "Johannes";
  state.interests = ["ai", "data", "dev", "startup"];
  state.prefs.focus = "Einstieg in MLOps, suche Austausch & lokale KI-Community";
  state.prefs.area = "Innenstadt";
  state.history = evs.slice(0, 2).map((e) => e.id);   // 2 Events als „besucht"
  state.searchHistory = ["KI-Workshop für Einsteiger", "Hackathon Würzburg"];
  save();
  renderScanner(); renderEinstellungen();
  if (currentScreen === "uebersicht") renderUebersicht();
}
function resetProfile() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  const fresh = JSON.parse(JSON.stringify(defaultState));
  Object.keys(fresh).forEach((k) => { state[k] = fresh[k]; });
  save();
  renderScanner(); renderEinstellungen();
  if (currentScreen === "uebersicht") renderUebersicht();
}
function buildDemoTools() {
  return h("div", { class: "card" },
    h("h2", { class: "section-title", style: { marginBottom: "6px" } }, "Demo & Test"),
    h("div", { class: "muted small", style: { marginBottom: "14px" } }, "Für die Präsentation: ein Beispiel-Profil laden (Interessen, Fokus, Besucht, Suchverlauf) oder alle lokalen Daten zurücksetzen."),
    h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
      h("button", { class: "btn primary", onclick: loadDemoProfile }, h("span", { html: I.sparkle }), "Demo-Profil laden"),
      h("button", { class: "btn", onclick: resetProfile }, "Zurücksetzen")));
}

function init() {
  const mount = $("#screens");
  SCREENS.forEach((s) => { const div = h("div", { class: "screen", id: "screen-" + s.id }); mount.appendChild(div); s.render(); });
  buildTabbar();
  go(location.hash.slice(1) || "scanner", true);
  window.addEventListener("hashchange", () => go(location.hash.slice(1) || "scanner", true));
  document.addEventListener("click", (e) => {
    const visitBtn = e.target.closest("[data-visit]");
    if (visitBtn) { toggleVisited(visitBtn.getAttribute("data-visit")); if (map) map.closePopup(); return; }
    const icsBtn = e.target.closest("[data-ics]");
    if (icsBtn) { downloadIcs(icsBtn.getAttribute("data-ics")); }
  });

  const wantsDemo = (() => { try { return new URLSearchParams(location.search).get("demo") === "1"; } catch (e) { return false; } })();
  loadLiveEvents().then(() => { if (wantsDemo) loadDemoProfile(); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();
