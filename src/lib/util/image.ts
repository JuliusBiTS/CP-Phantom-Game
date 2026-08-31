/**
 * Client-side image downscale for portraits — FEATURE_PLAN §M5. Keeps stored
 * data URLs small (campaigns live in localStorage / Firebase Spark).
 */

export async function resizeImageToDataUrl(file: File, maxPx = 256, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}
