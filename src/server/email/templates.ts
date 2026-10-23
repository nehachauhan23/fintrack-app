import { formatDate, formatMoney } from "@/lib/format";
import type { Email } from "./send";

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const INK = "#101820";
const MUTED = "#4A5560";

function shell(title: string, bodyHtml: string, appUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F3F5F7;font-family:Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #DDE2E5;border-radius:6px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #DDE2E5;font-size:15px;font-weight:700;letter-spacing:.02em;color:#0A6B66">FinTrack</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #DDE2E5;font-size:12px;color:${MUTED}">You get these because email alerts are on. <a href="${escapeHtml(appUrl)}/settings" style="color:#0A6B66">Change that in Settings</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

export function budgetAlertEmail(a: { name: string; categoryName: string; limit: number; spent: number; level: 80 | 100; currency: string; period: string }, appUrl: string): Omit<Email, "to"> {
  const money = (n: number) => formatMoney(n, a.currency);
  const month = formatDate(`${a.period}-01`, "month");
  const scope = a.categoryName === "Overall" ? "your overall budget" : `your ${a.categoryName} budget`;
  const headline = a.level === 100 ? `You've gone over ${scope}` : `You've used 80% of ${scope}`;
  const line = `${money(a.spent)} spent of ${money(a.limit)} in ${month}.`;
  const html = shell(
    headline,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hi ${escapeHtml(a.name.split(" ")[0] ?? a.name)}, ${escapeHtml(line)}</p>
<a href="${escapeHtml(appUrl)}/budgets" style="display:inline-block;background:#0A6B66;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;font-size:14px">Review budgets</a>`,
    appUrl,
  );
  return { subject: headline, html, text: `${headline}\n${line}\n${appUrl}/budgets` };
}

export function monthlyReportEmail(
  r: { name: string; period: string; currency: string; income: number; expense: number; net: number; headline: string; points: string[]; categories: { name: string; amount: number }[] },
  appUrl: string,
): Omit<Email, "to"> {
  const money = (n: number) => formatMoney(n, r.currency);
  const month = formatDate(`${r.period}-01`, "month");
  const row = (label: string, value: string) => `<tr><td style="padding:6px 0;color:${MUTED};font-size:14px">${escapeHtml(label)}</td><td align="right" style="padding:6px 0;font-size:14px;font-weight:600">${escapeHtml(value)}</td></tr>`;
  const html = shell(
    `Your ${month} summary`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escapeHtml(r.headline)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #DDE2E5;border-bottom:1px solid #DDE2E5;margin-bottom:16px">${row("Income", money(r.income))}${row("Spending", money(r.expense))}${row("Net", money(r.net))}</table>
${r.categories.length ? `<p style="margin:0 0 6px;font-size:13px;color:${MUTED}">Where it went</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">${r.categories.slice(0, 5).map((c) => row(c.name, money(c.amount))).join("")}</table>` : ""}
${r.points.length ? `<ul style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.5">${r.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}
<a href="${escapeHtml(appUrl)}/reports" style="display:inline-block;background:#0A6B66;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;font-size:14px">Open reports</a>`,
    appUrl,
  );
  const text = [`${month} summary`, r.headline, `Income ${money(r.income)}`, `Spending ${money(r.expense)}`, `Net ${money(r.net)}`, ...r.points.map((p) => `- ${p}`), `${appUrl}/reports`].join("\n");
  return { subject: `Your ${month} summary`, html, text };
}
