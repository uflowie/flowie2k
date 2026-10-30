import { defineConfig } from "void/config";

export default defineConfig({
  worker: {
    compatibility_date: "2026-02-24",
    compatibility_flags: ["nodejs_compat"],
  },
  cloudflare: {
    name: "flowie2k",
    account_id: "dde4706e29038f1d8466e82f2f91603b",
    // Serve at flowie2k.<subdomain>.workers.dev; preview URLs let Void
    // health-check new versions before they get traffic.
    workers_dev: true,
    preview_urls: true,
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
        database_id: "bb28ec25-ac20-4408-a3d3-d4e6a51c0bdc",
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
