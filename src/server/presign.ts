import { AwsClient } from "aws4fetch";
import { env } from "void/env";

/** Presigned GET URL for an R2 object, served straight from R2's S3 endpoint. */
export async function presignGetUrl(key: string, expiresInSeconds: number) {
  const endpoint = env.R2_S3_ENDPOINT.replace(/\/$/, "");
  const path = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${endpoint}/${encodeURIComponent(env.R2_BUCKET_NAME)}/${path}`);
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  // Leave Range unsigned so playback and seeking can reuse this URL.
  const signed = await client.sign(url, { method: "GET", aws: { signQuery: true } });
  return signed.url;
}
