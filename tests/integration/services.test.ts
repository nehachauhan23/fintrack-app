import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { authenticate, registerUser, changePassword } from "@/server/services/auth";
import { burnPasswordCheck, needsRehash, verifyPassword } from "@/server/auth/password";
import { archiveAccount, createAccount, listAccounts, reconcileAccount, setDefaultAccount } from "@/server/services/accounts";
import {
  bulkDeleteTransactions, createTransaction, createTransfer, deleteTransaction, importTransactions, listTransactions, recategorize, updateTransaction,
} from "@/server/services/transactions";
import { budgetStatuses, collectBudgetAlerts, markBudgetAlerted, setBudget } from "@/server/services/budgets";
import { contributeToGoal, createGoal } from "@/server/services/goals";
import { createRule, processRule, upcomingRecurring } from "@/server/services/recurring";
import { accountLedger, cashFlow, categoryBreakdown, detectAnomalies, monthSummary } from "@/server/services/analytics";
import { rateLimit } from "@/server/auth/rate-limit";
import { parseDateOnly } from "@/domain/periods";
import { balanceOf, cleanup, makeUser, makeUserWithAccount } from "./helpers";
import bcrypt from "bcryptjs";

const users: string[] = [];
afterAll(async () => {
  await cleanup(...users);
  await db.$disconnect();
});
const fresh = async (opening?: string) => {
  const r = await makeUserWithAccount(opening);
  users.push(r.userId);
  return r;
};
const tx = (accountId: string, o: Partial<Parameters<typeof createTransaction>[1]> = {}) =>
  createTransaction(users.at(-1)!, { accountId, type: "EXPENSE", amount: "10.00", date: "2026-10-10", category: "food", ...o });

describe("authentication", () => {
  it("registers, authenticates, and gives one error for unknown email and wrong password", async () => {
    const email = `auth-${Date.now()}@example.test`;
    const { id } = await registerUser({ name: "A", email: ` ${email.toUpperCase()} `, password: "correct-horse-battery" });
    users.push(id);
    expect((await authenticate(email, "correct-horse-battery")).id).toBe(id);
    const wrong = await authenticate(email, "nope-nope-nope").catch((e) => e);
    const unknown = await authenticate("nobody@example.test", "whatever-password").catch((e) => e);
    expect(wrong).toBeInstanceOf(AppError);
    expect(unknown).toBeInstanceOf(AppError);
    expect(wrong.message).toBe(unknown.message);
    await expect(registerUser({ name: "A", email, password: "correct-horse-battery" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("upgrades legacy low-cost bcrypt hashes on login", async () => {
    const email = `legacy-${Date.now()}@example.test`;
    const legacy = await bcrypt.hash("old-password-123", 8);
    const u = await db.user.create({ data: { email, name: "L", passwordHash: legacy } });
    users.push(u.id);
    expect(needsRehash(legacy)).toBe(true);
    await authenticate(email, "old-password-123");
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.passwordHash).not.toBe(legacy);
    expect(needsRehash(after.passwordHash)).toBe(false);
    expect((await verifyPassword("old-password-123", after.passwordHash)).valid).toBe(true);
    await burnPasswordCheck("x");
  });
  it("changes the password only with the correct current one", async () => {
    const userId = await makeUser("pw");
    users.push(userId);
    await expect(changePassword(userId, "wrong-password-1", "new-password-123")).rejects.toMatchObject({ code: "VALIDATION" });
    await changePassword(userId, "correct-horse-battery", "new-password-123");
    const email = (await db.user.findUniqueOrThrow({ where: { id: userId } })).email;
    await expect(authenticate(email, "correct-horse-battery")).rejects.toBeInstanceOf(AppError);
    expect((await authenticate(email, "new-password-123")).id).toBe(userId);
  });
});

describe("accounts", () => {
  it("makes the first account default and keeps exactly one default", async () => {
    const { userId, account } = await fresh();
    expect(account.isDefault).toBe(true);
    const second = await createAccount(userId, { name: "Savings", type: "SAVINGS", openingBalance: "500" });
    expect(second.isDefault).toBe(false);
    await setDefaultAccount(userId, second.id);
    const list = await listAccounts(userId);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual([second.id]);
  });
  it("reassigns the default when the default account is archived", async () => {
    const { userId, account } = await fresh();
    const second = await createAccount(userId, { name: "Other", type: "CASH", openingBalance: "0" });
    await archiveAccount(userId, account.id);
    const list = await listAccounts(userId);
    expect(list.map((a) => a.id)).toEqual([second.id]);
    expect(list[0]?.isDefault).toBe(true);
  });
  it("enforces one active default per user at the database level", async () => {
    const { userId, account } = await fresh();
    await expect(db.account.create({ data: { userId, name: "Dup", type: "CASH", isDefault: true } })).rejects.toThrow();
    expect(account.isDefault).toBe(true);
  });
  it("accepts a negative opening balance (credit card)", async () => {
    const { userId } = await fresh();
    const cc = await createAccount(userId, { name: "Card", type: "CREDIT_CARD", openingBalance: "-250.75" });
    expect(cc.balance).toBe(-250.75);
  });
});

describe("transactions and the balance invariant", () => {
  it("keeps balance = opening + Σ signed transactions across create, update, move and delete", async () => {
    const { userId, account } = await fresh("1000.00");
    const savings = await createAccount(userId, { name: "S", type: "SAVINGS", openingBalance: "0" });
    const a = await tx(account.id, { amount: "100.50" });
    const b = await tx(account.id, { type: "INCOME", amount: "300.00", category: "salary" });
    expect(await balanceOf(account.id)).toBe(1199.5);
    await updateTransaction(userId, a.id, { amount: "40.25" });
    expect(await balanceOf(account.id)).toBe(1259.75);
    await updateTransaction(userId, a.id, { accountId: savings.id });
    expect(await balanceOf(account.id)).toBe(1300);
    expect(await balanceOf(savings.id)).toBe(-40.25);
    await updateTransaction(userId, b.id, { type: "EXPENSE" });
    expect(await balanceOf(account.id)).toBe(700);
    await deleteTransaction(userId, a.id);
    expect(await balanceOf(savings.id)).toBe(0);
    for (const id of [account.id, savings.id]) expect((await reconcileAccount(userId, id)).drift).toBe(0);
  });
  it("never loses an update under concurrent writes", async () => {
    const { userId, account } = await fresh("0.00");
    await Promise.all(Array.from({ length: 25 }, () => tx(account.id, { type: "INCOME", amount: "10.10", category: "salary" })));
    expect(await balanceOf(account.id)).toBe(252.5);
    expect((await reconcileAccount(userId, account.id)).drift).toBe(0);
  });
  it("detects and repairs drift", async () => {
    const { userId, account } = await fresh("100.00");
    await tx(account.id, { amount: "25.00" });
    await db.account.update({ where: { id: account.id }, data: { balance: 999 } });
    expect((await reconcileAccount(userId, account.id)).drift).toBe(999 - 75);
    expect((await reconcileAccount(userId, account.id, true)).fixed).toBe(true);
    expect(await balanceOf(account.id)).toBe(75);
  });
  it("rejects bad amounts, dates and mismatched categories", async () => {
    const { account } = await fresh();
    await expect(tx(account.id, { amount: "0" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(tx(account.id, { amount: "1.999" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(tx(account.id, { date: "2026-02-31" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(tx(account.id, { category: "salary" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("categorises locally when no category is given and learns from the user's choices", async () => {
    const { userId, account } = await fresh();
    const auto = await createTransaction(userId, { accountId: account.id, type: "EXPENSE", amount: "5", date: "2026-10-10", description: "Netflix subscription" });
    expect(auto.category).toBe("entertainment");
    const odd = await createTransaction(userId, { accountId: account.id, type: "EXPENSE", amount: "9", date: "2026-10-11", description: "Zorblax Industries" });
    expect(odd.category).toBe("other-expense");
    await updateTransaction(userId, odd.id, { category: "shopping" });
    const again = await createTransaction(userId, { accountId: account.id, type: "EXPENSE", amount: "9", date: "2026-10-12", description: "Zorblax Industries" });
    expect(again.category).toBe("shopping");
  });
  it("never learns the catch-all 'Other' category as a merchant rule", async () => {
    const { userId, account } = await fresh();
    await createTransaction(userId, { accountId: account.id, type: "EXPENSE", amount: "9", date: "2026-10-10", description: "Quuxcorp Ltd" });
    await createTransaction(userId, { accountId: account.id, type: "EXPENSE", amount: "9", date: "2026-10-11", description: "Quuxcorp Ltd", category: "other-expense" });
    expect(await db.merchantRule.count({ where: { userId } })).toBe(0);
  });
  it("filters, searches and paginates", async () => {
    const { userId, account } = await fresh();
    for (let i = 1; i <= 7; i++) await tx(account.id, { amount: `${i}.00`, date: `2026-10-0${i}`, description: i % 2 ? "coffee beans" : "tea", category: i % 2 ? "food" : "groceries" });
    const page1 = await listTransactions(userId, {}, 1, 3);
    expect(page1).toMatchObject({ total: 7, pageCount: 3, expense: 28 });
    expect(page1.items.map((t) => t.date)).toEqual(["2026-10-07", "2026-10-06", "2026-10-05"]);
    expect((await listTransactions(userId, { q: "COFFEE" })).total).toBe(4);
    expect((await listTransactions(userId, { category: "groceries" })).total).toBe(3);
    expect((await listTransactions(userId, { from: "2026-10-03", to: "2026-10-05" })).total).toBe(3);
    expect((await listTransactions(userId, { min: 5 })).total).toBe(3);
  });
  it("bulk-deletes and reverses balances", async () => {
    const { userId, account } = await fresh("100.00");
    const rows = await Promise.all([tx(account.id, { amount: "10" }), tx(account.id, { amount: "20" }), tx(account.id, { amount: "30" })]);
    expect(await bulkDeleteTransactions(userId, rows.slice(0, 2).map((r) => r.id))).toBe(2);
    expect(await balanceOf(account.id)).toBe(70);
  });
  it("recategorizes only matching rows", async () => {
    const { userId, account } = await fresh();
    const e = await tx(account.id);
    const n = await recategorize(userId, [{ id: e.id, category: "shopping", ai: true }, { id: e.id, category: "salary" }]);
    expect(n).toBe(1);
    expect((await listTransactions(userId, {})).items[0]).toMatchObject({ category: "shopping", aiCategorized: true });
  });
});

describe("transfers", () => {
  it("moves money between accounts, excludes it from income/expense, and deletes both legs together", async () => {
    const { userId, account } = await fresh("500.00");
    const other = await createAccount(userId, { name: "Other", type: "SAVINGS", openingBalance: "50" });
    await createTransfer(userId, { fromAccountId: account.id, toAccountId: other.id, amount: "120.00", date: "2026-10-10" });
    expect(await balanceOf(account.id)).toBe(380);
    expect(await balanceOf(other.id)).toBe(170);
    const s = await monthSummary(userId, "2026-10");
    expect(s).toMatchObject({ income: 0, expense: 0 });
    const legs = (await listTransactions(userId, { type: "TRANSFER" })).items;
    expect(legs).toHaveLength(2);
    await deleteTransaction(userId, legs[0]!.id);
    expect(await balanceOf(account.id)).toBe(500);
    expect(await balanceOf(other.id)).toBe(50);
    expect((await listTransactions(userId, {})).total).toBe(0);
  });
  it("rejects same-account transfers and refuses to edit amounts on a leg", async () => {
    const { userId, account } = await fresh();
    await expect(createTransfer(userId, { fromAccountId: account.id, toAccountId: account.id, amount: "1", date: "2026-10-10" })).rejects.toMatchObject({ code: "VALIDATION" });
    const other = await createAccount(userId, { name: "O", type: "CASH", openingBalance: "0" });
    await createTransfer(userId, { fromAccountId: account.id, toAccountId: other.id, amount: "5", date: "2026-10-10" });
    const leg = (await listTransactions(userId, { type: "TRANSFER" })).items[0]!;
    await expect(updateTransaction(userId, leg.id, { amount: "9" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("tenant isolation", () => {
  it("never lets one user touch another user's data", async () => {
    const a = await fresh("100.00");
    const b = await fresh("100.00");
    const t = await createTransaction(a.userId, { accountId: a.account.id, type: "EXPENSE", amount: "10", date: "2026-10-10", category: "food" });
    await expect(updateTransaction(b.userId, t.id, { amount: "1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteTransaction(b.userId, t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createTransaction(b.userId, { accountId: a.account.id, type: "EXPENSE", amount: "1", date: "2026-10-10", category: "food" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createTransfer(b.userId, { fromAccountId: b.account.id, toAccountId: a.account.id, amount: "1", date: "2026-10-10" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setDefaultAccount(b.userId, a.account.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await bulkDeleteTransactions(b.userId, [t.id])).toBe(0);
    expect((await listTransactions(b.userId, {})).total).toBe(0);
    expect(await balanceOf(a.account.id)).toBe(90);
  });
});

describe("CSV import", () => {
  it("is idempotent, keeps genuine same-day duplicates, and moves the balance only for new rows", async () => {
    const { userId, account } = await fresh("0.00");
    const rows = [
      { date: "2026-10-01", type: "EXPENSE" as const, amount: "4.50", description: "Coffee" },
      { date: "2026-10-01", type: "EXPENSE" as const, amount: "4.50", description: "Coffee" },
      { date: "2026-10-02", type: "INCOME" as const, amount: "100.00", description: "Payroll ACME" },
    ];
    expect(await importTransactions(userId, account.id, rows)).toEqual({ inserted: 3, skipped: 0 });
    expect(await balanceOf(account.id)).toBe(91);
    expect(await importTransactions(userId, account.id, rows)).toEqual({ inserted: 0, skipped: 3 });
    expect(await balanceOf(account.id)).toBe(91);
    expect(await importTransactions(userId, account.id, [...rows, { date: "2026-10-03", type: "EXPENSE", amount: "1.00", description: "New" }])).toEqual({ inserted: 1, skipped: 3 });
    expect(await balanceOf(account.id)).toBe(90);
    const cats = (await listTransactions(userId, {}, 1, 50)).items.map((t) => t.category);
    expect(cats).toContain("food");
    expect(cats).toContain("salary");
  });
});

describe("recurring rules", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it("backfills due occurrences once and is idempotent, even when run concurrently", async () => {
    const { userId, account } = await fresh("1000.00");
    const rule = await createRule(userId, { accountId: account.id, type: "EXPENSE", amount: "50.00", category: "entertainment", description: "Gym", interval: "MONTHLY", startDate: "2026-07-19" }, now);
    expect(rule.nextRunOn).toBe("2026-11-19");
    expect(await balanceOf(account.id)).toBe(800);
    const today = parseDateOnly("2026-10-19")!;
    const results = await Promise.all([processRule(rule.id, today), processRule(rule.id, today), processRule(rule.id, today)]);
    expect(results.reduce((a, r) => a + r.created, 0)).toBe(0);
    expect(await db.transaction.count({ where: { recurringRuleId: rule.id } })).toBe(4);
    const later = parseDateOnly("2026-11-19")!;
    const again = await Promise.all([processRule(rule.id, later), processRule(rule.id, later)]);
    expect(again.reduce((a, r) => a + r.created, 0)).toBe(1);
    expect(await balanceOf(account.id)).toBe(750);
    expect((await reconcileAccount(userId, account.id)).drift).toBe(0);
  });
  it("stops after the end date and caps catch-up work", async () => {
    const { userId, account } = await fresh("0.00");
    const ended = await createRule(userId, { accountId: account.id, type: "INCOME", amount: "10", category: "salary", interval: "MONTHLY", startDate: "2026-08-01", endDate: "2026-09-15" }, now);
    expect(ended.isActive).toBe(false);
    expect(await balanceOf(account.id)).toBe(20);
    const daily = await createRule(userId, { accountId: account.id, type: "EXPENSE", amount: "1", category: "food", interval: "DAILY", startDate: "2026-01-01" }, now);
    expect(await db.transaction.count({ where: { recurringRuleId: daily.id } })).toBe(60);
    await processRule(daily.id, parseDateOnly("2026-10-19")!);
    expect(await db.transaction.count({ where: { recurringRuleId: daily.id } })).toBe(120);
  });
  it("lists upcoming occurrences", async () => {
    const { userId, account } = await fresh();
    await createRule(userId, { accountId: account.id, type: "EXPENSE", amount: "5", category: "food", description: "Weekly", interval: "WEEKLY", startDate: "2026-10-19" }, now);
    const up = await upcomingRecurring(userId, 15, now);
    expect(up.map((u) => u.date)).toEqual(["2026-10-26", "2026-11-02"]);
  });
});

describe("budgets", () => {
  it("tracks spend per category and the overall budget, and alerts once per level per month", async () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const { userId, account } = await fresh("5000.00");
    await setBudget(userId, "food", "100");
    await setBudget(userId, "all", "1000");
    await tx(account.id, { amount: "85.00", category: "food" });
    await tx(account.id, { amount: "15.00", category: "travel" });
    const statuses = await budgetStatuses(userId, "2026-10");
    expect(statuses.map((s) => [s.category, s.spent, s.level])).toEqual([["all", 100, 0], ["food", 85, 80]]);

    const mine = (alerts: Awaited<ReturnType<typeof collectBudgetAlerts>>) => alerts.filter((a) => a.userId === userId);
    const first = mine(await collectBudgetAlerts(now));
    expect(first.map((a) => [a.category, a.level])).toEqual([["food", 80]]);
    await markBudgetAlerted(first[0]!.budgetId, first[0]!.period, first[0]!.level);
    expect(mine(await collectBudgetAlerts(now))).toHaveLength(0);

    await tx(account.id, { amount: "20.00", category: "food" });
    const second = mine(await collectBudgetAlerts(now));
    expect(second.map((a) => [a.category, a.level])).toEqual([["food", 100]]);
    await markBudgetAlerted(second[0]!.budgetId, second[0]!.period, second[0]!.level);
    expect(mine(await collectBudgetAlerts(new Date("2026-11-02T00:00:00Z"))).length).toBe(0);
  });
  it("rejects invalid budgets", async () => {
    const { userId } = await fresh();
    await expect(setBudget(userId, "salary", "100")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setBudget(userId, "food", "-5")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("goals", () => {
  it("tracks deposits, completion and withdrawals, and refuses to overdraw", async () => {
    const { userId } = await fresh();
    const g = await createGoal(userId, { name: "Laptop", targetAmount: "1000" });
    expect((await contributeToGoal(userId, g.id, { kind: "deposit", amount: "400", date: "2026-10-10" })).pct).toBe(40);
    await expect(contributeToGoal(userId, g.id, { kind: "withdraw", amount: "500", date: "2026-10-10" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await contributeToGoal(userId, g.id, { kind: "deposit", amount: "600", date: "2026-10-11" })).completed).toBe(true);
    expect((await contributeToGoal(userId, g.id, { kind: "withdraw", amount: "100", date: "2026-10-12" })).completed).toBe(false);
  });
});

describe("analytics", () => {
  it("aggregates cash flow, category breakdown and flags a spending spike", async () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const { userId, account } = await fresh("0.00");
    const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
    for (const m of months) await tx(account.id, { amount: "200.00", category: "food", date: `${m}-10` });
    await tx(account.id, { type: "INCOME", amount: "3000.00", category: "salary", date: "2026-09-01" });
    await tx(account.id, { amount: "500.00", category: "food", date: "2026-10-05" });
    const flow = await cashFlow(userId, "2026-10", 3);
    expect(flow).toEqual([{ period: "2026-08", income: 0, expense: 200 }, { period: "2026-09", income: 3000, expense: 200 }, { period: "2026-10", income: 0, expense: 500 }]);
    const cats = await categoryBreakdown(userId, { from: parseDateOnly("2026-10-01")!, toExclusive: parseDateOnly("2026-11-01")! });
    expect(cats).toMatchObject([{ category: "food", amount: 500, pct: 100 }]);
    const report = await detectAnomalies(userId, now);
    expect(report.spikes.map((s) => s.category)).toEqual(["food"]);
    expect(report.spikes[0]).toMatchObject({ spent: 500, baseline: 200 });
  });
  it("compares month-to-date with the same day of earlier months, so a fixed bill is not an anomaly", async () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const { userId, account } = await fresh("0.00");
    for (const m of ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]) await tx(account.id, { amount: "1450.00", category: "housing", date: `${m}-02` });
    // Earlier months also spent heavily on groceries AFTER day 20; that must not count toward the day-20 baseline.
    for (const m of ["2026-04", "2026-05", "2026-06", "2026-07"]) await tx(account.id, { amount: "900.00", category: "groceries", date: `${m}-28` });
    await tx(account.id, { amount: "120.00", category: "groceries", date: "2026-10-10" });
    expect((await detectAnomalies(userId, now)).spikes).toEqual([]);
  });
});

describe("account ledger", () => {
  it("shows a running balance that ends at the opening balance and starts at the current one", async () => {
    const { userId, account } = await fresh("100.00");
    await tx(account.id, { amount: "30.00", date: "2026-10-01" });
    await tx(account.id, { type: "INCOME", amount: "200.00", category: "salary", date: "2026-10-02" });
    await tx(account.id, { amount: "20.00", date: "2026-10-03" });
    const ledger = await accountLedger(userId, account.id);
    expect(ledger.map((r) => [r.date, r.signed, r.balance])).toEqual([["2026-10-03", -20, 250], ["2026-10-02", 200, 270], ["2026-10-01", -30, 70]]);
    expect(ledger.at(-1)!.balance - ledger.at(-1)!.signed).toBe(100);
  });
  it("refuses another user's account", async () => {
    const a = await fresh();
    const b = await fresh();
    await expect(accountLedger(b.userId, a.account.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("rate limiter", () => {
  it("blocks past the limit and recovers after the window", async () => {
    const key = `test:${Date.now()}`;
    const t0 = new Date("2026-10-20T10:00:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, { limit: 3, windowSec: 60 }, t0));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3]?.retryAfterSec).toBeGreaterThan(0);
    const later = await rateLimit(key, { limit: 3, windowSec: 60 }, new Date(t0.getTime() + 61_000));
    expect(later.ok).toBe(true);
    await db.rateLimit.delete({ where: { key } });
  });
  it("counts correctly under concurrency", async () => {
    const key = `test-conc:${Date.now()}`;
    const t0 = new Date();
    const rs = await Promise.all(Array.from({ length: 10 }, () => rateLimit(key, { limit: 4, windowSec: 60 }, t0)));
    expect(rs.filter((r) => r.ok)).toHaveLength(4);
    await db.rateLimit.delete({ where: { key } });
  });
});
