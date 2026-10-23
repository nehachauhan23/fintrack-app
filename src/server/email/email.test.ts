import { describe, expect, it } from "vitest";
import { budgetAlertEmail, escapeHtml, monthlyReportEmail } from "./templates";
import { csvCell, csvRow } from "@/domain/csv";
import { filtersFromSearchParams } from "@/lib/filters";

describe("email templates", () => {
  it("escapes everything that comes from user data", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
    const mail = budgetAlertEmail({ name: "<b>Eve</b>", categoryName: "Food & dining", limit: 100, spent: 85, level: 80, currency: "USD", period: "2026-10" }, "https://app.example");
    expect(mail.html).not.toContain("<b>Eve</b>");
    expect(mail.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(mail.subject).toContain("80%");
    expect(mail.text).toContain("$85.00 spent of $100.00");
  });
  it("renders a monthly report without trusting AI text", () => {
    const mail = monthlyReportEmail({ name: "Sam Lee", period: "2026-09", currency: "USD", income: 4000, expense: 2500, net: 1500, headline: "Great <script>alert(1)</script> month", points: ["<i>x</i>"], categories: [{ name: "Housing", amount: 1200 }] }, "https://app.example");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<i>x</i>");
    expect(mail.html).toContain("Housing");
    expect(mail.subject).toBe("Your September 2026 summary");
  });
});

describe("CSV export safety", () => {
  it("neutralises spreadsheet formulas in text but keeps numbers numeric", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell(-45.5)).toBe("-45.5");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(null)).toBe("");
    expect(csvRow(["a", 1, null])).toBe("a,1,\r\n");
  });
});

describe("filtersFromSearchParams", () => {
  it("keeps valid filters and drops anything malformed", () => {
    const f = filtersFromSearchParams({ q: "coffee", type: "EXPENSE", from: "2026-10-01", to: "not-a-date", accountId: "nope", min: "5", max: "-3", category: ["food", "x"], evil: "1" });
    expect(f).toEqual({ q: "coffee", type: "EXPENSE", from: "2026-10-01", min: 5, category: "food" });
  });
});
