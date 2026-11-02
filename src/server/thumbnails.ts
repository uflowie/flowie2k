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
