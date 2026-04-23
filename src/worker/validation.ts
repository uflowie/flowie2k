import type { Hook } from "@hono/zod-validator"
import type { Env } from "hono"
import type { ZodType } from "zod"

export const zodError = ((result, c) => {
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request"
    return c.json({ error: message }, 400)
  }
}) satisfies Hook<
  unknown,
  Env,
  string,
  "json" | "param" | "query",
  { error: string },
  ZodType
>
