import { logger } from "hono/logger";
import { defineMiddleware } from "void";

export default defineMiddleware(logger());
