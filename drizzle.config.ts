import type { Config } from "drizzle-kit";

export default {
  // Where table definitions live
  schema: "./src/lib/db/schema.ts",

  // Where to output generated migration SQL files
  out: "./drizzle/migrations",

  // SQLite dialect (D1 uses SQLite)
  dialect: "sqlite",

  // D1 HTTP driver — for running migrations against remote D1
  // Uses Cloudflare REST API (not wrangler CLI)
  driver: "d1-http",

  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },

  // Better error messages
  verbose: true,
  strict: true,
} satisfies Config;
