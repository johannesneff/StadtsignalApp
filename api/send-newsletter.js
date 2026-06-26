// Stadtsignal — Newsletter-Versand (Vercel Serverless Function).
// Sendet eine ECHTE HTML-Mail an die hinterlegte Adresse – über Resend (https://resend.com).
//
// Erforderlich: Umgebungsvariable RESEND_API_KEY (Key: https://resend.com/api-keys).
// Optional:     RESEND_FROM  (Standard: "Stadtsignal <onboarding@resend.dev>").
//   Ohne eigene verifizierte Domain erlaubt Resend zuverlässig nur den Versand an
//   die EIGENE Konto-Adresse – genau der gewünschte Anwendungsfall.
//
// Ohne RESEND_API_KEY -> 503 (Frontend zeigt dann einen Hinweis statt zu senden).

const RESEND_FROM = process.env.RESEND_FROM || "Stadtsignal <onboarding@resend.dev>";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const CAT_COLOR = { ai: "#0a84ff", dev: "#34c759", data: "#ff9500", security: "#ff3b30" };
const CAT_LABEL = { ai: "KI / AI", dev: "Web-Entwicklung", data: "Data Science", security: "Cyber Security" };

// Ein Event als E-Mail-taugliche (table-basierte, inline-gestylte) Karte.
function eventRowHtml(ev) {
  const color = CAT_COLOR[ev.category] || "#0a84ff";
  const label = ev.categoryLabel || CAT_LABEL[ev.category] || "Event";
  const img = ev.image || "";
  const url = ev.url || "#";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e3e6;border-radius:16px;overflow:hidden;margin:0 0 12px">
    <tr>
      <td width="92" style="padding:0">
        ${img ? `<img src="${esc(img)}" width="92" height="92" alt="" style="display:block;width:92px;height:92px;object-fit:cover">` : `<div style="width:92px;height:92px;background:${color}1a"></div>`}
      </td>
      <td style="padding:12px 14px;vertical-align:top">
        <span style="display:inline-block;font-size:12px;font-weight:700;color:${color};background:${color}1a;padding:2px 9px;border-radius:980px">${esc(label)}</span>
        <div style="font-weight:600;font-size:15px;color:#1d1d1f;margin:6px 0 2px">${esc(ev.title)}</div>
        <div style="font-size:12.5px;color:#6e6e73">${esc(ev.when || "")}</div>
        <div style="font-size:12.5px;color:#6e6e73">${esc(ev.location || "")}</div>
        <a href="${esc(url)}" style="font-size:13px;font-weight:600;color:${color};text-decoration:none">Zur Eventseite &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function buildHtml({ name, kw, dateLabel, interests, events, top }) {
  const heroHtml = top ? `
    <div style="background:#0a84ff0f;border-radius:14px;padding:14px 16px;margin:0 0 16px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.04em;color:#0a84ff;text-transform:uppercase">★ Empfehlung des Agenten${top.match ? " · " + esc(top.match) + "% Match" : ""}</div>
      <div style="font-weight:700;font-size:16px;color:#1d1d1f;margin:8px 0 4px">${esc(top.title)}</div>
      ${top.reason ? `<div style="font-size:13px;color:#6e6e73">${esc(top.reason)}</div>` : ""}
    </div>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:20px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden">
        <tr><td style="background:#0a84ff;color:#fff;padding:22px 24px">
          <div style="font-size:13px;font-weight:600;opacity:.85">STADTSIGNAL · KW ${esc(kw)} · ${esc(dateLabel)}</div>
          <div style="font-size:22px;font-weight:700;margin-top:2px">Dein Würzburger Tech-Radar</div>
        </td></tr>
        <tr><td style="padding:22px 24px">
          <div style="font-weight:700;font-size:17px;color:#1d1d1f">Hallo ${esc(name)} 👋</div>
          <p style="color:#6e6e73;margin:6px 0 16px;line-height:1.5;font-size:14px">Diese Auswahl passt zu deinen Interessen: ${esc((interests || []).join(", "))}.</p>
          ${heroHtml}
          ${(events || []).map(eventRowHtml).join("")}
          <p style="color:#a1a1a6;font-size:12px;margin:18px 0 0">— gesendet mit Stadtsignal</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const key = process.env.RESEND_API_KEY;
  if (!key) { res.status(503).json({ error: "RESEND_API_KEY nicht gesetzt" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const to = (body.to || "").toString().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { res.status(400).json({ error: "Ungültige Empfängeradresse" }); return; }

  const name = (body.name || "Tech-Fan").toString().slice(0, 80);
  const events = Array.isArray(body.events) ? body.events.slice(0, 8) : [];
  const interests = Array.isArray(body.interests) ? body.interests.slice(0, 12) : [];
  const subject = (body.subject || "Stadtsignal · dein Würzburger Tech-Radar").toString().slice(0, 160);
  const html = buildHtml({
    name, kw: body.kw || "", dateLabel: body.dateLabel || "", interests, events, top: body.top || null,
  });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(r.status).json({ error: data?.message || `Resend-Fehler (${r.status})` }); return; }
    res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Versand fehlgeschlagen" });
  }
}
