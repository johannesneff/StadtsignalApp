/* Stadtsignal — App-Logik (kein Build, klassische Scripts).
   Screens: Karte · Kalender · Scanner · Historie · Konto. */

(function () {
  "use strict";

  const DAY = 1000 * 60 * 60 * 24;
  const WUERZBURG = [49.7913, 9.9534];

  /* ---------------------- State ---------------------- */
  const LS_KEY = "stadtsignal.v1";
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

  const EVENTS = getEvents();

  function scoreInput() {
    return {
      interests: state.interests,
      historyTags: aggregateHistoryTags(state.history, EVENTS),
    };
  }
  function isVisited(id) { return state.history.includes(id); }
  function toggleVisited(id) {
    const i = state.history.indexOf(id);
    if (i >= 0) state.history.splice(i, 1);
    else state.history.push(id);
    save();
    renderHistorie(); renderScanner(); renderKalender();
    if (currentScreen === "karte") refreshMapData();
  }

  /* ---------------------- Icons (inline SVG) ---------------------- */
  const I = {
    map: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>',
    calendar: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
    sparkle: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5C10.4 6.7 11.7 5.4 12 2.5Zm6.5 9c.2 1.7 1 2.5 2.7 2.7-1.7.2-2.5 1-2.7 2.7-.2-1.7-1-2.5-2.7-2.7 1.7-.2 2.5-1 2.7-2.7Zm-12 2c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2Z"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    gear: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 17.4 6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21.4 11h.1a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
    radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><circle cx="12" cy="12" r="2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>',
  };

  /* ---------------------- Wiederverwendbare Bausteine ---------------------- */
  function header(title, subtitle, action) {
    return h("div", { class: "page-header" },
      h("div", { class: "glyph", html: I.radio }),
      h("div", {}, h("h1", {}, title), h("p", {}, subtitle)),
      action ? h("div", { class: "header-action" }, action) : null,
    );
  }

  function categoryTag(catId) {
    return h("span", { class: "tag", style: { background: hexA(interestColor(catId), 0.12), color: interestColor(catId) } },
      h("span", { class: "dot", style: { background: interestColor(catId) } }),
      categoryLabel(catId),
    );
  }

  function hexA(hex, a) {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function eventRow(ev, onClick) {
    const d = new Date(ev.startsAt);
    return h("button", { class: "event-row", onclick: onClick },
      h("div", { class: "event-date" },
        h("div", { class: "d tnum" }, String(d.getDate())),
        h("div", { class: "m" }, MONTHS_SHORT[d.getMonth()]),
      ),
      h("div", { class: "event-main" },
        h("div", { class: "t" }, ev.title),
        h("div", { class: "meta" },
          categoryTag(ev.category),
          h("span", {}, "· " + fmtTime(ev.startsAt)),
          h("span", {}, "· " + ev.location),
          isVisited(ev.id) ? h("span", { style: { color: "#34c759", fontWeight: "600" } }, "· ✓ besucht") : null,
        ),
      ),
      h("div", {}, ""),
    );
  }

  /* ============================================================
     SCANNER
     ============================================================ */
  function renderScanner() {
    const root = $("#screen-scanner");
    if (!root) return;
    clear(root);
    root.appendChild(header("Scanner", "Dein KI-Tech-Radar für Würzburg"));

    const body = h("div", { class: "screen-body split" });

    const left = h("div", { class: "col-left", style: { display: "grid", gap: "18px" } });

    // Such-Agent
    const input = h("input", { class: "search-input", type: "text", placeholder: 'z. B. „KI-Workshops nächste Woche"', "aria-label": "Suche" });
    const goBtn = h("button", { class: "search-go", html: I.send, "aria-label": "Suchen" });
    const thinking = h("div", { class: "thinking" });
    const results = h("div", {});
    const runSearch = () => runScannerSearch(input.value, thinking, results);
    goBtn.addEventListener("click", runSearch);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

    const suggestions = ["KI-Events diese Woche", "Wo lerne ich was über Security?", "Was ist heute Abend los?", "Workshops für Anfänger"];
    const sugRow = h("div", { class: "chip-row" },
      suggestions.map((s) => h("button", { class: "chip", onclick: () => { input.value = s; runSearch(); } }, s)),
    );

    left.appendChild(h("div", { class: "card" },
      h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Frag den Agenten"),
      h("h2", { class: "section-title", style: { margin: "8px 0 16px" } }, "Was suchst du heute?"),
      h("div", { class: "search-wrap" }, input, goBtn),
      h("div", { style: { marginTop: "14px" } }, sugRow),
      thinking, results,
    ));

    // Empfehlung des Tages
    const ranked = scoreAndRank(EVENTS.filter((e) => dayOffset(e.startsAt) >= 0), scoreInput());
    const top = ranked[0];
    if (top) {
      const ev = top.event;
      left.appendChild(h("div", { class: "card hero" },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Empfehlung des Tages"),
          h("span", { class: "match" }, Math.round(top.score * 100) + "% Match"),
        ),
        h("div", { class: "muted small", style: { marginTop: "4px" } }, "Persönlich für dich"),
        h("div", { class: "hero-title" }, ev.title),
        h("div", { class: "hero-meta" }, categoryTag(ev.category), h("span", {}, "· " + fmtDateTime(ev.startsAt)), h("span", {}, "· " + ev.location)),
        h("p", { class: "reason" }, top.reasons.join(" · ")),
        h("div", { style: { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" } },
          h("button", { class: "btn primary", onclick: () => goToMap(ev.id) }, "Auf der Karte zeigen"),
          h("button", { class: "btn", onclick: () => toggleVisited(ev.id) }, isVisited(ev.id) ? "✓ Besucht" : "Als besucht markieren"),
          h("a", { class: "btn", href: ev.url, target: "_blank", rel: "noopener" }, "Zur Eventseite"),
        ),
      ));
    }

    // Top 3 nächste 14 Tage
    const next = ranked.filter((r) => dayOffset(r.event.startsAt) <= 14).slice(0, 3);
    left.appendChild(h("div", { class: "card" },
      h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Top 3 in den nächsten 14 Tagen"),
      h("div", { class: "reco-list", style: { marginTop: "14px" } },
        next.map((r) => h("button", { class: "reco-item", onclick: () => goToMap(r.event.id) },
          h("div", {},
            h("div", { class: "t" }, r.event.title),
            h("div", { class: "meta" }, categoryLabel(r.event.category) + " · " + fmtDateTime(r.event.startsAt)),
          ),
          h("span", { class: "match" }, Math.round(r.score * 100) + "%"),
        )),
      ),
    ));

    // Event-Feed (aktuellste 5)
    const feed = [...EVENTS].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).slice(0, 5);
    const col2 = h("div", { class: "col-map", style: { display: "grid", gap: "18px" } },
      h("div", { class: "card" },
        h("div", { class: "section-eyebrow" }, "Aktuelle Events"),
        h("div", { class: "event-list", style: { marginTop: "8px" } }, feed.map((ev) => eventRow(ev, () => goToMap(ev.id)))),
      ),
    );

    body.appendChild(left);
    body.appendChild(col2);
    root.appendChild(body);
  }

  function runScannerSearch(query, thinkingEl, resultsEl) {
    clear(thinkingEl); clear(resultsEl);
    const steps = [
      "Verlauf analysieren …",
      "Schwerpunkte erkennen (" + (state.interests.map((i) => INTEREST_BY_ID[i].short).slice(0, 3).join(", ") || "alle") + ") …",
      query ? `Anfrage interpretieren: „${query}" …` : "Aktuelle Interessen interpretieren …",
      "Live suchen: Meetup · Eventbrite · Uni Würzburg · ZDI · Heise …",
      "Bewerten & nach deinem Profil sortieren …",
    ];
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    steps.forEach((s, idx) => {
      const step = h("div", { class: "think-step", style: { animationDelay: (reduced ? 0 : idx * 0.45) + "s" } },
        h("span", { class: "tick" }, "✓"), s);
      thinkingEl.appendChild(step);
    });

    const show = () => {
      const filtered = filterByQuery(EVENTS, query);
      const ranked = scoreAndRank(filtered, scoreInput()).slice(0, 6);
      clear(resultsEl);
      resultsEl.appendChild(h("div", { class: "section-eyebrow", style: { margin: "20px 0 10px" } },
        ranked.length + " Treffer · sortiert nach deinem Profil"));
      const list = h("div", { class: "reco-list" });
      ranked.forEach((r) => list.appendChild(h("button", { class: "reco-item", onclick: () => goToMap(r.event.id) },
        h("div", {},
          h("div", { class: "t" }, r.event.title),
          h("div", { class: "meta" }, categoryLabel(r.event.category) + " · " + fmtDateTime(r.event.startsAt) + " · " + r.event.source),
        ),
        h("span", { class: "match" }, Math.round(r.score * 100) + "%"),
      )));
      resultsEl.appendChild(list);
    };
    if (reduced) show(); else setTimeout(show, steps.length * 450 + 250);
  }

  function filterByQuery(events, query) {
    const q = (query || "").toLowerCase().trim();
    if (!q) return events;
    const KW = {
      ki: "ai", "ai": "ai", llm: "ai", security: "security", cyber: "security", dev: "dev",
      web: "dev", frontend: "dev", data: "data", daten: "data", cloud: "cloud", devops: "cloud",
      mobile: "mobile", ux: "ux", design: "ux", startup: "startup", "open source": "oss",
      robot: "robotics", blockchain: "blockchain", web3: "blockchain", gaming: "gaming", game: "gaming",
    };
    const wantTags = [];
    for (const k in KW) if (q.includes(k)) wantTags.push(KW[k]);
    const wantTonight = q.includes("heute") || q.includes("abend") || q.includes("today");
    const wantWeek = q.includes("woche") || q.includes("week");
    const wantBeginner = q.includes("anfänger") || q.includes("anfanger") || q.includes("einsteiger") || q.includes("lerne") || q.includes("workshop");

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
     KARTE / RADAR
     ============================================================ */
  let map = null, heatLayer = null, markers = [], markerById = {}, selectedRange = 0;

  function renderKarte() {
    const root = $("#screen-karte");
    if (!root) return;
    clear(root);
    root.appendChild(header(EVENTS.length + " Events · Würzburg", "Tippe auf einen Punkt für Details",
      h("button", { class: "cal-nav", html: I.refresh, "aria-label": "Aktualisieren", onclick: () => refreshMapData() })));

    const body = h("div", { class: "screen-body" });
    const mapCard = h("div", { class: "card flush map-card" },
      h("div", { style: { padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        h("div", { class: "section-title", style: { fontSize: "20px" } }, "Radar"),
        h("div", { class: "muted small", id: "range-label" }, "Heute"),
      ),
      h("div", { id: "map" }),
      h("div", { class: "range-bar" },
        h("label", { for: "range" }, "Zeitraum"),
        h("input", { type: "range", id: "range", min: "0", max: "6", step: "1", value: String(selectedRange),
          oninput: (e) => { selectedRange = +e.target.value; updateRangeLabel(); refreshMapData(); } }),
        h("span", { class: "range-val tnum", id: "range-val" }, rangeText(selectedRange)),
      ),
      h("div", { class: "legend" },
        ["ai", "dev", "data", "security"].map((c) =>
          h("span", { class: "item" }, h("span", { class: "dot", style: { background: interestColor(c) } }), categoryLabel(c))),
      ),
    );
    body.appendChild(mapCard);
    root.appendChild(body);
    setTimeout(initMap, 30);
  }

  function rangeText(n) { return n === 0 ? "Heute" : "Tag +" + n; }
  function updateRangeLabel() {
    const a = $("#range-val"), b = $("#range-label");
    if (a) a.textContent = rangeText(selectedRange);
    if (b) b.textContent = rangeText(selectedRange);
  }

  function initMap() {
    const el = document.getElementById("map");
    if (!el || typeof L === "undefined") return;
    if (map) { map.invalidateSize(); refreshMapData(); return; }
    map = L.map(el, { zoomControl: true, scrollWheelZoom: true }).setView(WUERZBURG, 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '© OpenStreetMap, © CARTO', maxZoom: 19, subdomains: "abcd",
    }).addTo(map);
    refreshMapData();
    setTimeout(() => map.invalidateSize(), 120);
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
      markers.push(marker);
      markerById[ev.id] = marker;
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
      </div>
    </div>`;
  }

  function goToMap(id) {
    go("karte");
    const ev = EVENTS.find((e) => e.id === id);
    setTimeout(() => {
      if (!map || !ev) return;
      map.invalidateSize();
      map.setView([ev.lat, ev.lng], 15, { animate: true });
      const m = markerById[id];
      if (m) m.openPopup();
    }, 160);
  }

  /* ============================================================
     KALENDER
     ============================================================ */
  let calMonth = new Date().getMonth(), calYear = new Date().getFullYear(), calSelected = null;

  function renderKalender() {
    const root = $("#screen-kalender");
    if (!root) return;
    clear(root);
    root.appendChild(header("Kalender", "Wähle einen Tag für Empfehlungen"));

    const body = h("div", { class: "screen-body" });
    const card = h("div", { class: "card" });

    card.appendChild(h("div", { class: "cal-head" },
      h("button", { class: "cal-nav", "aria-label": "Vorheriger Monat", onclick: () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderKalender(); } }, "‹"),
      h("div", { class: "month" }, MONTHS[calMonth] + " " + calYear),
      h("button", { class: "cal-nav", "aria-label": "Nächster Monat", onclick: () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderKalender(); } }, "›"),
    ));

    const grid = h("div", { class: "cal-grid" });
    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach((d) => grid.appendChild(h("div", { class: "cal-dow" }, d)));

    const first = new Date(calYear, calMonth, 1);
    let startPad = (first.getDay() + 6) % 7; // Montag-basiert
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < startPad; i++) grid.appendChild(h("div", { class: "cal-cell empty out" }));

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calYear, calMonth, day);
      const dayEvents = EVENTS.filter((e) => sameDay(e.startsAt, date));
      const cats = [...new Set(dayEvents.map((e) => e.category))].slice(0, 3);
      const isToday = sameDay(today.toISOString(), date);
      const isSel = calSelected && sameDay(calSelected.toISOString(), date);
      const cell = h("button", {
        class: "cal-cell" + (isToday ? " today" : ""),
        "aria-pressed": isSel ? "true" : "false",
        onclick: () => { calSelected = date; renderKalender(); },
      },
        h("span", { class: "num" }, String(day)),
        h("div", { class: "cal-dots" }, cats.map((c) => h("span", { class: "d", style: { background: interestColor(c) } }))),
      );
      grid.appendChild(cell);
    }
    card.appendChild(grid);
    body.appendChild(card);

    // Detail
    if (calSelected) {
      const dayEvents = scoreAndRank(EVENTS.filter((e) => sameDay(e.startsAt, calSelected)), scoreInput());
      const detail = h("div", { class: "card" },
        h("div", { class: "section-eyebrow" }, fmtSelectedDay(calSelected)),
      );
      if (dayEvents.length) {
        detail.appendChild(h("div", { class: "event-list", style: { marginTop: "8px" } },
          dayEvents.map((r) => eventRowWithVisit(r.event))));
      } else {
        detail.appendChild(h("div", { class: "empty-state", style: { marginTop: "12px" } }, "Keine Events an diesem Tag."));
      }
      body.appendChild(detail);
    } else {
      body.appendChild(h("div", { class: "card" }, h("div", { class: "empty-state" }, "Wähle einen Tag aus, um Empfehlungen zu sehen.")));
    }
    root.appendChild(body);
  }

  function fmtSelectedDay(date) {
    return `${WD[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  }

  function eventRowWithVisit(ev) {
    return h("div", { class: "event-row", style: { gridTemplateColumns: "56px 1fr auto" } },
      h("div", { class: "event-date" },
        h("div", { class: "d tnum" }, fmtTime(ev.startsAt).slice(0, 5)),
        h("div", { class: "m" }, ev.source),
      ),
      h("div", { class: "event-main" },
        h("div", { class: "t" }, ev.title),
        h("div", { class: "meta" }, categoryTag(ev.category), h("span", {}, "· " + ev.location)),
      ),
      h("button", { class: "chip", onclick: () => toggleVisited(ev.id) }, isVisited(ev.id) ? "✓" : "Merken"),
    );
  }

  /* ============================================================
     HISTORIE
     ============================================================ */
  let histTab = "visited";
  function renderHistorie() {
    const root = $("#screen-historie");
    if (!root) return;
    clear(root);
    root.appendChild(header("Historie", "Besuchte Events und Notizen"));
    const body = h("div", { class: "screen-body" });

    const visited = state.history.map((id) => EVENTS.find((e) => e.id === id)).filter(Boolean);
    const noteIds = Object.keys(state.notes).filter((id) => state.notes[id] && state.notes[id].trim());

    body.appendChild(h("div", { style: { display: "flex", justifyContent: "center" } },
      h("div", { class: "segmented" },
        h("button", { "aria-pressed": histTab === "visited", onclick: () => { histTab = "visited"; renderHistorie(); } }, "Besucht (" + visited.length + ")"),
        h("button", { "aria-pressed": histTab === "notes", onclick: () => { histTab = "notes"; renderHistorie(); } }, "Notizen (" + noteIds.length + ")"),
      ),
    ));

    if (histTab === "visited") {
      if (!visited.length) {
        body.appendChild(h("div", { class: "card" }, h("div", { class: "empty-state" }, "Noch keine Events besucht. Markiere Events im Kalender oder auf der Karte.")));
      } else {
        body.appendChild(h("div", { class: "card" },
          h("div", { class: "event-list" }, visited.map((ev) => h("div", { class: "event-row" },
            h("div", { class: "event-date" }, h("div", { class: "d tnum" }, String(new Date(ev.startsAt).getDate())), h("div", { class: "m" }, MONTHS_SHORT[new Date(ev.startsAt).getMonth()])),
            h("div", { class: "event-main" }, h("div", { class: "t" }, ev.title), h("div", { class: "meta" }, categoryTag(ev.category), h("span", {}, "· " + ev.location))),
            h("button", { class: "chip", onclick: () => toggleVisited(ev.id) }, "Entfernen"),
          )))));
      }
    } else {
      if (!visited.length) {
        body.appendChild(h("div", { class: "card" }, h("div", { class: "empty-state" }, "Markiere zuerst Events als besucht, dann kannst du hier Notizen hinterlegen.")));
      } else {
        const card = h("div", { class: "card" });
        visited.forEach((ev) => {
          const ta = h("textarea", { placeholder: "Notiz zu diesem Event …", oninput: (e) => { state.notes[ev.id] = e.target.value; save(); } }, );
          ta.value = state.notes[ev.id] || "";
          card.appendChild(h("div", { class: "note-row" },
            h("div", { class: "t", style: { fontWeight: "600" } }, ev.title),
            h("div", { class: "meta small muted" }, fmtDateTime(ev.startsAt)),
            ta,
          ));
        });
        body.appendChild(card);
      }
    }
    root.appendChild(body);
  }

  /* ============================================================
     KONTO / EINSTELLUNGEN
     ============================================================ */
  function renderKonto() {
    const root = $("#screen-konto");
    if (!root) return;
    clear(root);
    root.appendChild(header("Konto", "Interessen, Newsletter und mehr"));
    const body = h("div", { class: "screen-body" });

    // Profil
    const nameInput = h("input", { class: "input", type: "text", placeholder: "Wie heißt du?", value: state.name,
      oninput: (e) => { state.name = e.target.value; save(); } });
    body.appendChild(h("div", { class: "card" },
      h("div", { class: "profile-row" },
        h("div", { class: "avatar", html: I.person }),
        h("div", {}, h("div", { class: "who" }, "Mein Konto"), h("div", { class: "muted small" }, "Gast – nur lokal gespeichert")),
      ),
      h("div", { class: "field", style: { marginTop: "16px" } }, h("label", {}, "ANZEIGE-NAME"), nameInput),
    ));

    // Interessen
    const chipRow = h("div", { class: "chip-row" });
    INTERESTS.forEach((it) => {
      const active = state.interests.includes(it.id);
      const chip = h("button", {
        class: "chip", "aria-pressed": active ? "true" : "false",
        style: active ? { background: hexA(it.color, 0.14), color: it.color } : {},
        onclick: () => { toggleInterest(it.id); },
      },
        h("span", { class: "dot", style: { background: it.color } }), it.label);
      chipRow.appendChild(chip);
    });
    body.appendChild(h("div", { class: "card" },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" } },
        h("h2", { class: "section-title" }, "Interessen"),
        h("span", { class: "muted" }, state.interests.length + "/12 aktiv"),
      ),
      chipRow,
    ));

    // Standort-Hinweise
    const sw = h("label", { class: "switch" },
      Object.assign(h("input", { type: "checkbox", onchange: (e) => { state.locationHints = e.target.checked; save(); } }), {}),
      h("span", { class: "slider" }));
    sw.querySelector("input").checked = state.locationHints;
    body.appendChild(h("div", { class: "card" },
      h("div", { class: "toggle-row" },
        h("div", {}, h("div", { style: { fontWeight: "600" } }, "Standort-Hinweise"),
          h("div", { class: "muted small", style: { marginTop: "3px" } }, "Benachrichtigung bei Hotspots in deiner Nähe (geplant)")),
        sw,
      ),
    ));

    // Newsletter
    const emailInput = h("input", { class: "input", type: "email", placeholder: "du@beispiel.de", value: state.email,
      oninput: (e) => { state.email = e.target.value; save(); updateDigestEstimate(); } });
    const seg = h("div", { class: "segmented" },
      [["daily", "Täglich"], ["weekly", "Wöchentlich"], ["monthly", "Monatlich"]].map(([v, l]) =>
        h("button", { "aria-pressed": state.rhythm === v, onclick: () => { state.rhythm = v; save(); renderKonto(); } }, l)));

    const matching = EVENTS.filter((e) => e.tags.some((t) => state.interests.includes(t)));
    const perWeek = Math.max(1, Math.round(matching.length / 2));

    body.appendChild(h("div", { class: "card" },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" } },
        h("h2", { class: "section-title" }, "Newsletter"),
        h("span", { class: "muted", id: "digest-est" }, "ca. " + perWeek + " Events/Woche"),
      ),
      h("div", { class: "field", style: { marginBottom: "16px" } }, h("label", {}, "E-MAIL"), emailInput),
      h("div", { class: "field", style: { marginBottom: "18px" } }, h("label", {}, "RHYTHMUS"), seg),
      h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
        h("button", { class: "btn", onclick: openNewsletterPreview }, h("span", { html: I.eye }), "Vorschau"),
        h("button", { class: "btn primary", onclick: sendNewsletter }, h("span", { html: I.send }), "An mich senden"),
      ),
      h("div", { class: "muted small", style: { marginTop: "10px" } }, "Öffnet deine Mail-App mit fertigem Entwurf."),
    ));

    root.appendChild(body);
  }

  function updateDigestEstimate() { /* live estimate unchanged when only email changes */ }

  function toggleInterest(id) {
    const i = state.interests.indexOf(id);
    if (i >= 0) state.interests.splice(i, 1); else state.interests.push(id);
    save();
    renderKonto(); renderScanner();
    if (currentScreen === "karte") refreshMapData();
  }

  /* ============================================================
     NEWSLETTER (Vorschau + Versand)
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
          h("div", { class: "nl-title" }, "Dein Würzburger Tech-Radar"),
        ),
        h("div", { class: "nl-body" },
          h("div", {}, h("div", { style: { fontWeight: "700", fontSize: "17px" } }, "Hallo " + name + " 👋"),
            h("p", { class: "muted", style: { margin: "6px 0 0", lineHeight: "1.5" } },
              "Diese Auswahl passt zu deinen Interessen: " + state.interests.map((i) => INTEREST_BY_ID[i].label).join(", ") + ".")),
          top ? h("div", { class: "card", style: { padding: "16px", background: hexA("#0a84ff", 0.06), boxShadow: "none" } },
            h("div", { class: "section-eyebrow" }, h("span", { html: I.sparkle }), "Empfehlung des Agenten · " + Math.round(top.score * 100) + "% Match"),
            h("div", { style: { fontWeight: "700", margin: "8px 0 4px" } }, top.event.title),
            h("div", { class: "muted small" }, top.reasons.join(" · ")),
          ) : null,
          h("div", { style: { display: "grid", gap: "12px" } }, items.map((r) => {
            const ev = r.event;
            return h("div", { class: "nl-event" },
              h("div", { class: "thumb", style: { backgroundImage: `url(${thumbUrl(ev)})` } }),
              h("div", { class: "body" },
                h("div", {}, categoryTag(ev.category)),
                h("div", { class: "t", style: { marginTop: "4px" } }, ev.title),
                h("div", { class: "meta" }, fmtDateTime(ev.startsAt)),
                h("div", { class: "meta" }, ev.location),
                h("a", { href: ev.url, target: "_blank", rel: "noopener", style: { fontSize: "13px", fontWeight: "600" } }, "Zur Eventseite →"),
              ),
            );
          })),
        ),
        h("div", { class: "nl-foot" },
          h("button", { class: "btn", onclick: close }, "Schließen"),
          h("button", { class: "btn primary", onclick: () => { close(); sendNewsletter(); } }, h("span", { html: I.send }), "An mich senden"),
        ),
      ),
    );
    root.appendChild(modal);
    document.addEventListener("keydown", function onEsc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); } });
  }

  function sendNewsletter() {
    const items = digestEvents();
    const to = state.email.trim();
    if (!to) { go("konto"); alert("Bitte zuerst eine E-Mail-Adresse im Konto hinterlegen."); return; }
    const now = new Date();
    const name = state.name.trim() || "Tech-Fan";
    const subject = `Stadtsignal · KW ${isoWeek(now)} · dein Würzburger Tech-Radar`;
    const lines = [
      `Hallo ${name},`, "",
      "deine persönliche Event-Auswahl rund um Würzburg:", "",
      ...items.map((r) => {
        const ev = r.event;
        return `• ${ev.title}\n  ${categoryLabel(ev.category)} · ${fmtDateTime(ev.startsAt)}\n  ${ev.location}\n  ${ev.url}`;
      }),
      "", `Interessen: ${state.interests.map((i) => INTEREST_BY_ID[i].label).join(", ")}`,
      `Rhythmus: ${({ daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich" })[state.rhythm]}`,
      "", "— gesendet mit Stadtsignal",
    ];
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  /* ============================================================
     Navigation / Bootstrap
     ============================================================ */
  const SCREENS = [
    { id: "karte", label: "Karte", icon: I.map, render: renderKarte },
    { id: "kalender", label: "Kalender", icon: I.calendar, render: renderKalender },
    { id: "scanner", label: "Scanner", icon: I.sparkle, render: renderScanner, fab: true },
    { id: "historie", label: "Historie", icon: I.clock, render: renderHistorie },
    { id: "konto", label: "Konto", icon: I.gear, render: renderKonto },
  ];
  let currentScreen = "scanner";

  function go(name, fromHash) {
    if (!SCREENS.some((s) => s.id === name)) name = "scanner";
    currentScreen = name;
    SCREENS.forEach((s) => {
      const el = document.getElementById("screen-" + s.id);
      if (el) el.classList.toggle("active", s.id === name);
    });
    document.querySelectorAll("#tabbar button").forEach((b) => {
      b.setAttribute("aria-current", b.dataset.screen === name ? "page" : "false");
    });
    if (!fromHash && location.hash.slice(1) !== name) location.hash = name;
    if (name === "karte") setTimeout(initMap, 40);
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function buildTabbar() {
    const bar = $("#tabbar");
    clear(bar);
    SCREENS.forEach((s) => {
      bar.appendChild(h("button", {
        class: s.fab ? "fab" : "", dataset: { screen: s.id }, "aria-current": "false",
        "aria-label": s.label, onclick: () => go(s.id),
      },
        h("span", { class: "ico", html: s.icon }),
        h("span", {}, s.label),
      ));
    });
  }

  function init() {
    const mount = $("#screens");
    SCREENS.forEach((s) => {
      const div = h("div", { class: "screen", id: "screen-" + s.id });
      mount.appendChild(div);
      s.render();
    });
    buildTabbar();
    go(location.hash.slice(1) || "scanner", true);
    window.addEventListener("hashchange", () => go(location.hash.slice(1) || "scanner", true));

    // Popup-Buttons (Karte) per Delegation
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-visit]");
      if (btn) { toggleVisited(btn.getAttribute("data-visit")); if (map) map.closePopup(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
