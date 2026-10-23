import "server-only";
import { env } from "@/env";
import { db } from "@/server/db";
import { inngest } from "./client";
import { sendEmail } from "@/server/email/send";
import { budgetAlertEmail, monthlyReportEmail } from "@/server/email/templates";
import { collectBudgetAlerts, markBudgetAlerted } from "@/server/services/budgets";
import { dueRuleIds, processRule } from "@/server/services/recurring";
import { runMaintenance } from "@/server/services/maintenance";
import { periodStats } from "@/server/services/analytics";
import { getMonthlyInsight } from "@/server/ai/insights";
import { addMonths, periodKeyOf, utcToday } from "@/domain/periods";

/** Posts every recurring transaction that has come due. Safe to run twice: processRule is idempotent. */
export const processRecurring = inngest.createFunction({ id: "process-recurring", retries: 3 }, { cron: "0 1 * * *" }, async ({ step }) => {
  const ids = await step.run("find-due-rules", () => dueRuleIds());
  let created = 0;
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    created += await step.run(`post-${i / 25}`, async () => {
      let n = 0;
      for (const id of chunk) n += (await processRule(id, utcToday())).created;
      return n;
    });
  }
  return { rules: ids.length, created };
});

/** Emails each budget alert once per level per month. A budget is only marked as alerted after its email was sent. */
export const budgetAlerts = inngest.createFunction({ id: "budget-alerts", retries: 3 }, { cron: "0 */6 * * *" }, async ({ step }) => {
  const alerts = await step.run("collect", () => collectBudgetAlerts());
  for (const a of alerts) {
    await step.run(`alert-${a.budgetId}-${a.level}`, async () => {
      const mail = budgetAlertEmail(a, env.APP_URL);
      await sendEmail({ to: a.email, ...mail });
      await markBudgetAlerted(a.budgetId, a.period, a.level);
    });
  }
  return { alerts: alerts.length };
});

/** On the 1st: a summary of the month that just ended, using any cached AI insight and otherwise the rule-based one (no AI quota is spent). */
export const monthlyReport = inngest.createFunction({ id: "monthly-report", retries: 2 }, { cron: "0 8 1 * *" }, async ({ step }) => {
  const period = addMonths(periodKeyOf(utcToday()), -1);
  const users = await step.run("find-users", () => db.user.findMany({ where: { emailAlerts: true, accounts: { some: {} } }, select: { id: true, email: true, name: true, currency: true, aiEnabled: true } }));
  let sent = 0;
  for (const u of users) {
    sent += await step.run(`report-${u.id}`, async () => {
      const stats = await periodStats(u.id, period);
      if (stats.income === 0 && stats.expense === 0) return 0;
      const insight = await getMonthlyInsight({ ...u, emailAlerts: true, sessionId: "job" }, period);
      const mail = monthlyReportEmail(
        { name: u.name, period, currency: u.currency, income: stats.income, expense: stats.expense, net: stats.net, headline: insight.headline, points: insight.insights.map((i) => `${i.title}: ${i.detail}`).slice(0, 4), categories: stats.categories },
        env.APP_URL,
      );
      return (await sendEmail({ to: u.email, ...mail })).sent ? 1 : 0;
    });
  }
  return { period, users: users.length, sent };
});

export const maintenance = inngest.createFunction({ id: "maintenance" }, { cron: "30 3 * * *" }, async ({ step }) => step.run("cleanup", () => runMaintenance()));

export const functions = [processRecurring, budgetAlerts, monthlyReport, maintenance];
