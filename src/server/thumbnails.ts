import { selectCover, type IPicture } from "music-metadata";
import { storage } from "void/storage";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Stores the front cover (or best available picture) under a key derived from
 * its content, so identical covers share one object. Returns the key, or null
 * when the file has no pictures.
 */
export async function storeCover(pictures: IPicture[] | undefined): Promise<string | null> {
  const cover = selectCover(pictures);
  if (!cover) return null;

  // Copy into an ArrayBuffer-backed array, which digest() requires.
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(cover.data)));
  const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = `thumbnails/${hash}.${EXTENSIONS[cover.format] ?? "img"}`;

  await storage.put(key, cover.data, { httpMetadata: { contentType: cover.format } });
  return key;
}
