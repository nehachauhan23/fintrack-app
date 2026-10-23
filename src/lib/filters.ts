import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.object({
  q: z.string().max(100).optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  category: z.string().max(40).optional(),
  accountId: z.uuid().optional(),
  from: date.optional(),
  to: date.optional(),
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
});

export type ParsedFilters = z.infer<typeof schema>;

/** Query strings are untrusted: anything that fails validation is dropped rather than passed to the database. */
export function filtersFromSearchParams(params: Record<string, string | string[] | undefined>): ParsedFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined && v !== ""));
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const parsed = field.safeParse(flat[key]);
    if (flat[key] !== undefined && parsed.success) out[key] = parsed.data;
  }
  return out as ParsedFilters;
}
