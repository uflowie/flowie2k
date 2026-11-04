import { defineHandler } from "void";
import { storage } from "void/storage";
import { z } from "zod";

import { getSmallCover } from "@/server/thumbnails";

// GET /api/thumbnails/:file?size=small — album art, addressed by its storage key.
// The small size is for lists; without it, the original upload is served.
export const GET = defineHandler.withValidator({
  // A single file name, so requests can't reach objects outside thumbnails/.
  params: z.object({ file: z.string().regex(/^[\w-]+\.\w+$/) }),
  query: z.object({ size: z.literal("small").optional() }),
})(async (c, { params: { file }, query: { size } }) => {
  const object =
    size === "small"
      ? await getSmallCover(c.env.IMAGES, file)
      : await storage.get(`thumbnails/${file}`);
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
