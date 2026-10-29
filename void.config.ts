import { defineConfig } from "void/config";

export default defineConfig({
  worker: {
    compatibility_date: "2026-02-24",
    compatibility_flags: ["nodejs_compat"],
  },
  cloudflare: {
    name: "flowie2k",
    observability: {
      enabled: true,
    },
    upload_source_maps: true,
    // Existing resources. Binding names follow Void's defaults (DB, STORAGE)
    // so `void/db` and `void/storage` pick them up.
    d1_databases: [
      {
        binding: "DB",
        database_name: "music-server-db",
        database_id: "b68356ae-2253-48b3-86c5-d53878a6dc85",
      },
    ],
    r2_buckets: [
      {
        binding: "STORAGE",
        bucket_name: "music-server-storage",
        // Local S3 credentials so presigned playback URLs work in dev.
        local_dev: {
          experimental_s3_credentials: {
            accessKeyId: "flowie2k-local",
            secretAccessKey: "flowie2k-local-development-only",
          },
        },
      },
    ],
  },
});
