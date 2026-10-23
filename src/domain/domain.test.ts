import { describe, expect, it } from "vitest";
import { parseMoneyInput, directionOf, round2 } from "./money";
import { addMonths, daysInMonth, lastPeriods, monthBounds, parseDateOnly, periodKeyOf } from "./periods";
import { nextAfter, occurrenceAt, occurrencesBetween } from "./recurrence";
import { budgetProgress, dailyAllowance, projectMonthEnd, suggestLimit } from "./budget";
import { normalizeMerchant, guessCategory } from "./merchant";
import { balanceSeries, runningBalances } from "./balance";
import { detectCategorySpikes, detectDuplicates, detectOutliers, detectSubscriptions, type TxnLite } from "./anomaly";
import { detectColumns, importHash, mapRows, parseAmountCell, parseDateCell } from "./csv";
import { isCategoryFor } from "./categories";

const d = (s: string) => parseDateOnly(s) as Date;

describe("money", () => {
  it("canonicalises valid input", () => {
    expect(parseMoneyInput("1,234.5")).toBe("1234.50");
    expect(parseMoneyInput(" 007 ")).toBe("7.00");
    expect(parseMoneyInput("0.01")).toBe("0.01");
  });
  it("rejects zero, negatives, too many decimals and junk", () => {
    for (const bad of ["0", "0.00", "-5", "1.234", "abc", "", "1e5", "9999999999999"]) {
      expect(parseMoneyInput(bad)).toBeNull();
    }
  });
  it("derives direction from the transaction type", () => {
    expect(directionOf("INCOME")).toBe(1);
    expect(directionOf("TRANSFER_IN")).toBe(1);
    expect(directionOf("EXPENSE")).toBe(-1);
    expect(directionOf("TRANSFER_OUT")).toBe(-1);
  });
  it("rounds to two decimals without float artefacts", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("periods", () => {
  it("handles month math across year boundaries", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(lastPeriods(3, "2026-01")).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("knows month lengths including leap years", () => {
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(monthBounds("2026-10").endExclusive.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
  it("parses strict dates only", () => {
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("2026-2-3")).toBeNull();
    expect(periodKeyOf(d("2026-10-19"))).toBe("2026-10");
  });
});

describe("recurrence", () => {
  it("clamps month-end without drifting", () => {
    const anchor = d("2026-01-31");
    expect(occurrenceAt(anchor, "MONTHLY", 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(occurrenceAt(anchor, "MONTHLY", 2).toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(occurrenceAt(anchor, "MONTHLY", 13).toISOString().slice(0, 10)).toBe("2027-02-28");
  });
  it("handles leap-day yearly rules", () => {
    expect(occurrenceAt(d("2024-02-29"), "YEARLY", 1).toISOString().slice(0, 10)).toBe("2025-02-28");
    expect(occurrenceAt(d("2024-02-29"), "YEARLY", 4).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
  it("finds the next occurrence strictly after a date", () => {
    expect(nextAfter(d("2026-01-15"), "MONTHLY", d("2026-03-15")).toISOString().slice(0, 10)).toBe("2026-04-15");
    expect(nextAfter(d("2026-01-15"), "WEEKLY", d("2026-01-15")).toISOString().slice(0, 10)).toBe("2026-01-22");
    expect(nextAfter(d("2026-01-15"), "DAILY", d("2025-12-01")).toISOString().slice(0, 10)).toBe("2026-01-15");
  });
  it("lists catch-up occurrences, respects endDate and the safety limit", () => {
    const got = occurrencesBetween(d("2026-01-31"), "MONTHLY", d("2026-01-31"), d("2026-06-30"));
    expect(got.map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30"]);
    expect(occurrencesBetween(d("2026-01-01"), "DAILY", d("2026-01-01"), d("2026-12-31"), { limit: 10 })).toHaveLength(10);
    expect(occurrencesBetween(d("2026-01-01"), "MONTHLY", d("2026-01-01"), d("2026-12-31"), { endDate: d("2026-03-01") })).toHaveLength(3);
  });
});

describe("budget", () => {
  it("classifies progress levels", () => {
    expect(budgetProgress(50, 100).level).toBe(0);
    expect(budgetProgress(80, 100).level).toBe(80);
    expect(budgetProgress(120, 100)).toMatchObject({ level: 100, remaining: -20 });
    expect(budgetProgress(10, 0).pct).toBe(0);
  });
  it("projects month end but not from the first days", () => {
    expect(projectMonthEnd(300, 10, 30)).toBe(900);
    expect(projectMonthEnd(500, 2, 30)).toBe(500);
  });
  it("computes a non-negative daily allowance", () => {
    expect(dailyAllowance(3000, 1000, 11, 30)).toBeCloseTo(100);
    expect(dailyAllowance(1000, 2000, 11, 30)).toBe(0);
  });
  it("suggests round limits with a buffer", () => {
    expect(suggestLimit([200, 220, 180])).toBe(230);
    expect(suggestLimit([0, 0])).toBeNull();
  });
});

describe("merchant", () => {
  it("normalises noisy statement lines", () => {
    expect(normalizeMerchant("POS 44210 STARBUCKS #1032 NYC")).toBe("starbucks nyc");
    expect(normalizeMerchant("UPI/Swiggy/123456789")).toBe("swiggy");
  });
  it("guesses categories by type", () => {
    expect(guessCategory("Netflix.com", "EXPENSE")).toBe("entertainment");
    expect(guessCategory("ACME PAYROLL", "INCOME")).toBe("salary");
    expect(guessCategory("Netflix.com", "INCOME")).toBeNull();
    expect(guessCategory("zzz unknown", "EXPENSE")).toBeNull();
  });
  it("only accepts categories of the right kind", () => {
    expect(isCategoryFor("food", "EXPENSE")).toBe(true);
    expect(isCategoryFor("food", "INCOME")).toBe(false);
    expect(isCategoryFor("transfer", "TRANSFER_OUT")).toBe(true);
  });
});

describe("balanceSeries", () => {
  it("reconstructs end-of-day balances backwards from the current balance", () => {
    const s = balanceSeries(1000, [
      { date: "2026-10-03", delta: -100 },
      { date: "2026-10-02", delta: 300 },
      { date: "2026-10-03", delta: -50 },
    ], "2026-10-01", "2026-10-03");
    expect(s).toEqual([
      { date: "2026-10-01", balance: 850 },
      { date: "2026-10-02", balance: 1150 },
      { date: "2026-10-03", balance: 1000 },
    ]);
  });
  it("accounts for future-dated entries beyond the window", () => {
    const s = balanceSeries(900, [{ date: "2026-10-10", delta: -100 }], "2026-10-01", "2026-10-02");
    expect(s.at(-1)?.balance).toBe(1000);
  });
  it("returns nothing for an inverted range", () => {
    expect(balanceSeries(0, [], "2026-10-05", "2026-10-01")).toEqual([]);
  });
});

const t = (id: string, category: string, amount: number, date: string, merchantKey = "", accountId = "a"): TxnLite => ({ id, category, amount, date: d(date), merchantKey, accountId });

describe("anomaly detection", () => {
  it("flags a category already far above where earlier months were by the same day", () => {
    const spikes = detectCategorySpikes({ food: [200, 210, 190, 205], travel: [100, 100, 100] }, { food: 600, travel: 40 });
    expect(spikes.map((s) => s.category)).toEqual(["food"]);
    expect(spikes[0]?.ratio).toBeGreaterThan(2.5);
  });
  it("does not mistake fixed bills for overspending", () => {
    expect(detectCategorySpikes({ housing: [1450, 1450, 1450, 1450] }, { housing: 1450 })).toEqual([]);
  });
  it("stays quiet with thin history or a trivial excess", () => {
    expect(detectCategorySpikes({ food: [200, 210] }, { food: 900 })).toEqual([]);
    expect(detectCategorySpikes({ healthcare: [0, 0, 60, 0] }, { healthcare: 127 }, { minExcess: 150 })).toEqual([]);
    expect(detectCategorySpikes({ healthcare: [0, 0, 60, 0] }, { healthcare: 127 }, { minExcess: 20 }).map((s) => s.category)).toEqual(["healthcare"]);
  });
  it("finds outlier transactions using robust statistics", () => {
    const rows = [10, 12, 11, 9, 13, 10, 11].map((a, i) => t(`n${i}`, "food", a, "2026-10-01"));
    rows.push(t("big", "food", 150, "2026-10-02"));
    expect(detectOutliers(rows).map((o) => o.id)).toEqual(["big"]);
  });
  it("finds double charges inside the window only", () => {
    const rows = [t("1", "food", 25, "2026-10-01", "cafe"), t("2", "food", 25, "2026-10-02", "cafe"), t("3", "food", 25, "2026-10-20", "cafe")];
    expect(detectDuplicates(rows)).toEqual([{ first: "1", second: "2", amount: 25, merchantKey: "cafe" }]);
  });
  it("detects monthly subscriptions and ignores irregular merchants", () => {
    const rows = [
      t("1", "entertainment", 9.99, "2026-07-05", "netflix"),
      t("2", "entertainment", 9.99, "2026-08-05", "netflix"),
      t("3", "entertainment", 9.99, "2026-09-05", "netflix"),
      t("4", "food", 12, "2026-07-01", "cafe"),
      t("5", "food", 30, "2026-07-20", "cafe"),
      t("6", "food", 8, "2026-09-02", "cafe"),
    ];
    const subs = detectSubscriptions(rows);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ merchantKey: "netflix", interval: "MONTHLY", amount: 9.99 });
    expect(subs[0]?.nextExpected.toISOString().slice(0, 10)).toBe("2026-10-05");
  });
});

describe("csv parsing", () => {
  it("parses amounts in common bank formats", () => {
    expect(parseAmountCell("1,234.50")).toBe(1234.5);
    expect(parseAmountCell("(45.00)")).toBe(-45);
    expect(parseAmountCell("-$12.30")).toBe(-12.3);
    expect(parseAmountCell("₹1.234,50")).toBe(1234.5);
    expect(parseAmountCell("12,50")).toBe(12.5);
    expect(parseAmountCell("45.00 DR")).toBe(-45);
    expect(parseAmountCell("abc")).toBeNull();
  });
  it("parses dates with an explicit day/month order", () => {
    expect(parseDateCell("03/04/2026", "dmy")?.toISOString().slice(0, 10)).toBe("2026-04-03");
    expect(parseDateCell("03/04/2026", "mdy")?.toISOString().slice(0, 10)).toBe("2026-03-04");
    expect(parseDateCell("2026-10-19T10:00:00Z", "dmy")?.toISOString().slice(0, 10)).toBe("2026-10-19");
    expect(parseDateCell("5 Oct 2026", "dmy")?.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(parseDateCell("Oct 5, 2026", "dmy")?.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(parseDateCell("31/02/2026", "dmy")).toBeNull();
  });
  it("detects columns and maps rows, reporting bad lines", () => {
    const cols = detectColumns(["Date", "Narration", "Withdrawal Amt", "Deposit Amt"]);
    expect(cols).toMatchObject({ date: "Date", description: "Narration", debit: "Withdrawal Amt", credit: "Deposit Amt" });
    const { rows, errors } = mapRows(
      [
        { Date: "01/10/2026", Narration: "Coffee", "Withdrawal Amt": "4.50", "Deposit Amt": "" },
        { Date: "02/10/2026", Narration: "Pay", "Withdrawal Amt": "", "Deposit Amt": "1,000.00" },
        { Date: "nope", Narration: "x", "Withdrawal Amt": "1", "Deposit Amt": "" },
        { Date: "03/10/2026", Narration: "empty", "Withdrawal Amt": "", "Deposit Amt": "" },
      ],
      { date: "Date", description: "Narration", debit: "Withdrawal Amt", credit: "Deposit Amt" },
      { dateOrder: "dmy" },
    );
    expect(rows.map((r) => [r.type, r.amount, r.date])).toEqual([["EXPENSE", "4.50", "2026-10-01"], ["INCOME", "1000.00", "2026-10-02"]]);
    expect(errors.map((e) => e.line)).toEqual([4, 5]);
  });
  it("supports inverted sign for credit-card exports", () => {
    const { rows } = mapRows([{ D: "2026-10-01", N: "Shop", A: "20.00" }], { date: "D", description: "N", amount: "A" }, { dateOrder: "dmy", invertSign: true });
    expect(rows[0]?.type).toBe("EXPENSE");
  });
  it("makes dedupe hashes stable, but distinct per occurrence and account", () => {
    const row = { date: "2026-10-01", amount: "4.50", type: "EXPENSE" as const, description: "Coffee" };
    expect(importHash("a", row, 0)).toBe(importHash("a", { ...row, description: " coffee " }, 0));
    expect(importHash("a", row, 0)).not.toBe(importHash("a", row, 1));
    expect(importHash("a", row, 0)).not.toBe(importHash("b", row, 0));
  });
});

describe("runningBalances", () => {
  it("starts at the current balance and undoes each newer entry going back", () => {
    // current 1000; newest entry was -100 (so before it: 1100), then +300 (before it: 800), then -50
    expect(runningBalances(1000, [-100, 300, -50])).toEqual([1000, 1100, 800]);
    expect(runningBalances(0, [])).toEqual([]);
  });
  it("avoids float drift", () => {
    expect(runningBalances(0.3, [0.1, 0.2])).toEqual([0.3, 0.2]);
  });
});
