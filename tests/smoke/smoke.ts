/**
 * HTTP smoke test against a running server (`npm run build && npm start`, then `npm run test:smoke`).
 * Needs the demo seed. Creates a short-lived session directly in the database, so no password is involved.
 */
import assert from "node:assert/strict";
import { db } from "@/server/db";
import { hashSessionToken, newSessionToken } from "@/server/auth/tokens";
import { registerUser } from "@/server/services/auth";
import { createAccount } from "@/server/services/accounts";
import { createTransaction, deleteTransaction } from "@/server/services/transactions";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
let passed = 0;
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
    process.exitCode = 1;
  }
};

async function main() {
  const user = await db.user.findUniqueOrThrow({ where: { email: "demo@fintrack.dev" } });
  const token = newSessionToken();
  const session = await db.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3_600_000) } });
  const authed = { cookie: `ft_session=${token}` };
  const get = (path: string, headers: Record<string, string> = authed) => fetch(BASE + path, { redirect: "manual", headers });
  const account = await db.account.findFirstOrThrow({ where: { userId: user.id, name: "Everyday" } });
  const stranger = await registerUser({ name: "Stranger", email: `stranger-${Date.now()}@example.test`, password: "correct-horse-battery" });
  const strangerAccount = await createAccount(stranger.id, { name: "Private", type: "CASH", openingBalance: "1.00" });
  const injected = await createTransaction(user.id, { accountId: account.id, type: "EXPENSE", amount: "1.00", date: new Date().toISOString().slice(0, 10), category: "other-expense", description: "=2+2" });

  try {
    console.log(`Smoke testing ${BASE}`);
    await check("health endpoint reports ok", async () => {
      const r = await get("/api/health", {});
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { status: "ok" });
    });
    await check("landing page is public and honest", async () => {
      const r = await get("/", {});
      const html = await r.text();
      assert.equal(r.status, 200);
      assert.match(html, /one ledger/);
      assert.doesNotMatch(html, /50K\+|\$2B/);
    });
    await check("security headers are present, framework banner is not", async () => {
      const r = await get("/", {});
      assert.match(r.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert.equal(r.headers.get("x-frame-options"), "DENY");
      assert.equal(r.headers.get("x-powered-by"), null);
    });
    await check("anonymous visitors are redirected to sign-in with a return path", async () => {
      const r = await get("/dashboard", {});
      assert.equal(r.status, 307);
      assert.match(r.headers.get("location") ?? "", /\/sign-in\?next=%2Fdashboard/);
    });
    await check("a forged cookie passes the proxy but is rejected by the data layer, without a redirect loop", async () => {
      const r = await get("/dashboard", { cookie: "ft_session=forged" });
      assert.equal(r.status, 307);
      assert.match(r.headers.get("location") ?? "", /\/sign-in/);
      const signIn = await get("/sign-in", { cookie: "ft_session=forged" });
      assert.equal(signIn.status, 200);
    });
    await check("signed-in users skip sign-in, and open-redirect attempts are neutralised", async () => {
      const r = await get("/sign-in?next=//evil.example");
      assert.equal(r.status, 307);
      assert.equal(new URL(r.headers.get("location") ?? "", BASE).pathname, "/dashboard");
      assert.doesNotMatch(r.headers.get("location") ?? "", /evil/);
    });

    const pages: [string, RegExp][] = [
      ["/dashboard", /Net worth/],
      ["/transactions", /Export CSV/],
      ["/transactions?type=EXPENSE&q=coffee&page=2", /Transactions/],
      ["/transactions?accountId=%27%20OR%201%3D1&page=-5&min=abc", /Transactions/],
      ["/accounts", /Everyday/],
      [`/accounts/${account.id}`, /Integrity/],
      ["/budgets", /Suggested from your history/],
      ["/goals", /Emergency fund/],
      ["/recurring", /Rent/],
      ["/reports", /Spending by category/],
      ["/reports?period=2026-01", /Reports/],
      ["/reports?period=garbage", /Reports/],
      ["/assistant", /Assistant/],
      ["/settings", /Where you.re signed in/],
    ];
    for (const [path, marker] of pages) {
      await check(`GET ${path}`, async () => {
        const r = await get(path);
        const html = await r.text();
        assert.equal(r.status, 200, `status ${r.status}`);
        assert.match(html, marker);
        assert.doesNotMatch(html, /Something went wrong on our side/);
      });
    }

    await check("another user's account is a 404, not a leak", async () => {
      const r = await get(`/accounts/${strangerAccount.id}`);
      const html = await r.text();
      assert.equal(r.status, 404);
      assert.doesNotMatch(html, /Private/);
    });
    await check("unknown routes return the styled 404", async () => {
      const r = await get("/definitely-not-here", {});
      assert.equal(r.status, 404);
    });
    await check("CSV export streams, is attributed, and neutralises formulas", async () => {
      const r = await get("/api/export/transactions?q=2%2B2");
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type") ?? "", /text\/csv/);
      assert.match(r.headers.get("content-disposition") ?? "", /attachment/);
      const bytes = new Uint8Array(await r.clone().arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "UTF-8 BOM so Excel detects the encoding");
      const body = await r.text();
      assert.match(body, /^(\uFEFF)?Date,Account,Type,Category,Description,Merchant,Amount,Source\r\n/);
      assert.match(body, /'=2\+2/);
      assert.doesNotMatch(body, /,=2\+2,/);
    });
    await check("full export includes data but never credentials", async () => {
      const r = await get("/api/export/data");
      const text = await r.text();
      assert.equal(r.status, 200);
      assert.doesNotMatch(text, /passwordHash|tokenHash/);
      assert.ok(JSON.parse(text).transactions.length > 100);
    });
    await check("exports require authentication", async () => {
      for (const p of ["/api/export/transactions", "/api/export/data"]) {
        const r = await get(p, {});
        assert.equal(r.status, 401);
      }
    });
    await check("job endpoint does not crash", async () => {
      const r = await get("/api/inngest", {});
      assert.ok(r.status < 500, `status ${r.status}`);
    });
  } finally {
    await deleteTransaction(user.id, injected.id).catch(() => undefined);
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
    await db.$disconnect();
  }
  console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
