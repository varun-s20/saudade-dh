/**
 * The HTML body of every Saudade email: the site's look on paper. Linen ground, the stamp-and-heart
 * wordmark, a paper card edged with the airmail stripe and a postmark, block-capital headline with
 * a handwritten word, and the brick-red button (styles/tokens.css).
 *
 * Email-safe on purpose: tables and inline styles (Gmail strips most <style>), PNG images instead
 * of SVG (public/email/, drawn by scripts/email-assets.mjs), and web fonts with solid fallbacks
 * (Apple Mail shows Bowlby One / Karla / Nanum Pen Script; Gmail and Outlook show Arial Black,
 * Arial and the system hand). Every message also carries the plain-text version (templates.ts).
 */

export interface EmailContent {
  /** Inbox preview line (hidden in the body). */
  preheader: string;
  /** Small tracked capitals above the headline, like the site's postal labels. */
  eyebrow: string;
  /** Block capitals… */
  heading: string;
  /** …and the handwritten word that finishes it, as on the site ("Claim your envelope."). */
  script: string;
  paragraphs: string[];
  code?: string;
  buttons: { label: string; href: string }[];
  /** Shown under the button: the raw link, for when the button doesn't work. */
  fallbackLink?: string;
  /** A boxed tip (the voice-recording note). */
  note?: string;
  /** Why they got this email; small print under the card. */
  footer: string;
}

const C = {
  linen: "#f2e8d8",
  paper: "#fbf5eb",
  card: "#fffbf4",
  edge: "#c8b496",
  ink: "#2f231b",
  inkSoft: "#574739",
  inkFaded: "#76655a",
  red: "#b5432a",
  navy: "#213a63",
  cobalt: "#2f4a68",
  ochre: "#f0b437",
};
const FONT = {
  display: "'Bowlby One','Arial Black','Helvetica Neue',Arial,sans-serif",
  ui: "Karla,'Helvetica Neue',Helvetica,Arial,sans-serif",
  hand: "'Nanum Pen Script','Bradley Hand','Segoe Print','Comic Sans MS',cursive",
};

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function button(b: { label: string; href: string }, first: boolean): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${first ? 28 : 12}px 0 0">
  <tr><td bgcolor="${C.red}" style="background:${C.red};border:2px solid ${C.ink};border-radius:999px;box-shadow:3px 3px 0 ${C.ink}">
    <a href="${esc(b.href)}" target="_blank" style="display:inline-block;padding:14px 30px;font:700 16px/1.2 ${FONT.ui};color:${C.paper};text-decoration:none;border-radius:999px">${esc(b.label)}&nbsp;&rarr;</a>
  </td></tr></table>`;
}

/** The whole HTML document. `origin` is the site the images and the logo link come from. */
export function renderEmailHtml(c: EmailContent, opts: { subject: string; origin: string; supportEmail: string }): string {
  const img = (file: string) => `${opts.origin}/email/${file}`;
  const p = (text: string) => `<p style="margin:16px 0 0;font:400 17px/1.6 ${FONT.ui};color:${C.inkSoft}">${esc(text)}</p>`;

  const code = c.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">
  <tr><td align="center" bgcolor="${C.paper}" style="background:${C.paper};border:2px dashed ${C.edge};border-radius:10px;padding:16px 12px">
    <div style="font:700 12px/1.4 ${FONT.ui};letter-spacing:0.18em;text-transform:uppercase;color:${C.inkFaded}">Your code</div>
    <div style="margin-top:6px;font:700 32px/1.2 ${FONT.ui};letter-spacing:0.16em;color:${C.ink}">${esc(c.code)}</div>
  </td></tr></table>`
    : "";

  const fallback = c.fallbackLink
    ? `<p style="margin:18px 0 0;font:400 13px/1.55 ${FONT.ui};color:${C.inkFaded}">Button not working? Copy this into your browser:<br>
  <a href="${esc(c.fallbackLink)}" target="_blank" style="color:${C.navy};word-break:break-all">${esc(c.fallbackLink)}</a></p>`
    : "";

  const note = c.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0">
  <tr><td bgcolor="${C.paper}" style="background:${C.paper};border-left:4px solid ${C.ochre};padding:12px 16px;font:400 14px/1.55 ${FONT.ui};color:${C.inkSoft}">
    <strong style="font-weight:700;color:${C.ink}">Tip:</strong> ${esc(c.note)}
  </td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(opts.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Karla:wght@400;700&family=Nanum+Pen+Script&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%}
  @media (max-width:600px){.sd-pad{padding:28px 22px 26px !important}.sd-h1{font-size:28px !important}.sd-mark{width:56px !important;height:56px !important}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.linen}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.linen}" style="background:${C.linen}">
<tr><td align="center" style="padding:32px 12px 40px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td align="center" style="padding:0 0 22px">
      <a href="${esc(opts.origin)}" target="_blank" style="text-decoration:none"><img src="${img("logo.png")}" width="152" height="48" alt="Saudade" style="display:block;border:0;width:152px;height:48px;max-width:100%;font:400 30px/48px ${FONT.hand};color:${C.ink}"></a>
    </td></tr>
    <tr><td bgcolor="${C.card}" style="background:${C.card};border:2px solid ${C.ink};border-radius:6px;box-shadow:6px 6px 0 ${C.cobalt}">
      <div style="height:8px;line-height:8px;font-size:0;background:${C.red};border-radius:4px 4px 0 0"><img src="${img("airmail.png")}" width="100%" height="8" alt="" style="display:block;border:0;width:100%;max-width:100%;height:8px;border-radius:4px 4px 0 0"></div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="sd-pad" style="padding:34px 40px 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="padding-top:6px;font:700 12px/1.4 ${FONT.ui};letter-spacing:0.18em;text-transform:uppercase;color:${C.inkFaded}">${esc(c.eyebrow)}</td>
          <td valign="top" align="right" width="72"><img class="sd-mark" src="${img("postmark.png")}" width="72" height="72" alt="" style="display:block;border:0;width:72px;height:72px"></td>
        </tr></table>
        <h1 class="sd-h1" style="margin:4px 0 0;font:400 34px/1.08 ${FONT.display};text-transform:uppercase;color:${C.ink}">${esc(c.heading)} <span style="font-family:${FONT.hand};font-size:1.15em;text-transform:none;color:${C.red};white-space:nowrap">${esc(c.script)}</span></h1>
        ${c.paragraphs.map(p).join("\n        ")}
        ${code}
        ${c.buttons.map((b, i) => button(b, i === 0)).join("\n")}
        ${fallback}
        ${note}
      </td></tr></table>
    </td></tr>
    <tr><td align="center" style="padding:26px 12px 0;font:400 13px/1.6 ${FONT.ui};color:${C.inkFaded}">
      ${esc(c.footer)}<br>
      Questions? Write to <a href="mailto:${esc(opts.supportEmail)}" style="color:${C.navy}">${esc(opts.supportEmail)}</a>.<br>
      <span style="font-family:${FONT.hand};font-size:20px;color:${C.inkSoft}">With love, Saudade</span>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
