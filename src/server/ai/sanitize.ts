/**
 * Wraps untrusted text (receipt contents, merchant names, user notes) so the model can tell it apart from instructions.
 * This reduces prompt-injection risk; it is not a guarantee, which is why model output is never executed:
 * it is validated, shown to the user, and only then saved.
 */
export function fence(text: string, maxLength = 400): string {
  const cleaned = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/<\/?data>/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return `<data>${cleaned}</data>`;
}
