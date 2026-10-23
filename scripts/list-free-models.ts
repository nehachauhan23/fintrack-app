/**
 * Lists the models OpenRouter currently offers for free, so you can set OPENROUTER_MODELS / OPENROUTER_VISION_MODELS.
 * Free models rotate often, so check this when AI features start failing.   npm run ai:models
 */
import { z } from "zod";

const model = z.object({
  id: z.string(),
  context_length: z.number().nullish(),
  pricing: z.object({ prompt: z.string(), completion: z.string() }).partial(),
  architecture: z.object({ input_modalities: z.array(z.string()).optional() }).partial().optional(),
  supported_parameters: z.array(z.string()).optional(),
});

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`);
  const { data } = z.object({ data: z.array(model) }).parse(await res.json());
  const free = data
    .filter((m) => Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 && !m.id.startsWith("openrouter/"))
    .map((m) => ({
      id: m.id,
      ctx: m.context_length ?? 0,
      vision: m.architecture?.input_modalities?.includes("image") ?? false,
      json: (m.supported_parameters ?? []).some((p) => p === "response_format" || p === "structured_outputs"),
    }))
    .sort((a, b) => b.ctx - a.ctx);

  const show = (title: string, rows: typeof free) => {
    console.log(`\n${title}`);
    for (const r of rows.slice(0, 12)) console.log(`  ${r.id.padEnd(58)} ${String(Math.round(r.ctx / 1000) + "k").padStart(6)}  ${r.json ? "json" : "    "}`);
  };
  show("Free text models (good for OPENROUTER_MODELS; prefer ones marked json):", free.filter((m) => m.json));
  show("Free vision models (for OPENROUTER_VISION_MODELS, used for receipts):", free.filter((m) => m.vision));
  console.log("\nTip: put up to 3 ids, comma-separated, in priority order. `openrouter/free` is a good last fallback.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
