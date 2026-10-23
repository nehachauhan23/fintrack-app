import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUserOrThrow } from "@/server/auth/dal";
import { rateLimitOrThrow } from "@/server/auth/rate-limit";
import { iterateTransactions } from "@/server/services/transactions";
import { categoryName } from "@/domain/categories";
import { csvRow } from "@/domain/csv";
import { AppError } from "@/lib/errors";
import { filtersFromSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

/** Streams the filtered ledger as CSV in constant memory. Text cells are neutralised against spreadsheet formula injection. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserOrThrow();
    await rateLimitOrThrow(`export:${user.id}`, { limit: 10, windowSec: 60 });
    const filters = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams));
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode("\uFEFF" + csvRow(["Date", "Account", "Type", "Category", "Description", "Merchant", "Amount", "Source"])));
          for await (const batch of iterateTransactions(user.id, filters)) {
            for (const t of batch) {
              const signed = t.type === "INCOME" || t.type === "TRANSFER_IN" ? t.amount : -t.amount;
              controller.enqueue(encoder.encode(csvRow([t.date, t.accountName, t.type, categoryName(t.category), t.description, t.merchant, signed, t.source])));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fintrack-transactions.csv"`, "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    throw err;
  }
}
