import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { registerUser } from "@/server/services/auth";
import { createAccount } from "@/server/services/accounts";

export async function makeUser(label = "u") {
  const { id } = await registerUser({ name: `Test ${label}`, email: `${label}-${randomUUID()}@example.test`, password: "correct-horse-battery" });
  return id;
}

export async function makeUserWithAccount(opening = "1000.00") {
  const userId = await makeUser();
  const account = await createAccount(userId, { name: "Main", type: "CURRENT", openingBalance: opening });
  return { userId, account };
}

export async function cleanup(...userIds: string[]) {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}

export const balanceOf = async (accountId: string) => (await db.account.findUniqueOrThrow({ where: { id: accountId } })).balance.toNumber();
