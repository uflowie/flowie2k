import { tracks } from "@schema";
import { parseBuffer, type IAudioMetadata } from "music-metadata";
import { defineHandler } from "void";
import { db, sql } from "void/db";
import { storage } from "void/storage";
import { z } from "zod";

// POST /api/songs/upload/:filename — raw file bytes in the request body
export const POST = defineHandler.withValidator({
  params: z.object({ filename: z.string().min(1, { message: "Filename is required" }) }),
})(async (c, { params: { filename } }) => {
  const extension = filename.match(/\.[^/.]+$/)?.[0] ?? "";
  const baseId = crypto.randomUUID();
  const storageKey = `tracks/${baseId}${extension}`;
  const body = await c.req.arrayBuffer();

  await storage.put(storageKey, body, {
    httpMetadata: { contentType: "audio/mpeg" },
  });

  let metadata: Partial<IAudioMetadata["common"]> = {};
  let thumbnailPath: string | null = null;
  let durationSeconds: number | null = null;

  try {
    const parsed = await parseBuffer(new Uint8Array(body));
    metadata = parsed.common;
    durationSeconds = parsed.format.duration ?? null;

    const picture = parsed.common.picture?.[0];
    if (picture) {
      thumbnailPath = `thumbnails/${baseId}.${picture.format.split("/")[1] || "jpg"}`;
      await storage.put(thumbnailPath, picture.data, {
        httpMetadata: { contentType: picture.format },
      });
    }
  } catch (error) {
    // Keep the upload with basic info if metadata can't be read.
    console.error(`[UPLOAD] Failed to extract metadata from ${filename}:`, error);
  }

  const values = {
    filename,
    storage_key: storageKey,
    title: metadata.title || filename.replace(/\.[^/.]+$/, ""),
    artist: metadata.artist || null,
    album: metadata.album || null,
    genre: metadata.genre?.[0] ?? null,
    duration: durationSeconds !== null ? Math.round(durationSeconds) : null,
    file_size: body.byteLength,
    mime_type: "audio/mpeg",
    thumbnail_path: thumbnailPath,
  };

  const [track] = await db
    .insert(tracks)
    .values(values)
    .onConflictDoUpdate({
      target: tracks.storage_key,
      set: {
        filename: sql`excluded.filename`,
        title: sql`excluded.title`,
        artist: sql`excluded.artist`,
        album: sql`excluded.album`,
        genre: sql`excluded.genre`,
        duration: sql`excluded.duration`,
        file_size: sql`excluded.file_size`,
        mime_type: sql`excluded.mime_type`,
        thumbnail_path: sql`excluded.thumbnail_path`,
      },
    })
    .returning({ id: tracks.id });

  return {
    message: `File ${filename} uploaded successfully`,
    size: body.byteLength,
    id: track.id,
    metadata: {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      hasAlbumArt: !!thumbnailPath,
    },
  };
});
