# Uoozer Vault

Zero-knowledge file storage. Files are encrypted in your browser before they ever touch a server, and the backend is built so it can't read them even if it wanted to.

It looks and feels like a normal cloud drive - folders, uploads, trash, share links. Underneath, the server is deliberately kept dumb: it stores ciphertext in object storage, encrypted metadata in Postgres, and handles logins. That's all it can do. If the whole database and the entire bucket were dumped tomorrow, whoever did it would walk away with file sizes and timestamps.

The project lives in three repos; this README ships in all of them.

- **Main repo** - docs, issues, and planning. [Link](https://github.com/nynrathod/uoozer-vault-workspace)
- **Backend** - Rust, Axum, sqlx, Postgres. The API, presigning, cleanup worker. [Link](https://github.com/nynrathod/uoozer-vault-backend)
- **Frontend** - React 19 + TypeScript + Vite. All UI, all crypto. [Link](https://github.com/nynrathod/uoozer-vault-frontend)
  
	
## How the encryption works

All of it runs client-side, in a dedicated web worker, on libsodium primitives - no custom crypto.

1. Your password goes through **Argon2id** in the browser: 64 MiB of memory, 3 iterations, 4 lanes. The exact parameters are served by the backend at login, so they can be raised later without stranding existing accounts.
2. The derived key material is split in two: a **master key** that never leaves the browser, and an **auth key**, which is the only thing the server ever sees. The server bcrypt-hashes the auth key before storing it, so even that doesn't sit in the database as-is.
3. Every account gets a random **data encryption key** (DEK), wrapped under a key derived from the master key. Only the wrapped DEK is stored server-side - that's how the vault unlocks on a second device without the server learning anything. Signup also generates a one-time **recovery key** with its own wrapped copy of the DEK: the only way back in if the password is ever lost. Lose both the password and the recovery key, and the data is gone.
4. Files are split into **4 MB chunks**, streamed through **XChaCha20-Poly1305** secretstream, and hashed with **BLAKE3** - once per chunk, once over the whole plaintext. Each file is encrypted under its own random **file key**, which the account DEK wraps - the DEK only ever touches keys and metadata, never raw file bytes. Chunk hashes enable dedup and tamper detection.
5. File names and folder structures are **encrypted too**. The rows in Postgres are ciphertext.
6. Chunks upload **directly to Cloudflare R2** through short-lived presigned URLs (1 hour TTL). The backend never proxies a single file byte.
7. Public share links carry the file key in the URL **fragment** (`#k=...`). Fragments are never sent to any server, so even a shared file stays unreadable to the backend.

The whole chain in one picture:

```text
password
  │ Argon2id
  ├─► auth key ─────► server (the only thing it ever learns)
  └─► master key ──unwraps──► account DEK ──unwraps──► file key ──encrypts──► your files
```

The file key encrypts data, the account DEK protects file keys and metadata, the master key protects the DEK, the password protects the master key - and the server sits outside the entire chain.

One deliberate limitation: dedup only works within your own account. Two different users uploading the same file will never produce matching ciphertext, because every vault has its own DEK - cross-user dedup is impossible by design. That's the point.

## Architecture

```
┌────────────────────────────────┐
│            browser             │
│   React + TS, crypto worker    │
│    all crypto in libsodium     │
└───────┬────────────────┬───────┘
        │                │
        │ metadata,      │  4 MB encrypted chunks,
        │ keys, SSE      │  straight to storage via
        │                │  short-lived presigned URLs
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│   backend    │  │  R2 bucket   │
│ Rust / Axum  │  │ ciphertext,  │
│     sqlx     │  │ nothing else │
└───────┬──────┘  └──────────────┘
        │
        ▼
┌──────────────┐
│   Postgres   │
│  encrypted   │
│   metadata   │
└──────────────┘
```

## What works today

- Folders, chunked uploads (concurrent, resumable), downloads
- Trash with restore and permanent delete
- Public share links
- Same-user dedup - skip re-uploading files you already have
- In-browser previews of documents and epubs, decrypted locally first
- A Playwright benchmark suite for the upload engine: throughput at 1/5/10 GB, resume, tamper detection, retry idempotency, tenant isolation, crash recovery (`npm run bench:tp10`, `npm run bench:crash`, ...)


## Running it locally

**Backend** - you need Rust and a Postgres database it can reach.

Create a `.env` next to the crate:

```env
DATABASE_URL=postgres://user:pass@localhost:5432/uoozer_vault
CORS_ALLOWED_ORIGINS=http://localhost:5173
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=uoozer-vault-dev
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

Then:

```bash
cargo run
```

Migrations run automatically on boot. On first start in dev the backend generates an Ed25519 signing key and writes it to `dev_jwt_key.pem` - keep that file around (or set `JWT_PRIVATE_KEY_PEM`) so restarting doesn't log you out. The server listens on `0.0.0.0:8080`; defaults live in `config/default.toml`, and anything can be overridden with `UOOZER_`-prefixed env vars, e.g. `UOOZER_SERVER__PORT=9090`.

**Frontend** - Node and npm:

```bash
npm install
npm run dev
```

Set `VITE_API_BASE_URL` (and `VITE_SSE_BASE_URL` if SSE runs on its own origin) when the backend isn't on the same origin. `npm run build` for production, `npm run lint` for oxlint.

## Deployment

The backend ships with Terraform targeting Google Cloud Run: Artifact Registry for images, Secret Manager holding the JWT key and R2 credentials, Workload Identity for access. The frontend builds to static files - any static host or CDN works. Postgres can be Cloud SQL or anything reachable.

## Status

This is a working POC, not a finished product. It has not been security-audited, and I am not a cryptographer. The primitives are boring on purpose - libsodium, BLAKE3, Argon2id - but the surrounding engineering (session revocation, key rotation, edge cases) is exactly the part audits tend to find problems in. Don't keep the only copy of anything important on it yet.