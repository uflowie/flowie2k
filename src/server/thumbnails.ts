import type { IPicture } from "music-metadata";
import { storage } from "void/storage";

import { pickCover } from "./media";

/** Stores the song's cover in R2 and returns its key, or null when there is none. */
export async function storeCover(pictures: IPicture[] | undefined): Promise<string | null> {
  const cover = await pickCover(pictures);
  if (!cover) return null;
  await storage.put(cover.key, cover.data, { httpMetadata: { contentType: cover.contentType } });
  return cover.key;
}

// List covers are at most 36px (on phones); this stays sharp on 3x screens.
const SMALL_COVER_SIZE = 128;

/**
 * A small square WebP of a cover, for lists. Made from the original on first request and
 * kept in R2, so each cover is resized once. Returns the original if resizing fails, for
 * example once the free tier's monthly resizes run out.
 */
export async function getSmallCover(images: ImagesBinding, file: string) {
  // The size is in the key, so changing it makes new covers instead of reusing old ones.
  const key = `thumbnails/${SMALL_COVER_SIZE}/${file.replace(/\.\w+$/, "")}.webp`;
  const small = await storage.get(key);
  if (small) return small;

  const original = await storage.get(`thumbnails/${file}`);
  if (!original) return null;
  try {
    const result = await images
      .input(original.body)
      .transform({ width: SMALL_COVER_SIZE, height: SMALL_COVER_SIZE, fit: "cover" })
      .output({ format: "image/webp", quality: 80 });
    await storage.put(key, await result.response().arrayBuffer(), {
      httpMetadata: { contentType: "image/webp" },
    });
    return await storage.get(key);
  } catch (error) {
    console.error(`[THUMBNAILS] Failed to make a small cover for ${file}:`, error);
    return await storage.get(`thumbnails/${file}`);
  }
}
