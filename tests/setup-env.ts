// Deterministic environment for tests. Integration tests override DATABASE_URL via the shell.
process.env.DATABASE_URL ??= "postgresql://fintrack:fintrack@localhost:5432/fintrack_test";
process.env.OPENROUTER_API_KEY ??= "test-key";
Object.assign(process.env, { NODE_ENV: "test" });
