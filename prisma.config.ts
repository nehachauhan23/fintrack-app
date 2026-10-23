import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations should use a direct (non-pooled) connection when one is provided.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";


export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx --conditions=react-server prisma/seed.ts" },
  datasource: { url },
});
