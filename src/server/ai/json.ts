/** Removes reasoning blocks some models emit before their answer. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
}

/**
 * Pulls the first complete JSON value out of model output. Free models often wrap JSON in prose or code fences
 * even when told not to, so the parser scans for a balanced object/array instead of trusting the whole string.
 */
export function extractJson(raw: string): unknown {
  const text = stripThinking(raw).replace(/```(?:json)?/gi, "");
  const start = text.search(/[{[]/);
  if (start < 0) throw new SyntaxError("No JSON found in model output");
  const open = text[start] as string;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i] as string;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new SyntaxError("Unterminated JSON in model output");
}
