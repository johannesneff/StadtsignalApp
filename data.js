/* Stadtsignal — Daten-Seed (Kategorien, Interessen, Events).
   In Produktion käme das aus echten Feeds (FHWS/JMU ICS, Heise RSS, Meetup).
   Für die Demo: kuratierter, realistischer Seed mit echten Würzburger Orten. */

export const INTERESTS = [
  { id: "ai", label: "KI / AI", short: "KI", color: "#0a84ff", isMain: true },
  { id: "dev", label: "Web-Entwicklung", short: "Dev", color: "#34c759", isMain: true },
  { id: "data", label: "Data Science", short: "Data", color: "#ff9500", isMain: true },
  { id: "security", label: "Cyber Security", short: "Security", color: "#ff3b30", isMain: true },
  { id: "cloud", label: "DevOps & Cloud", short: "Cloud", color: "#30b0c7", isMain: false },
  { id: "mobile", label: "Mobile", short: "Mobile", color: "#5e5ce6", isMain: false },
  { id: "ux", label: "UX / UI", short: "UX", color: "#ff2d92", isMain: false },
  { id: "startup", label: "Startups", short: "Startup", color: "#ffcc00", isMain: false },
  { id: "oss", label: "Open Source", short: "OSS", color: "#00c7be", isMain: false },
  { id: "robotics", label: "Robotik", short: "Robotik", color: "#647488", isMain: false },
  { id: "blockchain", label: "Blockchain", short: "Blockchain", color: "#af52de", isMain: false },
  { id: "gaming", label: "Gaming", short: "Gaming", color: "#bf5af2", isMain: false },
];

export const INTEREST_BY_ID = Object.fromEntries(INTERESTS.map((i) => [i.id, i]));

/** Vier Hauptkategorien (matchen die Karten-Marker-Farben). */
export const MAIN_CATEGORIES = ["ai", "dev", "data", "security"];

export function interestColor(id) {
  return (INTEREST_BY_ID[id] || {}).color || "#647488";
}
export function categoryLabel(id) {
  return (INTEREST_BY_ID[id] || {}).label || id;
}

/* Anker: heute. daysAhead(n) liefert ISO-Startzeit n Tage in der Zukunft. */
function daysAhead(n, hour = 18, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const VENUES = {
  fhws_sandersring: { name: "FHWS Sanderheinrichsleitenweg 20", lat: 49.7768, lng: 9.9305 },
  fhws_lochweg: { name: "FHWS Münzstraße 12", lat: 49.7848, lng: 9.9701 },
  jmu_zentrum: { name: "Uni Würzburg, Z6 Hubland", lat: 49.7836, lng: 9.9683 },
  jmu_informatik: { name: "Informatik Hubland Süd", lat: 49.7822, lng: 9.9712 },
  zdi: { name: "ZDI Mainfranken, Veitshöchheimer Str. 14", lat: 49.8035, lng: 9.9213 },
  vogel: { name: "Vogel Communications, Max-Planck-Str. 7", lat: 49.7649, lng: 9.9608 },
  ihk: { name: "IHK Würzburg-Schweinfurt, Mainaustr. 33", lat: 49.7917, lng: 9.9263 },
  posthalle: { name: "Posthalle, Bahnhofplatz", lat: 49.8016, lng: 9.9337 },
  igz: { name: "Innovations- & Gründerzentrum, Friedrich-Bergius-Ring 15", lat: 49.7585, lng: 9.9648 },
  central: { name: "Café Central, Marienplatz 7", lat: 49.7913, lng: 9.9298 },
  digitalhub: { name: "Digital Hub Mainfranken, Münzstraße 1", lat: 49.7949, lng: 9.9277 },
};

export const EVENTS = [
  { id: "e1", title: "KI-Stammtisch Würzburg: LLM-Agenten in Produktion", description: "Praxis-Talks zu LangGraph, Eval-Pipelines und Kosten-Optimierung beim Betrieb von LLM-Agenten.", startsAt: daysAhead(1, 19, 0), venue: "digitalhub", category: "ai", tags: ["ai", "cloud"], url: "https://www.meetup.com/de-DE/wuerzburg-ki/", source: "Meetup" },
  { id: "e2", title: "FHWS Tech Talk: TypeScript-Performance im Monorepo", description: "Wie Skip-Compilation, Project References und Bun den Build großer Frontends halbiert haben.", startsAt: daysAhead(2, 18, 30), venue: "fhws_sandersring", category: "dev", tags: ["dev", "oss"], url: "https://www.thws.de/forschung/", source: "FHWS" },
  { id: "e3", title: "Data Science Meetup: Vector Search ohne Pinecone", description: "pgvector, DuckDB-VSS und Qdrant im Vergleich – live Benchmarks an Würzburger Open-Data.", startsAt: daysAhead(2, 19, 30), venue: "vogel", category: "data", tags: ["data", "ai"], url: "https://www.meetup.com/wuerzburg-data/", source: "Meetup" },
  { id: "e4", title: "OWASP Würzburg Chapter Meeting", description: "Threat-Modeling für KI-Anwendungen. Workshop-Format mit eigenen Apps.", startsAt: daysAhead(3, 18, 0), venue: "ihk", category: "security", tags: ["security", "ai"], url: "https://owasp.org/chapters/germany/", source: "OWASP" },
  { id: "e5", title: "JMU Forschungskolloquium: Erklärbare KI in der Medizin", description: "Wie SHAP, LIME und Concept Bottleneck Models in der Radiologie eingesetzt werden.", startsAt: daysAhead(4, 16, 15), venue: "jmu_informatik", category: "ai", tags: ["ai", "data"], url: "https://www.uni-wuerzburg.de/informatik/", source: "Uni Würzburg" },
  { id: "e6", title: "Startup Pitch Night Mainfranken", description: "Fünf Mainfranken-Startups pitchen vor lokalen Angels. Anschließendes Get-together.", startsAt: daysAhead(5, 19, 0), venue: "igz", category: "dev", tags: ["startup", "dev"], url: "https://www.gruenderzentrum-wuerzburg.de/", source: "IGZ" },
  { id: "e7", title: "DevOps Lunch & Learn: Plattform-Engineering mit Backstage", description: "Erfahrungsbericht eines Würzburger Software-Hauses zur Einführung von Backstage.", startsAt: daysAhead(6, 12, 0), venue: "posthalle", category: "dev", tags: ["cloud", "dev", "oss"], url: "https://backstage.io/", source: "Lokal" },
  { id: "e8", title: "ZDI Mainfranken: KI-Schnuppertag", description: "Studierende der Uni Würzburg zeigen ML-Projekte. Offen für die Tech-Community.", startsAt: daysAhead(0, 14, 0), venue: "zdi", category: "ai", tags: ["ai", "robotics"], url: "https://zdi-mainfranken.de/", source: "ZDI" },
  { id: "e9", title: "Frontend Friday: View Transitions & React 19", description: "Hands-on, wie die View-Transition-API mit React 19 Server Components zusammenspielt.", startsAt: daysAhead(3, 17, 30), venue: "fhws_lochweg", category: "dev", tags: ["dev", "ux"], url: "https://www.meetup.com/wuerzburg-frontend/", source: "Meetup" },
  { id: "e10", title: "Cyber-Threat-Briefing: Ransomware in DACH", description: "Geschlossener IHK-Kreis, Quartalsbriefing von CERT-Bayern. Anmeldung nötig.", startsAt: daysAhead(4, 9, 0), venue: "ihk", category: "security", tags: ["security", "cloud"], url: "https://www.wuerzburg.ihk.de/", source: "IHK" },
  { id: "e11", title: "PyData Würzburg: Polars statt Pandas", description: "Performance-Vergleich, Migration-Cookbook und Real-World-Beispiele aus der Logistik.", startsAt: daysAhead(5, 18, 30), venue: "jmu_zentrum", category: "data", tags: ["data", "oss"], url: "https://www.meetup.com/pydata-wuerzburg/", source: "PyData" },
  { id: "e12", title: "UX-Roundtable: Mobile-First Banking", description: "Designer:innen lokaler Sparkassen-IT diskutieren Touch-Targets, A11y und Trust-Signale.", startsAt: daysAhead(1, 17, 0), venue: "central", category: "dev", tags: ["ux", "mobile"], url: "https://www.uxschnitzel.de/", source: "UX Schnitzel" },
  { id: "e13", title: "OSS Hack Saturday – Open-Data Würzburg", description: "Beiträge zu offenen Datensätzen der Stadt (Verkehr, Parken, Luft). Kuchen inklusive.", startsAt: daysAhead(6, 10, 0), venue: "digitalhub", category: "dev", tags: ["oss", "data"], url: "https://opendata.wuerzburg.de/", source: "Open-Data WÜ" },
  { id: "e14", title: "ML for Robotics: ROS 2 & Foundation Models", description: "Wie Vision-Language-Models in autonome Roboter integriert werden. Mit Demo-Roboter vor Ort.", startsAt: daysAhead(2, 18, 0), venue: "jmu_informatik", category: "ai", tags: ["ai", "robotics"], url: "https://www.uni-wuerzburg.de/informatik/", source: "Uni Würzburg" },
  { id: "e15", title: "Cloud Native Würzburg: Kubernetes auf der grünen Wiese", description: "Talos Linux, Cilium und Argo CD – ein Greenfield-Setup live aufgebaut.", startsAt: daysAhead(3, 19, 30), venue: "posthalle", category: "dev", tags: ["cloud", "dev"], url: "https://www.cncf.io/", source: "CNCF" },
  { id: "e16", title: "Gamedev-Treff: Godot 4.5 Workshop", description: "Von der leeren Szene zum spielbaren Prototyp in 2 Stunden.", startsAt: daysAhead(5, 19, 0), venue: "central", category: "dev", tags: ["gaming", "dev"], url: "https://godotengine.org/", source: "Gamedev WÜ" },
  { id: "e17", title: "Web3 Coffee: Layer-2 für nicht-finanzielle Anwendungen", description: "Wo Blockchain abseits von DeFi wirklich Sinn ergibt – Praxisbeispiel ID-Wallets.", startsAt: daysAhead(4, 8, 30), venue: "central", category: "dev", tags: ["blockchain"], url: "https://ethereum.org/", source: "Web3 WÜ" },
  { id: "e18", title: "Security Sundowner: Supply-Chain-Attacken auf npm", description: "Live-Forensik einer kompromittierten Toolchain. Drinks im Anschluss.", startsAt: daysAhead(6, 18, 30), venue: "vogel", category: "security", tags: ["security", "dev", "oss"], url: "https://owasp.org/", source: "OWASP" },
  { id: "e19", title: "Heise devSec Roadshow Würzburg", description: "Ganztags-Konferenz: Sichere SDLC, Threat Modeling, SBOMs, KI-Code-Reviews.", startsAt: daysAhead(0, 9, 30), venue: "posthalle", category: "security", tags: ["security", "dev"], url: "https://devsec.heise.de/", source: "Heise" },
  { id: "e20", title: "Frauen in Tech – Karriereabend Mainfranken", description: "Speed-Mentoring, Talks und Networking für FLINTA in der Tech-Branche.", startsAt: daysAhead(1, 18, 0), venue: "igz", category: "dev", tags: ["startup", "dev", "ux"], url: "https://www.womenwhocode.com/", source: "WWC" },
].map((e) => {
  const v = VENUES[e.venue];
  return { ...e, location: v.name, lat: v.lat, lng: v.lng };
});

export function getEvents() {
  return EVENTS;
}
