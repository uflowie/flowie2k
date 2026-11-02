import { defineHandler } from "void";
import { storage } from "void/storage";
import { z } from "zod";

// GET /api/thumbnails/:file — album art, addressed by its storage key
export const GET = defineHandler.withValidator({
  // A single file name, so requests can't reach objects outside thumbnails/.
  params: z.object({ file: z.string().regex(/^[\w-]+\.\w+$/) }),
})(async (c, { params: { file } }) => {
  const object = await storage.get(`thumbnails/${file}`);
  if (!object) {
    return c.json({ error: "Thumbnail not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  // Keys are content hashes (or unique IDs), so the image behind a URL never changes.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
});
