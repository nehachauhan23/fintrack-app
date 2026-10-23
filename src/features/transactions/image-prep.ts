/**
 * Shrinks a photo in the browser before upload: receipts stay readable at ~1400px, uploads stay small and fast,
 * and EXIF metadata (location, device) is dropped because the pixels are redrawn onto a canvas.
 */
export async function prepareReceiptImage(file: File, maxEdge = 1400, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Couldn't read that image. Try a JPEG or PNG.");
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
