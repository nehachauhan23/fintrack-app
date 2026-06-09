"use server";

import { db } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const serializeDecimal = (obj) => {
  const s = { ...obj };
  if (obj.amount != null) s.amount = Number(obj.amount);
  return s;
};

function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);
  switch (interval) {
    case "DAILY":   date.setDate(date.getDate() + 1); break;
    case "WEEKLY":  date.setDate(date.getDate() + 7); break;
    case "MONTHLY": date.setMonth(date.getMonth() + 1); break;
    case "YEARLY":  date.setFullYear(date.getFullYear() + 1); break;
  }
  return date;
}

export async function createTransaction(data) {
  try {
    const session = await requireAuth();

    const account = await db.account.findUnique({
      where: { id: data.accountId, userId: session.id },
    });
    if (!account) return { success: false, error: "Account not found" };

    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const newBalance = Number(account.balance) + balanceChange;

    const transaction = await db.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          type: data.type,
          amount: data.amount,
          description: data.description,
          date: data.date,
          category: data.category,
          isRecurring: data.isRecurring,
          recurringInterval: data.recurringInterval ?? null,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
          userId: session.id,
          accountId: data.accountId,
        },
      });

      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: newBalance },
      });

      return created;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);
    return { success: true, data: serializeDecimal(transaction) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getTransaction(id) {
  const session = await requireAuth();

  const transaction = await db.transaction.findUnique({
    where: { id, userId: session.id },
  });

  if (!transaction) throw new Error("Transaction not found");
  return serializeDecimal(transaction);
}

export async function updateTransaction(id, data) {
  try {
    const session = await requireAuth();

    const original = await db.transaction.findUnique({
      where: { id, userId: session.id },
      include: { account: true },
    });
    if (!original) throw new Error("Transaction not found");

    const oldDelta =
      original.type === "EXPENSE" ? -Number(original.amount) : Number(original.amount);
    const newDelta = data.type === "EXPENSE" ? -data.amount : data.amount;
    const netChange = newDelta - oldDelta;

    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id, userId: session.id },
        data: {
          type: data.type,
          amount: data.amount,
          description: data.description,
          date: data.date,
          category: data.category,
          isRecurring: data.isRecurring,
          recurringInterval: data.recurringInterval ?? null,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
          accountId: data.accountId,
        },
      });

      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: netChange } },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);
    return { success: true, data: serializeDecimal(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

// ── Gemini OCR receipt scanner ───────────────────────────────────
export async function scanReceipt(file) {
  console.log("gemini key : ", process.env.GEMINI_API_KEY, file.name);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash",});
    const r = await model.generateContent("Say hello");
console.log(r.response.text());
    const arrayBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `Analyze this receipt image and extract the following information in JSON format:
- Total amount (just the number)
- Date (in ISO format)
- Description or items purchased (brief summary)
- Merchant/store name
- Suggested category (one of: housing, transportation, groceries, utilities, entertainment, food, shopping, healthcare, education, personal, travel, insurance, gifts, bills, other-expense)

Only respond with valid JSON in this exact format:
{
  "amount": number,
  "date": "ISO date string",
  "description": "string",
  "merchantName": "string",
  "category": "string"
}

If it is not a receipt, return an empty object {}`;

    const result = await model.generateContent([
      { inlineData: { data: base64String, mimeType: file.type } },
      prompt,
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
    const data = JSON.parse(cleaned);

    if (!data.amount) return null; // not a receipt

    return {
      amount: parseFloat(data.amount),
      date: data.date ? new Date(data.date) : new Date(),
      description: data.description || "",
      merchantName: data.merchantName || "",
      category: data.category || "other-expense",
    };
  } catch (error) {
    console.error("[SCAN_RECEIPT]", error);
    throw new Error("Failed to scan receipt. Please try again.");
  }
}
