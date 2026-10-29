import { defineEnv, string, url } from "void/env";

// R2 S3 API credentials, used to presign playback URLs.
export default defineEnv({
  R2_S3_ENDPOINT: url(),
  R2_BUCKET_NAME: string(),
  R2_ACCESS_KEY_ID: string(),
  R2_SECRET_ACCESS_KEY: string(),
});
