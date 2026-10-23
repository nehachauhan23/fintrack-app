import "server-only";
import { z } from "zod";
import { invalid } from "@/lib/errors";
import type { AuthUser } from "@/server/auth/session";
import { coerceAmount } from "@/domain/csv";
import { EXPENSE_CATEGORIES, categoryName, isCategoryFor } from "@/domain/categories";
import { guessCategory } from "@/domain/merchant";
import { addDays, formatDateOnly, parseDateOnly } from "@/domain/periods";
import { assertAiAllowed, generateObject } from "./generate";
import { MAX_IMAGE_BYTES, sniffImage } from "./image";
import { SYSTEM_BASE, categoryCatalog } from "./prompts";

const schema = z.object({
  merchant: z.string().max(120).nullish(),
  date: z.string().nullish(),
  total: z.union([z.number(), z.string()]).nullish(),
  category: z.string().nullish(),
});

export interface ReceiptDraft {
  merchant: string | null;
  amount: string;
  date: string | null;
  category: string;
  categoryName: string;
  description: string;
}

/** Reads a receipt photo. The result is only ever a draft for the user to review: nothing is saved here. */
export async function scanReceipt(user: AuthUser, imageBase64: string, today: string): Promise<ReceiptDraft> {
  assertAiAllowed(user);
  const base64 = imageBase64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw invalid("Use an image under 4 MB.");
  const kind = sniffImage(bytes);
  if (!kind) throw invalid("Upload a JPEG, PNG or WebP photo of the receipt.");
  const todayDate = parseDateOnly(today) ?? parseDateOnly(formatDateOnly(new Date())) ?? new Date();

  const { data } = await generateObject({
    feature: "receipt",
    userId: user.id,
    vision: true,
    maxTokens: 400,
    maxAttempts: 1, // a vision retry is expensive on a request-limited free tier; the user can simply try again
    schema,
    messages: [
      { role: "system", content: SYSTEM_BASE },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Today is ${formatDateOnly(todayDate)}. Read this receipt and return JSON: {"merchant": string|null, "date": "YYYY-MM-DD"|null, "total": number|null, "category": string|null}. ` +
              `"total" is the final amount paid including tax and tip. "category" must be one of these ids:\n${categoryCatalog("EXPENSE")}\n` +
              `If the image is not a receipt, return every field as null.`,
          },
          { type: "image_url", image_url: { url: `data:${kind.mime};base64,${base64}` } },
        ],
      },
    ],
  });

  const amount = coerceAmount(data.total);
  if (!amount) throw invalid("That doesn't look like a receipt, or the total wasn't readable. Try a clearer, flatter photo.");
  const parsedDate = data.date ? parseDateOnly(data.date) : null;
  const date = parsedDate && parsedDate <= addDays(todayDate, 1) ? formatDateOnly(parsedDate) : null;
  const merchant = data.merchant?.trim() || null;
  const modelCategory = data.category && isCategoryFor(data.category, "EXPENSE") ? data.category : null;
  const category = modelCategory ?? (merchant ? guessCategory(merchant, "EXPENSE") : null) ?? "other-expense";
  return { merchant, amount, date, category, categoryName: categoryName(category), description: merchant ? `${merchant}` : "Receipt" };
}

export const RECEIPT_CATEGORIES = EXPENSE_CATEGORIES.map((c) => c.id);
