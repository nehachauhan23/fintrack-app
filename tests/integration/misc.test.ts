import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { previewCsv } from "@/server/services/csv-import";
import { importTransactions } from "@/server/services/transactions";
import { runMaintenance } from "@/server/services/maintenance";
import { learnRule } from "@/server/services/merchant-rules";
import { cleanup, makeUserWithAccount } from "./helpers";

const users: string[] = [];
afterAll(async () => {
  await cleanup(...users);
  await db.$disconnect();
});
const fresh = async () => {
  const r = await makeUserWithAccount("0.00");
  users.push(r.userId);
  return r;
};

describe("CSV preview", () => {
  const csv = "\uFEFFDate,Narration,Withdrawal Amt,Deposit Amt\n01/10/2026,Netflix.com,15.99,\n02/10/2026,ACME PAYROLL,,2500.00\n03/10/2026,Local Shop 1234,12.00,\nnot-a-date,Broken,5,\n04/10/2026,Learned Merchant,8.00,\n";
  it("detects columns, categorises with rules and keywords, and reports bad rows without failing", async () => {
    const { userId } = await fresh();
    await learnRule(db, userId, "Learned Merchant", "gifts", "USER");
    const p = await previewCsv(userId, csv, { dateOrder: "dmy", invertSign: false });
    expect(p.needsMapping).toBe(false);
    expect(p.mapping).toMatchObject({ date: "Date", description: "Narration", debit: "Withdrawal Amt", credit: "Deposit Amt" });
    expect(p.rows.map((r) => [r.description, r.type, r.amount, r.category, r.via])).toEqual([
      ["Netflix.com", "EXPENSE", "15.99", "entertainment", "keyword"],
      ["ACME PAYROLL", "INCOME", "2500.00", "salary", "keyword"],
      ["Local Shop 1234", "EXPENSE", "12.00", "other-expense", "default"],
      ["Learned Merchant", "EXPENSE", "8.00", "gifts", "rule"],
    ]);
    expect(p.errorCount).toBe(1);
    expect(p.errors[0]).toMatchObject({ line: 5 });
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
  });
  it("asks for a mapping when columns can't be identified, and honours a supplied one", async () => {
    const { userId } = await fresh();
    const odd = "when,thing,delta\n2026-10-01,Coffee,-4.50\n2026-10-02,Pay,100\n";
    const first = await previewCsv(userId, odd, { dateOrder: "dmy", invertSign: false });
    expect(first.needsMapping).toBe(true);
    expect(first.headers).toEqual(["when", "thing", "delta"]);
    const mapped = await previewCsv(userId, odd, { dateOrder: "dmy", invertSign: false, mapping: { date: "when", description: "thing", amount: "delta" } });
    expect(mapped.rows.map((r) => [r.type, r.amount])).toEqual([["EXPENSE", "4.50"], ["INCOME", "100.00"]]);
  });
  it("rejects files that aren't CSV-shaped", async () => {
    const { userId } = await fresh();
    await expect(previewCsv(userId, "just one line", { dateOrder: "dmy", invertSign: false })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("import validation", () => {
  it("refuses rows with non-canonical amounts or impossible dates instead of crashing the database layer", async () => {
    const { userId, account } = await fresh();
    for (const bad of [{ amount: "abc", date: "2026-10-01" }, { amount: "-5.00", date: "2026-10-01" }, { amount: "5.00", date: "2026-02-30" }, { amount: "5", date: "2026-10-01" }]) {
      await expect(importTransactions(userId, account.id, [{ ...bad, type: "EXPENSE", description: "x" }])).rejects.toMatchObject({ code: "VALIDATION" });
    }
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
  });
});

describe("maintenance", () => {
  it("purges expired sessions, stale rate limits and old operational rows, and nothing else", async () => {
    const { userId } = await fresh();
    const now = new Date("2026-10-20T00:00:00Z");
    const day = 86_400_000;
    await db.session.createMany({ data: [
      { userId, tokenHash: `old-${userId}`, expiresAt: new Date(now.getTime() - day) },
      { userId, tokenHash: `new-${userId}`, expiresAt: new Date(now.getTime() + day) },
    ] });
    await db.rateLimit.createMany({ data: [{ key: `old-${userId}`, count: 1, resetAt: new Date(now.getTime() - 1000) }, { key: `new-${userId}`, count: 1, resetAt: new Date(now.getTime() + 60_000) }] });
    await db.aiUsage.createMany({ data: [{ userId, day: "2026-01-01", feature: "t", status: "ok", createdAt: new Date(now.getTime() - 100 * day) }, { userId, day: "2026-10-19", feature: "t", status: "ok", createdAt: new Date(now.getTime() - day) }] });
    await db.auditLog.createMany({ data: [{ userId, action: "old", createdAt: new Date(now.getTime() - 400 * day) }, { userId, action: "new", createdAt: new Date(now.getTime() - day) }] });

    const r = await runMaintenance(now);
    expect(r.sessions).toBeGreaterThanOrEqual(1);
    expect(await db.session.count({ where: { userId } })).toBe(1);
    expect(await db.rateLimit.count({ where: { key: { endsWith: userId } } })).toBe(1);
    expect(await db.aiUsage.count({ where: { userId } })).toBe(1);
    expect(await db.auditLog.count({ where: { userId } })).toBe(1);
    await db.rateLimit.deleteMany({ where: { key: { endsWith: userId } } });
  });
});
