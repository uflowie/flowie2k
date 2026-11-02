// Pure helpers (no Worker bindings), usable from the Worker and from Node scripts.
import { selectCover, type IPicture } from "music-metadata";

const AUDIO_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Content type for an audio file, from its extension. Browsers need it to play the file. */
export function audioMimeType(filename: string): string {
  const extension = /\.[^./]+$/.exec(filename)?.[0].toLowerCase();
  return (extension && AUDIO_TYPES[extension]) || "application/octet-stream";
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  // Copy into an ArrayBuffer-backed array, which digest() requires.
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Picks the front cover (or best available picture) and its storage key. The key
 * is derived from the image content, so identical covers share one object.
 */
export async function pickCover(
  pictures: IPicture[] | undefined,
): Promise<{ key: string; data: Uint8Array; contentType: string } | null> {
  const cover = selectCover(pictures);
  if (!cover) return null;
  const extension = IMAGE_EXTENSIONS[cover.format] ?? "img";
  return {
    key: `thumbnails/${await sha256Hex(cover.data)}.${extension}`,
    data: cover.data,
    contentType: cover.format,
  };
}
