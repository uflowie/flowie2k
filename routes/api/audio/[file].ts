import { defineHandler } from "void";
import { storage } from "void/storage";
import { z } from "zod";

// GET /api/audio/:file — track audio, addressed by its storage key (`tracks/<file>`).
// Served from the app's own origin so playback reuses the open connection,
// with Range support so the audio element can start early and seek.
export const GET = defineHandler.withValidator({
  // A single file name, so requests can't reach objects outside tracks/.
  params: z.object({ file: z.string().regex(/^[\w-]+(\.\w+)?$/) }),
})(async (c, { params: { file } }) => {
  const key = `tracks/${file}`;
  const requestHeaders = c.req.raw.headers;

  let object: R2Object | R2ObjectBody | null;
  try {
    object = await storage.get(key, { range: requestHeaders, onlyIf: requestHeaders });
  } catch {
    // R2 rejects ranges it can't satisfy (past the end, multiple ranges).
    const head = await storage.head(key);
    if (!head) return c.json({ error: "Audio not found" }, 404);
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${head.size}` },
    });
  }
  if (!object) {
    return c.json({ error: "Audio not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  // Keys never point at different audio, but the app is behind Access, so keep it out of shared caches.
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");

  // A failed precondition (If-None-Match matched) returns metadata without a body.
  if (!("body" in object)) {
    return new Response(null, { status: 304, headers });
  }

  const range = byteRange(object.range, object.size);
  if (!range || !requestHeaders.has("Range")) {
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
  }

  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${object.size}`);
  headers.set("Content-Length", String(range.end - range.start + 1));
  return new Response(object.body, { status: 206, headers });
});

// R2 may resolve ranges to { offset, length } and still carry other keys as
// undefined, so check values rather than key presence.
function byteRange(range: R2Range | undefined, size: number) {
  if (!range) return null;
  if ("suffix" in range && range.suffix !== undefined) {
    const length = Math.min(range.suffix, size);
    return { start: size - length, end: size - 1 };
  }
  const start = ("offset" in range && range.offset) || 0;
  const length = ("length" in range && range.length) || size - start;
  return { start, end: Math.min(start + length, size) - 1 };
}
