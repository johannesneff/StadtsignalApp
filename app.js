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
  locationHints: false,
};
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return Object.assign({}, defaultState, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return Object.assign({}, defaultState);
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

function scoreInput() {
  return { interests: state.interests, historyTags: aggregateHistoryTags(state.history, EVENTS) };
}
function isVisited(id) { return state.history.includes(id); }
function toggleVisited(id) {
  const i = state.history.indexOf(id);
  if (i >= 0) state.history.splice(i, 1); else state.history.push(id);
  save();
  renderEinstellungen(); renderScanner();
  if (currentScreen === "uebersicht") { renderUebersicht(); }
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
function eventRow(ev, onClick) {
  const d = new Date(ev.startsAt);
  return h("button", { class: "event-row", onclick: onClick },
    h("div", { class: "event-date" }, h("div", { class: "d tnum" }, String(d.getDate())), h("div", { class: "m" }, MONTHS_SHORT[d.getMonth()])),
    h("div", { class: "event-main" },
      h("div", { class: "t" }, ev.title),
      h("div", { class: "meta" },
        categoryTag(ev.category), h("span", {}, "· " + fmtTime(ev.startsAt)), h("span", {}, "· " + ev.location),
        isVisited(ev.id) ? h("span", { style: { color: "#34c759", fontWeight: "600" } }, "· ✓ besucht") : null),
    ),
    h("div", {}, ""),
  );
}

/* ============================================================
   SCANNER (KI-Agent + lokale Empfehlungen)
   ============================================================ */
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
    h("h2", { class: "section-title", style: { margin: "8px 0 16px" } }, "Was suchst du heute?"),
    h("div", { class: "search-wrap" }, input, goBtn),
    h("div", { style: { marginTop: "14px" } }, sugRow),
    thinking, results,
  ));

  const ranked = scoreAndRank(EVENTS.filter((e) => dayOffset(e.startsAt) >= 0), scoreInput());
  const top = ranked[0];
  if (top) {
    const ev = top.event;
    left.appendChild(h("div", { class: "card hero" },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Empfehlung des Tages"),
        h("span", { class: "match" }, Math.round(top.score * 100) + "% Match")),
      h("div", { class: "muted small", style: { marginTop: "4px" } }, "Persönlich für dich"),
      h("div", { class: "hero-title" }, ev.title),
      h("div", { class: "hero-meta" }, categoryTag(ev.category), h("span", {}, "· " + fmtDateTime(ev.startsAt)), h("span", {}, "· " + ev.location)),
      h("p", { class: "reason" }, top.reasons.join(" · ")),
      h("div", { style: { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" } },
        h("button", { class: "btn primary", onclick: () => goToMap(ev.id) }, "Auf der Karte zeigen"),
        h("button", { class: "btn", onclick: () => toggleVisited(ev.id) }, isVisited(ev.id) ? "✓ Besucht" : "Als besucht markieren"),
        h("a", { class: "btn", href: ev.url, target: "_blank", rel: "noopener" }, "Zur Eventseite")),
    ));
  }

  const next = ranked.filter((r) => dayOffset(r.event.startsAt) <= 14).slice(0, 3);
  left.appendChild(h("div", { class: "card" },
    h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Top 3 in den nächsten 14 Tagen"),
    h("div", { class: "reco-list", style: { marginTop: "14px" } },
      next.map((r) => h("button", { class: "reco-item", onclick: () => goToMap(r.event.id) },
        h("div", {}, h("div", { class: "t" }, r.event.title), h("div", { class: "meta" }, categoryLabel(r.event.category) + " · " + fmtDateTime(r.event.startsAt))),
        h("span", { class: "match" }, Math.round(r.score * 100) + "%"))),
    ),
  ));

  body.appendChild(left);
  root.appendChild(body);
}

async function runScannerSearch(query, thinkingEl, resultsEl, goBtn) {
  query = (query || "").trim();
  if (!query) return;
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

  // Echten Agenten versuchen; bei Fehler/ohne Key -> lokaler Fallback.
  let realText = null;
  try {
    const r = await fetch("/api/agent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        interestLabels: state.interests.map((i) => (INTEREST_BY_ID[i] || {}).label || i),
        history: state.history,
        events: EVENTS.map((e) => ({ id: e.id, title: e.title, category: e.category, tags: e.tags, startsAt: e.startsAt, location: e.location, description: e.description })),
      }),
    });
    if (r.ok) { const d = await r.json(); realText = (d && d.text) ? d.text : null; }
  } catch (e) { /* offline / kein Endpoint */ }

  // Mindestdauer für die Thinking-Animation, damit sie sichtbar ist.
  if (!reduced) await new Promise((res) => setTimeout(res, steps.length * 400 + 150));
  clear(resultsEl);
  if (realText) renderAgentAnswer(resultsEl, realText, "KI · Claude Haiku");
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
  // Escapen, dann **fett** und Zeilenumbrüche zulassen.
  let safe = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return safe;
}
function renderAgentAnswer(container, text, badge) {
  const card = h("div", { class: "card agent-answer" });
  card.appendChild(h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" } },
    h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Antwort des Agenten"),
    h("span", { class: "match" }, badge)));
  card.appendChild(h("div", { class: "agent-text", html: formatAgentText(text) }));

  const ids = eventIdsInText(text);
  if (ids.length) {
    const list = h("div", { class: "reco-list", style: { marginTop: "14px" } });
    ids.forEach((id) => {
      const ev = EVENTS.find((e) => e.id === id);
      const sc = scoreAndRank([ev], scoreInput())[0];
      list.appendChild(h("button", { class: "reco-item", onclick: () => goToMap(id) },
        h("div", {}, h("div", { class: "t" }, ev.title), h("div", { class: "meta" }, categoryLabel(ev.category) + " · " + fmtDateTime(ev.startsAt))),
        h("span", { class: "match" }, Math.round(sc.score * 100) + "%")));
    });
    card.appendChild(list);
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
  ranked.forEach((r) => list.appendChild(h("button", { class: "reco-item", onclick: () => goToMap(r.event.id) },
    h("div", {}, h("div", { class: "t" }, r.event.title), h("div", { class: "meta" }, categoryLabel(r.event.category) + " · " + fmtDateTime(r.event.startsAt) + " · " + r.event.source)),
    h("span", { class: "match" }, Math.round(r.score * 100) + "%"))));
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
let map = null, heatLayer = null, markers = [], markerById = {}, selectedRange = 0;
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

  const refreshBtn = h("button", { class: "cal-nav", html: I.refresh, "aria-label": "Aktualisieren",
    onclick: () => { if (overviewTab === "karte") refreshMapData(); } });
  root.appendChild(header("Übersicht", "Karte & Kalender", overviewTab === "karte" ? refreshBtn : null));

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
function buildMapCard() {
  return h("div", { class: "card flush map-card" },
    h("div", { style: { padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
      h("div", { class: "section-title", style: { fontSize: "20px" } }, "Radar"),
      h("div", { class: "muted small", id: "range-label" }, rangeText(selectedRange))),
    h("div", { id: "map" }),
    h("div", { class: "range-bar" },
      h("label", { for: "range" }, "Zeitraum"),
      h("input", { type: "range", id: "range", min: "0", max: "6", step: "1", value: String(selectedRange),
        oninput: (e) => { selectedRange = +e.target.value; updateRangeLabel(); refreshMapData(); } }),
      h("span", { class: "range-val tnum", id: "range-val" }, rangeText(selectedRange))),
    h("div", { class: "legend" },
      ["ai", "dev", "data", "security"].map((c) =>
        h("span", { class: "item" }, h("span", { class: "dot", style: { background: interestColor(c) } }), categoryLabel(c)))),
  );
}
function rangeText(n) { return n === 0 ? "Heute" : "Tag +" + n; }
function updateRangeLabel() {
  const a = $("#range-val"), b = $("#range-label");
  if (a) a.textContent = rangeText(selectedRange);
  if (b) b.textContent = rangeText(selectedRange);
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
  const heatPts = [];
  EVENTS.forEach((ev) => {
    const off = dayOffset(ev.startsAt);
    const proximity = Math.max(0, 1 - Math.abs(off - selectedRange) * 0.45);
    if (off >= 0) heatPts.push([ev.lat, ev.lng, Math.max(0.15, proximity)]);
    const marker = L.circleMarker([ev.lat, ev.lng], {
      radius: 8, color: "#fff", weight: 2, fillColor: interestColor(ev.category),
      fillOpacity: off === selectedRange ? 1 : 0.7,
    });
    marker.bindPopup(popupHtml(ev));
    marker.addTo(map);
    markers.push(marker); markerById[ev.id] = marker;
  });
  if (typeof L.heatLayer === "function") {
    heatLayer = L.heatLayer(heatPts, { radius: 38, blur: 28, maxZoom: 15,
      gradient: { 0.2: "#bcd9ff", 0.5: "#5fa8ff", 0.8: "#0a84ff", 1: "#0040a0" } });
    heatLayer.addTo(map);
  }
}
function popupHtml(ev) {
  const visited = isVisited(ev.id);
  return `<div class="popup">
    <div class="popup-title">${esc(ev.title)}</div>
    <div class="popup-meta">${esc(categoryLabel(ev.category))} · ${esc(fmtDateTime(ev.startsAt))}</div>
    <div class="popup-meta">${esc(ev.location)}</div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" style="padding:7px 14px;min-height:34px;font-size:13px" data-visit="${ev.id}">${visited ? "✓ Besucht" : "Merken"}</button>
      <a class="btn" style="padding:7px 14px;min-height:34px;font-size:13px" href="${esc(ev.url)}" target="_blank" rel="noopener">Eventseite</a>
    </div></div>`;
}
function goToMap(id) {
  overviewTab = "karte";
  go("uebersicht");
  renderUebersicht();
  const ev = EVENTS.find((e) => e.id === id);
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
    h("div", { class: "event-main" }, h("div", { class: "t" }, ev.title), h("div", { class: "meta" }, categoryTag(ev.category), h("span", {}, "· " + ev.location))),
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
  root.appendChild(header("Einstellungen", "Interessen, Newsletter & Historie"));
  const body = h("div", { class: "screen-body" });

  // Profil
  const nameInput = h("input", { class: "input", type: "text", placeholder: "Wie heißt du?", value: state.name,
    oninput: (e) => { state.name = e.target.value; save(); } });
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

  // Newsletter
  const emailInput = h("input", { class: "input", type: "email", placeholder: "du@beispiel.de", value: state.email,
    oninput: (e) => { state.email = e.target.value; save(); } });
  const seg = h("div", { class: "segmented" },
    [["daily", "Täglich"], ["weekly", "Wöchentlich"], ["monthly", "Monatlich"]].map(([v, l]) =>
      h("button", { "aria-pressed": state.rhythm === v, onclick: () => { state.rhythm = v; save(); renderEinstellungen(); } }, l)));
  const matching = EVENTS.filter((e) => e.tags.some((t) => state.interests.includes(t)));
  const perWeek = Math.max(1, Math.round(matching.length / 2));
  body.appendChild(h("div", { class: "card" },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" } },
      h("h2", { class: "section-title" }, "Newsletter"), h("span", { class: "muted" }, "ca. " + perWeek + " Events/Woche")),
    h("div", { class: "field", style: { marginBottom: "16px" } }, h("label", {}, "E-MAIL"), emailInput),
    h("div", { class: "field", style: { marginBottom: "18px" } }, h("label", {}, "RHYTHMUS"), seg),
    h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
      h("button", { class: "btn", onclick: openNewsletterPreview }, h("span", { html: I.eye }), "Vorschau"),
      h("button", { class: "btn primary", onclick: sendNewsletter }, h("span", { html: I.send }), "An mich senden")),
    h("div", { class: "muted small", style: { marginTop: "10px" } }, "Öffnet deine Mail-App mit fertigem Entwurf.")));

  // Historie (Besucht / Notizen)
  body.appendChild(buildHistorie());
  root.appendChild(body);
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
      h("div", { class: "event-main" }, h("div", { class: "t" }, ev.title), h("div", { class: "meta" }, categoryTag(ev.category), h("span", {}, "· " + ev.location))),
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
  const ranked = scoreAndRank(EVENTS.filter((e) => dayOffset(e.startsAt) >= 0), scoreInput());
  return ranked.filter((r) => r.event.tags.some((t) => state.interests.includes(t))).slice(0, 4);
}
function thumbUrl(ev) { return `https://picsum.photos/seed/${ev.id}stadtsignal/200/200`; }

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
              h("div", {}, categoryTag(ev.category)),
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
function sendNewsletter() {
  const items = digestEvents();
  const to = state.email.trim();
  if (!to) { go("einstellungen"); alert("Bitte zuerst eine E-Mail-Adresse hinterlegen."); return; }
  const now = new Date();
  const name = state.name.trim() || "Tech-Fan";
  const subject = `Stadtsignal · KW ${isoWeek(now)} · dein Würzburger Tech-Radar`;
  const lines = [
    `Hallo ${name},`, "", "deine persönliche Event-Auswahl rund um Würzburg:", "",
    ...items.map((r) => { const ev = r.event; return `• ${ev.title}\n  ${categoryLabel(ev.category)} · ${fmtDateTime(ev.startsAt)}\n  ${ev.location}\n  ${ev.url}`; }),
    "", `Interessen: ${state.interests.map((i) => INTEREST_BY_ID[i].label).join(", ")}`,
    `Rhythmus: ${({ daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich" })[state.rhythm]}`,
    "", "— gesendet mit Stadtsignal",
  ];
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
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
function init() {
  const mount = $("#screens");
  SCREENS.forEach((s) => { const div = h("div", { class: "screen", id: "screen-" + s.id }); mount.appendChild(div); s.render(); });
  buildTabbar();
  go(location.hash.slice(1) || "scanner", true);
  window.addEventListener("hashchange", () => go(location.hash.slice(1) || "scanner", true));
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-visit]");
    if (btn) { toggleVisited(btn.getAttribute("data-visit")); if (map) map.closePopup(); }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();
