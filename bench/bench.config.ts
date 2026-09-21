/** All environment-specific values in one place. Adjust, don't scatter. */
export const BENCH = {
  appUrl: process.env.BENCH_APP_URL ?? 'http://localhost:5173',
  apiBase: process.env.BENCH_API_URL ?? 'http://localhost:8080',

  // Substring that appears in presigned MinIO/R2 PUT URLs (matches r2Key host)
  storageHost: process.env.BENCH_STORAGE_HOST ?? 'localhost:9000',

  minio: {
    endpoint: process.env.BENCH_MINIO_URL ?? 'http://localhost:9000',
    region: 'us-east-1',
    bucket: process.env.BENCH_MINIO_BUCKET ?? 'uoozer-vault',
    accessKeyId: process.env.BENCH_MINIO_KEY ?? 'minioadmin',
    secretAccessKey: process.env.BENCH_MINIO_SECRET ?? 'minioadmin',
  },

  db: { url: 'postgres://postgres:admin@localhost:5432/uoozer_vault' },

  users: {
    a: { email: 'bench.a@test.local', password: 'BenchPass123!' },
    b: { email: 'bench.b@test.local', password: 'BenchPass123!' },
  },
  backendDir: process.env.BENCH_BACKEND_DIR ?? 'X:/Projects/uoozer/uoozer-vault-backend',

  selectors: {
    email: 'input[name="email"]', // ← FILL: LoginPage
    password: 'input[type="password"]', // ← FILL: LoginPage
    submit: 'button[type="submit"]',
    fileInput: 'input[type="file"]', // ← FILL: UploadDropzone (add data-testid if hidden)
    uploadComplete: '[data-sonner-toast][data-type="success"]',
    downloadTrigger: 'button:has-text("Download")', // ← FILL: file row/card after success
    toastError: '[data-sonner-toast][data-type="error"]',
  },

  api: {
    finalize: '/files', // ← FILL: substring of the finalize/create-version request
    downloadInit: '/download', // ← FILL: e.g. GET /files/{id}/download
  },

  sizeGB: Number(process.env.BENCH_SIZE_GB ?? 1),
  tmpDir: './bench/tmp',
  timeoutMs: 40 * 60 * 1000,
}
